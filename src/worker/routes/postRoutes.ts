import type { PostContentResponse } from '../../shared/postTypes'
import type { WorkerEnv } from '../env'
import { buildPostPaths } from '../../features/posts/postPathUtils'
import { getGitHubFile } from '../services/github/githubContent'
import { getAdminIndex } from '../services/indexer/adminIndex'
import { requireConfig } from '../utils/config'
import { json } from '../utils/response'

export async function handlePostsTree(env: WorkerEnv): Promise<Response> {
  return json(await getAdminIndex(env))
}

export async function handlePostContent(env: WorkerEnv, request: Request): Promise<Response> {
  const url = new URL(request.url)
  const relativeId = url.searchParams.get('relativeId')
  if (!relativeId) return json({ error: 'BAD_REQUEST', message: 'relativeId is required' }, { status: 400 })

  const index = await getAdminIndex(env)
  const post = index.posts.find((item) => item.relativeId === relativeId)
  if (!post) return json({ error: 'NOT_FOUND', message: 'Post not found' }, { status: 404 })

  const fallbackPath = buildPostPaths({
    postsDir: requireConfig(env).POSTS_DIR,
    relativeId,
  }).postPath
  const file = await getGitHubFile(env, post.path || fallbackPath)
  const response: PostContentResponse = {
    post,
    markdown: file.content,
    sha: file.sha,
  }

  return json(response)
}
