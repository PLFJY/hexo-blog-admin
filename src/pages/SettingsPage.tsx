import { Button, Body1, Text, Title1, Title3 } from '@fluentui/react-components'
import { ArrowClockwiseRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { ApiError, getJson } from '../lib/apiClient'
import type { GitHubRepoStatus, SetupIncompleteError, SetupStatus } from '../shared/apiTypes'
import { usePageStyles } from './pageStyles'

type SettingsState =
  | { status: 'loading' }
  | { status: 'ready'; setup: SetupStatus; github: GitHubRepoStatus | SetupIncompleteError }
  | { status: 'error'; message: string }

const githubFallback = (error: unknown): GitHubRepoStatus | SetupIncompleteError => {
  if (error instanceof ApiError && typeof error.payload === 'object' && error.payload !== null) {
    const payload = error.payload as Partial<SetupIncompleteError>
    if (payload.error === 'SETUP_INCOMPLETE' && Array.isArray(payload.missing)) {
      return { error: 'SETUP_INCOMPLETE', missing: payload.missing }
    }
  }

  return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' }
}

export function SettingsPage() {
  const styles = usePageStyles()
  const { t } = useTranslation()
  const [state, setState] = useState<SettingsState>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    void Promise.all([
      getJson<SetupStatus>('/api/setup/status'),
      getJson<GitHubRepoStatus>('/api/github/repo').catch(githubFallback),
    ])
      .then(([setup, github]) => setState({ status: 'ready', setup, github }))
      .catch((error: unknown) => {
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' })
      })
  }

  useEffect(load, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  const github = state.github
  const githubConnected = 'connected' in github && github.connected

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('settings.title')}</Title1>
        <Body1>{t('settings.description')}</Body1>
        <Button appearance="secondary" icon={<ArrowClockwiseRegular />} onClick={load}>
          {t('actions.refresh')}
        </Button>
      </header>
      <section className={styles.card}>
        <Title3>{t('settings.setupStatus')}</Title3>
        <StatusBadge status={state.setup.configured ? 'success' : 'danger'}>
          {state.setup.configured ? t('setup.configured') : t('setup.incomplete')}
        </StatusBadge>
        <Text>{t('setup.missing')}</Text>
        <ul>
          {state.setup.missing.map((item) => (
            <li key={item}>
              <code>{item}</code>
            </li>
          ))}
        </ul>
        <pre className={styles.codeBlock}>
          <code>{JSON.stringify(state.setup.defaults, null, 2)}</code>
        </pre>
      </section>
      <section className={styles.card}>
        <Title3>{t('settings.githubStatus')}</Title3>
        <StatusBadge status={githubConnected ? 'success' : 'danger'}>
          {githubConnected ? t('settings.connected') : t('settings.failed')}
        </StatusBadge>
        <pre className={styles.codeBlock}>
          <code>{JSON.stringify(github, null, 2)}</code>
        </pre>
      </section>
    </section>
  )
}
