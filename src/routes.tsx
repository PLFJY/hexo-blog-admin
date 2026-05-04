import { createBrowserRouter } from 'react-router'
import { AppShell } from './app/AppShell'
import { SetupGate } from './app/SetupGate'
import { DashboardPage } from './pages/DashboardPage'
import { DeployPage } from './pages/DeployPage'
import { DraftsPage } from './pages/DraftsPage'
import { PostsPage } from './pages/PostsPage'
import { SettingsPage } from './pages/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <SetupGate />,
    children: [
      {
        element: <AppShell />,
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
])
