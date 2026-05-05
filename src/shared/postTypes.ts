export type PostFile = {
  relativeId: string
  title: string
  path: string
  metadata?: {
    publishedAt?: string
  }
  publishedAt?: string
  folderPath?: string
  postSlug?: string
  assetDir?: string
  markdownAssetPrefix?: string
  date?: string
  updated?: string
  tags?: string[]
  categories?: string[]
  assets?: PostAsset[]
  updatedAt?: string
}

export type PostAsset = {
  filename: string
  repoPath: string
  markdownPath: string
  size?: number
  publicUrl?: string
}

export type PostTreeNode = {
  id: string
  name: string
  type: 'folder' | 'post'
  sortPublishedAt?: string
  children?: PostTreeNode[]
  post?: PostFile
}

export type PostTreeResponse = {
  version?: number
  generatedAt?: string
  postsDir?: string
  assetMode?: string
  stale?: boolean
  sourceCommitSha?: string
  cacheSyncedAt?: string
  posts: PostFile[]
  tree: PostTreeNode[]
}

export type PostContentResponse = {
  post: PostFile
  markdown: string
  sha?: string
}
