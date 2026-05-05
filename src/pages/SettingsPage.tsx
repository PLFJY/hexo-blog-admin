import { Button, Body1, Field, Input, Text, Title1, Title3 } from '@fluentui/react-components'
import { ArrowClockwiseRegular, DeleteRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { ApiError, getJson, sendJson } from '../lib/apiClient'
import type { GitHubRepoStatus, SetupIncompleteError, SetupStatus } from '../shared/apiTypes'
import type { AuthUser, CreateUserRequest } from '../shared/authTypes'
import { usePageStyles } from './pageStyles'

type SettingsState =
  | { status: 'loading' }
  | { status: 'ready'; setup: SetupStatus; github: GitHubRepoStatus | SetupIncompleteError; users: AuthUser[] }
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
      getJson<{ users: AuthUser[] }>('/api/users'),
    ])
      .then(([setup, github, users]) => setState({ status: 'ready', setup, github, users: users.users }))
      .catch((error: unknown) => {
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' })
      })
  }

  useEffect(load, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  const github = state.github
  const githubConnected = 'connected' in github && github.connected
  const createUser = (request: CreateUserRequest) => {
    void sendJson<AuthUser>('/api/users', 'POST', request).then((user) =>
      setState({ ...state, users: [...state.users, user] }),
    )
  }
  const deleteUser = (username: string) => {
    void sendJson<{ deleted: boolean }>(`/api/users/${encodeURIComponent(username)}`, 'DELETE').then(() =>
      setState({ ...state, users: state.users.filter((user) => user.username !== username) }),
    )
  }

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
          <code>{JSON.stringify(state.setup.config, null, 2)}</code>
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
      <UserManager users={state.users} onCreate={createUser} onDelete={deleteUser} />
    </section>
  )
}

type UserManagerProps = {
  users: AuthUser[]
  onCreate: (request: CreateUserRequest) => void
  onDelete: (username: string) => void
}

function UserManager({ users, onCreate, onDelete }: UserManagerProps) {
  const styles = usePageStyles()
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <section className={styles.card}>
      <Title3>{t('auth.users')}</Title3>
      <div className={styles.row}>
        <Field label={t('auth.username')}>
          <Input value={username} onChange={(_, data) => setUsername(data.value)} />
        </Field>
        <Field label={t('auth.password')}>
          <Input type="password" value={password} onChange={(_, data) => setPassword(data.value)} />
        </Field>
        <Button
          appearance="primary"
          onClick={() => {
            onCreate({ username, password })
            setUsername('')
            setPassword('')
          }}
        >
          {t('auth.newUser')}
        </Button>
      </div>
      <ul>
        {users.map((user) => (
          <li key={user.username}>
            <div className={styles.row}>
              <Text>{user.username}</Text>
              <Text>{user.builtIn ? t('auth.builtInAdmin') : user.role}</Text>
              <Button
                appearance="subtle"
                icon={<DeleteRegular />}
                disabled={user.builtIn}
                onClick={() => onDelete(user.username)}
              >
                {t('auth.deleteUser')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
