import {
  Body1,
  Button,
  Field,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  Title1,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { DeleteRegular, RocketRegular, SaveRegular } from '@fluentui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { ArticleMarkdownWorkspace } from '../components/ArticleMarkdownWorkspace'
import { MarkdownAssetPanel } from '../components/MarkdownAssetPanel'
import { StatusBadge } from '../components/StatusBadge'
import { getJson, sendJson } from '../lib/apiClient'
import { resolveMarkdownResourceUrl } from '../lib/markdownResource'
import type { PublicConfigResponse } from '../shared/apiTypes'
import type { DraftAsset, DraftAssetListResponse } from '../shared/assetTypes'
import type { DeployRecord, DeployStatusResponse } from '../shared/deployTypes'
import type { DraftListResponse, DraftRecord, PublishDraftResponse } from '../shared/draftTypes'
import { extractFrontMatterTitle } from '../shared/frontMatter'
import type { PostTreeResponse } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

const useDraftStyles = makeStyles({
  draftList: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
  draftItem: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  draftMeta: {
    display: 'grid',
    justifyItems: 'start',
    minWidth: 0,
    width: '100%',
    textAlign: 'left',
  },
  draftOpenButton: {
    justifyContent: 'flex-start',
    minWidth: 0,
    width: '100%',
    textAlign: 'left',
  },
  dangerButton: {
    color: tokens.colorPaletteRedForeground1,
    ':hover': {
      color: tokens.colorPaletteRedForeground1,
      backgroundColor: tokens.colorPaletteRedBackground1,
    },
  },
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
    maxWidth: '280px',
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
})

type DraftsState =
  | { status: 'loading' }
  | {
      status: 'ready'
      drafts: DraftRecord[]
      editing: DraftRecord
      assets: DraftAsset[]
      postRelativeIds: string[]
      postIndexLoaded: boolean
      publicConfig?: PublicConfigResponse
      message?: string
      publishCommitSha?: string
      deploy?: DeployRecord
      indexSynced?: boolean
    }
  | { status: 'error'; message: string }

const emptyDraft = (): DraftRecord => ({
  id: '',
  relativeId: '',
  title: '',
  markdown: '---\ntitle: \ndate: \ntags:\n---\n\n',
  updatedAt: new Date().toISOString(),
})

const normalizeRelativeId = (relativeId: string) =>
  relativeId.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')

const isValidRelativeId = (relativeId: string) => {
  const normalized = normalizeRelativeId(relativeId)
  if (!normalized) return false
  if (normalized.startsWith('.') || normalized.includes('..')) return false
  if (normalized.split('/').some((part) => !part || part === '.' || part === '..' || part === '.git')) return false
  return /^[a-zA-Z0-9][a-zA-Z0-9/_-]*[a-zA-Z0-9_-]$/.test(normalized)
}

export function DraftsPage() {
  const styles = usePageStyles()
  const draftStyles = useDraftStyles()
  const { t } = useTranslation()
  const [state, setState] = useState<DraftsState>({ status: 'loading' })
  const [assetObjectUrls, setAssetObjectUrls] = useState<Record<string, string>>({})
  const pollTimer = useRef<number | undefined>(undefined)

  const load = () => {
    setState({ status: 'loading' })
    void getJson<DraftListResponse>('/drafts')
      .then(({ drafts }) => {
        const editing = drafts[0] ?? emptyDraft()
        setState({ status: 'ready', drafts, editing, assets: [], postRelativeIds: [], postIndexLoaded: false })
        void getJson<PostTreeResponse>('/posts/tree')
          .then((index) =>
            setState((current) =>
              current.status === 'ready'
                ? { ...current, postRelativeIds: index.posts.map((post) => post.relativeId), postIndexLoaded: true }
                : current,
            ),
          )
          .catch((error: unknown) =>
            setState((current) =>
              current.status === 'ready'
                ? { ...current, message: error instanceof Error ? error.message : 'Unknown error', postIndexLoaded: true }
                : current,
            ),
          )
        void getJson<PublicConfigResponse>('/config/public').then((publicConfig) =>
          setState((current) => (current.status === 'ready' ? { ...current, publicConfig } : current)),
        )
        if (editing.id) {
          void getJson<DraftAssetListResponse>(`/assets?draftId=${encodeURIComponent(editing.id)}&relativeId=${encodeURIComponent(editing.relativeId)}`)
            .then((response) => setState((current) => (current.status === 'ready' ? { ...current, assets: response.manifest.assets } : current)))
        }
      })
      .catch((error: unknown) =>
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  const updateEditing = (patch: Partial<DraftRecord>) => {
    if (state.status !== 'ready') return
    setState({ ...state, editing: { ...state.editing, ...patch } })
  }

  const openDraft = (draft: DraftRecord) => {
    if (state.status !== 'ready') return
    setState({ ...state, editing: draft, assets: [] })
    void getJson<DraftAssetListResponse>(`/assets?draftId=${encodeURIComponent(draft.id)}&relativeId=${encodeURIComponent(draft.relativeId)}`)
      .then((response) => setState({ ...state, editing: draft, assets: response.manifest.assets }))
  }

  const save = () => {
    if (state.status !== 'ready') return
    const normalizedRelativeId = normalizeRelativeId(state.editing.relativeId)
    const duplicateDraft = state.drafts.some((draft) => draft.id !== state.editing.id && draft.relativeId === normalizedRelativeId)
    const duplicatePost = !state.editing.id && state.postRelativeIds.includes(normalizedRelativeId)
    if (!isValidRelativeId(state.editing.relativeId) || duplicateDraft || duplicatePost) {
      setState({
        ...state,
        message: !isValidRelativeId(state.editing.relativeId)
          ? t('drafts.relativeIdRequired')
          : duplicateDraft
            ? t('drafts.relativeIdDuplicateDraft')
            : t('drafts.relativeIdDuplicatePost'),
      })
      return
    }
    const method = state.editing.id ? 'PUT' : 'POST'
    const path = state.editing.id ? `/drafts/${encodeURIComponent(state.editing.id)}` : '/drafts'
    void sendJson<DraftRecord>(path, method, state.editing)
      .then((draft) => {
        const drafts = [draft, ...state.drafts.filter((item) => item.id !== draft.id)]
        setState({ ...state, drafts, editing: draft, assets: state.assets.map((asset) => ({ ...asset, draftId: draft.id })), message: t('drafts.saved') })
      })
      .catch((error: unknown) =>
        setState({ ...state, message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  const remove = () => {
    if (state.status !== 'ready' || !state.editing.id) return
    removeDraft(state.editing)
  }

  const removeDraft = (draft: DraftRecord) => {
    if (state.status !== 'ready' || !draft.id) return
    void sendJson<{ deleted: boolean }>(`/drafts/${encodeURIComponent(draft.id)}`, 'DELETE').then(() => {
      const drafts = state.drafts.filter((item) => item.id !== draft.id)
      const wasEditing = state.editing.id === draft.id
      setState({ ...state, drafts, editing: wasEditing ? drafts[0] ?? emptyDraft() : state.editing, assets: wasEditing ? [] : state.assets })
    })
  }

  const publish = () => {
    if (state.status !== 'ready' || !state.editing.id) return
    if (!isValidRelativeId(state.editing.relativeId)) {
      setState({ ...state, message: t('drafts.relativeIdRequired') })
      return
    }
    void sendJson<PublishDraftResponse>('/drafts/publish', 'POST', {
      draftId: state.editing.id,
    }).then((response) => {
      const drafts = state.drafts.filter((item) => item.id !== state.editing.id)
      setState({
        ...state,
        drafts,
        editing: drafts[0] ?? emptyDraft(),
        assets: [],
        message: `${t('drafts.published')}: ${response.commitSha}`,
        publishCommitSha: response.commitSha,
        deploy: {
          id: response.commitSha,
          status: 'queued',
          commitSha: response.commitSha,
        },
        indexSynced: false,
      })
      startDeployPolling(response.commitSha)
    })
  }

  const syncIndex = (commitSha: string, deploy: DeployRecord) => {
    void sendJson<PostTreeResponse>('/index/sync-online', 'POST')
      .then(() => {
        setState((current) => {
          if (current.status !== 'ready' || current.publishCommitSha !== commitSha) return current
          return {
            ...current,
            deploy,
            indexSynced: true,
            message: `${t('drafts.indexSynced')}: ${commitSha}`,
          }
        })
      })
      .catch((error: unknown) => {
        setState((current) => {
          if (current.status !== 'ready' || current.publishCommitSha !== commitSha) return current
          return {
            ...current,
            deploy,
            message: error instanceof Error ? error.message : 'Unknown error',
          }
        })
      })
  }

  const startDeployPolling = (commitSha: string, attempt = 0) => {
    window.clearTimeout(pollTimer.current)
    pollTimer.current = window.setTimeout(() => {
      void getJson<DeployStatusResponse>(`/deploy/status?commitSha=${encodeURIComponent(commitSha)}`)
        .then((data) => {
          const deploy = data.deploy
          const shouldContinue = attempt < 20 && (deploy.status === 'queued' || deploy.status === 'in_progress')
          setState((current) => {
            if (current.status !== 'ready' || current.publishCommitSha !== commitSha) return current
            return {
              ...current,
              deploy,
              message: shouldContinue ? t('drafts.deployTracking') : current.message,
            }
          })

          if (deploy.status === 'success') {
            syncIndex(commitSha, deploy)
            return
          }

          if (shouldContinue) startDeployPolling(commitSha, attempt + 1)
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown error'
          setState((current) => {
            if (current.status !== 'ready' || current.publishCommitSha !== commitSha) return current
            return { ...current, message }
          })
        })
    }, attempt === 0 ? 3000 : 8000)
  }

  const insertMarkdown = (markdown: string) => {
    if (state.status !== 'ready') return
    const current = state.editing.markdown
    updateEditing({ markdown: `${current}${current.endsWith('\n') ? '' : '\n'}${markdown}\n` })
  }

  const resolveResourceUrl = (src: string) => {
    if (state.status !== 'ready') return src
    return resolveMarkdownResourceUrl({
      src,
      relativeId: state.editing.relativeId,
      publicConfig: state.publicConfig,
      assets: state.assets,
      assetObjectUrls,
    })
  }

  useEffect(() => {
    load()
    return () => window.clearTimeout(pollTimer.current)
  }, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />
  const relativeIdDirty = state.editing.relativeId.trim().length > 0
  const relativeIdValid = isValidRelativeId(state.editing.relativeId)
  const normalizedRelativeId = normalizeRelativeId(state.editing.relativeId)
  const duplicateDraft = state.drafts.some((draft) => draft.id !== state.editing.id && draft.relativeId === normalizedRelativeId)
  const duplicatePost = !state.editing.id && state.postRelativeIds.includes(normalizedRelativeId)
  const canSaveDraft = state.postIndexLoaded && relativeIdValid && !duplicateDraft && !duplicatePost

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('drafts.title')}</Title1>
        <Body1>{t('drafts.description')}</Body1>
      </header>
      <section className={styles.card}>
        <div className={styles.row}>
          <Title3>{t('drafts.draftList')}</Title3>
          <Button onClick={() => state.status === 'ready' && setState({ ...state, editing: emptyDraft(), assets: [] })}>{t('drafts.newDraft')}</Button>
        </div>
        <ul className={draftStyles.draftList}>
          {state.drafts.map((draft) => (
            <li className={draftStyles.draftItem} key={draft.id}>
              <Button appearance="subtle" className={draftStyles.draftOpenButton} onClick={() => openDraft(draft)}>
                <span className={draftStyles.draftMeta}>
                  <Text truncate>{extractFrontMatterTitle(draft.markdown) || draft.relativeId || t('dashboard.untitledDraft')}</Text>
                  <Text size={200} truncate>{draft.relativeId || '-'}</Text>
                </span>
              </Button>
              <DeleteDraftPopover
                disabled={!draft.id}
                onConfirm={() => removeDraft(draft)}
              />
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.card}>
        <div className={styles.row}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={save} disabled={!canSaveDraft}>
            {t('drafts.saveDraft')}
          </Button>
          <Button icon={<RocketRegular />} onClick={publish} disabled={!state.editing.id || !canSaveDraft}>
            {t('drafts.publishDraft')}
          </Button>
          <DeleteDraftPopover disabled={!state.editing.id} onConfirm={remove} />
        </div>
        {state.message ? <Text>{state.message}</Text> : null}
        {state.publishCommitSha ? <Text>{t('deploy.commit')}: {state.publishCommitSha}</Text> : null}
        {state.deploy ? (
          <StatusBadge status={state.deploy.status === 'success' ? 'success' : state.deploy.status === 'failed' ? 'danger' : 'informative'}>
            {state.deploy.status}
          </StatusBadge>
        ) : null}
        {state.indexSynced ? <Text>{t('drafts.indexSynced')}</Text> : null}
        <MarkdownAssetPanel
          relativeId={state.editing.relativeId}
          draftId={state.editing.id}
          assets={state.assets}
          onAssetsChange={(assets) => setState({ ...state, assets })}
          onInsertMarkdown={insertMarkdown}
        />
        <Field
          label={t('drafts.relativeIdLabel')}
          validationState={(relativeIdDirty && !relativeIdValid) || duplicateDraft || duplicatePost ? 'error' : undefined}
          validationMessage={
            relativeIdDirty && !relativeIdValid
              ? t('drafts.relativeIdRequired')
              : duplicateDraft
                ? t('drafts.relativeIdDuplicateDraft')
                : duplicatePost
                  ? t('drafts.relativeIdDuplicatePost')
                  : undefined
          }
        >
          <Input
            value={state.editing.relativeId}
            onChange={(_, data) => updateEditing({ relativeId: data.value })}
            placeholder="ap-csa/00-about-ap-csa"
          />
        </Field>
        <Field label={t('drafts.markdownLabel')}>
          <ArticleMarkdownWorkspace
            markdown={state.editing.markdown}
            onChange={(markdown) => updateEditing({ markdown })}
            resolveResourceUrl={resolveResourceUrl}
            assets={state.assets}
            onAssetObjectUrlsChange={setAssetObjectUrls}
          />
        </Field>
      </section>
    </section>
  )
}

type DeleteDraftPopoverProps = {
  disabled?: boolean
  onConfirm: () => void
}

function DeleteDraftPopover({ disabled, onConfirm }: DeleteDraftPopoverProps) {
  const { t } = useTranslation()
  const draftStyles = useDraftStyles()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="primary" className={draftStyles.dangerPrimaryButton} icon={<DeleteRegular />} disabled={disabled}>
          {t('drafts.deleteDraft')}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={draftStyles.confirmSurface}>
        <Text weight="semibold">{t('drafts.confirmDeleteTitle')}</Text>
        <Text>{t('drafts.confirmDeleteDescription')}</Text>
        <div className={draftStyles.confirmActions}>
          <Button appearance="secondary" onClick={() => setOpen(false)}>
            {t('actions.close')}
          </Button>
          <Button
            appearance="primary"
            className={draftStyles.dangerPrimaryButton}
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
