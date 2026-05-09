import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from './app/AppShell'
import { AuthGate } from './app/AuthGate'
import { SetupGate } from './app/SetupGate'
import { DashboardPage } from './pages/DashboardPage'
import { DeployPage } from './pages/DeployPage'
import { CachePage } from './pages/CachePage'
import { CustomizeFileEditorPage } from './pages/CustomizeFileEditorPage'
import { CustomizeHomePage } from './pages/CustomizeHomePage'
import { CustomizePanelPage } from './pages/CustomizePanelPage'
import { DraftEditorPage } from './pages/DraftEditorPage'
import { DraftsPage } from './pages/DraftsPage'
import { PostsPage } from './pages/PostsPage'
import { SourcePostEditorPage } from './pages/SourcePostEditorPage'
import { SettingsPage } from './pages/SettingsPage'
import { LoginPage } from './pages/LoginPage'
import { AppErrorPage } from './pages/AppErrorPage'
import { NotFoundPage } from './pages/NotFoundPage'

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
              { path: 'hexo-settings', element: <CustomizeHomePage scope="hexo" /> },
              { path: 'theme-settings', element: <CustomizeHomePage scope="theme" /> },
              { path: 'hexo-settings/panel/:panelId', element: <CustomizePanelPage /> },
              { path: 'theme-settings/panel/:panelId', element: <CustomizePanelPage /> },
              { path: 'hexo-settings/file/:fileId', element: <CustomizeFileEditorPage /> },
              { path: 'theme-settings/file/:fileId', element: <CustomizeFileEditorPage /> },
              { path: 'customize', element: <Navigate to="/hexo-settings" replace /> },
              { path: 'customize/panel/:panelId', element: <CustomizePanelPage /> },
              { path: 'customize/file/:fileId', element: <CustomizeFileEditorPage /> },
              { path: 'deploy', element: <DeployPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
