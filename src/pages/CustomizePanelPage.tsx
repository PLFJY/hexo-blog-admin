import {
  Body1,
  Button,
  Checkbox,
  Field,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  Textarea,
  Title1,
  Title2,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  AddRegular,
  ArrowDownRegular,
  ArrowUpRegular,
  DeleteRegular,
  OpenRegular,
  SaveRegular,
} from '@fluentui/react-icons'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { HexColorPicker } from 'react-colorful'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { getJson, sendJson } from '../lib/apiClient'
import type {
  BookmarksPanelData,
  CustomizePanelResponse,
  CustomizeSaveResponse,
  KeyValueLinkItem,
  LinksPanelData,
  MarkdownPageData,
  NamedLinkItem,
} from '../shared/customizeTypes'
import { usePageStyles } from './pageStyles'
import { BackToCustomizeButton, CustomizeSaveStatusPanel } from './customizeShared'
import { useCommitDeployTracker } from './useCommitDeployTracker'

const useStyles = makeStyles({
  section: {
    display: 'grid',
    gap: tokens.spacingVerticalL,
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
  compactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalL,
    '@media (max-width: 720px)': {
      gridTemplateColumns: '1fr',
    },
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  itemBox: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    minWidth: 0,
  },
  nestedList: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
  },
  inputPreviewStack: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
  },
  inputActionRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  colorPicker: {
    width: '220px',
    maxWidth: '70vw',
  },
  colorPopover: {
    padding: tokens.spacingVerticalM,
  },
  swatchButton: {
    width: '28px',
    height: '28px',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
    padding: 0,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundImage: 'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)',
    backgroundSize: '10px 10px',
    backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0',
    cursor: 'pointer',
    ':focus-visible': {
      outline: `2px solid ${tokens.colorStrokeFocus2}`,
      outlineOffset: '2px',
    },
  },
  colorPreview: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    minWidth: 0,
  },
  imagePreview: {
    width: '100%',
    maxWidth: '240px',
    height: '96px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  iconPreview: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    minWidth: 0,
    color: tokens.colorNeutralForeground2,
  },
  iconGlyph: {
    width: '32px',
    height: '32px',
    display: 'inline-grid',
    placeItems: 'center',
    flexShrink: 0,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    fontSize: '16px',
  },
  iconImage: {
    width: '18px',
    height: '18px',
    objectFit: 'contain',
  },
  previewText: {
    overflowWrap: 'anywhere',
  },
  dangerButton: {
    color: tokens.colorPaletteRedForeground1,
  },
})

type SiteBasicsData = {
  title: string
  subtitle: string
  description: string
  author: string
  language: string
  timezone: string
  url: string
}

type RedefineBasicsData = {
  site: SiteBasicsData
  info: {
    title: string
    subtitle: string
    author: string
    url: string
  }
}

type VisualData = {
  defaults: {
    favicon: string
    logo: string
    avatar: string
  }
  colors: {
    primary: string
    secondary: string
    default_mode: string
  }
}

type HomeBannerData = {
  enable: boolean
  style: string
  image: {
    light: string
    dark: string
  }
  title: string
  subtitle: {
    text: string[]
    typing_speed: number
    backing_speed: number
    starting_delay: number
    backing_delay: number
    loop: boolean
    smart_backspace: boolean
  }
  text_color: {
    light: string
    dark: string
  }
  social_links: {
    enable: boolean
    style: string
    links: KeyValueLinkItem[]
    qrs: KeyValueLinkItem[]
  }
}

type NavigationData = {
  navbar: {
    auto_hide: boolean
    color: {
      left: string
      right: string
      transparency: number
    }
    search: {
      enable: boolean
      preload: boolean
    }
    links: NamedLinkItem[]
  }
  sidebar: {
    position: string
    announcement: string
    show_on_mobile: boolean
    links: NamedLinkItem[]
  }
}

type PageTemplatesData = {
  friends_column: number
  tags_style: string
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; panel: CustomizePanelResponse; data: unknown; saving?: boolean; message?: string }
  | { status: 'error'; message: string }

export function CustomizePanelPage() {
  const styles = usePageStyles()
  const localStyles = useStyles()
  const params = useParams()
  const panelId = params.panelId ?? ''
  const [state, setState] = useState<State>({ status: 'loading' })
  const tracker = useCommitDeployTracker()
  const { t } = useTranslation()

  const load = () => {
    if (!panelId) {
      setState({ status: 'error', message: 'panelId is required' })
      return
    }
    setState({ status: 'loading' })
    void getJson<CustomizePanelResponse>(`/customize/panel?id=${encodeURIComponent(panelId)}`)
      .then((panel) => setState({ status: 'ready', panel, data: panel.data }))
      .catch((error: unknown) => setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  useEffect(() => {
    let active = true
    if (!panelId) {
      setTimeout(() => {
        if (active) setState({ status: 'error', message: 'panelId is required' })
      }, 0)
      return () => {
        active = false
      }
    }
    void getJson<CustomizePanelResponse>(`/customize/panel?id=${encodeURIComponent(panelId)}`)
      .then((panel) => {
        if (active) setState({ status: 'ready', panel, data: panel.data })
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' })
      })
    return () => {
      active = false
    }
  }, [panelId])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  const updateData = (data: unknown) => setState({ ...state, data })
  const save = () => {
    setState({ ...state, saving: true, message: undefined })
    void sendJson<CustomizeSaveResponse>('/customize/panel', 'PUT', {
      id: state.panel.panel.id,
      data: state.data,
    })
      .then((response) => {
        setState({ ...state, saving: false })
        tracker.start(response.commitSha)
      })
      .catch((error: unknown) => setState({ ...state, saving: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <BackToCustomizeButton />
        </div>
        <Title1>{t(`customize.panels.${state.panel.panel.id}.title`, { defaultValue: state.panel.panel.title })}</Title1>
        <Body1 className={localStyles.subtitle}>
          {t(`customize.panels.${state.panel.panel.id}.description`, { defaultValue: state.panel.panel.description })}
        </Body1>
      </header>

      {state.message ? (
        <section className={styles.card}>
          <Text>{state.message}</Text>
        </section>
      ) : null}
      <CustomizeSaveStatusPanel status={tracker.status} />

      <section className={styles.card}>
        <div className={styles.row}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={save} disabled={state.saving}>
            {state.saving ? t('actions.saving') : t('actions.save')}
          </Button>
        </div>
        <PanelEditor panelId={state.panel.panel.id} data={state.data} onChange={updateData} />
      </section>
    </section>
  )
}

function PanelEditor({ panelId, data, onChange }: { panelId: string; data: unknown; onChange: (data: unknown) => void }) {
  if (panelId === 'site-basic') {
    return <SiteBasicsEditor data={data as SiteBasicsData} onChange={onChange} />
  }
  if (panelId === 'about-page') {
    return <MarkdownPageEditor data={data as MarkdownPageData} onChange={onChange} />
  }
  if (panelId === 'redefine-basic') {
    return <RedefineBasicsEditor data={data as RedefineBasicsData} onChange={onChange} />
  }
  if (panelId === 'redefine-visual') {
    return <VisualEditor data={data as VisualData} onChange={onChange} />
  }
  if (panelId === 'redefine-home-banner') {
    return <HomeBannerEditor data={data as HomeBannerData} onChange={onChange} />
  }
  if (panelId === 'redefine-navigation') {
    return <NavigationEditor data={data as NavigationData} onChange={onChange} />
  }
  if (panelId === 'redefine-bookmarks') {
    return <BookmarksEditor data={data as BookmarksPanelData} onChange={onChange} />
  }
  if (panelId === 'redefine-links') {
    return <LinksEditor data={data as LinksPanelData} onChange={onChange} />
  }
  if (panelId === 'redefine-page-templates') {
    return <PageTemplatesEditor data={data as PageTemplatesData} onChange={onChange} />
  }
  return <Text>Unsupported panel: {panelId}</Text>
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Field label={label}>
      <Input value={value ?? ''} placeholder={placeholder} onChange={(_, field) => onChange(field.value)} />
    </Field>
  )
}

function UrlField({
  label,
  value,
  onChange,
  imagePreview,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  imagePreview?: boolean
}) {
  const styles = useStyles()
  const { t } = useTranslation()
  const trimmed = value?.trim() ?? ''
  const href = trimmed || undefined
  const showImage = Boolean(imagePreview && trimmed)
  return (
    <Field label={label}>
      <div className={styles.inputPreviewStack}>
        <div className={styles.inputActionRow}>
          <Input value={value ?? ''} onChange={(_, field) => onChange(field.value)} />
          <Button
            as="a"
            href={href}
            target="_blank"
            rel="noreferrer"
            appearance="subtle"
            icon={<OpenRegular />}
            disabled={!href}
            aria-label={t('customize.openPreview')}
          />
        </div>
        {showImage ? (
          <img
            className={styles.imagePreview}
            src={trimmed}
            alt={t('customize.imagePreview')}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
      </div>
    </Field>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  const pickerValue = normalizeHexColor(value) ?? '#000000'
  return (
    <Field label={label}>
      <div className={styles.inputPreviewStack}>
        <Input value={value ?? ''} onChange={(_, field) => onChange(field.value)} />
        <div className={styles.colorPreview}>
          <Popover positioning="below-start">
            <PopoverTrigger disableButtonEnhancement>
              <button
                type="button"
                className={styles.swatchButton}
                style={{ backgroundColor: value || 'transparent' }}
                title={t('customize.pickColor')}
                aria-label={t('customize.pickColor')}
              />
            </PopoverTrigger>
            <PopoverSurface className={styles.colorPopover}>
              <HexColorPicker className={styles.colorPicker} color={pickerValue} onChange={onChange} />
            </PopoverSurface>
          </Popover>
          <Text size={200} className={styles.previewText}>
            {normalizeHexColor(value) ? t('customize.colorPreview') : t('customize.freeformColor')}
          </Text>
        </div>
      </div>
    </Field>
  )
}

function IconField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  const iconSet = detectIconSet(value)
  return (
    <Field label={label}>
      <div className={styles.inputPreviewStack}>
        <Input value={value ?? ''} onChange={(_, field) => onChange(field.value)} />
        <div className={styles.iconPreview}>
          <span className={styles.iconGlyph} aria-hidden>
            <IconPreview value={value} />
          </span>
          <Text size={200} className={styles.previewText}>
            {t('customize.detectedIconSet')}: {t(`customize.iconSets.${iconSet}`)}
          </Text>
        </div>
      </div>
    </Field>
  )
}

function IconPreview({ value }: { value: string }) {
  const styles = useStyles()
  const [failed, setFailed] = useState(false)
  const iconUrl = fontAwesomeIconUrl(value)

  useEffect(() => {
    setFailed(false)
  }, [iconUrl])

  if (iconUrl && !failed) {
    return <img className={styles.iconImage} src={iconUrl} alt="" onError={() => setFailed(true)} />
  }
  return <>{iconFallback(value)}</>
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        value={String(value ?? 0)}
        onChange={(_, field) => {
          const parsed = Number(field.value)
          onChange(Number.isFinite(parsed) ? parsed : 0)
        }}
      />
    </Field>
  )
}

function BooleanField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Checkbox label={label} checked={Boolean(value)} onChange={(_, field) => onChange(Boolean(field.checked))} />
}

function SiteBasicsEditor({ data, onChange }: { data: SiteBasicsData; onChange: (data: SiteBasicsData) => void }) {
  const { t } = useTranslation()
  return (
    <TwoColumnSection>
      <TextField label={t('customize.fields.siteTitle')} value={data.title} onChange={(title) => onChange({ ...data, title })} />
      <TextField label={t('customize.fields.siteSubtitle')} value={data.subtitle} onChange={(subtitle) => onChange({ ...data, subtitle })} />
      <TextField label={t('customize.fields.description')} value={data.description} onChange={(description) => onChange({ ...data, description })} />
      <TextField label={t('customize.fields.author')} value={data.author} onChange={(author) => onChange({ ...data, author })} />
      <TextField label={t('customize.fields.language')} value={data.language} onChange={(language) => onChange({ ...data, language })} />
      <TextField label={t('customize.fields.timezone')} value={data.timezone} onChange={(timezone) => onChange({ ...data, timezone })} />
      <UrlField label="url" value={data.url} onChange={(url) => onChange({ ...data, url })} />
    </TwoColumnSection>
  )
}

function RedefineBasicsEditor({ data, onChange }: { data: RedefineBasicsData; onChange: (data: RedefineBasicsData) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  return (
    <div className={styles.section}>
      <Title2>Hexo _config.yml</Title2>
      <SiteBasicsEditor data={data.site} onChange={(site) => onChange({ ...data, site })} />
      <Title2>Redefine info</Title2>
      <TwoColumnSection>
        <TextField label={t('customize.fields.themeTitle')} value={data.info.title} onChange={(title) => onChange({ ...data, info: { ...data.info, title } })} />
        <TextField label={t('customize.fields.themeSubtitle')} value={data.info.subtitle} onChange={(subtitle) => onChange({ ...data, info: { ...data.info, subtitle } })} />
        <TextField label={t('customize.fields.themeAuthor')} value={data.info.author} onChange={(author) => onChange({ ...data, info: { ...data.info, author } })} />
        <UrlField label={t('customize.fields.themeUrl')} value={data.info.url} onChange={(url) => onChange({ ...data, info: { ...data.info, url } })} />
      </TwoColumnSection>
    </div>
  )
}

function VisualEditor({ data, onChange }: { data: VisualData; onChange: (data: VisualData) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  return (
    <div className={styles.section}>
      <Title2>{t('customize.sections.images')}</Title2>
      <TwoColumnSection>
        <UrlField label="favicon" value={data.defaults.favicon} imagePreview onChange={(favicon) => onChange({ ...data, defaults: { ...data.defaults, favicon } })} />
        <UrlField label="logo" value={data.defaults.logo} imagePreview onChange={(logo) => onChange({ ...data, defaults: { ...data.defaults, logo } })} />
        <UrlField label="avatar" value={data.defaults.avatar} imagePreview onChange={(avatar) => onChange({ ...data, defaults: { ...data.defaults, avatar } })} />
      </TwoColumnSection>
      <Title2>{t('customize.sections.colors')}</Title2>
      <TwoColumnSection>
        <ColorField label={t('customize.fields.primaryColor')} value={data.colors.primary} onChange={(primary) => onChange({ ...data, colors: { ...data.colors, primary } })} />
        <ColorField label={t('customize.fields.secondaryColor')} value={data.colors.secondary} onChange={(secondary) => onChange({ ...data, colors: { ...data.colors, secondary } })} />
        <TextField label={t('customize.fields.defaultMode')} value={data.colors.default_mode} onChange={(defaultMode) => onChange({ ...data, colors: { ...data.colors, default_mode: defaultMode } })} />
      </TwoColumnSection>
    </div>
  )
}

function HomeBannerEditor({ data, onChange }: { data: HomeBannerData; onChange: (data: HomeBannerData) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  return (
    <div className={styles.section}>
      <Title2>Banner</Title2>
      <BooleanField label={t('customize.fields.enable')} value={data.enable} onChange={(enable) => onChange({ ...data, enable })} />
      <TwoColumnSection>
        <TextField label={t('customize.fields.bannerStyle')} value={data.style} onChange={(style) => onChange({ ...data, style })} />
        <TextField label={t('customize.fields.bannerTitle')} value={data.title} onChange={(title) => onChange({ ...data, title })} />
        <UrlField label={t('customize.fields.lightImage')} value={data.image.light} imagePreview onChange={(light) => onChange({ ...data, image: { ...data.image, light } })} />
        <UrlField label={t('customize.fields.darkImage')} value={data.image.dark} imagePreview onChange={(dark) => onChange({ ...data, image: { ...data.image, dark } })} />
        <ColorField label={t('customize.fields.lightTextColor')} value={data.text_color.light} onChange={(light) => onChange({ ...data, text_color: { ...data.text_color, light } })} />
        <ColorField label={t('customize.fields.darkTextColor')} value={data.text_color.dark} onChange={(dark) => onChange({ ...data, text_color: { ...data.text_color, dark } })} />
      </TwoColumnSection>
      <Title2>{t('customize.sections.typingText')}</Title2>
      <StringListEditor
        items={data.subtitle.text}
        addLabel={t('customize.addText')}
        onChange={(text) => onChange({ ...data, subtitle: { ...data.subtitle, text } })}
      />
      <TwoColumnSection>
        <NumberField label={t('customize.fields.typingSpeed')} value={data.subtitle.typing_speed} onChange={(typingSpeed) => onChange({ ...data, subtitle: { ...data.subtitle, typing_speed: typingSpeed } })} />
        <NumberField label={t('customize.fields.backingSpeed')} value={data.subtitle.backing_speed} onChange={(backingSpeed) => onChange({ ...data, subtitle: { ...data.subtitle, backing_speed: backingSpeed } })} />
        <NumberField label={t('customize.fields.startingDelay')} value={data.subtitle.starting_delay} onChange={(startingDelay) => onChange({ ...data, subtitle: { ...data.subtitle, starting_delay: startingDelay } })} />
        <NumberField label={t('customize.fields.backingDelay')} value={data.subtitle.backing_delay} onChange={(backingDelay) => onChange({ ...data, subtitle: { ...data.subtitle, backing_delay: backingDelay } })} />
      </TwoColumnSection>
      <div className={styles.row}>
        <BooleanField label="loop" value={data.subtitle.loop} onChange={(loop) => onChange({ ...data, subtitle: { ...data.subtitle, loop } })} />
        <BooleanField label={t('customize.fields.smartBackspace')} value={data.subtitle.smart_backspace} onChange={(smartBackspace) => onChange({ ...data, subtitle: { ...data.subtitle, smart_backspace: smartBackspace } })} />
      </div>
      <Title2>{t('customize.sections.socialLinks')}</Title2>
      <div className={styles.row}>
        <BooleanField label={t('customize.fields.enableSocialLinks')} value={data.social_links.enable} onChange={(enable) => onChange({ ...data, social_links: { ...data.social_links, enable } })} />
        <TextField label={t('customize.fields.linkStyle')} value={data.social_links.style} onChange={(style) => onChange({ ...data, social_links: { ...data.social_links, style } })} />
      </div>
      <KeyValueListEditor
        title="links"
        items={data.social_links.links}
        onChange={(links) => onChange({ ...data, social_links: { ...data.social_links, links } })}
      />
      <KeyValueListEditor
        title="qrs"
        items={data.social_links.qrs}
        onChange={(qrs) => onChange({ ...data, social_links: { ...data.social_links, qrs } })}
      />
    </div>
  )
}

function NavigationEditor({ data, onChange }: { data: NavigationData; onChange: (data: NavigationData) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  return (
    <div className={styles.section}>
      <Title2>Navbar</Title2>
      <div className={styles.row}>
        <BooleanField label={t('customize.fields.autoHide')} value={data.navbar.auto_hide} onChange={(autoHide) => onChange({ ...data, navbar: { ...data.navbar, auto_hide: autoHide } })} />
        <BooleanField label={t('customize.fields.enableSearch')} value={data.navbar.search.enable} onChange={(enable) => onChange({ ...data, navbar: { ...data.navbar, search: { ...data.navbar.search, enable } } })} />
        <BooleanField label={t('customize.fields.preloadSearch')} value={data.navbar.search.preload} onChange={(preload) => onChange({ ...data, navbar: { ...data.navbar, search: { ...data.navbar.search, preload } } })} />
      </div>
      <TwoColumnSection>
        <ColorField label={t('customize.fields.leftColor')} value={data.navbar.color.left} onChange={(left) => onChange({ ...data, navbar: { ...data.navbar, color: { ...data.navbar.color, left } } })} />
        <ColorField label={t('customize.fields.rightColor')} value={data.navbar.color.right} onChange={(right) => onChange({ ...data, navbar: { ...data.navbar, color: { ...data.navbar.color, right } } })} />
        <NumberField label={t('customize.fields.transparency')} value={data.navbar.color.transparency} onChange={(transparency) => onChange({ ...data, navbar: { ...data.navbar, color: { ...data.navbar.color, transparency } } })} />
      </TwoColumnSection>
      <NamedLinkListEditor
        title="navbar.links"
        items={data.navbar.links}
        onChange={(links) => onChange({ ...data, navbar: { ...data.navbar, links } })}
      />

      <Title2>Sidebar</Title2>
      <div className={styles.row}>
        <BooleanField label={t('customize.fields.showOnMobile')} value={data.sidebar.show_on_mobile} onChange={(showOnMobile) => onChange({ ...data, sidebar: { ...data.sidebar, show_on_mobile: showOnMobile } })} />
      </div>
      <TwoColumnSection>
        <TextField label={t('customize.fields.sidebarPosition')} value={data.sidebar.position} onChange={(position) => onChange({ ...data, sidebar: { ...data.sidebar, position } })} />
        <TextField label={t('customize.fields.announcement')} value={data.sidebar.announcement} onChange={(announcement) => onChange({ ...data, sidebar: { ...data.sidebar, announcement } })} />
      </TwoColumnSection>
      <NamedLinkListEditor
        title="home.sidebar.links"
        items={data.sidebar.links}
        onChange={(links) => onChange({ ...data, sidebar: { ...data.sidebar, links } })}
      />
    </div>
  )
}

function BookmarksEditor({ data, onChange }: { data: BookmarksPanelData; onChange: (data: BookmarksPanelData) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  const updateCategory = (index: number, category: BookmarksPanelData['categories'][number]) =>
    onChange({ ...data, categories: data.categories.map((item, itemIndex) => itemIndex === index ? category : item) })
  return (
    <div className={styles.section}>
      <MarkdownPageEditor data={data.page} onChange={(page) => onChange({ ...data, page })} />
      <div className={styles.row}>
        <Title2>{t('customize.sections.bookmarksData')}</Title2>
        <Button icon={<AddRegular />} onClick={() => onChange({ ...data, categories: [...data.categories, { category: t('customize.defaultCategory'), icon: '', items: [] }] })}>
          {t('customize.addCategory')}
        </Button>
      </div>
      <div className={styles.nestedList}>
        {data.categories.map((category, index) => (
          <section className={styles.itemBox} key={`${category.category}-${index}`}>
            <ItemActions
              title={category.category || t('customize.fallbackCategory', { index: index + 1 })}
              index={index}
              length={data.categories.length}
              onMove={(to) => onChange({ ...data, categories: moveItem(data.categories, index, to) })}
              onDelete={() => onChange({ ...data, categories: data.categories.filter((_, itemIndex) => itemIndex !== index) })}
            />
            <TwoColumnSection>
              <TextField label={t('customize.fields.categoryName')} value={category.category} onChange={(value) => updateCategory(index, { ...category, category: value })} />
              <IconField label={t('customize.fields.icon')} value={category.icon} onChange={(icon) => updateCategory(index, { ...category, icon })} />
            </TwoColumnSection>
            <div className={styles.row}>
              <Title3>{t('customize.sections.bookmarks')}</Title3>
              <Button icon={<AddRegular />} onClick={() => updateCategory(index, { ...category, items: [...category.items, { name: '', link: '', description: '', image: '' }] })}>
                {t('customize.addBookmark')}
              </Button>
            </div>
            {category.items.map((bookmark, bookmarkIndex) => (
              <section className={styles.itemBox} key={`${bookmark.name}-${bookmarkIndex}`}>
                <ItemActions
                  title={bookmark.name || t('customize.fallbackBookmark', { index: bookmarkIndex + 1 })}
                  index={bookmarkIndex}
                  length={category.items.length}
                  onMove={(to) => updateCategory(index, { ...category, items: moveItem(category.items, bookmarkIndex, to) })}
                  onDelete={() => updateCategory(index, { ...category, items: category.items.filter((_, itemIndex) => itemIndex !== bookmarkIndex) })}
                />
                <TwoColumnSection>
                  <TextField label={t('customize.fields.name')} value={bookmark.name} onChange={(name) => updateCategory(index, { ...category, items: replaceItem(category.items, bookmarkIndex, { ...bookmark, name }) })} />
                  <UrlField label={t('customize.fields.link')} value={bookmark.link} onChange={(link) => updateCategory(index, { ...category, items: replaceItem(category.items, bookmarkIndex, { ...bookmark, link }) })} />
                  <TextField label={t('customize.fields.description')} value={bookmark.description} onChange={(description) => updateCategory(index, { ...category, items: replaceItem(category.items, bookmarkIndex, { ...bookmark, description }) })} />
                  <UrlField label={t('customize.fields.image')} value={bookmark.image} imagePreview onChange={(image) => updateCategory(index, { ...category, items: replaceItem(category.items, bookmarkIndex, { ...bookmark, image }) })} />
                </TwoColumnSection>
              </section>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

function LinksEditor({ data, onChange }: { data: LinksPanelData; onChange: (data: LinksPanelData) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  const updateCategory = (index: number, category: LinksPanelData['categories'][number]) =>
    onChange({ ...data, categories: data.categories.map((item, itemIndex) => itemIndex === index ? category : item) })
  return (
    <div className={styles.section}>
      <MarkdownPageEditor data={data.page} onChange={(page) => onChange({ ...data, page })} />
      <div className={styles.row}>
        <Title2>{t('customize.sections.linksData')}</Title2>
        <Button icon={<AddRegular />} onClick={() => onChange({ ...data, categories: [...data.categories, { links_category: t('customize.defaultCategory'), has_thumbnail: false, list: [] }] })}>
          {t('customize.addCategory')}
        </Button>
      </div>
      <div className={styles.nestedList}>
        {data.categories.map((category, index) => (
          <section className={styles.itemBox} key={`${category.links_category}-${index}`}>
            <ItemActions
              title={category.links_category || t('customize.fallbackCategory', { index: index + 1 })}
              index={index}
              length={data.categories.length}
              onMove={(to) => onChange({ ...data, categories: moveItem(data.categories, index, to) })}
              onDelete={() => onChange({ ...data, categories: data.categories.filter((_, itemIndex) => itemIndex !== index) })}
            />
            <TwoColumnSection>
              <TextField label={t('customize.fields.linksCategory')} value={category.links_category} onChange={(value) => updateCategory(index, { ...category, links_category: value })} />
              <BooleanField label={t('customize.fields.hasThumbnail')} value={category.has_thumbnail} onChange={(hasThumbnail) => updateCategory(index, { ...category, has_thumbnail: hasThumbnail })} />
            </TwoColumnSection>
            <div className={styles.row}>
              <Title3>{t('customize.sections.friendLinks')}</Title3>
              <Button icon={<AddRegular />} onClick={() => updateCategory(index, { ...category, list: [...category.list, { name: '', description: '', link: '', avatar: '', thumbnail: '' }] })}>
                {t('customize.addFriendLink')}
              </Button>
            </div>
            {category.list.map((link, linkIndex) => (
              <section className={styles.itemBox} key={`${link.name}-${linkIndex}`}>
                <ItemActions
                  title={link.name || t('customize.fallbackLink', { index: linkIndex + 1 })}
                  index={linkIndex}
                  length={category.list.length}
                  onMove={(to) => updateCategory(index, { ...category, list: moveItem(category.list, linkIndex, to) })}
                  onDelete={() => updateCategory(index, { ...category, list: category.list.filter((_, itemIndex) => itemIndex !== linkIndex) })}
                />
                <TwoColumnSection>
                  <TextField label={t('customize.fields.name')} value={link.name} onChange={(name) => updateCategory(index, { ...category, list: replaceItem(category.list, linkIndex, { ...link, name }) })} />
                  <TextField label={t('customize.fields.description')} value={link.description} onChange={(description) => updateCategory(index, { ...category, list: replaceItem(category.list, linkIndex, { ...link, description }) })} />
                  <UrlField label={t('customize.fields.link')} value={link.link} onChange={(value) => updateCategory(index, { ...category, list: replaceItem(category.list, linkIndex, { ...link, link: value }) })} />
                  <UrlField label="avatar" value={link.avatar} imagePreview onChange={(avatar) => updateCategory(index, { ...category, list: replaceItem(category.list, linkIndex, { ...link, avatar }) })} />
                  <UrlField label="thumbnail" value={link.thumbnail} imagePreview onChange={(thumbnail) => updateCategory(index, { ...category, list: replaceItem(category.list, linkIndex, { ...link, thumbnail }) })} />
                </TwoColumnSection>
              </section>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

function PageTemplatesEditor({ data, onChange }: { data: PageTemplatesData; onChange: (data: PageTemplatesData) => void }) {
  const { t } = useTranslation()
  return (
    <TwoColumnSection>
      <NumberField label={t('customize.fields.friendsColumn')} value={data.friends_column} onChange={(friendsColumn) => onChange({ ...data, friends_column: friendsColumn })} />
      <TextField label={t('customize.fields.tagsStyle')} value={data.tags_style} onChange={(tagsStyle) => onChange({ ...data, tags_style: tagsStyle })} />
    </TwoColumnSection>
  )
}

function MarkdownPageEditor({ data, onChange }: { data: MarkdownPageData; onChange: (data: MarkdownPageData) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  const keys = [...new Set(['title', 'date', 'template', ...Object.keys(data.frontMatter ?? {})])]
    .filter((key) => data.frontMatter[key] !== undefined || key !== 'template')
  const updateFrontMatter = (key: string, value: string) =>
    onChange({ ...data, frontMatter: { ...data.frontMatter, [key]: value } })
  return (
    <div className={styles.section}>
      <Title2>{t('customize.sections.frontMatter')}</Title2>
      <TwoColumnSection>
        {keys.map((key) => (
          <TextField
            key={key}
            label={key}
            value={frontMatterValue(data.frontMatter[key])}
            onChange={(value) => updateFrontMatter(key, value)}
          />
        ))}
      </TwoColumnSection>
      <Field label={t('customize.fields.pageBody')}>
        <MarkdownEditor value={data.body} onChange={(body) => onChange({ ...data, body })} />
      </Field>
    </div>
  )
}

function StringListEditor({ items, addLabel, onChange }: { items: string[]; addLabel: string; onChange: (items: string[]) => void }) {
  const styles = useStyles()
  return (
    <div className={styles.nestedList}>
      {items.map((item, index) => (
        <div className={styles.itemBox} key={`${item}-${index}`}>
          <ItemActions
            title={`#${index + 1}`}
            index={index}
            length={items.length}
            onMove={(to) => onChange(moveItem(items, index, to))}
            onDelete={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
          />
          <Textarea value={item} resize="vertical" onChange={(_, field) => onChange(replaceItem(items, index, field.value))} />
        </div>
      ))}
      <Button icon={<AddRegular />} onClick={() => onChange([...items, ''])}>{addLabel}</Button>
    </div>
  )
}

function KeyValueListEditor({ title, items, onChange }: { title: string; items: KeyValueLinkItem[]; onChange: (items: KeyValueLinkItem[]) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  const valueIsImage = title === 'qrs'
  return (
    <div className={styles.section}>
      <div className={styles.row}>
        <Title3>{title}</Title3>
        <Button icon={<AddRegular />} onClick={() => onChange([...items, { key: '', value: '' }])}>{t('customize.addItem')}</Button>
      </div>
      {items.map((item, index) => (
        <section className={styles.itemBox} key={`${item.key}-${index}`}>
          <ItemActions
            title={item.key || t('customize.fallbackItem', { index: index + 1 })}
            index={index}
            length={items.length}
            onMove={(to) => onChange(moveItem(items, index, to))}
            onDelete={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
          />
          <TwoColumnSection>
            <IconField label={t('customize.fields.icon')} value={item.key} onChange={(key) => onChange(replaceItem(items, index, { ...item, key }))} />
            <UrlField label={t('customize.fields.value')} value={item.value} imagePreview={valueIsImage} onChange={(value) => onChange(replaceItem(items, index, { ...item, value }))} />
          </TwoColumnSection>
        </section>
      ))}
    </div>
  )
}

function NamedLinkListEditor({ title, items, onChange }: { title: string; items: NamedLinkItem[]; onChange: (items: NamedLinkItem[]) => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  return (
    <div className={styles.section}>
      <div className={styles.row}>
        <Title3>{title}</Title3>
        <Button icon={<AddRegular />} onClick={() => onChange([...items, { name: '', path: '', icon: '' }])}>{t('customize.addLink')}</Button>
      </div>
      {items.map((item, index) => (
        <section className={styles.itemBox} key={`${item.name}-${index}`}>
          <ItemActions
            title={item.name || t('customize.fallbackLink', { index: index + 1 })}
            index={index}
            length={items.length}
            onMove={(to) => onChange(moveItem(items, index, to))}
            onDelete={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
          />
          <TwoColumnSection>
            <TextField label={t('customize.fields.name')} value={item.name} onChange={(name) => onChange(replaceItem(items, index, { ...item, name }))} />
            <UrlField label={t('customize.fields.path')} value={item.path} onChange={(path) => onChange(replaceItem(items, index, { ...item, path }))} />
            <IconField label={t('customize.fields.icon')} value={item.icon} onChange={(icon) => onChange(replaceItem(items, index, { ...item, icon }))} />
          </TwoColumnSection>
        </section>
      ))}
    </div>
  )
}

function ItemActions({
  title,
  index,
  length,
  onMove,
  onDelete,
}: {
  title: string
  index: number
  length: number
  onMove: (to: number) => void
  onDelete: () => void
}) {
  const styles = useStyles()
  const { t } = useTranslation()
  return (
    <div className={styles.row}>
      <Text weight="semibold">{title}</Text>
      <Button appearance="subtle" icon={<ArrowUpRegular />} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={t('customize.moveUp')} />
      <Button appearance="subtle" icon={<ArrowDownRegular />} disabled={index >= length - 1} onClick={() => onMove(index + 1)} aria-label={t('customize.moveDown')} />
      <Button appearance="subtle" className={styles.dangerButton} icon={<DeleteRegular />} onClick={onDelete} aria-label={t('actions.delete')} />
    </div>
  )
}

function TwoColumnSection({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return <div className={styles.compactGrid}>{children}</div>
}

function replaceItem<T>(items: T[], index: number, item: T) {
  return items.map((current, itemIndex) => itemIndex === index ? item : current)
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item === undefined) return items
  next.splice(to, 0, item)
  return next
}

function frontMatterValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return String(value)
}

function normalizeHexColor(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split('').map((char) => `${char}${char}`).join('')}`
  }
  return null
}

function detectIconSet(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return 'empty'
  if (fontAwesomeIconName(trimmed)) return 'fontAwesome'
  if (/^[a-z0-9][a-z0-9_-]*$/i.test(trimmed)) return 'themeKey'
  return 'unknown'
}

function fontAwesomeIconUrl(value: string | undefined) {
  const parsed = fontAwesomeIconName(value)
  if (!parsed) return ''
  const prefix = parsed.style === 'brands' ? 'fa6-brands' : `fa6-${parsed.style}`
  return `https://api.iconify.design/${prefix}/${encodeURIComponent(parsed.name)}.svg?color=%231a1a1a`
}

function fontAwesomeIconName(value: string | undefined) {
  const tokens = (value?.trim() ?? '').split(/\s+/).filter(Boolean)
  const iconToken = tokens.find((token) => token.startsWith('fa-') && !isFontAwesomeStyleToken(token))
  if (!iconToken) return null
  const styleToken = tokens.find(isFontAwesomeStyleToken)
  const style = normalizeFontAwesomeStyle(styleToken)
  return { style, name: iconToken.replace(/^fa-/, '') }
}

function isFontAwesomeStyleToken(token: string) {
  return /^fa-(solid|regular|brands|light|thin|duotone|sharp|classic)$/.test(token)
}

function normalizeFontAwesomeStyle(styleToken: string | undefined) {
  if (styleToken === 'fa-regular') return 'regular'
  if (styleToken === 'fa-brands') return 'brands'
  return 'solid'
}

function iconFallback(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return '-'
  return trimmed.slice(0, 1).toUpperCase()
}
