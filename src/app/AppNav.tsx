import {
  NavDrawer,
  NavDrawerBody,
  NavDrawerHeader,
  NavItem,
  Button,
  Title2,
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
    minWidth: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    overflowX: 'hidden',
  },
  inlineDrawer: {
    height: 'calc(100vh - 64px)',
  },
  overlayDrawer: {
    height: '100vh',
  },
  header: {
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  collapseButton: {
    margin: tokens.spacingHorizontalS,
    transition: 'transform 0.2s ease',
    ':active': {
      transform: 'scale(0.95)',
    },
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
      className={`${styles.drawer} ${type === 'inline' ? styles.inlineDrawer : styles.overlayDrawer}`}
      type={type}
      open={type === 'inline' ? true : open}
      selectedValue={selectedValue(location.pathname)}
      style={type === 'inline' && collapsed ? { width: '72px' } : undefined}
      onOpenChange={(_, data: { open: boolean }) => onOpenChange?.(data.open)}
      modalProps={type === 'overlay' ? { shouldFocusFirstFocusableItem: true } : undefined}
    >
      {type === 'overlay' && (
        <NavDrawerHeader className={styles.header}>
          <Title2>Hexo Admin</Title2>
        </NavDrawerHeader>
      )}
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
