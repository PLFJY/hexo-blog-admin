import { Body1, Button, Field, FluentProvider, Input, Popover, PopoverSurface, PopoverTrigger, Text, Title1, Title2, makeStyles, mergeClasses, tokens, webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { ArrowLeftRegular, DeleteRegular, SaveRegular } from '@fluentui/react-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { useAdminBackground } from '../app/AdminBackgroundContext'
import { useAppTheme } from '../app/ThemeProvider'
import { ArticleMarkdownWorkspace } from '../components/ArticleMarkdownWorkspace'
import { EditorConflictResolverDialog } from '../components/EditorConflictResolverDialog'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
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
import type { PostContentResponse } from '../shared/postTypes'
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
      publicConfig?: PublicConfigResponse
      insertRequest?: { id: number; text: string }
      message?: string
      savedDraft?: DraftRecord
      assetObjectUrls: Record<string, string>
      changingId?: boolean
      committing?: boolean
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
  const [state, setState] = useState<State>({ status: 'loading' })
  const assetPanelRef = useRef<MarkdownAssetPanelHandle>(null)

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
        assetObjectUrls: state.assetObjectUrls,
        debugPublicUrl: assetPublicUrlDebug,
      })
  }, [
    assetPublicUrlDebug,
    state.status === 'ready' ? state.post.post.relativeId : '',
    state.status === 'ready' ? state.publicConfig : undefined,
    state.status === 'ready' ? state.assets : undefined,
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
          committing: false,
          message: t('assets.deleteCommitSuccess', { commitSha: response.commitSha }),
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
        deleteEditorSnapshot(`source:${relativeId}`)
        setState({ ...state, savedDraft: draft, message: t('drafts.saved'), assets: state.assets.map((asset) => ({ ...asset, draftId: draft.id })) })
      })
      .catch((error: unknown) => setState({ ...state, message: error instanceof Error ? error.message : 'Unknown error' }))
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
        />
      ) : null}
      {!state.savedDraft && state.message ? (
        <section className={localStyles.statusPanel}>
          <Text weight="semibold">{t('posts.statusPanelTitle')}</Text>
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
              setState({ ...state, markdown, message: t('posts.renameSuccess', { relativeId, commitSha }) })
              navigate(`/posts/edit?relativeId=${encodeURIComponent(relativeId)}`, { replace: true })
            }}
            onError={(message) => setState({ ...state, message })}
          />
        </div>
        <MarkdownAssetPanel
          ref={assetPanelRef}
          relativeId={state.post.post.relativeId}
          draftId={state.post.post.relativeId}
          assets={state.assets}
          sourceAssets={state.post.post.assets ?? []}
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
  const { t } = useTranslation()
  const [value, setValue] = useState(currentRelativeId)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = () => {
    if (!window.confirm(t('posts.confirmChangeId'))) return
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS, minWidth: 0 }}>
      <Button onClick={() => setOpen((current) => !current)} disabled={disabled || busy}>{t('posts.changeId')}</Button>
      {open ? (
        <section style={{ display: 'grid', gap: tokens.spacingVerticalS, padding: tokens.spacingVerticalS }}>
          <Field label={t('posts.newRelativeId')}>
            <Input value={value} onChange={(_, data) => setValue(data.value)} />
          </Field>
          <Text size={200}>{t('posts.changeIdDescription')}</Text>
          <Button appearance="primary" onClick={submit} disabled={busy || !value.trim()}>{busy ? t('actions.submitting') : t('actions.confirm')}</Button>
        </section>
      ) : null}
    </div>
  )
}
