import { createBrowserRouter } from 'react-router'
import { AppShell } from './app/AppShell'
import { AuthGate } from './app/AuthGate'
import { SetupGate } from './app/SetupGate'
import { DashboardPage } from './pages/DashboardPage'
import { DeployPage } from './pages/DeployPage'
import { CachePage } from './pages/CachePage'
import { DraftEditorPage } from './pages/DraftEditorPage'
import { DraftsPage } from './pages/DraftsPage'
import { PostsPage } from './pages/PostsPage'
import { SourcePostEditorPage } from './pages/SourcePostEditorPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { AppErrorPage } from './pages/AppErrorPage'

function getRouterBasename() {
  const pathname = window.location.pathname
  return pathname === '/admin' || pathname.startsWith('/admin/') ? '/admin' : '/'
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <AppErrorPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <AppErrorPage />,
    children: [
      {
        element: <SetupGate />,
        children: [
          {
            element: <AuthGate />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'posts', element: <PostsPage /> },
              { path: 'posts/edit', element: <SourcePostEditorPage /> },
              { path: 'drafts', element: <DraftsPage /> },
              { path: 'drafts/edit', element: <DraftEditorPage /> },
              { path: 'cache', element: <CachePage /> },
              { path: 'deploy', element: <DeployPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
], {
  basename: getRouterBasename(),
})
