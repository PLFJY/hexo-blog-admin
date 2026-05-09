import type { CustomizeAdapter } from '../adapterTypes'
import type { BookmarksPanelData, LinksPanelData, MarkdownPageData } from '../../shared/customizeTypes'
import {
  asStringArray,
  getArray,
  getBoolean,
  getIn,
  getNumber,
  getRecord,
  getString,
  keyValueItemsToMap,
  linkListToMap,
  linkMapToList,
  mapToKeyValueItems,
  parseMarkdownPage,
  parseYaml,
  setYamlPaths,
  stringifyMarkdownPage,
  stringifyYaml,
} from '../yaml'

const redefineConfigFile = {
  id: 'redefine-config',
  adapterId: 'redefine',
  label: 'Redefine _config.redefine.yml',
  path: '_config.redefine.yml',
  description: 'Redefine theme configuration',
  language: 'yaml' as const,
}

const bookmarksPageFile = {
  id: 'redefine-bookmarks-page',
  adapterId: 'redefine',
  label: 'Bookmarks page',
  path: 'source/bookmarks/index.md',
  description: 'Bookmarks page Markdown',
  language: 'markdown' as const,
}

const bookmarksDataFile = {
  id: 'redefine-bookmarks-data',
  adapterId: 'redefine',
  label: 'Bookmarks data',
  path: 'source/_data/bookmarks.yml',
  description: 'Structured bookmarks data',
  language: 'yaml' as const,
}

const linksPageFile = {
  id: 'redefine-links-page',
  adapterId: 'redefine',
  label: 'Links page',
  path: 'source/links/index.md',
  description: 'Friends links page Markdown',
  language: 'markdown' as const,
}

const linksDataFile = {
  id: 'redefine-links-data',
  adapterId: 'redefine',
  label: 'Links data',
  path: 'source/_data/links.yml',
  description: 'Structured friends links data',
  language: 'yaml' as const,
}

const panelDescriptors = [
  {
    id: 'redefine-basic',
    adapterId: 'redefine',
    title: 'Redefine 基础信息',
    description: '维护 Redefine 主题配置中的 info 区域。',
    group: 'basic' as const,
    fileIds: ['redefine-config'],
  },
  {
    id: 'redefine-visual',
    adapterId: 'redefine',
    title: '视觉基础',
    description: '维护 favicon、logo、avatar、主题主色和默认明暗模式。',
    group: 'visual' as const,
    fileIds: ['redefine-config'],
  },
  {
    id: 'redefine-home-banner',
    adapterId: 'redefine',
    title: '首页 Banner',
    description: '维护首页 Banner 图片、标题、打字文案和社交链接。',
    group: 'visual' as const,
    fileIds: ['redefine-config'],
  },
  {
    id: 'redefine-navigation',
    adapterId: 'redefine',
    title: '导航栏 / 侧边栏',
    description: '维护 navbar links、搜索、颜色、侧边栏链接和公告。',
    group: 'navigation' as const,
    fileIds: ['redefine-config'],
  },
  {
    id: 'redefine-bookmarks',
    adapterId: 'redefine',
    title: 'Bookmarks 管理',
    description: '维护 bookmarks 页面 front matter 和 source/_data/bookmarks.yml。',
    group: 'data' as const,
    fileIds: ['redefine-bookmarks-page', 'redefine-bookmarks-data'],
  },
  {
    id: 'redefine-links',
    adapterId: 'redefine',
    title: 'Links / Friends 管理',
    description: '维护 links 页面 front matter 和 source/_data/links.yml。',
    group: 'data' as const,
    fileIds: ['redefine-links-page', 'redefine-links-data'],
  },
  {
    id: 'redefine-page-templates',
    adapterId: 'redefine',
    title: 'Page Templates 常用项',
    description: '维护 friends_column 和 tags_style。',
    group: 'pages' as const,
    fileIds: ['redefine-config'],
  },
]

function readBasics(siteConfig: Record<string, unknown>, themeConfig: Record<string, unknown>) {
  return {
    site: {
      title: getString(siteConfig.title),
      subtitle: getString(siteConfig.subtitle),
      description: getString(siteConfig.description),
      author: getString(siteConfig.author),
      language: getString(siteConfig.language),
      timezone: getString(siteConfig.timezone),
      url: getString(siteConfig.url),
    },
    info: {
      title: getString(getIn(themeConfig, ['info', 'title'])),
      subtitle: getString(getIn(themeConfig, ['info', 'subtitle'])),
      author: getString(getIn(themeConfig, ['info', 'author'])),
      url: getString(getIn(themeConfig, ['info', 'url'])),
    },
  }
}

function writeBasics(themeContent: string, rawData: unknown) {
  const data = getRecord(rawData)
  const info = getRecord(data.info)
  return setYamlPaths(themeContent, [
    { path: ['info', 'title'], value: getString(info.title) },
    { path: ['info', 'subtitle'], value: getString(info.subtitle) },
    { path: ['info', 'author'], value: getString(info.author) },
    { path: ['info', 'url'], value: getString(info.url) },
  ])
}

function readVisual(themeConfig: Record<string, unknown>) {
  return {
    defaults: {
      favicon: getString(getIn(themeConfig, ['defaults', 'favicon'])),
      logo: getString(getIn(themeConfig, ['defaults', 'logo'])),
      avatar: getString(getIn(themeConfig, ['defaults', 'avatar'])),
    },
    colors: {
      primary: getString(getIn(themeConfig, ['colors', 'primary'])),
      secondary: getString(getIn(themeConfig, ['colors', 'secondary'])),
      default_mode: getString(getIn(themeConfig, ['colors', 'default_mode']), 'light'),
    },
  }
}

function writeVisual(themeContent: string, rawData: unknown) {
  const data = getRecord(rawData)
  const defaults = getRecord(data.defaults)
  const colors = getRecord(data.colors)
  return setYamlPaths(themeContent, [
    { path: ['defaults', 'favicon'], value: getString(defaults.favicon) },
    { path: ['defaults', 'logo'], value: getString(defaults.logo) },
    { path: ['defaults', 'avatar'], value: getString(defaults.avatar) },
    { path: ['colors', 'primary'], value: getString(colors.primary) },
    { path: ['colors', 'secondary'], value: getString(colors.secondary) },
    { path: ['colors', 'default_mode'], value: getString(colors.default_mode, 'light') },
  ])
}

function readHomeBanner(themeConfig: Record<string, unknown>) {
  const subtitle = getRecord(getIn(themeConfig, ['home_banner', 'subtitle']))
  const socialLinks = getRecord(getIn(themeConfig, ['home_banner', 'social_links']))
  return {
    enable: getBoolean(getIn(themeConfig, ['home_banner', 'enable']), true),
    style: getString(getIn(themeConfig, ['home_banner', 'style']), 'fixed'),
    image: {
      light: getString(getIn(themeConfig, ['home_banner', 'image', 'light'])),
      dark: getString(getIn(themeConfig, ['home_banner', 'image', 'dark'])),
    },
    title: getString(getIn(themeConfig, ['home_banner', 'title'])),
    subtitle: {
      text: asStringArray(subtitle.text),
      typing_speed: getNumber(subtitle.typing_speed, 100),
      backing_speed: getNumber(subtitle.backing_speed, 80),
      starting_delay: getNumber(subtitle.starting_delay, 500),
      backing_delay: getNumber(subtitle.backing_delay, 1500),
      loop: getBoolean(subtitle.loop, true),
      smart_backspace: getBoolean(subtitle.smart_backspace, true),
    },
    text_color: {
      light: getString(getIn(themeConfig, ['home_banner', 'text_color', 'light'])),
      dark: getString(getIn(themeConfig, ['home_banner', 'text_color', 'dark'])),
    },
    social_links: {
      enable: getBoolean(socialLinks.enable, true),
      style: getString(socialLinks.style, 'center'),
      links: mapToKeyValueItems(socialLinks.links),
      qrs: mapToKeyValueItems(socialLinks.qrs),
    },
  }
}

function writeHomeBanner(themeContent: string, rawData: unknown) {
  const data = getRecord(rawData)
  const image = getRecord(data.image)
  const subtitle = getRecord(data.subtitle)
  const textColor = getRecord(data.text_color)
  const socialLinks = getRecord(data.social_links)
  return setYamlPaths(themeContent, [
    { path: ['home_banner', 'enable'], value: getBoolean(data.enable, true) },
    { path: ['home_banner', 'style'], value: getString(data.style, 'fixed') },
    { path: ['home_banner', 'image', 'light'], value: getString(image.light) },
    { path: ['home_banner', 'image', 'dark'], value: getString(image.dark) },
    { path: ['home_banner', 'title'], value: getString(data.title) },
    { path: ['home_banner', 'subtitle', 'text'], value: asStringArray(subtitle.text) },
    { path: ['home_banner', 'subtitle', 'typing_speed'], value: getNumber(subtitle.typing_speed, 100) },
    { path: ['home_banner', 'subtitle', 'backing_speed'], value: getNumber(subtitle.backing_speed, 80) },
    { path: ['home_banner', 'subtitle', 'starting_delay'], value: getNumber(subtitle.starting_delay, 500) },
    { path: ['home_banner', 'subtitle', 'backing_delay'], value: getNumber(subtitle.backing_delay, 1500) },
    { path: ['home_banner', 'subtitle', 'loop'], value: getBoolean(subtitle.loop, true) },
    { path: ['home_banner', 'subtitle', 'smart_backspace'], value: getBoolean(subtitle.smart_backspace, true) },
    { path: ['home_banner', 'text_color', 'light'], value: getString(textColor.light) },
    { path: ['home_banner', 'text_color', 'dark'], value: getString(textColor.dark) },
    { path: ['home_banner', 'social_links', 'enable'], value: getBoolean(socialLinks.enable, true) },
    { path: ['home_banner', 'social_links', 'style'], value: getString(socialLinks.style, 'center') },
    { path: ['home_banner', 'social_links', 'links'], value: keyValueItemsToMap(mapToKeyValueItems(socialLinks.links)) },
    { path: ['home_banner', 'social_links', 'qrs'], value: keyValueItemsToMap(mapToKeyValueItems(socialLinks.qrs)) },
  ])
}

function readNavigation(themeConfig: Record<string, unknown>) {
  return {
    navbar: {
      auto_hide: getBoolean(getIn(themeConfig, ['navbar', 'auto_hide']), false),
      color: {
        left: getString(getIn(themeConfig, ['navbar', 'color', 'left'])),
        right: getString(getIn(themeConfig, ['navbar', 'color', 'right'])),
        transparency: getNumber(getIn(themeConfig, ['navbar', 'color', 'transparency']), 25),
      },
      search: {
        enable: getBoolean(getIn(themeConfig, ['navbar', 'search', 'enable']), true),
        preload: getBoolean(getIn(themeConfig, ['navbar', 'search', 'preload']), true),
      },
      links: linkMapToList(getIn(themeConfig, ['navbar', 'links'])),
    },
    sidebar: {
      position: getString(getIn(themeConfig, ['home', 'sidebar', 'position']), 'left'),
      announcement: getString(getIn(themeConfig, ['home', 'sidebar', 'announcement'])),
      show_on_mobile: getBoolean(getIn(themeConfig, ['home', 'sidebar', 'show_on_mobile']), true),
      links: linkMapToList(getIn(themeConfig, ['home', 'sidebar', 'links'])),
    },
  }
}

function writeNavigation(themeContent: string, rawData: unknown) {
  const data = getRecord(rawData)
  const navbar = getRecord(data.navbar)
  const navbarColor = getRecord(navbar.color)
  const navbarSearch = getRecord(navbar.search)
  const sidebar = getRecord(data.sidebar)
  return setYamlPaths(themeContent, [
    { path: ['navbar', 'auto_hide'], value: getBoolean(navbar.auto_hide, false) },
    { path: ['navbar', 'color', 'left'], value: getString(navbarColor.left) },
    { path: ['navbar', 'color', 'right'], value: getString(navbarColor.right) },
    { path: ['navbar', 'color', 'transparency'], value: getNumber(navbarColor.transparency, 25) },
    { path: ['navbar', 'search', 'enable'], value: getBoolean(navbarSearch.enable, true) },
    { path: ['navbar', 'search', 'preload'], value: getBoolean(navbarSearch.preload, true) },
    { path: ['navbar', 'links'], value: linkListToMap(linkMapToList(navbar.links)) },
    { path: ['home', 'sidebar', 'position'], value: getString(sidebar.position, 'left') },
    { path: ['home', 'sidebar', 'announcement'], value: getString(sidebar.announcement) },
    { path: ['home', 'sidebar', 'show_on_mobile'], value: getBoolean(sidebar.show_on_mobile, true) },
    { path: ['home', 'sidebar', 'links'], value: linkListToMap(linkMapToList(sidebar.links)) },
  ])
}

function defaultBookmarksPage(): MarkdownPageData {
  return {
    exists: false,
    path: bookmarksPageFile.path,
    frontMatter: {
      title: 'Bookmarks',
      date: new Date().toISOString(),
      template: 'bookmarks',
    },
    body: '\n',
  }
}

function defaultLinksPage(): MarkdownPageData {
  return {
    exists: false,
    path: linksPageFile.path,
    frontMatter: {
      title: 'Links',
      date: new Date().toISOString(),
      template: 'links',
    },
    body: '\n',
  }
}

function readBookmarks(pageContent: string, pageExists: boolean, dataContent: string): BookmarksPanelData {
  const rawCategories = parseYaml<unknown[]>(dataContent, [])
  return {
    page: pageExists ? parseMarkdownPage(pageContent, bookmarksPageFile.path) : defaultBookmarksPage(),
    categories: getArray(rawCategories).map((rawCategory) => {
      const category = getRecord(rawCategory)
      return {
        category: getString(category.category),
        icon: getString(category.icon),
        items: getArray(category.items).map((rawItem) => {
          const item = getRecord(rawItem)
          return {
            name: getString(item.name),
            link: getString(item.link),
            description: getString(item.description),
            image: getString(item.image),
          }
        }),
      }
    }),
  }
}

function writeBookmarks(rawData: unknown) {
  const data = getRecord(rawData)
  const page = getRecord(data.page)
  const categories = getArray(data.categories).map((rawCategory) => {
    const category = getRecord(rawCategory)
    return {
      category: getString(category.category),
      icon: getString(category.icon),
      items: getArray(category.items).map((rawItem) => {
        const item = getRecord(rawItem)
        return {
          name: getString(item.name),
          link: getString(item.link),
          description: getString(item.description),
          image: getString(item.image),
        }
      }),
    }
  })
  return {
    pageContent: stringifyMarkdownPage(getRecord(page.frontMatter), getString(page.body, '\n')),
    dataContent: stringifyYaml(categories),
  }
}

function readLinks(pageContent: string, pageExists: boolean, dataContent: string): LinksPanelData {
  const rawCategories = parseYaml<unknown[]>(dataContent, [])
  return {
    page: pageExists ? parseMarkdownPage(pageContent, linksPageFile.path) : defaultLinksPage(),
    categories: getArray(rawCategories).map((rawCategory) => {
      const category = getRecord(rawCategory)
      return {
        links_category: getString(category.links_category),
        has_thumbnail: getBoolean(category.has_thumbnail, false),
        list: getArray(category.list).map((rawItem) => {
          const item = getRecord(rawItem)
          return {
            name: getString(item.name),
            description: getString(item.description),
            link: getString(item.link),
            avatar: getString(item.avatar),
            thumbnail: getString(item.thumbnail),
          }
        }),
      }
    }),
  }
}

function writeLinks(rawData: unknown) {
  const data = getRecord(rawData)
  const page = getRecord(data.page)
  const categories = getArray(data.categories).map((rawCategory) => {
    const category = getRecord(rawCategory)
    return {
      links_category: getString(category.links_category),
      has_thumbnail: getBoolean(category.has_thumbnail, false),
      list: getArray(category.list).map((rawItem) => {
        const item = getRecord(rawItem)
        return {
          name: getString(item.name),
          description: getString(item.description),
          link: getString(item.link),
          avatar: getString(item.avatar),
          thumbnail: getString(item.thumbnail),
        }
      }),
    }
  })
  return {
    pageContent: stringifyMarkdownPage(getRecord(page.frontMatter), getString(page.body, '\n')),
    dataContent: stringifyYaml(categories),
  }
}

function readPageTemplates(themeConfig: Record<string, unknown>) {
  return {
    friends_column: getNumber(getIn(themeConfig, ['page_templates', 'friends_column']), 2),
    tags_style: getString(getIn(themeConfig, ['page_templates', 'tags_style']), 'blur'),
  }
}

function writePageTemplates(themeContent: string, rawData: unknown) {
  const data = getRecord(rawData)
  return setYamlPaths(themeContent, [
    { path: ['page_templates', 'friends_column'], value: getNumber(data.friends_column, 2) },
    { path: ['page_templates', 'tags_style'], value: getString(data.tags_style, 'blur') },
  ])
}

export const redefineAdapter: CustomizeAdapter = {
  id: 'redefine',
  label: 'Hexo Theme Redefine',
  themeNames: ['redefine'],
  isEnabled: (context) => context.detectedTheme?.toLowerCase() === 'redefine',
  files: [
    redefineConfigFile,
    bookmarksPageFile,
    bookmarksDataFile,
    linksPageFile,
    linksDataFile,
  ],
  panels: panelDescriptors,
  readPanel(panelId, context) {
    if (panelId === 'redefine-basic') return readBasics(context.siteConfig, context.themeConfig)
    if (panelId === 'redefine-visual') return readVisual(context.themeConfig)
    if (panelId === 'redefine-home-banner') return readHomeBanner(context.themeConfig)
    if (panelId === 'redefine-navigation') return readNavigation(context.themeConfig)
    if (panelId === 'redefine-bookmarks') {
      const page = context.files['redefine-bookmarks-page']
      const data = context.files['redefine-bookmarks-data']
      return readBookmarks(page?.content ?? '', Boolean(page?.exists), data?.content ?? '')
    }
    if (panelId === 'redefine-links') {
      const page = context.files['redefine-links-page']
      const data = context.files['redefine-links-data']
      return readLinks(page?.content ?? '', Boolean(page?.exists), data?.content ?? '')
    }
    if (panelId === 'redefine-page-templates') return readPageTemplates(context.themeConfig)
    throw new Error(`Unknown Redefine panel: ${panelId}`)
  },
  writePanel(panelId, context) {
    const themeContent = context.files['redefine-config']?.content ?? ''
    if (panelId === 'redefine-basic') {
      return { files: [{ id: 'redefine-config', content: writeBasics(themeContent, context.data) }] }
    }
    if (panelId === 'redefine-visual') return { files: [{ id: 'redefine-config', content: writeVisual(themeContent, context.data) }] }
    if (panelId === 'redefine-home-banner') return { files: [{ id: 'redefine-config', content: writeHomeBanner(themeContent, context.data) }] }
    if (panelId === 'redefine-navigation') return { files: [{ id: 'redefine-config', content: writeNavigation(themeContent, context.data) }] }
    if (panelId === 'redefine-bookmarks') {
      const result = writeBookmarks(context.data)
      return {
        files: [
          { id: 'redefine-bookmarks-page', content: result.pageContent },
          { id: 'redefine-bookmarks-data', content: result.dataContent },
        ],
      }
    }
    if (panelId === 'redefine-links') {
      const result = writeLinks(context.data)
      return {
        files: [
          { id: 'redefine-links-page', content: result.pageContent },
          { id: 'redefine-links-data', content: result.dataContent },
        ],
      }
    }
    if (panelId === 'redefine-page-templates') {
      return { files: [{ id: 'redefine-config', content: writePageTemplates(themeContent, context.data) }] }
    }
    throw new Error(`Unknown Redefine panel: ${panelId}`)
  },
}
