import type {
  CustomizeAdapterSummary,
  CustomizeFileDescriptor,
  CustomizeManifestResponse,
  CustomizePanelDescriptor,
} from '../shared/customizeTypes'

export type CustomizeFileState = {
  descriptor: CustomizeFileDescriptor
  content: string
  sha?: string
  exists: boolean
}

export type CustomizeAdapterContext = {
  detectedTheme?: string
  siteConfig: Record<string, unknown>
  themeConfig: Record<string, unknown>
  packageJson?: Record<string, unknown>
}

export type CustomizePanelReadContext = CustomizeAdapterContext & {
  files: Record<string, CustomizeFileState>
}

export type CustomizePanelWriteContext = CustomizePanelReadContext & {
  data: unknown
}

export type CustomizePanelWriteResult = {
  files: Array<{
    id: string
    content: string
  }>
}

export type CustomizeAdapter = CustomizeAdapterSummary & {
  isEnabled: (context: CustomizeAdapterContext) => boolean
  files: CustomizeFileDescriptor[]
  panels: CustomizePanelDescriptor[]
  readPanel: (panelId: string, context: CustomizePanelReadContext) => unknown
  writePanel: (panelId: string, context: CustomizePanelWriteContext) => CustomizePanelWriteResult
}

export type CustomizeManifestBuildContext = CustomizeAdapterContext & {
  enabledAdapters: CustomizeAdapter[]
  files: CustomizeFileDescriptor[]
  panels: CustomizePanelDescriptor[]
}

export type CustomizeManifestBuilder = (context: CustomizeManifestBuildContext) => CustomizeManifestResponse
