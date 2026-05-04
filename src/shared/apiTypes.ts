export type HealthResponse = {
  ok: true
  name: 'hexo-blog-admin'
  runtime: 'cloudflare-workers'
}

export type SetupStatus = {
  configured: boolean
  missing: string[]
  defaults: {
    GITHUB_BRANCH: string
    POSTS_DIR: string
    ADMIN_INDEX_PATH: string
    WORKFLOW_FILE: string
    R2_TEMP_PREFIX: string
  }
}

export type GitHubRepoStatus = {
  connected: boolean
  fullName?: string
  defaultBranch?: string
  private?: boolean
  htmlUrl?: string
  error?: string
}

export type SetupIncompleteError = {
  error: 'SETUP_INCOMPLETE'
  missing: string[]
}

export type TodoResponse<T> = T & {
  message: string
}
