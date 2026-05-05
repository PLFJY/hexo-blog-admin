import {
  NavDrawer,
  NavDrawerBody,
  NavItem,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  DocumentBulletListRegular,
  PanelLeftContractRegular,
  PanelLeftExpandRegular,
  HomeRegular,
  ImageRegular,
  RocketRegular,
  SettingsRegular,
  TextBulletListSquareRegular,
} from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'

const useStyles = makeStyles({
  drawer: {
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    height: 'calc(100vh - 64px)',
    minWidth: 0,
  },
  collapseButton: {
    margin: tokens.spacingHorizontalS,
  },
})

type AppNavProps = {
  type: 'inline' | 'overlay'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

const navItems = [
  { value: 'dashboard', path: '/', icon: <HomeRegular />, labelKey: 'nav.dashboard' },
  { value: 'posts', path: '/posts', icon: <DocumentBulletListRegular />, labelKey: 'nav.posts' },
  { value: 'drafts', path: '/drafts', icon: <TextBulletListSquareRegular />, labelKey: 'nav.drafts' },
  { value: 'cache', path: '/cache', icon: <ImageRegular />, labelKey: 'nav.cache' },
  { value: 'deploy', path: '/deploy', icon: <RocketRegular />, labelKey: 'nav.deploy' },
  { value: 'settings', path: '/settings', icon: <SettingsRegular />, labelKey: 'nav.settings' },
] as const

const selectedValue = (pathname: string) => {
  if (pathname.startsWith('/posts')) return 'posts'
  if (pathname.startsWith('/drafts')) return 'drafts'
  if (pathname.startsWith('/cache')) return 'cache'
  if (pathname.startsWith('/deploy')) return 'deploy'
  if (pathname.startsWith('/settings')) return 'settings'
  return 'dashboard'
}

export function AppNav({ type, open, onOpenChange, collapsed, onCollapsedChange }: AppNavProps) {
  const styles = useStyles()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <NavDrawer
      className={styles.drawer}
      type={type}
      open={type === 'inline' ? true : open}
      selectedValue={selectedValue(location.pathname)}
      style={type === 'inline' && collapsed ? { width: '72px' } : undefined}
      onOpenChange={(_, data: { open: boolean }) => onOpenChange?.(data.open)}
    >
      <NavDrawerBody>
        {type === 'inline' ? (
          <Button
            className={styles.collapseButton}
            appearance="subtle"
            icon={collapsed ? <PanelLeftExpandRegular /> : <PanelLeftContractRegular />}
            onClick={() => onCollapsedChange?.(!collapsed)}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
          />
        ) : null}
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
            {collapsed && type === 'inline' ? '' : t(item.labelKey)}
          </NavItem>
        ))}
      </NavDrawerBody>
    </NavDrawer>
  )
}
