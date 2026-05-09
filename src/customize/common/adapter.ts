import type { CustomizeAdapter } from '../adapterTypes'
import type { MarkdownPageData } from '../../shared/customizeTypes'
import {
  getIn,
  getRecord,
  getString,
  parseMarkdownPage,
  setYamlPaths,
  stringifyMarkdownPage,
} from '../yaml'

const siteConfigFile = {
  id: 'site-config',
  adapterId: 'common',
  label: 'Hexo _config.yml',
  path: '_config.yml',
  description: 'Hexo site configuration',
  language: 'yaml' as const,
}

const aboutPageFile = {
  id: 'about-page',
  adapterId: 'common',
  label: 'About page',
  path: 'source/about/index.md',
  description: 'About page Markdown',
  language: 'markdown' as const,
}

const panelDescriptors = [
  {
    id: 'site-basic',
    adapterId: 'common',
    title: 'Hexo 站点基础信息',
    description: '维护 Hexo 主配置中的站点标题、作者、语言、时区和 URL。',
    group: 'basic' as const,
    fileIds: ['site-config'],
  },
  {
    id: 'about-page',
    adapterId: 'common',
    title: 'About 页面',
    description: '维护 source/about/index.md 的 front matter 和正文。',
    group: 'pages' as const,
    fileIds: ['about-page'],
  },
]

function readSitePanel(siteConfig: Record<string, unknown>) {
  return {
    title: getString(siteConfig.title),
    subtitle: getString(siteConfig.subtitle),
    description: getString(siteConfig.description),
    author: getString(siteConfig.author),
    language: getString(siteConfig.language),
    timezone: getString(siteConfig.timezone),
    url: getString(siteConfig.url),
  }
}

function writeSitePanel(content: string, rawData: unknown) {
  const data = getRecord(rawData)
  return setYamlPaths(content, [
    { path: ['title'], value: getString(data.title) },
    { path: ['subtitle'], value: getString(data.subtitle) },
    { path: ['description'], value: getString(data.description) },
    { path: ['author'], value: getString(data.author) },
    { path: ['language'], value: getString(data.language) },
    { path: ['timezone'], value: getString(data.timezone) },
    { path: ['url'], value: getString(data.url) },
  ])
}

function defaultAboutPage(): MarkdownPageData {
  return {
    exists: false,
    path: aboutPageFile.path,
    frontMatter: {
      title: 'About',
      date: new Date().toISOString(),
    },
    body: '\n',
  }
}

export const commonAdapter: CustomizeAdapter = {
  id: 'common',
  label: 'Hexo Common',
  themeNames: ['*'],
  isEnabled: () => true,
  files: [siteConfigFile, aboutPageFile],
  panels: panelDescriptors,
  readPanel(panelId, context) {
    if (panelId === 'site-basic') return readSitePanel(context.siteConfig)
    if (panelId === 'about-page') {
      const file = context.files['about-page']
      return file?.exists ? parseMarkdownPage(file.content, aboutPageFile.path) : defaultAboutPage()
    }
    throw new Error(`Unknown common panel: ${panelId}`)
  },
  writePanel(panelId, context) {
    if (panelId === 'site-basic') {
      const file = context.files['site-config']
      return {
        files: [
          {
            id: 'site-config',
            content: writeSitePanel(file?.content ?? '', context.data),
          },
        ],
      }
    }

    if (panelId === 'about-page') {
      const data = getRecord(context.data)
      const frontMatter = getRecord(data.frontMatter)
      const body = getString(getIn(data, ['body']), '\n')
      return {
        files: [
          {
            id: 'about-page',
            content: stringifyMarkdownPage(frontMatter, body),
          },
        ],
      }
    }

    throw new Error(`Unknown common panel: ${panelId}`)
  },
}
