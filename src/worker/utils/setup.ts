import type { SetupStatus } from '../../shared/apiTypes'
import type { WorkerEnv } from '../env'
import { hasValue, publicConfig } from './config'

export function getSetupStatus(env: WorkerEnv): SetupStatus {
  const missing: string[] = []

  if (!hasValue(env.GITHUB_OWNER)) missing.push('GITHUB_OWNER')
  if (!hasValue(env.GITHUB_REPO)) missing.push('GITHUB_REPO')
  if (!hasValue(env.GITHUB_BRANCH)) missing.push('GITHUB_BRANCH')
  if (!hasValue(env.POSTS_DIR)) missing.push('POSTS_DIR')
  if (!hasValue(env.BLOG_PUBLIC_URL)) missing.push('BLOG_PUBLIC_URL')
  if (!hasValue(env.ADMIN_INDEX_PATH)) missing.push('ADMIN_INDEX_PATH')
  if (!hasValue(env.WORKFLOW_FILE)) missing.push('WORKFLOW_FILE')
  if (!hasValue(env.GITHUB_TOKEN)) missing.push('GITHUB_TOKEN')
  if (!hasValue(env.ADMIN_USERNAME)) missing.push('ADMIN_USERNAME')
  if (!hasValue(env.ADMIN_PASSWORD)) missing.push('ADMIN_PASSWORD')
  if (!env.BLOG_ADMIN_KV) missing.push('BLOG_ADMIN_KV')
  if (!env.BLOG_ADMIN_DB) missing.push('BLOG_ADMIN_DB')
  if (!env.BLOG_ASSET_CACHE) missing.push('BLOG_ASSET_CACHE')

  return {
    configured: missing.length === 0,
    missing,
    config: publicConfig(env),
  }
}

export function hasGitHubConfig(env: WorkerEnv) {
  return hasValue(env.GITHUB_OWNER) && hasValue(env.GITHUB_REPO) && hasValue(env.GITHUB_TOKEN)
}
