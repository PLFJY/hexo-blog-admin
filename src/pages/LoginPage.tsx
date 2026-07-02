import { Button, Field, Input, Text, Title1, makeStyles, mergeClasses, tokens } from '@fluentui/react-components'
import { LockClosedRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { LanguageSwitcher } from '../app/LanguageSwitcher'
import { ThemeSwitcher } from '../app/ThemeSwitcher'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { PressRevealPasswordInput } from '../components/PressRevealPasswordInput'
import { getJson, sendJson } from '../lib/apiClient'
import { safeRemoveLocalStorage } from '../lib/storage'
import type { SetupStatus } from '../shared/apiTypes'
import { SetupRequiredPage } from './SetupRequiredPage'

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: tokens.spacingHorizontalXXL,
    backgroundImage:
      'linear-gradient(var(--login-background-overlay), var(--login-background-overlay)), url("https://t.alcy.cc/ycy")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
    '@media (max-width: 480px)': {
      padding: tokens.spacingHorizontalM,
    },
  },
  toolbar: {
    position: 'fixed',
    top: tokens.spacingVerticalM,
    right: tokens.spacingHorizontalM,
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    padding: tokens.spacingVerticalXS,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8,
  },
  panel: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXXL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow64,
    transition: 'width 0.36s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.36s cubic-bezier(0.4, 0, 0.2, 1)',
    '@media (max-width: 480px)': {
      padding: tokens.spacingVerticalXL,
    },
  },
  loginPanel: {
    width: 'min(420px, 100%)',
    maxHeight: '520px',
  },
  setupPanel: {
    width: 'min(1120px, 100%)',
    maxHeight: 'min(820px, calc(100vh - 48px))',
    overflow: 'auto',
    '@media (max-width: 720px)': {
      maxHeight: 'calc(100vh - 32px)',
    },
  },
  heading: {
    display: 'grid',
    gap: tokens.spacingVerticalXS,
    textAlign: 'center',
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
  },
  form: {
    display: 'grid',
    gap: tokens.spacingVerticalL,
  },
})

type LoginPageProps = {
  onLoggedIn?: () => void
}

type SetupState =
  | { status: 'loading' }
  | { status: 'ready'; setup: SetupStatus }
  | { status: 'error'; message: string }

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const styles = useStyles()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [setupState, setSetupState] = useState<SetupState>({ status: 'loading' })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const refreshSetup = async (options?: { commit?: boolean }) => {
    const setup = await getJson<SetupStatus>('/setup/status')
    safeRemoveLocalStorage('setup-login-transition')
    if (options?.commit !== false) setSetupState({ status: 'ready', setup })
    return setup
  }

  useEffect(() => {
    queueMicrotask(() => {
      void refreshSetup().catch((error: unknown) => {
        setSetupState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' })
      })
    })
  }, [])

  const login = () => {
    setError('')
    void sendJson<{ authenticated: boolean }>('/auth/login', 'POST', { username, password })
      .then(() => {
        onLoggedIn?.()
        navigate('/')
      })
      .catch(() => setError(t('auth.invalidPassword')))
  }

  if (setupState.status === 'loading') return <LoadingState />
  if (setupState.status === 'error') {
    return <ErrorState message={setupState.message} onRetry={() => void refreshSetup()} />
  }

  const configured = setupState.setup.configured

  return (
    <main className={styles.root}>
      <div className={styles.toolbar}>
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
      <section className={mergeClasses(styles.panel, configured ? styles.loginPanel : styles.setupPanel)}>
        {configured ? (
          <>
            <header className={styles.heading}>
              <Title1>{t('app.name')}</Title1>
              <Text className={styles.subtitle}>{t('app.subtitle')}</Text>
            </header>
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault()
                login()
              }}
            >
              <Field label={t('auth.username')}>
                <Input
                  value={username}
                  onChange={(_, data) => setUsername(data.value)}
                  autoComplete="username"
                  autoFocus
                />
              </Field>
              <Field label={t('auth.password')} validationState={error ? 'error' : undefined} validationMessage={error}>
                <PressRevealPasswordInput
                  value={password}
                  onChange={(_, data) => setPassword(data.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    login()
                  }}
                  autoComplete="current-password"
                />
              </Field>
              <Button appearance="primary" icon={<LockClosedRegular />} type="submit">
                {t('auth.login')}
              </Button>
            </form>
          </>
        ) : (
          <SetupRequiredPage setup={setupState.setup} onRefresh={refreshSetup} embedded />
        )}
      </section>
    </main>
  )
}
