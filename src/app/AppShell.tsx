import { makeStyles, tokens } from '@fluentui/react-components'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AppHeader } from './AppHeader'
import { AppNav } from './AppNav'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  body: {
    display: 'grid',
    flexGrow: 1,
    minHeight: 0,
    height: '100%',
    transition: 'grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '@media (max-width: 720px)': {
      display: 'flex',
      flexDirection: 'column',
      height: 'auto',
      overflowY: 'auto',
    },
  },
  desktopNav: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    '@media (max-width: 720px)': {
      display: 'none',
    },
  },
  main: {
    minWidth: 0,
    flexGrow: 1,
    overflow: 'auto',
    padding: tokens.spacingHorizontalXXL,
    '@media (max-width: 720px)': {
      padding: tokens.spacingHorizontalM,
      overflowX: 'hidden',
      paddingBottom: '80px',
    },
  },
  pageContainer: {
    animationName: {
      from: { opacity: 0, transform: 'translateY(4px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    animationDuration: '0.4s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    animationFillMode: 'both',
  },
})

export function AppShell() {
  const styles = useStyles()
  const location = useLocation()
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
          <div key={location.key} className={styles.pageContainer}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
