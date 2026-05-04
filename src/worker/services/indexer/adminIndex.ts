import type { PostTreeResponse } from '../../../shared/postTypes'
import type { WorkerEnv } from '../../env'
import { requireConfig } from '../../utils/config'

export async function getAdminIndex(env: WorkerEnv): Promise<PostTreeResponse> {
  const config = requireConfig(env)
  const publicUrl = config.BLOG_PUBLIC_URL.replace(/\/+$/g, '')

  const indexUrl = `${publicUrl}${config.ADMIN_INDEX_PATH.startsWith('/') ? '' : '/'}${config.ADMIN_INDEX_PATH}`
  const response = await fetch(indexUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'hexo-blog-admin',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch admin index: ${response.status}`)
  }

  return (await response.json()) as PostTreeResponse
}
