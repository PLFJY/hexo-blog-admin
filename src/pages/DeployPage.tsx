import { Body1, Button, Field, Input, Link, Text, Title1, Title3 } from '@fluentui/react-components'
import { RocketRegular } from '@fluentui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { getJson, sendJson } from '../lib/apiClient'
import type { DeployLatestResponse, DeployStatusResponse, DispatchDeployResponse } from '../shared/deployTypes'
import { usePageStyles } from './pageStyles'

type DeployState =
  | { status: 'loading' }
  | { status: 'ready'; data: DeployLatestResponse; queried?: DeployStatusResponse; commitSha: string; message?: string }
  | { status: 'error'; message: string }

export function DeployPage() {
  const styles = usePageStyles()
  const { t } = useTranslation()
  const [state, setState] = useState<DeployState>({ status: 'loading' })
  const pollTimer = useRef<number | undefined>(undefined)

  const load = (message?: string) =>
    getJson<DeployLatestResponse>('/deploy/latest')
      .then((data) => setState({ status: 'ready', data, commitSha: '', message }))
      .catch((error: unknown) =>
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      )

  const startPolling = (attempt = 0) => {
    window.clearTimeout(pollTimer.current)
    pollTimer.current = window.setTimeout(() => {
      void getJson<DeployLatestResponse>('/deploy/latest').then((data) => {
        const shouldContinue =
          attempt < 8 && (data.deploy.status === 'queued' || data.deploy.status === 'in_progress' || data.deploy.status === 'idle')
        setState((current) => ({
          status: 'ready',
          data,
          commitSha: current.status === 'ready' ? current.commitSha : '',
          queried: current.status === 'ready' ? current.queried : undefined,
          message: shouldContinue ? t('deploy.polling') : undefined,
        }))
        if (shouldContinue) startPolling(attempt + 1)
      })
    }, attempt === 0 ? 3000 : 8000)
  }

  const dispatch = () => {
    if (state.status !== 'ready') return
    void sendJson<DispatchDeployResponse>('/deploy/dispatch', 'POST', {}).then(() =>
      {
        setState({ ...state, message: t('deploy.queued') })
        startPolling()
      },
    )
  }

  const queryCommit = () => {
    if (state.status !== 'ready' || !state.commitSha.trim()) return
    const commitSha = state.commitSha.trim()
    void getJson<DeployStatusResponse>(`/deploy/status?commitSha=${encodeURIComponent(commitSha)}`)
      .then((queried) => setState({ ...state, queried, message: undefined }))
      .catch((error: unknown) =>
        setState({ ...state, message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  useEffect(() => {
    void load()
    return () => window.clearTimeout(pollTimer.current)
  }, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={() => void load()} />

  const deploy = state.data.deploy
  const queriedDeploy = state.queried?.deploy

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('deploy.title')}</Title1>
        <Body1>{t('deploy.description')}</Body1>
      </header>
      <section className={styles.card}>
        <div className={styles.row}>
          <Title3>{t('deploy.latest')}</Title3>
          <StatusBadge status={deploy.status === 'success' ? 'success' : deploy.status === 'failed' ? 'danger' : 'informative'}>
            {deploy.status}
          </StatusBadge>
        </div>
        {state.message ? <Text>{state.message}</Text> : null}
        <Text>{t('deploy.commit')}: {deploy.commitSha ?? '-'}</Text>
        {deploy.workflowRunUrl ? (
          <Link href={deploy.workflowRunUrl} target="_blank" rel="noreferrer">
            {t('deploy.run')}
          </Link>
        ) : null}
        <Button appearance="primary" icon={<RocketRegular />} onClick={dispatch}>
          {t('deploy.dispatch')}
        </Button>
      </section>
      <section className={styles.card}>
        <Title3>{t('deploy.queryByCommit')}</Title3>
        <Field label={t('deploy.commitShaLabel')}>
          <Input
            value={state.commitSha}
            onChange={(_, data) => setState({ ...state, commitSha: data.value })}
            placeholder="abcdef123456"
          />
        </Field>
        <Button onClick={queryCommit}>{t('deploy.queryByCommit')}</Button>
        {queriedDeploy ? (
          <>
            <StatusBadge status={queriedDeploy.status === 'success' ? 'success' : queriedDeploy.status === 'failed' ? 'danger' : 'informative'}>
              {queriedDeploy.status}
            </StatusBadge>
            <Text>{t('deploy.commit')}: {queriedDeploy.commitSha}</Text>
            {queriedDeploy.workflowRunUrl ? (
              <Link href={queriedDeploy.workflowRunUrl} target="_blank" rel="noreferrer">
                {t('deploy.run')}
              </Link>
            ) : null}
          </>
        ) : null}
      </section>
    </section>
  )
}
