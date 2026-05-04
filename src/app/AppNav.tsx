import {
  NavDrawer,
  NavDrawerBody,
  NavItem,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  DocumentBulletListRegular,
  HomeRegular,
  RocketRegular,
  SettingsRegular,
  TextBulletListSquareRegular,
} from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'

const useStyles = makeStyles({
  drawer: {
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    minHeight: 'calc(100vh - 64px)',
  },
})

type AppNavProps = {
  type: 'inline' | 'overlay'
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const navItems = [
  { value: 'dashboard', path: '/', icon: <HomeRegular />, labelKey: 'nav.dashboard' },
  { value: 'posts', path: '/posts', icon: <DocumentBulletListRegular />, labelKey: 'nav.posts' },
  { value: 'drafts', path: '/drafts', icon: <TextBulletListSquareRegular />, labelKey: 'nav.drafts' },
  { value: 'deploy', path: '/deploy', icon: <RocketRegular />, labelKey: 'nav.deploy' },
  { value: 'settings', path: '/settings', icon: <SettingsRegular />, labelKey: 'nav.settings' },
] as const

const selectedValue = (pathname: string) => {
  if (pathname.startsWith('/posts')) return 'posts'
  if (pathname.startsWith('/drafts')) return 'drafts'
  if (pathname.startsWith('/deploy')) return 'deploy'
  if (pathname.startsWith('/settings')) return 'settings'
  return 'dashboard'
}

export function AppNav({ type, open, onOpenChange }: AppNavProps) {
  const styles = useStyles()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <NavDrawer
      className={styles.drawer}
      type={type}
      open={open}
      selectedValue={selectedValue(location.pathname)}
      onOpenChange={(_, data: { open: boolean }) => onOpenChange?.(data.open)}
    >
      <NavDrawerBody>
        {navItems.map((item) => (
          <NavItem
            key={item.value}
            icon={item.icon}
            value={item.value}
            onClick={() => {
              navigate(item.path)
              onOpenChange?.(false)
            }}
          >
            {t(item.labelKey)}
          </NavItem>
        ))}
      </NavDrawerBody>
    </NavDrawer>
  )
}
