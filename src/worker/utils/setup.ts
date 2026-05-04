import type { SetupStatus } from '../../shared/apiTypes'
import type { WorkerEnv } from '../env'
import { defaultConfig, hasValue } from './config'

export function getSetupStatus(env: WorkerEnv): SetupStatus {
  const missing: string[] = []

  if (!hasValue(env.GITHUB_OWNER)) missing.push('GITHUB_OWNER')
  if (!hasValue(env.GITHUB_REPO)) missing.push('GITHUB_REPO')
  if (!hasValue(env.BLOG_PUBLIC_URL)) missing.push('BLOG_PUBLIC_URL')
  if (!hasValue(env.GITHUB_TOKEN)) missing.push('GITHUB_TOKEN')
  if (!env.BLOG_ADMIN_KV) missing.push('BLOG_ADMIN_KV')
  if (!env.BLOG_ASSET_CACHE) missing.push('BLOG_ASSET_CACHE')

  return {
    configured: missing.length === 0,
    missing,
    defaults: defaultConfig(env),
  }
}

export function hasGitHubConfig(env: WorkerEnv) {
  return hasValue(env.GITHUB_OWNER) && hasValue(env.GITHUB_REPO) && hasValue(env.GITHUB_TOKEN)
}
