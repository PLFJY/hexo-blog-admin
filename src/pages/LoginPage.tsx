import { Button, Field, Input, Title1, makeStyles, tokens } from '@fluentui/react-components'
import { LockClosedRegular } from '@fluentui/react-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { sendJson } from '../lib/apiClient'

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: tokens.spacingHorizontalXXL,
    backgroundImage:
      'linear-gradient(rgba(12, 18, 31, 0.62), rgba(12, 18, 31, 0.74)), url("https://t.alcy.cc/ycy")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  panel: {
    width: 'min(420px, 100%)',
    display: 'grid',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalXXL,
    border: `1px solid rgba(255, 255, 255, 0.22)`,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: 'rgba(20, 24, 36, 0.68)',
    boxShadow: tokens.shadow64,
    backdropFilter: 'blur(20px)',
  },
  title: {
    textAlign: 'center',
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

  const login = () => {
    setError('')
    void sendJson<{ authenticated: boolean }>('/api/auth/login', 'POST', { username, password })
      .then(() => {
        onLoggedIn?.()
        navigate('/')
      })
      .catch(() => setError(t('auth.invalidPassword')))
  }

  return (
    <main className={styles.root}>
      <section className={styles.panel}>
        <Title1 className={styles.title}>{t('app.name')}</Title1>
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
          <Field label={t('auth.password')} validationMessage={error}>
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
