import type { WorkerEnv } from '../../env'

export async function githubFetch(env: WorkerEnv, path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/vnd.github+json')
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  headers.set('X-GitHub-Api-Version', '2022-11-28')
  headers.set('User-Agent', 'hexo-blog-admin')

  if (env.GITHUB_TOKEN) {
    headers.set('Authorization', `Bearer ${env.GITHUB_TOKEN}`)
  }

  return fetch(`https://api.github.com${normalizedPath}`, {
    ...init,
    headers,
  })
}

export async function githubJson<T>(env: WorkerEnv, path: string, init?: RequestInit): Promise<T> {
  const response = await githubFetch(env, path, init)
  const payload = (await response.json()) as unknown

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message?: unknown }).message)
        : `GitHub request failed: ${response.status}`
    throw new Error(message)
  }

  return payload as T
}
