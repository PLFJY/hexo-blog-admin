import type {
  CustomizeAdapter,
  CustomizeAdapterContext,
} from './adapterTypes'
import type {
  CustomizeFileDescriptor,
  CustomizeManifestResponse,
  CustomizePanelDescriptor,
  CustomizeSiteSummary,
} from '../shared/customizeTypes'
import { commonAdapter } from './common/adapter'
import { redefineAdapter } from './redefine/adapter'
import { getRecord, getString } from './yaml'

export const customizeAdapters: CustomizeAdapter[] = [
  commonAdapter,
  redefineAdapter,
]

export function getEnabledCustomizeAdapters(context: CustomizeAdapterContext) {
  return customizeAdapters.filter((adapter) => adapter.isEnabled(context))
}

export function getManifestDescriptors(enabledAdapters: CustomizeAdapter[]) {
  const files = new Map<string, CustomizeFileDescriptor>()
  const panels: CustomizePanelDescriptor[] = []

  for (const adapter of enabledAdapters) {
    for (const file of adapter.files) files.set(file.id, file)
    panels.push(...adapter.panels)
  }

  return {
    files: [...files.values()],
    panels,
  }
}

function getThemePackage(siteTheme: string | undefined, packageJson: Record<string, unknown> | undefined) {
  if (!siteTheme) return {}
  const packageName = `hexo-theme-${siteTheme}`
  const dependencies = getRecord(packageJson?.dependencies)
  const devDependencies = getRecord(packageJson?.devDependencies)
  const version = getString(dependencies[packageName]) || getString(devDependencies[packageName])
  return {
    themePackageName: packageName,
    themePackageVersion: version || undefined,
  }
}

export function buildCustomizeManifest(
  context: CustomizeAdapterContext,
  files: CustomizeFileDescriptor[],
  panels: CustomizePanelDescriptor[],
  enabledAdapters: CustomizeAdapter[],
): CustomizeManifestResponse {
  const detectedTheme = context.detectedTheme
  const themePackage = getThemePackage(detectedTheme, context.packageJson)
  const site: CustomizeSiteSummary = {
    title: getString(context.siteConfig.title) || getString(context.themeConfig.info && getRecord(context.themeConfig.info).title) || undefined,
    subtitle: getString(context.siteConfig.subtitle) || getString(context.themeConfig.info && getRecord(context.themeConfig.info).subtitle) || undefined,
    author: getString(context.siteConfig.author) || getString(context.themeConfig.info && getRecord(context.themeConfig.info).author) || undefined,
    url: getString(context.siteConfig.url) || getString(context.themeConfig.info && getRecord(context.themeConfig.info).url) || undefined,
    language: getString(context.siteConfig.language) || undefined,
    timezone: getString(context.siteConfig.timezone) || undefined,
    themeName: detectedTheme,
    themeConfigPath: detectedTheme ? `_config.${detectedTheme}.yml` : undefined,
    ...themePackage,
  }

  return {
    site,
    detectedTheme,
    enabledAdapters: enabledAdapters.map((adapter) => ({
      id: adapter.id,
      label: adapter.label,
      themeNames: adapter.themeNames,
    })),
    panels,
    files,
  }
}
