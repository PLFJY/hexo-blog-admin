import type { WorkerEnv } from '../env'

export const defaultConfig = (env: WorkerEnv) => ({
  GITHUB_BRANCH: env.GITHUB_BRANCH || 'main',
  POSTS_DIR: env.POSTS_DIR || 'source/_posts',
  ADMIN_INDEX_PATH: env.ADMIN_INDEX_PATH || '/admin-index.json',
  WORKFLOW_FILE: env.WORKFLOW_FILE || 'deploy.yml',
  R2_TEMP_PREFIX: env.R2_TEMP_PREFIX || '_draft-assets',
})

export const hasValue = (value: unknown) => typeof value === 'string' && value.trim().length > 0
