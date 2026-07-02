import { Body1, Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, FluentProvider, Input, Popover, PopoverSurface, PopoverTrigger, Text, Title1, Title2, makeStyles, mergeClasses, tokens, webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { ArrowLeftRegular, DeleteRegular, RocketRegular, SaveRegular } from '@fluentui/react-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { useAdminBackground } from '../app/AdminBackgroundContext'
import { useAppTheme } from '../app/themeContext'
import { ArticleMarkdownWorkspace } from '../components/ArticleMarkdownWorkspace'
import { EditorConflictResolverDialog } from '../components/EditorConflictResolverDialog'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import type { MermaidRenderError } from '../components/MarkdownPreview'
import { MarkdownAssetPanel } from '../components/MarkdownAssetPanel'
import type { MarkdownAssetPanelHandle } from '../components/MarkdownAssetPanel'
import { ApiError, getJson, sendJson } from '../lib/apiClient'
import { decideEditorConflict } from '../lib/editorConflict'
import { deleteEditorSnapshot, readEditorSnapshot, writeEditorSnapshot } from '../lib/editorSnapshot'
import { resolveMarkdownResourceUrl } from '../lib/markdownResource'
import type { PublicConfigResponse } from '../shared/apiTypes'
import type { DraftAsset, DraftAssetListResponse } from '../shared/assetTypes'
import type { DraftRecord } from '../shared/draftTypes'
import { extractFrontMatterTitle } from '../shared/frontMatter'
import type { PostAssetIndexResponse, PostContentResponse, PublishPostResponse } from '../shared/postTypes'
import type { PostAsset } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

const useSourceEditorStyles = makeStyles({
  headerRow: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    '& h1, & span': {
      overflowWrap: 'anywhere',
    },
  },
  statusPanel: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    border: `1px solid ${tokens.colorBrandStroke1}`,
    borderLeft: `4px solid ${tokens.colorBrandForeground1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  dangerPrimaryButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorPaletteRedBackground3,
    ':hover': { color: tokens.colorNeutralForegroundOnBrand, backgroundColor: tokens.colorPaletteRedForeground1 },
    ':disabled': {
      backgroundColor: tokens.colorNeutralBackgroundDisabled,
      color: tokens.colorNeutralForegroundDisabled,
      borderTopColor: tokens.colorNeutralStrokeDisabled,
      borderRightColor: tokens.colorNeutralStrokeDisabled,
      borderBottomColor: tokens.colorNeutralStrokeDisabled,
      borderLeftColor: tokens.colorNeutralStrokeDisabled,
    },
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    padding: tokens.spacingHorizontalM,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    minHeight: '100dvh',
  },
  decisionPanel: {
    display: 'grid',
    gap: tokens.spacingVerticalL,
    width: 'min(560px, 100%)',
    maxHeight: 'calc(100dvh - 32px)',
    overflowY: 'auto',
    padding: tokens.spacingVerticalXL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow64,
    backgroundColor: tokens.colorNeutralBackground1,
    boxSizing: 'border-box',
    '@media (max-width: 480px)': {
      padding: tokens.spacingVerticalL,
    },
  },
  decisionActions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalM,
    '@media (max-width: 480px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
  },
  confirmSurface: { display: 'grid', gap: tokens.spacingVerticalM, width: 'min(320px, 90vw)' },
  changeIdSurface: { width: 'min(520px, 92vw)' },
  changeIdContent: { display: 'grid', gap: tokens.spacingVerticalM },
})

type State =
  | { status: 'loading' }
  | {
      status: 'ready'
      post: PostContentResponse
      markdown: string
      baseMarkdown: string
      baseRevision?: string
      assets: DraftAsset[]
      sourceAssets: PostAsset[]
      publicConfig?: PublicConfigResponse
      insertRequest?: { id: number; text: string }
      message?: string
      savedDraft?: DraftRecord
      assetObjectUrls: Record<string, string>
      changingId?: boolean
      committing?: boolean
      publishingDirectly?: boolean
      directPublishConfirmOpen?: boolean
      conflict?: {
        legacy?: boolean
        cloudMarkdown: string
        localMarkdown: string
      }
    }
  | { status: 'missing'; relativeId: string }
  | { status: 'error'; message: string }

export function SourcePostEditorPage() {
  const styles = usePageStyles()
  const localStyles = useSourceEditorStyles()
  const { t } = useTranslation()
  const { assetPublicUrlDebug } = useAdminBackground()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const relativeId = params.get('relativeId') ?? ''
  const renamedFrom = params.get('renamedFrom') ?? ''
  const [state, setState] = useState<State>({ status: 'loading' })
  const [mermaidErrors, setMermaidErrors] = useState<MermaidRenderError[]>([])
  const assetPanelRef = useRef<MarkdownAssetPanelHandle>(null)

  useEffect(() => {
    let disposed = false
    queueMicrotask(() => {
      if (disposed) return

      if (!relativeId) {
        setState({ status: 'error', message: 'relativeId is required' })
        return
      }
      setState({ status: 'loading' })
      void Promise.all([
        getJson<PostContentResponse>(`/posts/content?relativeId=${encodeURIComponent(relativeId)}`),
        getJson<PublicConfigResponse>('/config/public'),
        getJson<DraftAssetListResponse>(`/assets?draftId=${encodeURIComponent(relativeId)}&relativeId=${encodeURIComponent(relativeId)}`).catch(() => ({ manifest: { assets: [] } })),
        getJson<PostAssetIndexResponse>(`/posts/assets?relativeId=${encodeURIComponent(relativeId)}`).catch(() => ({ relativeId, assets: [] })),
      ])
        .then(([post, publicConfig, assetResponse, sourceAssetResponse]) => {
          const snapshotScope = `source:${relativeId}`
          const decision = decideEditorConflict({ cloudMarkdown: post.markdown, snapshot: readEditorSnapshot(snapshotScope) })
          let markdown = post.markdown
          let message: string | undefined
          let conflict: Extract<State, { status: 'ready' }>['conflict']
          if (decision.kind === 'use-cloud') {
            deleteEditorSnapshot(snapshotScope)
            if (decision.reason === 'local-behind-cloud') message = t('conflict.localBehindCloud')
          } else if (decision.kind === 'use-local') {
            markdown = decision.localMarkdown
            message = t('conflict.safeLocalRestored')
          } else if (decision.kind === 'legacy-snapshot') {
            conflict = { legacy: true, cloudMarkdown: post.markdown, localMarkdown: decision.localMarkdown }
            message = t('conflict.legacySnapshotDescription')
          } else {
            conflict = { cloudMarkdown: decision.cloudMarkdown, localMarkdown: decision.localMarkdown }
            message = t('conflict.conflictDetected')
          }
          setState({
            status: 'ready',
            post,
            markdown,
            baseMarkdown: post.markdown,
            baseRevision: post.sha,
            assets: assetResponse.manifest.assets,
            sourceAssets: sourceAssetResponse.assets,
            publicConfig,
            assetObjectUrls: {},
            message,
            conflict,
          })
        })
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) {
            setState({ status: 'missing', relativeId })
          } else {
            setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' })
          }
        })
    })

    return () => {
      disposed = true
    }
  }, [relativeId])

  useEffect(() => {
    if (state.status !== 'ready' || state.conflict || state.savedDraft) return
    const timer = window.setTimeout(() => writeEditorSnapshot({
      scope: `source:${relativeId}`,
      source: 'source',
      markdown: state.markdown,
      baseMarkdown: state.baseMarkdown,
      baseRevision: state.baseRevision,
    }), 400)
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
        sourceAssets: state.sourceAssets,
        assetObjectUrls: state.assetObjectUrls,
        debugPublicUrl: assetPublicUrlDebug,
      })
  }, [
    assetPublicUrlDebug,
    state.status === 'ready' ? state.post.post.relativeId : '',
    state.status === 'ready' ? state.publicConfig : undefined,
    state.status === 'ready' ? state.assets : undefined,
    state.status === 'ready' ? state.sourceAssets : undefined,
    state.status === 'ready' ? state.assetObjectUrls : undefined,
  ])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'missing') {
    return (
      <section className={styles.page}>
        <header className={styles.header}>
          <div>
            <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate('/posts')}>
              {t('actions.back')}
            </Button>
          </div>
          <Title1>{t('posts.postNotFoundTitle')}</Title1>
          <Body1>{state.relativeId}</Body1>
        </header>
        <section className={styles.card}>
          <div style={{ display: 'grid', gap: tokens.spacingVerticalM, justifyItems: 'start' }}>
            <Text>{t('posts.postNotFoundDescription')}</Text>
            <Button icon={<ArrowLeftRegular />} onClick={() => navigate('/posts')} appearance='primary'>
              {t('posts.backToPosts')}
            </Button>
          </div>
        </section>
      </section>
    )
  }
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={() => window.location.reload()} />

  const setMarkdown = (markdown: string) => setState((current) => (current.status === 'ready' ? { ...current, markdown } : current))
  const insertMarkdown = (text: string) => setState((current) => (current.status === 'ready' ? { ...current, insertRequest: { id: Date.now(), text } } : current))
  const replaceMarkdownPath = (oldPath: string, newPath: string) =>
    setState((current) => (current.status === 'ready' ? { ...current, markdown: current.markdown.split(oldPath).join(newPath) } : current))
  const renameSourceAsset = (asset: PostAsset, filename: string) => {
    setState({ ...state, committing: true, message: t('assets.submittingRename') })
    void sendJson<{ commitSha: string; markdown: string; asset: PostAsset }>('/posts/asset/rename', 'POST', {
      relativeId: state.post.post.relativeId,
      repoPath: asset.repoPath,
      filename,
      markdown: state.markdown,
    })
      .then((response) =>
        setState({
          ...state,
          markdown: response.markdown,
          sourceAssets: state.sourceAssets.map((item) => (item.repoPath === asset.repoPath ? response.asset : item)),
          committing: false,
          message: t('assets.renameCommitSuccess', { commitSha: response.commitSha }),
        }),
      )
      .catch((error: unknown) => setState({ ...state, committing: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }
  const deleteSourceAsset = (asset: PostAsset) => {
    setState({ ...state, committing: true, message: t('assets.submittingDelete') })
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
          sourceAssets: state.sourceAssets.filter((item) => item.repoPath !== asset.repoPath),
          committing: false,
          message: t('assets.deleteCommitSuccess', { commitSha: response.commitSha }),
        }),
      )
      .catch((error: unknown) => setState({ ...state, committing: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }
  const saveAsDraft = () => {
    void sendJson<DraftRecord>('/drafts', 'POST', {
      relativeId: state.post.post.relativeId,
      sourceRelativeId: state.post.post.relativeId,
      title: extractFrontMatterTitle(state.markdown),
      markdown: state.markdown,
    })
      .then((draft) => {
        deleteEditorSnapshot(`source:${relativeId}`)
        setState({ ...state, savedDraft: draft, message: t('drafts.saved'), assets: state.assets.map((asset) => ({ ...asset, draftId: draft.id })) })
      })
      .catch((error: unknown) => setState({ ...state, message: error instanceof Error ? error.message : 'Unknown error' }))
  }
  const publishDirectly = () => {
    if (state.status !== 'ready' || state.publishingDirectly) return
    setState({ ...state, publishingDirectly: true, directPublishConfirmOpen: false, message: t('posts.directPublishing') })
    void sendJson<PublishPostResponse>('/posts/publish', 'POST', {
      relativeId: state.post.post.relativeId,
      markdown: state.markdown,
    })
      .then((response) => {
        deleteEditorSnapshot(`source:${relativeId}`)
        setState({
          ...state,
          markdown: response.markdown,
          baseMarkdown: response.markdown,
          baseRevision: response.commitSha,
          assets: [],
          assetObjectUrls: {},
          publishingDirectly: false,
          directPublishConfirmOpen: false,
          message: t('posts.directPublishSuccess', { commitSha: response.commitSha }),
        })
      })
      .catch((error: unknown) =>
        setState({
          ...state,
          publishingDirectly: false,
          directPublishConfirmOpen: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      )
  }
  const deletePost = () => {
    void sendJson<{ commitSha: string }>('/posts/delete', 'POST', { relativeId: state.post.post.relativeId })
      .then((response) => {
        deleteEditorSnapshot(`source:${relativeId}`)
        setState({ ...state, message: t('posts.deleteSuccess', { commitSha: response.commitSha }) })
        navigate('/posts')
      })
      .catch((error: unknown) => setState({ ...state, message: error instanceof Error ? error.message : 'Unknown error' }))
  }
  const resolveConflictWithCloud = () => {
    deleteEditorSnapshot(`source:${relativeId}`)
    setState({ ...state, markdown: state.conflict?.cloudMarkdown ?? state.markdown, conflict: undefined, message: undefined, baseMarkdown: state.conflict?.cloudMarkdown ?? state.baseMarkdown })
  }
  const resolveConflictWithLocal = (markdown = state.conflict?.localMarkdown ?? state.markdown, message = t('conflict.cloudBehindLocal')) => {
    writeEditorSnapshot({
      scope: `source:${relativeId}`,
      source: 'source',
      markdown,
      baseMarkdown: state.conflict?.cloudMarkdown ?? state.baseMarkdown,
      baseRevision: state.baseRevision,
    })
    setState({ ...state, markdown, conflict: undefined, message, baseMarkdown: state.conflict?.cloudMarkdown ?? state.baseMarkdown })
  }
  return (
    <section className={styles.page}>
      {mermaidErrors.length > 0 ? (
        <section className={styles.pageBanner} role="alert" aria-live="polite">
          <Text weight="semibold">Mermaid 流程图渲染失败</Text>
          {mermaidErrors.map((error) => (
            <Text key={`${error.index}-${error.line ?? 'unknown'}`}>
              {error.line ? `第 ${error.line} 行：` : ''}{error.message}
            </Text>
          ))}
        </section>
      ) : null}
      {state.conflict ? (
        <EditorConflictResolverDialog
          open
          title={state.conflict.legacy ? t('conflict.legacySnapshotTitle') : t('conflict.title')}
          cloudLabel={t('conflict.cloudVersion')}
          localLabel={t('conflict.localVersion')}
          cloudMarkdown={state.conflict.cloudMarkdown}
          localMarkdown={state.conflict.localMarkdown}
          legacy={state.conflict.legacy}
          onUseCloud={resolveConflictWithCloud}
          onUseLocal={() => resolveConflictWithLocal(state.conflict?.localMarkdown, state.conflict?.legacy ? t('conflict.legacySnapshotDescription') : t('conflict.cloudBehindLocal'))}
          onApplyMerged={(markdown) => resolveConflictWithLocal(markdown, t('conflict.safeLocalRestored'))}
        />
      ) : null}
      <header className={mergeClasses(styles.header, localStyles.headerRow)}>
        <div>
          <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate('/posts')}>
            {t('actions.back')}
          </Button>
        </div>
        <Title1>{state.post.post.title}</Title1>
        <Body1>{state.post.post.relativeId}</Body1>
        <Text>{t('posts.localCloudDraftNote')}</Text>
      </header>
      {state.savedDraft ? (
        <DraftSavedOverlay
          draft={state.savedDraft}
          onOpenDrafts={() => navigate('/drafts')}
          onContinueDraft={() => navigate(`/drafts/edit?draftId=${encodeURIComponent(state.savedDraft?.id ?? '')}`)}
          message={state.message}
        />
      ) : null}
      {!state.savedDraft && state.message ? (
        <section className={localStyles.statusPanel}>
          <Text weight="semibold">{t('posts.statusPanelTitle')}</Text>
          <Text>{state.message}</Text>
        </section>
      ) : null}
      {assetPublicUrlDebug && renamedFrom && renamedFrom !== state.post.post.relativeId ? (
        <SourceIdDebugPanel sourceRelativeId={renamedFrom} currentRelativeId={state.post.post.relativeId} />
      ) : null}
      <section className={styles.card}>
        <div className={styles.row}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={saveAsDraft} disabled={state.committing || state.publishingDirectly || state.changingId}>{t('posts.createDraft')}</Button>
          <Button
            appearance="primary"
            icon={<RocketRegular />}
            onClick={() => setState({ ...state, directPublishConfirmOpen: true })}
            disabled={state.committing || state.publishingDirectly || state.changingId || mermaidErrors.length > 0}
          >
            {state.publishingDirectly ? t('actions.publishing') : t('posts.directPublish')}
          </Button>
          <DeletePostPopover onConfirm={deletePost} />
          <ChangeIdDialog
            currentRelativeId={state.post.post.relativeId}
            markdown={state.markdown}
            disabled={state.committing}
            onDone={(relativeId, markdown, commitSha) => {
              setState({ ...state, markdown, message: t('posts.renameSuccess', { relativeId, commitSha }) })
              navigate('/posts', {
                state: {
                  commitSha,
                  message: t('posts.renameSuccess', { relativeId, commitSha }),
                },
              })
            }}
            onError={(message) => setState({ ...state, message })}
          />
        </div>
        <DirectPublishDialog
          open={Boolean(state.directPublishConfirmOpen)}
          submitting={Boolean(state.publishingDirectly)}
          onCancel={() => setState({ ...state, directPublishConfirmOpen: false })}
          onConfirm={publishDirectly}
        />
        <MarkdownAssetPanel
          ref={assetPanelRef}
          relativeId={state.post.post.relativeId}
          draftId={state.post.post.relativeId}
          assets={state.assets}
          sourceAssets={state.sourceAssets}
          onAssetsChange={(assets) => setState((current) => (current.status === 'ready' ? { ...current, assets } : current))}
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
            onInsertConsumed={(id) =>
              setState((current) => (current.status === 'ready' && current.insertRequest?.id === id ? { ...current, insertRequest: undefined } : current))
            }
            onPasteImages={(files) => void assetPanelRef.current?.handleIncomingImageFiles(files, 'paste')}
            onSaveShortcut={saveAsDraft}
            onMermaidRenderErrorsChange={setMermaidErrors}
            documentKey={state.post.post.relativeId}
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
  message,
}: {
  draft: DraftRecord
  onOpenDrafts: () => void
  onContinueDraft: () => void
  message?: string
}) {
  const styles = useSourceEditorStyles()
  const { t } = useTranslation()
  const { resolvedMode } = useAppTheme()
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return createPortal(
    <FluentProvider theme={resolvedMode === 'dark' ? webDarkTheme : webLightTheme}>
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="draft-saved-title">
        <section className={styles.decisionPanel}>
          <div>
            <Title2 id="draft-saved-title">{t('posts.draftSavedTitle')}</Title2>
            <br/>
            <Body1>{t('posts.draftSavedDescription')}</Body1>
          </div>
          <Text>{t('posts.draftSavedId', { id: draft.relativeId })}</Text>
          {message ? <Text>{message}</Text> : null}
          <div className={styles.decisionActions}>
            <Button onClick={onOpenDrafts}>{t('posts.goToDrafts')}</Button>
            <Button appearance="primary" onClick={onContinueDraft}>{t('posts.continueDraft')}</Button>
          </div>
        </section>
      </div>
    </FluentProvider>,
    document.body,
  )
}

function DirectPublishDialog({
  open,
  submitting,
  onCancel,
  onConfirm,
}: {
  open: boolean
  submitting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={(_, data) => !submitting && !data.open && onCancel()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t('posts.directPublishTitle')}</DialogTitle>
          <DialogContent>
            <Text>{t('posts.directPublishDescription')}</Text>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCancel} disabled={submitting}>{t('actions.cancel')}</Button>
            <Button appearance="primary" icon={<RocketRegular />} onClick={onConfirm} disabled={submitting}>
              {submitting ? t('actions.publishing') : t('posts.confirmDirectPublish')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

function DeletePostPopover({ onConfirm }: { onConfirm: () => void }) {
  const styles = useSourceEditorStyles()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="primary" className={styles.dangerPrimaryButton} icon={<DeleteRegular />}>{t('posts.deletePost')}</Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.confirmSurface}>
        <Text weight="semibold">{t('posts.confirmDeleteTitle')}</Text>
        <Text>{t('posts.confirmDeleteDescription')}</Text>
        <div className={styles.decisionActions}>
          <Button onClick={() => setOpen(false)}>{t('actions.cancel')}</Button>
          <Button appearance="primary" className={styles.dangerPrimaryButton} icon={<DeleteRegular />} onClick={() => { setOpen(false); onConfirm() }}>{t('actions.delete')}</Button>
        </div>
      </PopoverSurface>
    </Popover>
  )
}

function SourceIdDebugPanel({ sourceRelativeId, currentRelativeId }: { sourceRelativeId: string; currentRelativeId: string }) {
  const styles = useSourceEditorStyles()
  return (
    <section className={styles.statusPanel}>
      <Text weight="semibold">ID mapping debug</Text>
      <Text>sourceRelativeId: {sourceRelativeId}</Text>
      <Text>currentRelativeId: {currentRelativeId}</Text>
      <Text>request: /posts/rename</Text>
      <Text>source action: source post and source assets moved to currentRelativeId paths</Text>
    </section>
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
  const styles = useSourceEditorStyles()
  const { t } = useTranslation()
  const [value, setValue] = useState(currentRelativeId)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = () => {
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
      <Button onClick={() => setOpen(true)} disabled={disabled || busy}>{t('posts.changeId')}</Button>
      <Dialog open={open} onOpenChange={(_, data) => !busy && setOpen(data.open)}>
        <DialogSurface className={styles.changeIdSurface}>
          <DialogBody>
            <DialogTitle>{t('posts.changeId')}</DialogTitle>
            <DialogContent className={styles.changeIdContent}>
              <Text>{t('posts.confirmChangeId')}</Text>
              <Field label={t('posts.newRelativeId')}>
                <Input value={value} onChange={(_, data) => setValue(data.value)} />
              </Field>
              <Text size={200}>{t('posts.changeIdDescription')}</Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setOpen(false)} disabled={busy}>{t('actions.cancel')}</Button>
              <Button appearance="primary" onClick={submit} disabled={busy || !value.trim() || value.trim() === currentRelativeId}>
                {busy ? t('actions.submitting') : t('actions.confirm')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  )
}
