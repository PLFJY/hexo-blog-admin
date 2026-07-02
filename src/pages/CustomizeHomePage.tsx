import {
  Badge,
  Body1,
  Button,
  Text,
  Title1,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  CodeRegular,
  DocumentEditRegular,
  OpenRegular,
} from '@fluentui/react-icons'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { getJson } from '../lib/apiClient'
import { getCachedAdminIndex, setCachedAdminIndex } from '../lib/indexCache'
import type { PostTreeResponse } from '../shared/postTypes'
import type { CustomizeAdapterSummary, CustomizeFileDescriptor, CustomizeManifestResponse, CustomizePanelDescriptor, CustomizePanelGroup } from '../shared/customizeTypes'
import { usePageStyles } from './pageStyles'

const useStyles = makeStyles({
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalL,
    '@media (max-width: 960px)': {
      gridTemplateColumns: '1fr',
    },
  },
  summaryItem: {
    display: 'grid',
    gap: tokens.spacingVerticalXS,
    minWidth: 0,
  },
  groups: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
  },
  panelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  panelCard: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    alignContent: 'space-between',
    minWidth: 0,
  },
  titleBlock: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    minWidth: 0,
  },
  subtitle: {
    display: 'block',
    overflowWrap: 'anywhere',
  },
  fileList: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
  fileItem: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    minWidth: 0,
    padding: `${tokens.spacingVerticalS} 0`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  path: {
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
    overflowWrap: 'anywhere',
  },
})

type State =
  | { status: 'loading' }
  | { status: 'ready'; manifest: CustomizeManifestResponse; message?: string; syncing?: boolean }
  | { status: 'error'; message: string }

type SettingsScope = 'hexo' | 'theme'

const adapterLabels: Record<string, string> = {
  common: 'Hexo Common',
  redefine: 'Hexo Theme Redefine',
}

const panelSummaries: Record<string, Omit<CustomizePanelDescriptor, 'id'>> = {
  'site-basic': {
    adapterId: 'common',
    title: 'Hexo 站点基础信息',
    description: '维护 Hexo 主配置中的站点标题、作者、语言、时区和 URL。',
    group: 'basic',
    fileIds: ['site-config'],
  },
  'about-page': {
    adapterId: 'common',
    title: 'About 页面',
    description: '维护 source/about/index.md 的 Front Matter 和正文。',
    group: 'pages',
    fileIds: ['about-page'],
  },
  'redefine-basic': {
    adapterId: 'redefine',
    title: 'Redefine 基础信息',
    description: '维护 Redefine 主题配置中的 info 区域。',
    group: 'basic',
    fileIds: ['redefine-config'],
  },
  'redefine-visual': {
    adapterId: 'redefine',
    title: '视觉基础',
    description: '维护 favicon、logo、avatar、主题主色和默认明暗模式。',
    group: 'visual',
    fileIds: ['redefine-config'],
  },
  'redefine-home-banner': {
    adapterId: 'redefine',
    title: '首页 Banner',
    description: '维护首页 Banner 图片、标题、打字文案和社交链接。',
    group: 'visual',
    fileIds: ['redefine-config'],
  },
  'redefine-navigation': {
    adapterId: 'redefine',
    title: '导航栏 / 侧边栏',
    description: '维护导航栏链接、搜索、颜色、侧边栏链接和公告。',
    group: 'navigation',
    fileIds: ['redefine-config'],
  },
  'redefine-bookmarks': {
    adapterId: 'redefine',
    title: 'Bookmarks 管理',
    description: '维护 bookmarks 页面 Front Matter 和 source/_data/bookmarks.yml。',
    group: 'data',
    fileIds: ['redefine-bookmarks-page', 'redefine-bookmarks-data'],
  },
  'redefine-links': {
    adapterId: 'redefine',
    title: 'Links / Friends 管理',
    description: '维护 links 页面 Front Matter 和 source/_data/links.yml。',
    group: 'data',
    fileIds: ['redefine-links-page', 'redefine-links-data'],
  },
  'redefine-page-templates': {
    adapterId: 'redefine',
    title: 'Page Templates 常用项',
    description: '维护 friends_column 和 tags_style。',
    group: 'pages',
    fileIds: ['redefine-config'],
  },
}

function indexToCustomizeManifest(index: PostTreeResponse): CustomizeManifestResponse {
  const adapterIds = index.customize?.availableAdapters?.length ? index.customize.availableAdapters : ['common']
  const enabledAdapters: CustomizeAdapterSummary[] = adapterIds.map((id) => ({
    id,
    label: adapterLabels[id] ?? id,
    themeNames: id === 'common' ? ['*'] : [id],
  }))
  const panelIds = index.customize?.availablePanels ?? []
  const panels = panelIds
    .map((id) => panelSummaries[id] ? { id, ...panelSummaries[id] } : undefined)
    .filter((panel): panel is CustomizePanelDescriptor => Boolean(panel))
  const files: CustomizeFileDescriptor[] = (index.customize?.files ?? []).map((file) => ({
    id: file.id,
    adapterId: file.id.startsWith('redefine-') || file.id === 'redefine-config' ? 'redefine' : 'common',
    label: file.path,
    path: file.path,
    language: file.type === 'yaml' || file.type === 'markdown' || file.type === 'text' ? file.type : 'text',
    exists: Boolean(file.exists),
  }))

  return {
    site: {
      title: index.site?.title,
      subtitle: index.site?.subtitle,
      author: index.site?.author,
      url: index.site?.url,
      language: index.site?.language,
      timezone: index.site?.timezone,
      themeName: index.site?.theme?.name ?? index.customize?.detectedTheme,
      themePackageName: index.site?.theme?.packageName,
      themePackageVersion: index.site?.theme?.packageVersion,
      themeConfigPath: index.site?.theme?.configPath,
    },
    detectedTheme: index.customize?.detectedTheme ?? index.site?.theme?.name,
    enabledAdapters,
    panels,
    files,
  }
}

const groupLabels: Record<CustomizePanelGroup, string> = {
  basic: 'customize.groups.basic',
  visual: 'customize.groups.visual',
  navigation: 'customize.groups.navigation',
  pages: 'customize.groups.pages',
  data: 'customize.groups.data',
  advanced: 'customize.groups.advanced',
}

const matchesScope = (adapterId: string, scope: SettingsScope) => scope === 'hexo' ? adapterId === 'common' : adapterId !== 'common'

function themeDisplayName(manifest: CustomizeManifestResponse) {
  const themeName = manifest.detectedTheme ?? manifest.site.themeName
  if (!themeName) return undefined
  return themeName.toLowerCase() === 'redefine' ? 'Redefine' : themeName
}

export function CustomizeHomePage({ scope }: { scope: SettingsScope }) {
  const styles = usePageStyles()
  const localStyles = useStyles()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = () => {
    const cached = getCachedAdminIndex()
    if (cached) {
      setState({ status: 'ready', manifest: indexToCustomizeManifest(cached), syncing: true })
    } else {
      setState({ status: 'loading' })
    }

    void getJson<PostTreeResponse>('/index')
      .then((index) => {
        setCachedAdminIndex(index)
        setState({ status: 'ready', manifest: indexToCustomizeManifest(index), syncing: false })
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error'
        setState((current) => (current.status === 'ready' ? { ...current, syncing: false, message } : { status: 'error', message }))
      })
  }

  useEffect(() => {
    queueMicrotask(load)
  }, [])

  const groupedPanels = useMemo(() => {
    if (state.status !== 'ready') return []
    const groups = new Map<CustomizePanelGroup, typeof state.manifest.panels>()
    for (const panel of state.manifest.panels.filter((panel) => matchesScope(panel.adapterId, scope))) {
      groups.set(panel.group, [...(groups.get(panel.group) ?? []), panel])
    }
    return (['basic', 'visual', 'navigation', 'pages', 'data', 'advanced'] as CustomizePanelGroup[])
      .map((group) => ({ group, panels: groups.get(group) ?? [] }))
      .filter((group) => group.panels.length > 0)
  }, [scope, state])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  const manifest = state.manifest
  const files = manifest.files.filter((file) => matchesScope(file.adapterId, scope))
  const adapters = manifest.enabledAdapters.filter((adapter) => matchesScope(adapter.id, scope))
  const themeName = themeDisplayName(manifest)
  const pageTitle = scope === 'hexo' ? t('customize.hexoTitle') : themeName ? t('customize.themeTitleNamed', { theme: themeName }) : t('customize.themeTitle')
  const pageDescription = scope === 'hexo' ? t('customize.hexoDescription') : t('customize.themeDescription')

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{pageTitle}</Title1>
        <Body1 className={localStyles.subtitle}>{pageDescription}</Body1>
      </header>

      <section className={styles.card}>
        <Title3>{t('customize.currentSite')}</Title3>
        {state.message ? <Text>{state.message}</Text> : null}
        <div className={localStyles.summaryGrid}>
          <div className={localStyles.summaryItem}>
            <Text size={200}>{t('customize.summary.title')}</Text>
            <Text weight="semibold">{manifest.site.title ?? '-'}</Text>
          </div>
          <div className={localStyles.summaryItem}>
            <Text size={200}>{t('customize.summary.theme')}</Text>
            <Text weight="semibold">{manifest.detectedTheme ?? '-'}</Text>
          </div>
          <div className={localStyles.summaryItem}>
            <Text size={200}>{t('customize.summary.themePackage')}</Text>
            <Text weight="semibold">
              {manifest.site.themePackageName ?? '-'} {manifest.site.themePackageVersion ?? ''}
            </Text>
          </div>
          <div className={localStyles.summaryItem}>
            <Text size={200}>{t('customize.summary.author')}</Text>
            <Text>{manifest.site.author ?? '-'}</Text>
          </div>
          <div className={localStyles.summaryItem}>
            <Text size={200}>URL</Text>
            <Text>{manifest.site.url ?? '-'}</Text>
          </div>
          <div className={localStyles.summaryItem}>
            <Text size={200}>{t('customize.summary.themeConfig')}</Text>
            <Text className={localStyles.path}>{manifest.site.themeConfigPath ?? '-'}</Text>
          </div>
        </div>
        <div className={styles.row}>
          {adapters.map((adapter) => (
            <Badge key={adapter.id} appearance="filled" color={adapter.id === 'common' ? 'informative' : 'brand'}>
              {adapter.label}
            </Badge>
          ))}
        </div>
      </section>

      <section className={localStyles.groups}>
        {groupedPanels.map((group) => (
          <section key={group.group} className={styles.grid}>
            <Title3>{t(groupLabels[group.group])}</Title3>
            <div className={localStyles.panelGrid}>
              {group.panels.map((panel) => (
                <section key={panel.id} className={styles.card}>
                  <div className={localStyles.panelCard}>
                    <div className={localStyles.titleBlock}>
                      <Title3>{t(`customize.panels.${panel.id}.title`, { defaultValue: panel.title })}</Title3>
                      <Body1 className={localStyles.subtitle}>
                        {t(`customize.panels.${panel.id}.description`, { defaultValue: panel.description })}
                      </Body1>
                    </div>
                    <Button
                      appearance="primary"
                      icon={<OpenRegular />}
                      onClick={() => navigate(`/${scope === 'hexo' ? 'hexo-settings' : 'theme-settings'}/panel/${encodeURIComponent(panel.id)}`)}
                    >
                      {t('customize.openPanel')}
                    </Button>
                  </div>
                </section>
              ))}
            </div>
          </section>
        ))}
      </section>

      <section className={styles.card}>
        <div className={localStyles.titleBlock}>
          <Title3>{t('customize.rawEditor')}</Title3>
          <Body1 className={localStyles.subtitle}>{t('customize.rawEditorDescription')}</Body1>
        </div>
        <ul className={localStyles.fileList}>
          {files.map((file) => (
            <li className={localStyles.fileItem} key={file.id}>
              <div>
                <Text weight="semibold">{file.label}</Text>
                <br />
                <Text size={200} className={localStyles.path}>{file.path}</Text>
              </div>
              <div className={styles.row}>
                <Badge appearance="outline" color={file.exists ? 'success' : 'warning'}>
                  {file.exists ? t('customize.fileExists') : t('customize.fileCreatable')}
                </Badge>
                <Button icon={<CodeRegular />} onClick={() => navigate(`/${scope === 'hexo' ? 'hexo-settings' : 'theme-settings'}/file/${encodeURIComponent(file.id)}`)}>
                  {t('actions.edit')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {scope === 'hexo' ? (
        <Button icon={<DocumentEditRegular />} onClick={() => navigate('/hexo-settings/file/site-config')}>
          {t('customize.editHexoConfig')}
        </Button>
        ) : null}
      </section>
    </section>
  )
}
