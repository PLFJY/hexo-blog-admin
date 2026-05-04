import type { WorkerEnv } from '../env'

export type RuntimeConfig = {
  GITHUB_OWNER: string
  GITHUB_REPO: string
  GITHUB_BRANCH: string
  POSTS_DIR: string
  BLOG_PUBLIC_URL: string
  ADMIN_INDEX_PATH: string
  WORKFLOW_FILE: string
}

export const hasValue = (value: unknown) => typeof value === 'string' && value.trim().length > 0

export function requireConfig(env: WorkerEnv): RuntimeConfig {
  const entries = {
    GITHUB_OWNER: env.GITHUB_OWNER,
    GITHUB_REPO: env.GITHUB_REPO,
    GITHUB_BRANCH: env.GITHUB_BRANCH,
    POSTS_DIR: env.POSTS_DIR,
    BLOG_PUBLIC_URL: env.BLOG_PUBLIC_URL,
    ADMIN_INDEX_PATH: env.ADMIN_INDEX_PATH,
    WORKFLOW_FILE: env.WORKFLOW_FILE,
  }

  for (const [key, value] of Object.entries(entries)) {
    if (!hasValue(value)) {
      throw new Error(`${key} is not configured`)
    }
  }

  return entries as RuntimeConfig
}

export function publicConfig(env: WorkerEnv) {
  return {
    GITHUB_OWNER: env.GITHUB_OWNER,
    GITHUB_REPO: env.GITHUB_REPO,
    GITHUB_BRANCH: env.GITHUB_BRANCH ?? '',
    POSTS_DIR: env.POSTS_DIR ?? '',
    BLOG_PUBLIC_URL: env.BLOG_PUBLIC_URL,
    ADMIN_INDEX_PATH: env.ADMIN_INDEX_PATH ?? '',
    WORKFLOW_FILE: env.WORKFLOW_FILE ?? '',
  }
}
