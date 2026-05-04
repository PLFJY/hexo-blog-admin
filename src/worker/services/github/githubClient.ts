import type { WorkerEnv } from '../../env'

export async function githubFetch(env: WorkerEnv, path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/vnd.github+json')
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
