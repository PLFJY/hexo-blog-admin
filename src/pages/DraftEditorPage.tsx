import { Body1, Button, Field, Input, Popover, PopoverSurface, PopoverTrigger, Text, Title1, makeStyles, tokens } from '@fluentui/react-components'
import { ArrowLeftRegular, DeleteRegular, RocketRegular, SaveRegular } from '@fluentui/react-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { useAdminBackground } from '../app/AdminBackgroundContext'
import { ArticleMarkdownWorkspace } from '../components/ArticleMarkdownWorkspace'
import { EditorConflictResolverDialog } from '../components/EditorConflictResolverDialog'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { MarkdownAssetPanel } from '../components/MarkdownAssetPanel'
import type { MarkdownAssetPanelHandle } from '../components/MarkdownAssetPanel'
import { decideEditorConflict } from '../lib/editorConflict'
import { deleteEditorSnapshot, readEditorSnapshot, writeEditorSnapshot } from '../lib/editorSnapshot'
import { getCachedAdminIndex, setCachedAdminIndex } from '../lib/indexCache'
import { getJson, sendJson } from '../lib/apiClient'
import { resolveMarkdownResourceUrl } from '../lib/markdownResource'
import type { PublicConfigResponse } from '../shared/apiTypes'
import type { DraftAsset, DraftAssetListResponse } from '../shared/assetTypes'
import type { DraftListResponse, DraftRecord, PublishDraftResponse } from '../shared/draftTypes'
import { removeMarkdownImageReferences } from '../shared/markdownAssets'
import type { PostAsset, PostAssetIndexResponse, PostTreeResponse } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

const useStyles = makeStyles({
  statusPanel: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderTop: `1px solid ${tokens.colorBrandStroke1}`,
    borderRight: `1px solid ${tokens.colorBrandStroke1}`,
    borderBottom: `1px solid ${tokens.colorBrandStroke1}`,
    borderLeft: `4px solid ${tokens.colorBrandForeground1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  statusPanelSuccess: {
    borderTopColor: tokens.colorPaletteGreenBorder2,
    borderRightColor: tokens.colorPaletteGreenBorder2,
    borderBottomColor: tokens.colorPaletteGreenBorder2,
    borderLeftColor: tokens.colorPaletteGreenBorder2,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  statusPanelError: {
    borderTopColor: tokens.colorPaletteRedBorder2,
    borderRightColor: tokens.colorPaletteRedBorder2,
    borderBottomColor: tokens.colorPaletteRedBorder2,
    borderLeftColor: tokens.colorPaletteRedBorder2,
    borderLeftWidth: '4px',
    borderLeftStyle: 'solid',
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  statusPanelHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  statusMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
  dangerPrimaryButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorPaletteRedBackground3,
    ':hover': {
      color: tokens.colorNeutralForegroundOnBrand,
      backgroundColor: tokens.colorPaletteRedForeground1,
    },
    ':disabled': {
      backgroundColor: tokens.colorNeutralBackgroundDisabled,
      color: tokens.colorNeutralForegroundDisabled,
      borderTopColor: tokens.colorNeutralStrokeDisabled,
      borderRightColor: tokens.colorNeutralStrokeDisabled,
      borderBottomColor: tokens.colorNeutralStrokeDisabled,
      borderLeftColor: tokens.colorNeutralStrokeDisabled,
    },
  },
  confirmSurface: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    maxWidth: '280px',
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
})

const emptyDraft = (): DraftRecord => ({
  id: '',
  relativeId: '',
  title: '',
  markdown: `---\ntitle: \ndate: ${new Date().toISOString()}\ntags:\n---\n\n`,
  updatedAt: new Date().toISOString(),
})

const normalizeRelativeId = (relativeId: string) => relativeId.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
const isValidRelativeId = (relativeId: string) => {
  const normalized = normalizeRelativeId(relativeId)
  if (!normalized || normalized.startsWith('.') || normalized.includes('..')) return false
  if (normalized.split('/').some((part) => !part || part === '.' || part === '..' || part === '.git')) return false
  return /^[a-zA-Z0-9][a-zA-Z0-9/_-]*[a-zA-Z0-9_-]$/.test(normalized)
}

async function fetchSourceAssets(relativeId: string, postIndex: PostTreeResponse): Promise<PostAsset[]> {
  const normalized = normalizeRelativeId(relativeId)
  if (!normalized || !postIndex.posts.some((post) => post.relativeId === normalized)) return []
  return await getJson<PostAssetIndexResponse>(`/posts/assets?relativeId=${encodeURIComponent(normalized)}`)
    .then((response) => response.assets)
    .catch(() => [])
}

type State =
  | { status: 'loading' }
  | {
      status: 'ready'
      draft: DraftRecord
      drafts: DraftRecord[]
      assets: DraftAsset[]
      sourceAssets: PostAsset[]
      publicConfig?: PublicConfigResponse
      postRelativeIds: string[]
      insertRequest?: { id: number; text: string }
      assetObjectUrls: Record<string, string>
      message?: string
      saving?: boolean
      committing?: boolean
      publishing?: boolean
      baseMarkdown: string
      baseUpdatedAt?: string
      snapshotDisabled?: boolean
      conflict?: {
        legacy?: boolean
        cloudMarkdown: string
        localMarkdown: string
      }
    }
  | { status: 'error'; message: string }

export function DraftEditorPage() {
  const styles = usePageStyles()
  const localStyles = useStyles()
  const { t } = useTranslation()
  const { assetPublicUrlDebug } = useAdminBackground()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const draftId = params.get('draftId') ?? ''
  const [state, setState] = useState<State>({ status: 'loading' })
  const pollTimer = useRef<number | undefined>(undefined)
  const assetPanelRef = useRef<MarkdownAssetPanelHandle>(null)

  useEffect(() => {
    setState({ status: 'loading' })
    const draftRequest = draftId ? getJson<DraftRecord>(`/drafts/${encodeURIComponent(draftId)}`) : Promise.resolve(emptyDraft())
    const cachedPostIndex = getCachedAdminIndex()
    const postIndexRequest = cachedPostIndex
      ? Promise.resolve(cachedPostIndex)
      : getJson<PostTreeResponse>('/posts/tree')
        .then((index) => {
          setCachedAdminIndex(index)
          return index
        })
        .catch(() => ({ posts: [], tree: [] }))

    void Promise.all([
      draftRequest,
      getJson<DraftListResponse>('/drafts'),
      getJson<PublicConfigResponse>('/config/public'),
      postIndexRequest,
    ])
      .then(async ([draft, draftList, publicConfig, postIndex]) => {
        const snapshotScope = draft.id ? `draft:${draft.id}` : ''
        const snapshot = snapshotScope ? readEditorSnapshot(snapshotScope) : { kind: 'none' as const }
        const decision = decideEditorConflict({ cloudMarkdown: draft.markdown, snapshot })
        let nextDraft = draft
        let message: string | undefined
        let conflict: Extract<State, { status: 'ready' }>['conflict']
        if (decision.kind === 'use-cloud') {
          if (snapshotScope) deleteEditorSnapshot(snapshotScope)
          if (decision.reason === 'local-behind-cloud') message = t('conflict.localBehindCloud')
        } else if (decision.kind === 'use-local') {
          nextDraft = { ...draft, markdown: decision.localMarkdown }
          message = t('conflict.safeLocalRestored')
        } else if (decision.kind === 'legacy-snapshot') {
          conflict = { legacy: true, cloudMarkdown: draft.markdown, localMarkdown: decision.localMarkdown }
          message = t('conflict.legacySnapshotDescription')
        } else {
          conflict = { cloudMarkdown: decision.cloudMarkdown, localMarkdown: decision.localMarkdown }
          message = t('conflict.conflictDetected')
        }
        const assetResponse = nextDraft.id
          ? await getJson<DraftAssetListResponse>(`/assets?draftId=${encodeURIComponent(nextDraft.id)}&relativeId=${encodeURIComponent(nextDraft.relativeId)}`)
          : { manifest: { assets: [] as DraftAsset[] } }
        const sourceAssets = await fetchSourceAssets(nextDraft.relativeId, postIndex)
        setState({
          status: 'ready',
          draft: nextDraft,
          drafts: draftList.drafts,
          assets: assetResponse.manifest.assets,
          sourceAssets,
          publicConfig,
          postRelativeIds: postIndex.posts.map((post) => post.relativeId),
          assetObjectUrls: {},
          message,
          baseMarkdown: draft.markdown,
          baseUpdatedAt: draft.updatedAt,
          conflict,
        })
        if (cachedPostIndex) {
          void getJson<PostTreeResponse>('/posts/tree')
            .then(async (freshIndex) => {
              setCachedAdminIndex(freshIndex)
              const freshSourceAssets = await fetchSourceAssets(nextDraft.relativeId, freshIndex)
              setState((current) =>
                current.status === 'ready'
                  ? {
                      ...current,
                      sourceAssets: current.draft.relativeId === nextDraft.relativeId ? freshSourceAssets : current.sourceAssets,
                      postRelativeIds: freshIndex.posts.map((post) => post.relativeId),
                    }
                  : current,
              )
            })
            .catch(() => undefined)
        }
      })
      .catch((error: unknown) => setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }))
    return () => window.clearTimeout(pollTimer.current)
  }, [draftId])

  useEffect(() => {
    if (state.status !== 'ready' || !state.draft.id || state.snapshotDisabled || state.conflict) return
    const timer = window.setTimeout(() => writeEditorSnapshot({
      scope: `draft:${state.draft.id}`,
      source: 'draft',
      markdown: state.draft.markdown,
      baseMarkdown: state.baseMarkdown,
      baseUpdatedAt: state.baseUpdatedAt,
    }), 400)
    return () => window.clearTimeout(timer)
  }, [state])

  const resolveResourceUrl = useMemo(() => {
    if (state.status !== 'ready') return undefined
    return (src: string) =>
      resolveMarkdownResourceUrl({
        src,
        relativeId: state.draft.relativeId,
        publicConfig: state.publicConfig,
        assets: state.assets,
        assetObjectUrls: state.assetObjectUrls,
        debugPublicUrl: assetPublicUrlDebug,
      })
  }, [
    assetPublicUrlDebug,
    state.status === 'ready' ? state.draft.relativeId : '',
    state.status === 'ready' ? state.publicConfig : undefined,
    state.status === 'ready' ? state.assets : undefined,
    state.status === 'ready' ? state.assetObjectUrls : undefined,
  ])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={() => window.location.reload()} />

  const updateDraft = (patch: Partial<DraftRecord>) =>
    setState((current) => (current.status === 'ready' ? { ...current, draft: { ...current.draft, ...patch } } : current))
  const normalizedRelativeId = normalizeRelativeId(state.draft.relativeId)
  const duplicateDraft = state.drafts.some((draft) => draft.id !== state.draft.id && draft.relativeId === normalizedRelativeId)
  const duplicatePost = !state.draft.id && state.postRelativeIds.includes(normalizedRelativeId)
  const canSaveDraft = isValidRelativeId(state.draft.relativeId) && !duplicateDraft && !duplicatePost
  const insertMarkdown = (text: string) => setState((current) => (current.status === 'ready' ? { ...current, insertRequest: { id: Date.now(), text } } : current))
  const replaceMarkdownPath = (oldPath: string, newPath: string) =>
    setState((current) =>
      current.status === 'ready'
        ? { ...current, draft: { ...current.draft, markdown: current.draft.markdown.split(oldPath).join(newPath) } }
        : current,
    )
  const deleteSourceAssetFromDraft = (asset: PostAsset) => {
    const nextMarkdown = removeMarkdownImageReferences(state.draft.markdown, asset.markdownPath)
    setState({ ...state, saving: true, committing: true, message: t('assets.submittingDelete') })
    void sendJson<{ commitSha: string; markdown: string }>('/posts/asset/delete', 'POST', {
      relativeId: state.draft.relativeId,
      repoPath: asset.repoPath,
      markdownPath: asset.markdownPath,
    })
      .then(async (response) => {
        const savedDraft = state.draft.id
          ? await sendJson<DraftRecord>(`/drafts/${encodeURIComponent(state.draft.id)}`, 'PUT', {
              ...state.draft,
              markdown: nextMarkdown,
            })
          : { ...state.draft, markdown: nextMarkdown }
        if (savedDraft.id) deleteEditorSnapshot(`draft:${savedDraft.id}`)
        setState({
          ...state,
          draft: savedDraft,
          sourceAssets: state.sourceAssets.filter((item) => item.repoPath !== asset.repoPath),
          saving: false,
          committing: false,
          message: t('assets.deleteCommitSuccess', { commitSha: response.commitSha }),
          baseMarkdown: savedDraft.markdown,
          baseUpdatedAt: savedDraft.updatedAt,
        })
      })
      .catch((error: unknown) => setState({ ...state, saving: false, committing: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }
  const save = () => {
    if (!canSaveDraft) {
      setState({ ...state, message: t('drafts.relativeIdRequired') })
      return
    }
    const method = state.draft.id ? 'PUT' : 'POST'
    const path = state.draft.id ? `/drafts/${encodeURIComponent(state.draft.id)}` : '/drafts'
    setState({ ...state, saving: true })
    void sendJson<DraftRecord>(path, method, { ...state.draft, relativeId: normalizedRelativeId })
      .then((draft) => {
        deleteEditorSnapshot(`draft:${draft.id}`)
        setState({ ...state, draft, saving: false, message: t('drafts.saved'), assets: state.assets.map((asset) => ({ ...asset, draftId: draft.id })), baseMarkdown: draft.markdown, baseUpdatedAt: draft.updatedAt })
        if (!draftId) navigate(`/drafts/edit?draftId=${encodeURIComponent(draft.id)}`, { replace: true })
      })
      .catch((error: unknown) => setState({ ...state, saving: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  const remove = () => {
    if (!state.draft.id) return
    void sendJson<{ deleted: boolean }>(`/drafts/${encodeURIComponent(state.draft.id)}`, 'DELETE').then(() => {
      deleteEditorSnapshot(`draft:${state.draft.id}`)
      navigate('/drafts')
    })
  }

  const publish = () => {
    if (!state.draft.id || !canSaveDraft) return
    setState({ ...state, saving: true, publishing: true })
    void sendJson<DraftRecord>(`/drafts/${encodeURIComponent(state.draft.id)}`, 'PUT', {
      ...state.draft,
      relativeId: normalizedRelativeId,
    })
      .then((draft) => sendJson<PublishDraftResponse>('/drafts/publish', 'POST', { draftId: draft.id }).then((response) => ({ draft, response })))
      .then((response) => {
        deleteEditorSnapshot(`draft:${response.draft.id}`)
        navigate('/drafts', { state: { message: `${t('drafts.published')}: ${response.response.commitSha}` } })
      })
      .catch((error: unknown) => setState({ ...state, saving: false, publishing: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  const showStatusPanel = Boolean(state.message)
  const snapshotScope = state.draft.id ? `draft:${state.draft.id}` : ''
  const resolveConflictWithCloud = () => {
    if (snapshotScope) deleteEditorSnapshot(snapshotScope)
    setState({ ...state, draft: { ...state.draft, markdown: state.conflict?.cloudMarkdown ?? state.draft.markdown }, conflict: undefined, message: undefined, baseMarkdown: state.conflict?.cloudMarkdown ?? state.baseMarkdown })
  }
  const resolveConflictWithLocal = (markdown = state.conflict?.localMarkdown ?? state.draft.markdown, message = t('conflict.cloudBehindLocal')) => {
    if (snapshotScope) {
      writeEditorSnapshot({
        scope: snapshotScope,
        source: 'draft',
        markdown,
        baseMarkdown: state.conflict?.cloudMarkdown ?? state.baseMarkdown,
        baseUpdatedAt: state.baseUpdatedAt,
      })
    }
    setState({ ...state, draft: { ...state.draft, markdown }, conflict: undefined, message, baseMarkdown: state.conflict?.cloudMarkdown ?? state.baseMarkdown })
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
      <header className={styles.header}>
        <div>
          <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate('/drafts')}>
            {t('actions.back')}
          </Button>
        </div>
        <Title1>{state.draft.id ? state.draft.relativeId : t('drafts.newDraft')}</Title1>
        <Body1>{t('drafts.description')}</Body1>
        <Text>{t('drafts.localCloudDraftNote')}</Text>
      </header>
      <section className={styles.card}>
        <div className={styles.row}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={save} disabled={!canSaveDraft || state.saving}>
            {state.saving ? t('actions.saving') : t('drafts.saveDraft')}
          </Button>
          <Button icon={<RocketRegular />} onClick={publish} disabled={!state.draft.id || !canSaveDraft || state.saving || state.publishing}>
            {state.publishing ? t('actions.publishing') : t('drafts.publishDraft')}
          </Button>
          <DeleteDraftPopover disabled={!state.draft.id} onConfirm={remove} />
          <ChangeIdNote />
        </div>
        {showStatusPanel ? (
          <section className={localStyles.statusPanel}>
            <div className={localStyles.statusPanelHeader}>
              <Text weight="semibold">{t('drafts.statusPanelTitle')}</Text>
            </div>
            {state.message ? <Text>{state.message}</Text> : null}
          </section>
        ) : null}
        <Field
          label={t('drafts.relativeIdLabel')}
          validationState={!canSaveDraft ? 'error' : undefined}
          validationMessage={!isValidRelativeId(state.draft.relativeId) ? t('drafts.relativeIdRequired') : duplicateDraft ? t('drafts.relativeIdDuplicateDraft') : duplicatePost ? t('drafts.relativeIdDuplicatePost') : undefined}
        >
          <Input value={state.draft.relativeId} onChange={(_, data) => updateDraft({ relativeId: data.value })} placeholder="ap-csa/00-about-ap-csa" />
        </Field>
        <MarkdownAssetPanel
          ref={assetPanelRef}
          relativeId={state.draft.relativeId}
          draftId={state.draft.id}
          assets={state.assets}
          sourceAssets={state.sourceAssets}
          onAssetsChange={(assets) => setState((current) => (current.status === 'ready' ? { ...current, assets } : current))}
          onInsertMarkdown={insertMarkdown}
          onMarkdownPathReplace={replaceMarkdownPath}
          onSourceAssetDelete={deleteSourceAssetFromDraft}
          uploadDisabled={!canSaveDraft}
        />
        <Field label={t('drafts.markdownLabel')}>
          <ArticleMarkdownWorkspace
            markdown={state.draft.markdown}
            onChange={(markdown) => updateDraft({ markdown })}
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
            onSaveShortcut={save}
          />
        </Field>
      </section>
    </section>
  )
}

function ChangeIdNote() {
  const { t } = useTranslation()
  return <Text>{t('drafts.changeIdNote')}</Text>
}

function DeleteDraftPopover({ disabled, onConfirm }: { disabled?: boolean; onConfirm: () => void }) {
  const localStyles = useStyles()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="primary" className={localStyles.dangerPrimaryButton} icon={<DeleteRegular />} disabled={disabled}>
          {t('drafts.deleteDraft')}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={localStyles.confirmSurface}>
        <Text weight="semibold">{t('drafts.confirmDeleteTitle')}</Text>
        <Text>{t('drafts.confirmDeleteDescription')}</Text>
        <div className={localStyles.confirmActions}>
          <Button appearance="secondary" onClick={() => setOpen(false)}>{t('actions.close')}</Button>
          <Button
            appearance="primary"
            className={localStyles.dangerPrimaryButton}
            icon={<DeleteRegular />}
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            {t('drafts.deleteDraft')}
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  )
}
