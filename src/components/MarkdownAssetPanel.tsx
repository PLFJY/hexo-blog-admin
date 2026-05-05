import { Button, Input, Text, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { DeleteRegular, ImageAddRegular } from '@fluentui/react-icons'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getJson, sendJson } from '../lib/apiClient'
import type { DraftAsset, DraftAssetListResponse, DraftAssetUploadResponse } from '../shared/assetTypes'
import { usePageStyles } from '../pages/pageStyles'

const useStyles = makeStyles({
  hiddenInput: {
    display: 'none',
  },
  assetList: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
  assetItem: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
})

type MarkdownAssetPanelProps = {
  relativeId: string
  draftId?: string
  assets: DraftAsset[]
  onAssetsChange: (assets: DraftAsset[]) => void
  onInsertMarkdown: (markdown: string) => void
}

export function MarkdownAssetPanel({
  relativeId,
  draftId,
  assets,
  onAssetsChange,
  onInsertMarkdown,
}: MarkdownAssetPanelProps) {
  const styles = useStyles()
  const pageStyles = usePageStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()
  const [message, setMessage] = useState('')

  const refresh = () => {
    if (!draftId) return
    void getJson<DraftAssetListResponse>(`/assets?draftId=${encodeURIComponent(draftId)}&relativeId=${encodeURIComponent(relativeId)}`)
      .then((response) => onAssetsChange(response.manifest.assets))
  }

  const upload = (file: File) => {
    const form = new FormData()
    form.set('relativeId', relativeId)
    form.set('file', file)
    void getJson<DraftAssetUploadResponse>('/assets', {
      method: 'POST',
      body: form,
    }).then((response) => {
      onAssetsChange(response.manifest.assets)
      onInsertMarkdown(`![${response.asset.filename}](${response.asset.markdownPath})`)
      setMessage(t('assets.uploaded'))
    })
  }

  const remove = (asset: DraftAsset) => {
    void sendJson<{ deleted: boolean }>(`/assets?key=${encodeURIComponent(asset.key)}`, 'DELETE').then(() => {
      onAssetsChange(assets.filter((item) => item.key !== asset.key))
      setMessage(t('assets.deleted'))
    })
  }

  return (
    <section className={pageStyles.card}>
      <div className={pageStyles.row}>
        <Title3>{t('assets.title')}</Title3>
        <Button
          appearance="secondary"
          icon={<ImageAddRegular />}
          onClick={() => inputRef.current?.click()}
          disabled={!relativeId}
        >
          {t('assets.upload')}
        </Button>
        <Button appearance="subtle" onClick={refresh} disabled={!draftId}>
          {t('actions.refresh')}
        </Button>
      </div>
      <Input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) upload(file)
          event.currentTarget.value = ''
        }}
      />
      {message ? <Text>{message}</Text> : null}
      <ul className={styles.assetList}>
        {assets.map((asset) => (
          <li className={styles.assetItem} key={asset.key}>
            <Text truncate>{asset.markdownPath}</Text>
            <Button appearance="subtle" icon={<DeleteRegular />} onClick={() => remove(asset)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
