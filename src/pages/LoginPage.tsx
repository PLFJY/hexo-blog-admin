import { Button, Field, Input, Text, Title1, makeStyles, mergeClasses, tokens } from '@fluentui/react-components'
import { LockClosedRegular } from '@fluentui/react-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { LanguageSwitcher } from '../app/LanguageSwitcher'
import { ThemeSwitcher } from '../app/ThemeSwitcher'
import { sendJson } from '../lib/apiClient'
import { safeGetLocalStorage, safeRemoveLocalStorage } from '../lib/storage'

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
    width: 'min(420px, 100%)',
    display: 'grid',
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXXL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow64,
    '@media (max-width: 480px)': {
      padding: tokens.spacingVerticalXL,
    },
  },
  panelFromSetup: {
    animationName: {
      from: { opacity: 0, transform: 'scale(0.72) translateY(12px)' },
      to: { opacity: 1, transform: 'scale(1) translateY(0)' },
    },
    animationDuration: '0.38s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    animationFillMode: 'both',
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

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const styles = useStyles()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fromSetup] = useState(() => {
    const enabled = safeGetLocalStorage('setup-login-transition') === '1'
    if (enabled) safeRemoveLocalStorage('setup-login-transition')
    return enabled
  })

  const login = () => {
    setError('')
    void sendJson<{ authenticated: boolean }>('/auth/login', 'POST', { username, password })
      .then(() => {
        onLoggedIn?.()
        navigate('/')
      })
      .catch(() => setError(t('auth.invalidPassword')))
  }

  return (
    <main className={styles.root}>
      <div className={styles.toolbar}>
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
      <section className={fromSetup ? mergeClasses(styles.panel, styles.panelFromSetup) : styles.panel}>
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
            <Input
              type="password"
              value={password}
              onChange={(_, data) => setPassword(data.value)}
              autoComplete="current-password"
            />
          </Field>
          <Button appearance="primary" icon={<LockClosedRegular />} type="submit">
            {t('auth.login')}
          </Button>
        </form>
      </section>
    </main>
  )
}
