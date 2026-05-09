import type { DeployRecord } from './deployTypes'

export type CustomizePanelGroup = 'basic' | 'visual' | 'navigation' | 'pages' | 'data' | 'advanced'

export type CustomizeAdapterSummary = {
  id: string
  label: string
  themeNames: string[]
}

export type CustomizeFileDescriptor = {
  id: string
  adapterId: string
  label: string
  path: string
  description?: string
  language?: 'yaml' | 'markdown' | 'text'
  exists?: boolean
}

export type CustomizePanelDescriptor = {
  id: string
  adapterId: string
  title: string
  description: string
  group: CustomizePanelGroup
  fileIds: string[]
}

export type CustomizeSiteSummary = {
  title?: string
  subtitle?: string
  author?: string
  url?: string
  language?: string
  timezone?: string
  themeName?: string
  themePackageName?: string
  themePackageVersion?: string
  themeConfigPath?: string
}

export type CustomizeManifestResponse = {
  site: CustomizeSiteSummary
  detectedTheme?: string
  enabledAdapters: CustomizeAdapterSummary[]
  panels: CustomizePanelDescriptor[]
  files: CustomizeFileDescriptor[]
}

export type CustomizeFileResponse = {
  file: CustomizeFileDescriptor
  content: string
  sha?: string
  exists: boolean
}

export type CustomizeSaveResponse = {
  commitSha: string
}

export type CustomizePanelResponse<T = unknown> = {
  panel: CustomizePanelDescriptor
  data: T
}

export type CustomizeFileSaveRequest = {
  id: string
  content: string
}

export type CustomizePanelSaveRequest<T = unknown> = {
  id: string
  data: T
}

export type CustomizeSaveStatus = {
  commitSha?: string
  deploy?: DeployRecord
  indexSynced?: boolean
  message?: string
}

export type MarkdownPageData = {
  exists: boolean
  path: string
  frontMatter: Record<string, unknown>
  body: string
}

export type NamedLinkItem = {
  name: string
  path: string
  icon: string
}

export type KeyValueLinkItem = {
  key: string
  value: string
}

export type BookmarksPanelData = {
  page: MarkdownPageData
  categories: Array<{
    category: string
    icon: string
    items: Array<{
      name: string
      link: string
      description: string
      image: string
    }>
  }>
}

export type LinksPanelData = {
  page: MarkdownPageData
  categories: Array<{
    links_category: string
    has_thumbnail: boolean
    list: Array<{
      name: string
      description: string
      link: string
      avatar: string
      thumbnail: string
    }>
  }>
}
