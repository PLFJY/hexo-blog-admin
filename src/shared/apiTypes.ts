export type HealthResponse = {
  ok: true
  name: 'hexo-blog-admin'
  runtime: 'cloudflare-workers'
}

export type SetupStatus = {
  configured: boolean
  missing: string[]
  config: {
    GITHUB_OWNER?: string
    GITHUB_REPO?: string
    GITHUB_BRANCH: string
    POSTS_DIR: string
    BLOG_PUBLIC_URL?: string
    ADMIN_INDEX_PATH: string
    WORKFLOW_FILE: string
  }
}

export type PublicConfigResponse = SetupStatus['config']

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

export type ApiErrorResponse = {
  error: string
  message?: string
}
