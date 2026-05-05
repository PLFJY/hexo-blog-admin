import { Body1, Button, Field, Input, Text, Title1, makeStyles, tokens } from '@fluentui/react-components'
import { DeleteRegular, RocketRegular, SaveRegular } from '@fluentui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { ArticleMarkdownWorkspace } from '../components/ArticleMarkdownWorkspace'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { MarkdownAssetPanel } from '../components/MarkdownAssetPanel'
import { StatusBadge } from '../components/StatusBadge'
import { deleteEditorSnapshot, readEditorSnapshot, writeEditorSnapshot } from '../lib/editorSnapshot'
import { getJson, sendJson } from '../lib/apiClient'
import { resolveMarkdownResourceUrl } from '../lib/markdownResource'
import type { PublicConfigResponse } from '../shared/apiTypes'
import type { DraftAsset, DraftAssetListResponse } from '../shared/assetTypes'
import type { DeployRecord, DeployStatusResponse } from '../shared/deployTypes'
import type { DraftListResponse, DraftRecord, PublishDraftResponse } from '../shared/draftTypes'
import type { PostAsset, PostTreeResponse } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

const useStyles = makeStyles({
  statusPanel: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    border: `1px solid ${tokens.colorBrandStroke1}`,
    borderLeft: `4px solid ${tokens.colorBrandForeground1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
  },
  statusPanelSuccess: {
    borderColor: tokens.colorPaletteGreenBorder2,
    borderLeftColor: tokens.colorPaletteGreenForeground1,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  statusPanelError: {
    borderColor: tokens.colorPaletteRedBorder2,
    borderLeftColor: tokens.colorPaletteRedForeground1,
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
      publishCommitSha?: string
      deploy?: DeployRecord
      indexSynced?: boolean
      saving?: boolean
      publishing?: boolean
    }
  | { status: 'error'; message: string }

export function DraftEditorPage() {
  const styles = usePageStyles()
  const localStyles = useStyles()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const draftId = params.get('draftId') ?? ''
  const [state, setState] = useState<State>({ status: 'loading' })
  const pollTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setState({ status: 'loading' })
    const draftRequest = draftId ? getJson<DraftRecord>(`/drafts/${encodeURIComponent(draftId)}`) : Promise.resolve(emptyDraft())
    void Promise.all([
      draftRequest,
      getJson<DraftListResponse>('/drafts'),
      getJson<PublicConfigResponse>('/config/public'),
      getJson<PostTreeResponse>('/posts/tree').catch(() => ({ posts: [], tree: [] })),
    ])
      .then(async ([draft, draftList, publicConfig, postIndex]) => {
        const snapshot = draft.id ? readEditorSnapshot(`draft:${draft.id}`) : null
        const nextDraft = snapshot && snapshot.updatedAt > draft.updatedAt ? { ...draft, markdown: snapshot.markdown } : draft
        const assetResponse = nextDraft.id
          ? await getJson<DraftAssetListResponse>(`/assets?draftId=${encodeURIComponent(nextDraft.id)}&relativeId=${encodeURIComponent(nextDraft.relativeId)}`)
          : { manifest: { assets: [] as DraftAsset[] } }
        setState({
          status: 'ready',
          draft: nextDraft,
          drafts: draftList.drafts,
          assets: assetResponse.manifest.assets,
          sourceAssets: postIndex.posts.find((post) => post.relativeId === nextDraft.relativeId)?.assets ?? [],
          publicConfig,
          postRelativeIds: postIndex.posts.map((post) => post.relativeId),
          assetObjectUrls: {},
          message: snapshot && snapshot.updatedAt > draft.updatedAt ? '已恢复较新的本地编辑快照' : undefined,
        })
      })
      .catch((error: unknown) => setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }))
    return () => window.clearTimeout(pollTimer.current)
  }, [draftId])

  useEffect(() => {
    if (state.status !== 'ready' || !state.draft.id) return
    const timer = window.setTimeout(() => writeEditorSnapshot(`draft:${state.draft.id}`, state.draft.markdown), 400)
    return () => window.clearTimeout(timer)
  }, [state])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={() => window.location.reload()} />

  const updateDraft = (patch: Partial<DraftRecord>) => setState({ ...state, draft: { ...state.draft, ...patch } })
  const normalizedRelativeId = normalizeRelativeId(state.draft.relativeId)
  const duplicateDraft = state.drafts.some((draft) => draft.id !== state.draft.id && draft.relativeId === normalizedRelativeId)
  const duplicatePost = !state.draft.id && state.postRelativeIds.includes(normalizedRelativeId)
  const canSaveDraft = isValidRelativeId(state.draft.relativeId) && !duplicateDraft && !duplicatePost
  const insertMarkdown = (text: string) => setState({ ...state, insertRequest: { id: Date.now(), text } })
  const replaceMarkdownPath = (oldPath: string, newPath: string) => updateDraft({ markdown: state.draft.markdown.split(oldPath).join(newPath) })
  const resolveResourceUrl = (src: string) =>
    resolveMarkdownResourceUrl({
      src,
      relativeId: state.draft.relativeId,
      publicConfig: state.publicConfig,
      assets: state.assets,
      assetObjectUrls: state.assetObjectUrls,
    })

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
        writeEditorSnapshot(`draft:${draft.id}`, draft.markdown)
        setState({ ...state, draft, saving: false, message: t('drafts.saved'), assets: state.assets.map((asset) => ({ ...asset, draftId: draft.id })) })
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

  const syncIndex = (commitSha: string, deploy: DeployRecord) => {
    void sendJson('/index/sync-online', 'POST')
      .then(() => setState((current) => (current.status === 'ready' ? { ...current, deploy, indexSynced: true, message: `${t('drafts.indexSynced')}: ${commitSha}` } : current)))
      .catch((error: unknown) => setState((current) => (current.status === 'ready' ? { ...current, deploy, message: error instanceof Error ? error.message : 'Unknown error' } : current)))
  }

  const startDeployPolling = (commitSha: string, attempt = 0) => {
    window.clearTimeout(pollTimer.current)
    pollTimer.current = window.setTimeout(() => {
      void getJson<DeployStatusResponse>(`/deploy/status?commitSha=${encodeURIComponent(commitSha)}`)
        .then((data) => {
          const deploy = data.deploy
          const shouldContinue = attempt < 20 && (deploy.status === 'queued' || deploy.status === 'in_progress')
          setState((current) => (current.status === 'ready' ? { ...current, deploy, message: shouldContinue ? t('drafts.deployTracking') : current.message } : current))
          if (deploy.status === 'success') syncIndex(commitSha, deploy)
          else if (shouldContinue) startDeployPolling(commitSha, attempt + 1)
        })
    }, attempt === 0 ? 3000 : 8000)
  }

  const publish = () => {
    if (!state.draft.id || !canSaveDraft) return
    setState({ ...state, publishing: true })
    void sendJson<PublishDraftResponse>('/drafts/publish', 'POST', { draftId: state.draft.id })
      .then((response) => {
        deleteEditorSnapshot(`draft:${state.draft.id}`)
        setState({
          ...state,
          publishing: false,
          assets: [],
          message: `${t('drafts.published')}: ${response.commitSha}`,
          publishCommitSha: response.commitSha,
          deploy: { id: response.commitSha, status: 'queued', commitSha: response.commitSha },
          indexSynced: false,
        })
        startDeployPolling(response.commitSha)
      })
      .catch((error: unknown) => setState({ ...state, publishing: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  const panelTone =
    state.deploy?.status === 'failed'
      ? localStyles.statusPanelError
      : state.deploy?.status === 'success' || state.indexSynced
        ? localStyles.statusPanelSuccess
        : ''
  const showStatusPanel = Boolean(state.message || state.publishCommitSha || state.deploy || state.indexSynced)

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{state.draft.id ? state.draft.relativeId : t('drafts.newDraft')}</Title1>
        <Body1>{t('drafts.description')}</Body1>
      </header>
      <section className={styles.card}>
        <div className={styles.row}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={save} disabled={!canSaveDraft || state.saving}>
            {state.saving ? '保存中...' : t('drafts.saveDraft')}
          </Button>
          <Button icon={<RocketRegular />} onClick={publish} disabled={!state.draft.id || !canSaveDraft || state.publishing}>
            {state.publishing ? '发布中...' : t('drafts.publishDraft')}
          </Button>
          <Button appearance="primary" className={localStyles.dangerPrimaryButton} icon={<DeleteRegular />} onClick={remove} disabled={!state.draft.id}>
            {t('drafts.deleteDraft')}
          </Button>
          <ChangeIdNote />
        </div>
        {showStatusPanel ? (
          <section className={`${localStyles.statusPanel} ${panelTone}`}>
            <div className={localStyles.statusPanelHeader}>
              <Text weight="semibold">发布与部署状态</Text>
              {state.deploy ? (
                <StatusBadge status={state.deploy.status === 'success' ? 'success' : state.deploy.status === 'failed' ? 'danger' : 'informative'}>
                  {state.deploy.status}
                </StatusBadge>
              ) : null}
            </div>
            {state.message ? <Text>{state.message}</Text> : null}
            <div className={localStyles.statusMeta}>
              {state.publishCommitSha ? <Text size={200}>{t('deploy.commit')}: {state.publishCommitSha}</Text> : null}
              {state.indexSynced ? <Text size={200}>{t('drafts.indexSynced')}</Text> : null}
            </div>
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
          relativeId={state.draft.relativeId}
          draftId={state.draft.id}
          assets={state.assets}
          sourceAssets={state.sourceAssets}
          onAssetsChange={(assets) => setState({ ...state, assets })}
          onInsertMarkdown={insertMarkdown}
          onMarkdownPathReplace={replaceMarkdownPath}
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
            onInsertConsumed={(id) => state.insertRequest?.id === id && setState({ ...state, insertRequest: undefined })}
          />
        </Field>
      </section>
    </section>
  )
}

function ChangeIdNote() {
  return <Text>草稿文章 ID 可直接修改；保存时会同步更新 Markdown 图片路径，并迁移该草稿的 R2 暂存图片目录。</Text>
}
