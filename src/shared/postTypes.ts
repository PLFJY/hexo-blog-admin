export type PostFile = {
  relativeId: string
  title: string
  path: string
  updatedAt?: string
}

export type PostTreeNode = {
  id: string
  name: string
  type: 'folder' | 'post'
  children?: PostTreeNode[]
  post?: PostFile
}

export type PostTreeResponse = {
  posts: PostFile[]
  tree: PostTreeNode[]
}
