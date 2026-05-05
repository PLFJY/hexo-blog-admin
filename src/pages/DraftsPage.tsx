import { Body1, Button, Field, Input, Text, Title1, Title3 } from '@fluentui/react-components'
import { DeleteRegular, RocketRegular, SaveRegular } from '@fluentui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { MarkdownAssetPanel } from '../components/MarkdownAssetPanel'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { MarkdownPreview } from '../components/MarkdownPreview'
import { StatusBadge } from '../components/StatusBadge'
import { buildApiUrl, getJson, sendJson } from '../lib/apiClient'
import type { DraftListResponse, DraftRecord, PublishDraftResponse } from '../shared/draftTypes'
import type { DraftAsset, DraftAssetListResponse } from '../shared/assetTypes'
import type { DeployRecord, DeployStatusResponse } from '../shared/deployTypes'
import type { PostTreeResponse } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

type DraftsState =
  | { status: 'loading' }
  | {
      status: 'ready'
      drafts: DraftRecord[]
      editing: DraftRecord
      assets: DraftAsset[]
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

const isValidRelativeId = (relativeId: string) => {
  const normalized = relativeId.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
  if (!normalized) return false
  if (normalized.startsWith('.') || normalized.includes('..')) return false
  if (normalized.split('/').some((part) => !part || part === '.' || part === '..' || part === '.git')) return false
  return /^[a-zA-Z0-9][a-zA-Z0-9/_-]*[a-zA-Z0-9_-]$/.test(normalized)
}

export function DraftsPage() {
  const styles = usePageStyles()
  const { t } = useTranslation()
  const [state, setState] = useState<DraftsState>({ status: 'loading' })
  const pollTimer = useRef<number | undefined>(undefined)

  const load = () => {
    setState({ status: 'loading' })
    void getJson<DraftListResponse>('/drafts')
      .then(({ drafts }) => {
        const editing = drafts[0] ?? emptyDraft()
        setState({ status: 'ready', drafts, editing, assets: [] })
        if (editing.id) {
          void getJson<DraftAssetListResponse>(`/assets?draftId=${encodeURIComponent(editing.id)}&relativeId=${encodeURIComponent(editing.relativeId)}`)
            .then((response) => setState({ status: 'ready', drafts, editing, assets: response.manifest.assets }))
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
    if (!isValidRelativeId(state.editing.relativeId)) {
      setState({ ...state, message: t('drafts.relativeIdRequired') })
      return
    }
    const method = state.editing.id ? 'PUT' : 'POST'
    const path = state.editing.id ? `/drafts/${encodeURIComponent(state.editing.id)}` : '/drafts'
    void sendJson<DraftRecord>(path, method, state.editing)
      .then((draft) => {
        const drafts = [draft, ...state.drafts.filter((item) => item.id !== draft.id)]
        setState({ status: 'ready', drafts, editing: draft, assets: state.assets.map((asset) => ({ ...asset, draftId: draft.id })), message: t('drafts.saved') })
      })
      .catch((error: unknown) =>
        setState({ ...state, message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  const remove = () => {
    if (state.status !== 'ready' || !state.editing.id) return
    void sendJson<{ deleted: boolean }>(`/drafts/${encodeURIComponent(state.editing.id)}`, 'DELETE').then(() => {
      const drafts = state.drafts.filter((item) => item.id !== state.editing.id)
      setState({ status: 'ready', drafts, editing: drafts[0] ?? emptyDraft(), assets: [] })
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
        status: 'ready',
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

  const resolveImageSrc = (src: string) => {
    const asset = state.status === 'ready' ? state.assets.find((item) => item.markdownPath === src) : undefined
    return asset ? buildApiUrl(`/assets/blob?key=${encodeURIComponent(asset.key)}`) : src
  }

  useEffect(() => {
    load()
    return () => window.clearTimeout(pollTimer.current)
  }, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />
  const relativeIdValid = isValidRelativeId(state.editing.relativeId)

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
        <ul>
          {state.drafts.map((draft) => (
            <li key={draft.id}>
              <Button appearance="subtle" onClick={() => openDraft(draft)}>
                {draft.title || draft.relativeId}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.card}>
        <div className={styles.row}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={save} disabled={!relativeIdValid}>
            {t('drafts.saveDraft')}
          </Button>
          <Button icon={<RocketRegular />} onClick={publish} disabled={!state.editing.id || !relativeIdValid}>
            {t('drafts.publishDraft')}
          </Button>
          <Button icon={<DeleteRegular />} onClick={remove} disabled={!state.editing.id}>
            {t('drafts.deleteDraft')}
          </Button>
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
        <Field label={t('drafts.relativeIdLabel')}>
          <Input
            value={state.editing.relativeId}
            onChange={(_, data) => updateEditing({ relativeId: data.value })}
            placeholder="ap-csa/00-about-ap-csa"
            validationState={relativeIdValid ? undefined : 'error'}
            validationMessage={relativeIdValid ? undefined : t('drafts.relativeIdRequired')}
          />
        </Field>
        <Field label={t('drafts.titleLabel')}>
          <Input value={state.editing.title} onChange={(_, data) => updateEditing({ title: data.value })} />
        </Field>
        <Field label={t('drafts.markdownLabel')}>
          <div className={styles.split}>
            <MarkdownEditor value={state.editing.markdown} onChange={(markdown) => updateEditing({ markdown })} />
            <section className={styles.card}>
              <Title3>{t('posts.markdownPreview')}</Title3>
              <MarkdownPreview markdown={state.editing.markdown} resolveImageSrc={resolveImageSrc} />
            </section>
          </div>
        </Field>
      </section>
    </section>
  )
}
