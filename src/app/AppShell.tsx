import { makeStyles, tokens } from '@fluentui/react-components'
import { useState } from 'react'
import { Outlet } from 'react-router'
import { AppHeader } from './AppHeader'
import { AppNav } from './AppNav'

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    overflowX: 'hidden',
  },
  body: {
    display: 'grid',
    height: 'calc(100vh - 64px)',
    '@media (max-width: 720px)': {
      display: 'block',
      height: 'auto',
    },
  },
  desktopNav: {
    '@media (max-width: 720px)': {
      display: 'none',
    },
  },
  main: {
    minWidth: 0,
    overflow: 'auto',
    padding: tokens.spacingHorizontalXXL,
    '@media (max-width: 720px)': {
      padding: tokens.spacingHorizontalM,
    },
  },
})

export function AppShell() {
  const styles = useStyles()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(false)

  return (
    <div className={styles.root}>
      <AppHeader onOpenMenu={() => setMobileOpen(true)} />
      <AppNav type="overlay" open={mobileOpen} onOpenChange={setMobileOpen} />
      <div className={styles.body} style={{ gridTemplateColumns: navCollapsed ? '72px minmax(0, 1fr)' : '280px minmax(0, 1fr)' }}>
        <aside className={styles.desktopNav}>
          <AppNav type="inline" collapsed={navCollapsed} onCollapsedChange={setNavCollapsed} />
        </aside>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
