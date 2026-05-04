import type { HealthResponse } from '../shared/apiTypes'
import type { WorkerEnv } from './env'
import { handleAssets } from './routes/assetRoutes'
import { handleSetupStatus } from './routes/configRoutes'
import { handleLatestDeploy } from './routes/deployRoutes'
import { handleDrafts } from './routes/draftRoutes'
import { handleGitHubRepo } from './routes/githubRoutes'
import { handleAdminIndex } from './routes/indexRoutes'
import { handlePostsTree } from './routes/postRoutes'
import { json } from './utils/response'
import { getSetupStatus } from './utils/setup'

const health: HealthResponse = {
  ok: true,
  name: 'hexo-blog-admin',
  runtime: 'cloudflare-workers',
}

const setupBypassPaths = new Set(['/api/health', '/api/setup/status'])

async function handleApiRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname

  if (pathname === '/api/health') return json(health)
  if (pathname === '/api/setup/status') return handleSetupStatus(env)

  const setup = getSetupStatus(env)
  if (!setup.configured && !setupBypassPaths.has(pathname)) {
    return json({ error: 'SETUP_INCOMPLETE', missing: setup.missing }, { status: 503 })
  }

  if (pathname === '/api/github/repo') return handleGitHubRepo(env)
  if (pathname === '/api/index') return handleAdminIndex(env)
  if (pathname === '/api/posts/tree') return handlePostsTree()
  if (pathname === '/api/drafts') return handleDrafts(env)
  if (pathname === '/api/assets') return handleAssets()
  if (pathname === '/api/deploy/latest') return handleLatestDeploy(env)

  return json({ error: 'NOT_FOUND' }, { status: 404 })
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env)
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<WorkerEnv & { ASSETS: Fetcher }>
