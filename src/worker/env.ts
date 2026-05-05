export type WorkerEnv = {
  GITHUB_OWNER?: string
  GITHUB_REPO?: string
  GITHUB_BRANCH?: string
  GITHUB_TOKEN?: string
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  POSTS_DIR?: string
  BLOG_PUBLIC_URL?: string
  ADMIN_INDEX_PATH?: string
  WORKFLOW_FILE?: string
  BLOG_ADMIN_KV?: KVNamespace
  BLOG_ASSET_CACHE?: R2Bucket
}
