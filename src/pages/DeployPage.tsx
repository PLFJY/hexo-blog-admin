import { Body1, Button, Link, Text, Title1, Title3 } from '@fluentui/react-components'
import { RocketRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { getJson, sendJson } from '../lib/apiClient'
import type { DeployLatestResponse, DispatchDeployResponse } from '../shared/deployTypes'
import { usePageStyles } from './pageStyles'

type DeployState =
  | { status: 'loading' }
  | { status: 'ready'; data: DeployLatestResponse; message?: string }
  | { status: 'error'; message: string }

export function DeployPage() {
  const styles = usePageStyles()
  const { t } = useTranslation()
  const [state, setState] = useState<DeployState>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    void getJson<DeployLatestResponse>('/api/deploy/latest')
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) =>
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  const dispatch = () => {
    if (state.status !== 'ready') return
    void sendJson<DispatchDeployResponse>('/api/deploy/dispatch', 'POST', {}).then(() =>
      setState({ ...state, message: t('deploy.queued') }),
    )
  }

  useEffect(load, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  const deploy = state.data.deploy

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
    </section>
  )
}
