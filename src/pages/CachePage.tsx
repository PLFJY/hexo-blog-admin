import {
  Body1,
  Button,
  Checkbox,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  Title1,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { DeleteRegular, OpenRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { buildApiUrl, getJson, sendJson } from '../lib/apiClient'
import type { AssetCacheListResponse } from '../shared/assetTypes'
import { usePageStyles } from './pageStyles'

const useStyles = makeStyles({
  groupList: { display: 'grid', gap: tokens.spacingVerticalM },
  assetList: { display: 'grid', gap: tokens.spacingVerticalXS, margin: 0, padding: 0, listStyleType: 'none' },
  assetItem: { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto auto', gap: tokens.spacingHorizontalS, alignItems: 'center' },
  dangerPrimaryButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorPaletteRedBackground3,
    ':hover': {
      color: tokens.colorNeutralForegroundOnBrand,
      backgroundColor: tokens.colorPaletteRedForeground1,
    },
  },
  confirmSurface: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    width: '320px',
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
})

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: AssetCacheListResponse; selectedKeys: string[]; deleting?: boolean; message?: string }
  | { status: 'error'; message: string }

export function CachePage() {
  const pageStyles = usePageStyles()
  const styles = useStyles()
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    void getJson<AssetCacheListResponse>('/assets/cache')
      .then((data) => setState({ status: 'ready', data, selectedKeys: [] }))
      .catch((error: unknown) => setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  useEffect(load, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  const toggle = (key: string) => {
    setState({
      ...state,
      selectedKeys: state.selectedKeys.includes(key) ? state.selectedKeys.filter((item) => item !== key) : [...state.selectedKeys, key],
    })
  }

  const removeSelected = () => {
    if (state.selectedKeys.length === 0) return
    setState({ ...state, deleting: true })
    void sendJson<{ deleted: number }>('/assets/cache', 'DELETE', { keys: state.selectedKeys })
      .then((response) => {
        setState({ ...state, deleting: false, message: `已删除 ${response.deleted} 个缓存对象`, selectedKeys: [] })
        load()
      })
      .catch((error: unknown) => setState({ ...state, deleting: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  const openPreview = (key: string) => {
    window.open(buildApiUrl(`/assets/blob?key=${encodeURIComponent(key)}`), '_blank', 'noopener,noreferrer')
  }

  return (
    <section className={pageStyles.page}>
      <header className={pageStyles.header}>
        <Title1>暂存图片管理</Title1>
        <Body1>按 relativeId / draftId 分组查看 R2 暂存图片，并同步清理 KV manifest。</Body1>
      </header>
      <section className={pageStyles.card}>
        <div className={pageStyles.row}>
          <Button onClick={load}>刷新列表</Button>
          <DeleteCachePopover
            count={state.selectedKeys.length}
            deleting={state.deleting}
            onConfirm={removeSelected}
          />
        </div>
        {state.message ? <Text>{state.message}</Text> : null}
      </section>
      <div className={styles.groupList}>
        {state.data.groups.map((group) => (
          <section className={pageStyles.card} key={group.draftId}>
            <Title3>{group.relativeId}</Title3>
            <Text>draftId: {group.draftId}</Text>
            <Text>{group.count} 张，合计 {formatSize(group.totalSize)}</Text>
            <ul className={styles.assetList}>
              {group.assets.map((asset) => (
                <li className={styles.assetItem} key={asset.key}>
                  <Checkbox checked={state.selectedKeys.includes(asset.key)} onChange={() => toggle(asset.key)} />
                  <Text truncate>{asset.markdownPath}</Text>
                  <Text>{formatSize(asset.size)}</Text>
                  <Button appearance="subtle" icon={<OpenRegular />} onClick={() => openPreview(asset.key)}>
                    预览
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}

function DeleteCachePopover({ count, deleting, onConfirm }: { count: number; deleting?: boolean; onConfirm: () => void }) {
  const styles = useStyles()
  const [open, setOpen] = useState(false)
  if (count === 0 || deleting) {
    return (
      <Button appearance="primary" icon={<DeleteRegular />} disabled>
        {deleting ? '删除中...' : '删除所选 (0)'}
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="primary" className={styles.dangerPrimaryButton} icon={<DeleteRegular />}>
          删除所选 ({count})
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.confirmSurface}>
        <Text weight="semibold">确认清理暂存图片</Text>
        <Text>将删除 {count} 个 R2 暂存图片，并同步清理 KV manifest。此操作不能撤销。</Text>
        <div className={styles.confirmActions}>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button
            appearance="primary"
            className={styles.dangerPrimaryButton}
            icon={<DeleteRegular />}
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            确认删除
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  )
}
