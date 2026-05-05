import { Body1, Button, Field, Input, Popover, PopoverSurface, PopoverTrigger, Text, Title1, Title2, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { DeleteRegular, SaveRegular } from '@fluentui/react-icons'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { ArticleMarkdownWorkspace } from '../components/ArticleMarkdownWorkspace'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { MarkdownAssetPanel } from '../components/MarkdownAssetPanel'
import { getJson, sendJson } from '../lib/apiClient'
import { deleteEditorSnapshot, readEditorSnapshot, writeEditorSnapshot } from '../lib/editorSnapshot'
import { resolveMarkdownResourceUrl } from '../lib/markdownResource'
import type { PublicConfigResponse } from '../shared/apiTypes'
import type { DraftAsset, DraftAssetListResponse } from '../shared/assetTypes'
import type { DraftRecord } from '../shared/draftTypes'
import { extractFrontMatterTitle } from '../shared/frontMatter'
import type { PostContentResponse } from '../shared/postTypes'
import type { PostAsset } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

const useSourceEditorStyles = makeStyles({
  statusPanel: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    border: `1px solid ${tokens.colorBrandStroke1}`,
    borderLeft: `4px solid ${tokens.colorBrandForeground1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
  },
  dangerPrimaryButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorPaletteRedBackground3,
    ':hover': { color: tokens.colorNeutralForegroundOnBrand, backgroundColor: tokens.colorPaletteRedForeground1 },
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    padding: tokens.spacingHorizontalXXL,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  decisionPanel: {
    display: 'grid',
    gap: tokens.spacingVerticalL,
    width: 'min(560px, 100%)',
    padding: tokens.spacingVerticalXXL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow64,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  decisionActions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalM,
  },
  confirmSurface: { display: 'grid', gap: tokens.spacingVerticalM, width: '320px' },
})

type State =
  | { status: 'loading' }
  | {
      status: 'ready'
      post: PostContentResponse
      markdown: string
      assets: DraftAsset[]
      publicConfig?: PublicConfigResponse
      localSnapshot?: { markdown: string; updatedAt: string }
      insertRequest?: { id: number; text: string }
      message?: string
      savedDraft?: DraftRecord
      assetObjectUrls: Record<string, string>
      changingId?: boolean
      committing?: boolean
    }
  | { status: 'error'; message: string }

export function SourcePostEditorPage() {
  const styles = usePageStyles()
  const localStyles = useSourceEditorStyles()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const relativeId = params.get('relativeId') ?? ''
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!relativeId) {
      setState({ status: 'error', message: 'relativeId is required' })
      return
    }
    setState({ status: 'loading' })
    void Promise.all([
      getJson<PostContentResponse>(`/posts/content?relativeId=${encodeURIComponent(relativeId)}`),
      getJson<PublicConfigResponse>('/config/public'),
      getJson<DraftAssetListResponse>(`/assets?draftId=${encodeURIComponent(relativeId)}&relativeId=${encodeURIComponent(relativeId)}`).catch(() => ({ manifest: { assets: [] } })),
    ])
      .then(([post, publicConfig, assetResponse]) => {
        setState({
          status: 'ready',
          post,
          markdown: post.markdown,
          assets: assetResponse.manifest.assets,
          publicConfig,
          localSnapshot: readEditorSnapshot(`source:${relativeId}`) ?? undefined,
          assetObjectUrls: {},
        })
      })
      .catch((error: unknown) => setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }))
  }, [relativeId])

  useEffect(() => {
    if (state.status !== 'ready') return
    const timer = window.setTimeout(() => writeEditorSnapshot(`source:${relativeId}`, state.markdown), 400)
    return () => window.clearTimeout(timer)
  }, [relativeId, state])

  const resolveResourceUrl = useMemo(() => {
    if (state.status !== 'ready') return undefined
    return (src: string) =>
      resolveMarkdownResourceUrl({
        src,
        relativeId: state.post.post.relativeId,
        publicConfig: state.publicConfig,
        assets: state.assets,
        assetObjectUrls: state.assetObjectUrls,
      })
  }, [state])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={() => window.location.reload()} />

  const setMarkdown = (markdown: string) => setState({ ...state, markdown })
  const insertMarkdown = (text: string) => setState({ ...state, insertRequest: { id: Date.now(), text } })
  const replaceMarkdownPath = (oldPath: string, newPath: string) => setMarkdown(state.markdown.split(oldPath).join(newPath))
  const renameSourceAsset = (asset: PostAsset, filename: string) => {
    if (!window.confirm('确认改名源站图片？这会立即提交到 GitHub，并需要等待 Actions 构建后刷新索引。')) return
    setState({ ...state, committing: true, message: '正在提交源站图片改名...' })
    void sendJson<{ commitSha: string; markdown: string }>('/posts/asset/rename', 'POST', {
      relativeId: state.post.post.relativeId,
      repoPath: asset.repoPath,
      filename,
      markdown: state.markdown,
    })
      .then((response) =>
        setState({
          ...state,
          markdown: response.markdown,
          committing: false,
          message: `源站图片已改名，commit: ${response.commitSha}。请等待 Actions 构建并刷新 admin-index。`,
        }),
      )
      .catch((error: unknown) => setState({ ...state, committing: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }
  const deleteSourceAsset = (asset: PostAsset) => {
    if (!window.confirm('确认删除源站图片？这会立即提交到 GitHub，并需要等待 Actions 构建后刷新索引。')) return
    setState({ ...state, committing: true, message: '正在提交源站图片删除...' })
    void sendJson<{ commitSha: string; markdown: string }>('/posts/asset/delete', 'POST', {
      relativeId: state.post.post.relativeId,
      repoPath: asset.repoPath,
      markdownPath: asset.markdownPath,
      markdown: state.markdown,
    })
      .then((response) =>
        setState({
          ...state,
          markdown: response.markdown,
          committing: false,
          message: `源站图片已删除，commit: ${response.commitSha}。请等待 Actions 构建并刷新 admin-index。`,
        }),
      )
      .catch((error: unknown) => setState({ ...state, committing: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }
  const saveAsDraft = () => {
    void sendJson<DraftRecord>('/drafts', 'POST', {
      relativeId: state.post.post.relativeId,
      title: extractFrontMatterTitle(state.markdown),
      markdown: state.markdown,
    })
      .then((draft) => {
        setState({ ...state, savedDraft: draft, message: t('drafts.saved'), assets: state.assets.map((asset) => ({ ...asset, draftId: draft.id })) })
      })
      .catch((error: unknown) => setState({ ...state, message: error instanceof Error ? error.message : 'Unknown error' }))
  }
  const deletePost = () => {
    void sendJson<{ commitSha: string }>('/posts/delete', 'POST', { relativeId: state.post.post.relativeId })
      .then((response) => {
        deleteEditorSnapshot(`source:${relativeId}`)
        setState({ ...state, message: `文章已删除，commit: ${response.commitSha}。请等待 Actions 构建并刷新 admin-index。` })
        navigate('/posts')
      })
      .catch((error: unknown) => setState({ ...state, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{state.post.post.title}</Title1>
        <Body1>{state.post.post.relativeId}</Body1>
      </header>
      {state.localSnapshot ? (
        <section className={styles.card}>
          <Title3>检测到未保存的本地编辑</Title3>
          <Text>本地快照保存于 {state.localSnapshot.updatedAt}。源站编辑刷新后默认加载 GitHub 版本，只有点击恢复才会应用本地内容。</Text>
          <div className={styles.row}>
            <Button appearance="primary" onClick={() => setState({ ...state, markdown: state.localSnapshot?.markdown ?? state.markdown, localSnapshot: undefined })}>
              恢复本地编辑
            </Button>
            <Button onClick={() => { deleteEditorSnapshot(`source:${relativeId}`); setState({ ...state, localSnapshot: undefined }) }}>
              丢弃本地编辑
            </Button>
          </div>
        </section>
      ) : null}
      {state.savedDraft ? (
        <DraftSavedOverlay
          draft={state.savedDraft}
          onOpenDrafts={() => navigate('/drafts')}
          onContinueDraft={() => navigate(`/drafts/edit?draftId=${encodeURIComponent(state.savedDraft?.id ?? '')}`)}
        />
      ) : null}
      {!state.savedDraft && state.message ? (
        <section className={localStyles.statusPanel}>
          <Text weight="semibold">源站操作状态</Text>
          <Text>{state.message}</Text>
        </section>
      ) : null}
      <section className={styles.card}>
        <div className={styles.row}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={saveAsDraft}>{t('posts.createDraft')}</Button>
          <DeletePostPopover onConfirm={deletePost} />
          <ChangeIdDialog
            currentRelativeId={state.post.post.relativeId}
            markdown={state.markdown}
            disabled={state.committing}
            onDone={(relativeId, markdown, commitSha) => {
              setState({ ...state, markdown, message: `文章 ID 已修改为 ${relativeId}，commit: ${commitSha}。请等待 Actions 构建并刷新 admin-index。` })
              navigate(`/posts/edit?relativeId=${encodeURIComponent(relativeId)}`, { replace: true })
            }}
            onError={(message) => setState({ ...state, message })}
          />
        </div>
        <MarkdownAssetPanel
          relativeId={state.post.post.relativeId}
          draftId={state.post.post.relativeId}
          assets={state.assets}
          sourceAssets={state.post.post.assets ?? []}
          onAssetsChange={(assets) => setState({ ...state, assets })}
          onInsertMarkdown={insertMarkdown}
          onMarkdownPathReplace={replaceMarkdownPath}
          onSourceAssetRename={renameSourceAsset}
          onSourceAssetDelete={deleteSourceAsset}
        />
        <Field label={t('posts.editor')}>
          <ArticleMarkdownWorkspace
            markdown={state.markdown}
            onChange={setMarkdown}
            resolveResourceUrl={resolveResourceUrl}
            assets={state.assets}
            onAssetObjectUrlsChange={(assetObjectUrls) =>
              setState((current) => (current.status === 'ready' ? { ...current, assetObjectUrls } : current))
            }
            insertRequest={state.insertRequest}
            onInsertConsumed={(id) => state.insertRequest?.id === id && setState({ ...state, insertRequest: undefined })}
          />
        </Field>
      </section>
    </section>
  )
}

function DraftSavedOverlay({
  draft,
  onOpenDrafts,
  onContinueDraft,
}: {
  draft: DraftRecord
  onOpenDrafts: () => void
  onContinueDraft: () => void
}) {
  const styles = useSourceEditorStyles()
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="draft-saved-title">
      <section className={styles.decisionPanel}>
        <div>
          <Title2 id="draft-saved-title">草稿已保存</Title2>
          <Body1>已将当前修改转为草稿并存入 KV，请选择接下来的操作。</Body1>
        </div>
        <Text>文章 ID：{draft.relativeId}</Text>
        <div className={styles.decisionActions}>
          <Button onClick={onOpenDrafts}>前往草稿管理</Button>
          <Button appearance="primary" onClick={onContinueDraft}>继续编辑草稿</Button>
        </div>
      </section>
    </div>
  )
}

function DeletePostPopover({ onConfirm }: { onConfirm: () => void }) {
  const styles = useSourceEditorStyles()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="primary" className={styles.dangerPrimaryButton} icon={<DeleteRegular />}>删除文章</Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.confirmSurface}>
        <Text weight="semibold">确认删除源站文章？</Text>
        <Text>会删除 Markdown 和已索引资源，并立即提交到 GitHub。此操作不能撤销。</Text>
        <div className={styles.decisionActions}>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button appearance="primary" className={styles.dangerPrimaryButton} icon={<DeleteRegular />} onClick={() => { setOpen(false); onConfirm() }}>确认删除</Button>
        </div>
      </PopoverSurface>
    </Popover>
  )
}

function ChangeIdDialog({
  currentRelativeId,
  markdown,
  disabled,
  onDone,
  onError,
}: {
  currentRelativeId: string
  markdown: string
  disabled?: boolean
  onDone: (relativeId: string, markdown: string, commitSha: string) => void
  onError: (message: string) => void
}) {
  const [value, setValue] = useState(currentRelativeId)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = () => {
    if (!window.confirm('确认修改源站文章 ID？这会改变文章路径/URL，并立即提交到 GitHub。')) return
    setBusy(true)
    void sendJson<{ commitSha: string; relativeId: string; markdown: string }>('/posts/rename', 'POST', {
      relativeId: currentRelativeId,
      newRelativeId: value,
      markdown,
    })
      .then((response) => {
        setOpen(false)
        onDone(response.relativeId, response.markdown, response.commitSha)
      })
      .catch((error: unknown) => onError(error instanceof Error ? error.message : 'Unknown error'))
      .finally(() => setBusy(false))
  }
  return (
    <>
      <Button onClick={() => setOpen((current) => !current)} disabled={disabled || busy}>修改文章 ID</Button>
      {open ? (
        <section>
          <Field label="新的 relativeId">
            <Input value={value} onChange={(_, data) => setValue(data.value)} />
          </Field>
          <Text>这会移动 Markdown 和资源目录，更新图片路径，并立即提交到 GitHub。</Text>
          <Button appearance="primary" onClick={submit} disabled={busy || !value.trim()}>{busy ? '提交中...' : '确认修改'}</Button>
        </section>
      ) : null}
    </>
  )
}
