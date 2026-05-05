export type PostFile = {
  relativeId: string
  title: string
  path: string
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
}

export type PostTreeNode = {
  id: string
  name: string
  type: 'folder' | 'post'
  children?: PostTreeNode[]
  post?: PostFile
}

export type PostTreeResponse = {
  version?: number
  generatedAt?: string
  postsDir?: string
  assetMode?: string
  stale?: boolean
  posts: PostFile[]
  tree: PostTreeNode[]
}

export type PostContentResponse = {
  post: PostFile
  markdown: string
  sha?: string
}
