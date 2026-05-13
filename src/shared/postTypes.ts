export type PostFile = {
  relativeId: string
  title: string
  path: string
  metadata?: {
    publishedAt?: string
    published?: boolean
  }
  publishedAt?: string
  folderPath?: string
  postSlug?: string
  assetDir?: string
  markdownAssetPrefix?: string
  assetIndexPath?: string
  assetCount?: number
  assetTotalSize?: number
  date?: string
  updated?: string
  tags?: string[]
  categories?: string[]
  assets?: PostAsset[]
  updatedAt?: string
  published?: boolean
}

export type PostAsset = {
  filename: string
  repoPath: string
  markdownPath: string
  size?: number
  publicUrl?: string
  postRelativeId?: string
}

export type PostTreeNode = {
  id: string
  name: string
  type: 'folder' | 'post'
  sortPublishedAt?: string
  children?: PostTreeNode[]
  postRef?: string
  post?: PostFile
}

export type PostTreeResponse = {
  version?: number
  generatedAt?: string
  postsDir?: string
  assetMode?: string
  assetIndexMode?: string
  assetIndexBasePath?: string
  site?: {
    title?: string
    subtitle?: string
    author?: string
    url?: string
    language?: string
    timezone?: string
    theme?: {
      name?: string
      packageName?: string
      packageVersion?: string
      configPath?: string
    }
  }
  customize?: {
    detectedTheme?: string
    availableAdapters?: string[]
    availablePanels?: string[]
    files?: Array<{
      id: string
      path: string
      type?: string
      exists?: boolean
    }>
  }
  stale?: boolean
  sourceCommitSha?: string
  cacheSyncedAt?: string
  posts: PostFile[]
  tree: PostTreeNode[]
  assets?: PostAsset[]
}

export type PostAssetIndexResponse = {
  relativeId: string
  assetIndexPath?: string
  assets: PostAsset[]
}

export type PostContentResponse = {
  post: PostFile
  markdown: string
  sha?: string
}

export type PublishPostRequest = {
  relativeId: string
  markdown: string
  message?: string
  branch?: string
}

export type PublishPostResponse = {
  commitSha: string
  relativeId: string
  markdown: string
}

export type TogglePostPublishedRequest = {
  relativeId: string
  published: boolean
}

export type TogglePostPublishedResponse = {
  commitSha: string
  relativeId: string
  published: boolean
  markdown: string
}
