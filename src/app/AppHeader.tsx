import { Button, Text, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { ArrowExitRegular, NavigationRegular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import { sendJson } from '../lib/apiClient'
import { LanguageSwitcher } from './LanguageSwitcher'

const useStyles = makeStyles({
  root: {
    alignItems: 'center',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    minHeight: '64px',
    padding: `0 ${tokens.spacingHorizontalXXL}`,
    '@media (max-width: 720px)': {
      padding: `0 ${tokens.spacingHorizontalM}`,
    },
  },
  menuButton: {
    display: 'none',
    '@media (max-width: 720px)': {
      display: 'inline-flex',
    },
  },
  titleBlock: {
    display: 'grid',
    flexGrow: 1,
    minWidth: 0,
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
  },
})

type AppHeaderProps = {
  onOpenMenu: () => void
}

export function AppHeader({ onOpenMenu }: AppHeaderProps) {
  const styles = useStyles()
  const { t } = useTranslation()

  const logout = () => {
    void sendJson('/auth/logout', 'POST', {}).finally(() => {
      window.location.reload()
    })
  }

  return (
    <header className={styles.root}>
      <Button
        appearance="subtle"
        aria-label={t('actions.menu')}
        className={styles.menuButton}
        icon={<NavigationRegular />}
        onClick={onOpenMenu}
      />
      <div className={styles.titleBlock}>
        <Title3 truncate>{t('app.name')}</Title3>
        <Text className={styles.subtitle} size={200} truncate>
          {t('app.subtitle')}
        </Text>
      </div>
      <LanguageSwitcher />
      <Button appearance="subtle" aria-label={t('actions.logout')} icon={<ArrowExitRegular />} onClick={logout} />
    </header>
  )
}
