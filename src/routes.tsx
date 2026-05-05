import { createBrowserRouter } from 'react-router'
import { AppShell } from './app/AppShell'
import { AuthGate } from './app/AuthGate'
import { SetupGate } from './app/SetupGate'
import { DashboardPage } from './pages/DashboardPage'
import { DeployPage } from './pages/DeployPage'
import { DraftsPage } from './pages/DraftsPage'
import { PostsPage } from './pages/PostsPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        element: <SetupGate />,
        children: [
          {
            element: <AuthGate />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'posts', element: <PostsPage /> },
              { path: 'drafts', element: <DraftsPage /> },
              { path: 'deploy', element: <DeployPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
])
