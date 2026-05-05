import type { HealthResponse } from '../shared/apiTypes'
import type { WorkerEnv } from './env'
import { handleAssetBlob, handleAssetCache, handleAssetRename, handleAssets } from './routes/assetRoutes'
import { handleAuthStatus, handleCreateUser, handleDeleteUser, handleListUsers, handleLogin, handleLogout } from './routes/authRoutes'
import { handlePublicConfig, handleSetupStatus } from './routes/configRoutes'
import { handleDeployStatus, handleDispatchDeploy, handleLatestDeploy } from './routes/deployRoutes'
import { handleCreateDraft, handleDraftById, handleDrafts, handlePublishDraft } from './routes/draftRoutes'
import { handleGitHubRepo } from './routes/githubRoutes'
import { handleAdminIndex, handleSyncOnlineAdminIndex } from './routes/indexRoutes'
import {
  handleDeletePostAsset,
  handleDeletePost,
  handlePostAssetBlob,
  handlePostContent,
  handlePostsTree,
  handleRenamePost,
  handleRenamePostAsset,
} from './routes/postRoutes'
import { json } from './utils/response'
import { getSetupStatus } from './utils/setup'
import { clearSessionCookie, isAuthenticated } from './utils/auth'

const health: HealthResponse = {
  ok: true,
  name: 'hexo-blog-admin',
  runtime: 'cloudflare-workers',
}

const ADMIN_BASE_PATH = '/admin'
const setupBypassPaths = new Set(['/api/health', '/api/setup/status'])
const authBypassPaths = new Set(['/api/health', '/api/setup/status', '/api/auth/status', '/api/auth/login'])

function normalizePathname(pathname: string) {
  if (pathname === ADMIN_BASE_PATH) return '/'
  if (pathname.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return pathname.slice(ADMIN_BASE_PATH.length) || '/'
  }
  return pathname
}

async function handleApiRequest(request: Request, env: WorkerEnv, pathname: string): Promise<Response> {
  if (pathname === '/api/health') return json(health)
  if (pathname === '/api/setup/status') return handleSetupStatus(env)
  if (pathname === '/api/config/public') return handlePublicConfig(env)
  if (pathname === '/api/auth/status') return handleAuthStatus(request, env)

  const setup = getSetupStatus(env)
  if (!setup.configured && !setupBypassPaths.has(pathname)) {
    return json({ error: 'SETUP_INCOMPLETE', missing: setup.missing }, { status: 503 })
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') return handleLogin(request, env)
  if (pathname === '/api/auth/logout' && request.method === 'POST') return handleLogout(request)
  if (!authBypassPaths.has(pathname) && !(await isAuthenticated(request, env))) {
    return json({ error: 'UNAUTHORIZED' }, {
      status: 401,
      headers: { 'set-cookie': clearSessionCookie(request) },
    })
  }

  if (pathname === '/api/github/repo') return handleGitHubRepo(env)
  if (pathname === '/api/users' && request.method === 'GET') return handleListUsers(env)
  if (pathname === '/api/users' && request.method === 'POST') return handleCreateUser(env, request)
  if (pathname.startsWith('/api/users/') && request.method === 'DELETE') {
    return handleDeleteUser(env, decodeURIComponent(pathname.slice('/api/users/'.length)))
  }
  if (pathname === '/api/index') return handleAdminIndex(env)
  if (pathname === '/api/posts/tree') return handlePostsTree(env)
  if (pathname === '/api/posts/content') return handlePostContent(env, request)
  if (pathname === '/api/posts/asset/blob') return handlePostAssetBlob(env, request)
  if (pathname === '/api/posts/asset/rename') return handleRenamePostAsset(env, request)
  if (pathname === '/api/posts/asset/delete') return handleDeletePostAsset(env, request)
  if (pathname === '/api/posts/rename') return handleRenamePost(env, request)
  if (pathname === '/api/posts/delete') return handleDeletePost(env, request)
  if (pathname === '/api/drafts' && request.method === 'GET') return handleDrafts(env)
  if (pathname === '/api/drafts' && request.method === 'POST') return handleCreateDraft(env, request)
  if (pathname === '/api/drafts/publish' && request.method === 'POST') return handlePublishDraft(env, request)
  if (pathname.startsWith('/api/drafts/')) {
    const id = decodeURIComponent(pathname.slice('/api/drafts/'.length))
    return handleDraftById(env, request, id)
  }
  if (pathname === '/api/assets') return handleAssets(env, request)
  if (pathname === '/api/assets/blob') return handleAssetBlob(env, request)
  if (pathname === '/api/assets/rename') return handleAssetRename(env, request)
  if (pathname === '/api/assets/cache') return handleAssetCache(env, request)
  if (pathname === '/api/deploy/latest') return handleLatestDeploy(env)
  if (pathname === '/api/deploy/status') return handleDeployStatus(env, request)
  if (pathname === '/api/deploy/dispatch' && request.method === 'POST') return handleDispatchDeploy(env, request)
  if (pathname === '/api/index/sync-online' && request.method === 'POST') return handleSyncOnlineAdminIndex(env)

  return json({ error: 'NOT_FOUND' }, { status: 404 })
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === ADMIN_BASE_PATH) {
      return Response.redirect(`${url.origin}${ADMIN_BASE_PATH}/`, 308)
    }
    const pathname = normalizePathname(url.pathname)

    if (pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, pathname)
    }

    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request)
      if (response.status === 404 && !pathname.includes('.')) {
        return env.ASSETS.fetch(new Request(`${url.origin}${ADMIN_BASE_PATH}/`, request))
      }
      return response
    }

    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<WorkerEnv & { ASSETS?: Fetcher }>