import { Body1, Button, Field, Input, Text, Textarea, Title1, Title3 } from '@fluentui/react-components'
import { DeleteRegular, RocketRegular, SaveRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { AssetCachePlaceholder } from '../features/assets/AssetCachePlaceholder'
import { getJson, sendJson } from '../lib/apiClient'
import type { DraftListResponse, DraftRecord, PublishDraftResponse } from '../shared/draftTypes'
import { usePageStyles } from './pageStyles'

type DraftsState =
  | { status: 'loading' }
  | { status: 'ready'; drafts: DraftRecord[]; editing: DraftRecord; message?: string }
  | { status: 'error'; message: string }

const emptyDraft = (): DraftRecord => ({
  id: '',
  relativeId: '',
  title: '',
  markdown: '---\ntitle: \ndate: \ntags:\n---\n\n',
  updatedAt: new Date().toISOString(),
})

export function DraftsPage() {
  const styles = usePageStyles()
  const { t } = useTranslation()
  const [state, setState] = useState<DraftsState>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    void getJson<DraftListResponse>('/api/drafts')
      .then(({ drafts }) => setState({ status: 'ready', drafts, editing: drafts[0] ?? emptyDraft() }))
      .catch((error: unknown) =>
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  const updateEditing = (patch: Partial<DraftRecord>) => {
    if (state.status !== 'ready') return
    setState({ ...state, editing: { ...state.editing, ...patch } })
  }

  const save = () => {
    if (state.status !== 'ready') return
    const method = state.editing.id ? 'PUT' : 'POST'
    const path = state.editing.id ? `/api/drafts/${encodeURIComponent(state.editing.id)}` : '/api/drafts'
    void sendJson<DraftRecord>(path, method, state.editing).then((draft) => {
      const drafts = [draft, ...state.drafts.filter((item) => item.id !== draft.id)]
      setState({ status: 'ready', drafts, editing: draft, message: t('drafts.saved') })
    })
  }

  const remove = () => {
    if (state.status !== 'ready' || !state.editing.id) return
    void sendJson<{ deleted: boolean }>(`/api/drafts/${encodeURIComponent(state.editing.id)}`, 'DELETE').then(() => {
      const drafts = state.drafts.filter((item) => item.id !== state.editing.id)
      setState({ status: 'ready', drafts, editing: drafts[0] ?? emptyDraft() })
    })
  }

  const publish = () => {
    if (state.status !== 'ready' || !state.editing.id) return
    void sendJson<PublishDraftResponse>('/api/drafts/publish', 'POST', {
      draftId: state.editing.id,
    }).then((response) => {
      const drafts = state.drafts.filter((item) => item.id !== state.editing.id)
      setState({
        status: 'ready',
        drafts,
        editing: drafts[0] ?? emptyDraft(),
        message: `${t('drafts.published')}: ${response.commitSha}`,
      })
    })
  }

  useEffect(load, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('drafts.title')}</Title1>
        <Body1>{t('drafts.description')}</Body1>
      </header>
      <section className={styles.card}>
        <div className={styles.row}>
          <Title3>{t('drafts.draftList')}</Title3>
          <Button onClick={() => updateEditing(emptyDraft())}>{t('drafts.newDraft')}</Button>
        </div>
        <ul>
          {state.drafts.map((draft) => (
            <li key={draft.id}>
              <Button appearance="subtle" onClick={() => updateEditing(draft)}>
                {draft.title || draft.relativeId}
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.card}>
        <div className={styles.row}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={save}>
            {t('drafts.saveDraft')}
          </Button>
          <Button icon={<RocketRegular />} onClick={publish} disabled={!state.editing.id}>
            {t('drafts.publishDraft')}
          </Button>
          <Button icon={<DeleteRegular />} onClick={remove} disabled={!state.editing.id}>
            {t('drafts.deleteDraft')}
          </Button>
        </div>
        {state.message ? <Text>{state.message}</Text> : null}
        <Field label={t('drafts.relativeIdLabel')}>
          <Input
            value={state.editing.relativeId}
            onChange={(_, data) => updateEditing({ relativeId: data.value })}
            placeholder="ap-csa/00-about-ap-csa"
          />
        </Field>
        <Field label={t('drafts.titleLabel')}>
          <Input value={state.editing.title} onChange={(_, data) => updateEditing({ title: data.value })} />
        </Field>
        <Field label={t('drafts.markdownLabel')}>
          <Textarea
            className={styles.editor}
            resize="vertical"
            value={state.editing.markdown}
            onChange={(_, data) => updateEditing({ markdown: data.value })}
          />
        </Field>
      </section>
      <AssetCachePlaceholder />
    </section>
  )
}
