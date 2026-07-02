import { Button, Body1, FluentProvider, Text, Title1, Title3, makeStyles, mergeClasses, tokens, webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { ArrowClockwiseRegular, CheckmarkCircleRegular, CircleRegular, CopyRegular } from '@fluentui/react-icons'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAppTheme } from '../app/themeContext'
import { StatusBadge } from '../components/StatusBadge'
import { safeSetLocalStorage } from '../lib/storage'
import type { SetupStatus } from '../shared/apiTypes'
import { usePageStyles } from './pageStyles'

const useSetupStyles = makeStyles({
  wizard: {
    display: 'grid',
    gridTemplateColumns: '280px minmax(0, 1fr)',
    gap: tokens.spacingHorizontalL,
    '@media (max-width: 860px)': {
      gridTemplateColumns: '1fr',
    },
  },
  steps: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    alignContent: 'start',
  },
  stepButton: {
    width: '100%',
    justifyContent: 'flex-start',
    minHeight: '56px',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
  },
  selectedStep: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorBrandBackground,
    borderTopColor: tokens.colorBrandBackground,
    borderRightColor: tokens.colorBrandBackground,
    borderBottomColor: tokens.colorBrandBackground,
    borderLeftColor: tokens.colorBrandBackground,
    ':hover': {
      color: tokens.colorNeutralForegroundOnBrand,
      backgroundColor: tokens.colorBrandBackgroundHover,
      borderTopColor: tokens.colorBrandBackgroundHover,
      borderRightColor: tokens.colorBrandBackgroundHover,
      borderBottomColor: tokens.colorBrandBackgroundHover,
      borderLeftColor: tokens.colorBrandBackgroundHover,
    },
    ':active': {
      color: tokens.colorNeutralForegroundOnBrand,
      backgroundColor: tokens.colorBrandBackgroundPressed,
      borderTopColor: tokens.colorBrandBackgroundPressed,
      borderRightColor: tokens.colorBrandBackgroundPressed,
      borderBottomColor: tokens.colorBrandBackgroundPressed,
      borderLeftColor: tokens.colorBrandBackgroundPressed,
    },
    ':focus': {
      color: tokens.colorNeutralForegroundOnBrand,
      backgroundColor: tokens.colorBrandBackground,
      borderTopColor: tokens.colorBrandBackground,
      borderRightColor: tokens.colorBrandBackground,
      borderBottomColor: tokens.colorBrandBackground,
      borderLeftColor: tokens.colorBrandBackground,
    },
  },
  stepText: {
    display: 'grid',
    gap: '2px',
    minWidth: 0,
    textAlign: 'left',
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
  detail: {
    display: 'grid',
    gap: tokens.spacingVerticalL,
    animationName: {
      from: { opacity: 0, transform: 'translateY(8px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
    animationDuration: '0.22s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    animationFillMode: 'both',
  },
  missingList: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
  bindingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalM,
    '@media (max-width: 960px)': {
      gridTemplateColumns: '1fr',
    },
  },
  missingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  missingItemText: {
    display: 'grid',
    gap: tokens.spacingVerticalXS,
    minWidth: 0,
  },
  okPanel: {
    borderTopColor: tokens.colorPaletteGreenBorder2,
    borderRightColor: tokens.colorPaletteGreenBorder2,
    borderBottomColor: tokens.colorPaletteGreenBorder2,
    borderLeftColor: tokens.colorPaletteGreenBorder2,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
  },
  disabledStep: {
    opacity: 0.58,
    cursor: 'not-allowed',
  },
  codeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  bindingCard: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    alignContent: 'start',
    padding: tokens.spacingVerticalL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    minWidth: 0,
  },
  bindingCardReady: {
    borderTopColor: tokens.colorPaletteGreenBorder2,
    borderRightColor: tokens.colorPaletteGreenBorder2,
    borderBottomColor: tokens.colorPaletteGreenBorder2,
    borderLeftColor: tokens.colorPaletteGreenBorder2,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  bindingNameRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  portalProvider: {
    minHeight: '100vh',
    backgroundColor: 'transparent',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    padding: tokens.spacingHorizontalXXL,
    backgroundColor: tokens.colorNeutralBackground1,
    backgroundImage:
      'linear-gradient(var(--login-background-overlay), var(--login-background-overlay)), url("https://t.alcy.cc/ycy")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: tokens.colorNeutralForeground1,
    '@media (max-width: 720px)': {
      padding: tokens.spacingHorizontalM,
    },
  },
  shell: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
    width: 'min(1120px, 100%)',
    maxHeight: 'min(820px, calc(100vh - 48px))',
    overflow: 'auto',
    padding: tokens.spacingVerticalXXL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow64,
    '@media (max-width: 720px)': {
      maxHeight: 'calc(100vh - 32px)',
      padding: tokens.spacingVerticalXL,
    },
  },
  shellCompleting: {
    animationName: {
      from: {
        width: 'min(1120px, 100%)',
        maxHeight: 'min(820px, calc(100vh - 48px))',
        transform: 'scale(1)',
      },
      to: {
        width: 'min(420px, 100%)',
        maxHeight: '520px',
        transform: 'scale(1)',
      },
    },
    animationDuration: '0.36s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    animationFillMode: 'both',
  },
  shellContent: {
    display: 'grid',
    gap: tokens.spacingVerticalXL,
  },
  shellContentCompleting: {
    animationName: {
      from: { opacity: 1, transform: 'translateY(0)' },
      to: { opacity: 0, transform: 'translateY(-6px)' },
    },
    animationDuration: '0.18s',
    animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    animationFillMode: 'both',
  },
})

type SetupRequiredPageProps = {
  setup: SetupStatus
  onRefresh: (options?: { commit?: boolean }) => Promise<SetupStatus>
  embedded?: boolean
}

type SetupGroup = {
  id: string
  titleKey: string
  descriptionKey: string
  items: string[]
}

const setupGroups: SetupGroup[] = [
  {
    id: 'data',
    titleKey: 'setup.groups.data.title',
    descriptionKey: 'setup.groups.data.description',
    items: ['BLOG_ADMIN_KV', 'BLOG_ADMIN_DB', 'BLOG_ADMIN_DB_SCHEMA', 'BLOG_ASSET_CACHE'],
  },
  {
    id: 'github',
    titleKey: 'setup.groups.github.title',
    descriptionKey: 'setup.groups.github.description',
    items: ['GITHUB_OWNER', 'GITHUB_REPO', 'GITHUB_BRANCH', 'GITHUB_TOKEN', 'WORKFLOW_FILE'],
  },
  {
    id: 'site',
    titleKey: 'setup.groups.site.title',
    descriptionKey: 'setup.groups.site.description',
    items: ['POSTS_DIR', 'BLOG_PUBLIC_URL', 'ADMIN_INDEX_PATH'],
  },
  {
    id: 'admin',
    titleKey: 'setup.groups.admin.title',
    descriptionKey: 'setup.groups.admin.description',
    items: ['ADMIN_USERNAME', 'ADMIN_PASSWORD'],
  },
]

const bindingItems = ['BLOG_ADMIN_KV', 'BLOG_ADMIN_DB', 'BLOG_ASSET_CACHE'] as const
const optionalDataVariables = ['BLOG_ASSET_PUBLIC_URL'] as const

function setupInstructionKey(item: string) {
  if (item === 'BLOG_ADMIN_KV') return 'setup.instructions.kv'
  if (item === 'BLOG_ADMIN_DB') return 'setup.instructions.d1'
  if (item === 'BLOG_ASSET_CACHE') return 'setup.instructions.r2'
  if (item === 'BLOG_ADMIN_DB_SCHEMA') return 'setup.instructions.d1Schema'
  if (item === 'GITHUB_TOKEN' || item === 'ADMIN_USERNAME' || item === 'ADMIN_PASSWORD') return 'setup.instructions.secret'
  return 'setup.instructions.variable'
}

function setupValuePlaceholder(item: string) {
  if (item === 'GITHUB_OWNER') return 'PLFJY'
  if (item === 'GITHUB_REPO') return 'blog'
  if (item === 'GITHUB_BRANCH') return 'main'
  if (item === 'POSTS_DIR') return 'source/_posts'
  if (item === 'BLOG_PUBLIC_URL') return 'https://your-blog-domain'
  if (item === 'BLOG_ASSET_PUBLIC_URL') return 'https://your-r2-public-domain'
  if (item === 'ADMIN_INDEX_PATH') return '/admin-index.json'
  if (item === 'WORKFLOW_FILE') return 'Build Pages.yml'
  if (item === 'ADMIN_USERNAME') return 'admin'
  if (item === 'ADMIN_PASSWORD') return 'your-admin-password'
  if (item === 'GITHUB_TOKEN') return 'github_pat_...'
  return ''
}

function setupSnippet(items: string[]) {
  return items.map((item) => `${item}=${setupValuePlaceholder(item)}`).join('\n')
}

export function SetupRequiredPage({ setup, onRefresh, embedded }: SetupRequiredPageProps) {
  const styles = usePageStyles()
  const localStyles = useSetupStyles()
  const { t } = useTranslation()
  const { resolvedMode } = useAppTheme()
  const [selectedGroupId, setSelectedGroupId] = useState(setupGroups[0].id)
  const [checking, setChecking] = useState(false)
  const [completing, setCompleting] = useState(false)
  const missingSet = useMemo(() => new Set(setup.missing), [setup.missing])
  const groups = setupGroups.map((group) => ({
    ...group,
    missingItems: group.items.filter((item) => missingSet.has(item)),
  }))
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0]
  const selectedIndex = groups.findIndex((group) => group.id === selectedGroup.id)
  const completedGroups = groups.filter((group) => group.missingItems.length === 0).length
  const firstIncompleteIndex = groups.findIndex((group) => group.missingItems.length > 0)
  const currentAllowedIndex = firstIncompleteIndex === -1 ? groups.length - 1 : firstIncompleteIndex
  const isLastGroup = selectedIndex === groups.length - 1
  const currentSnippet = setupSnippet(selectedGroup.items)
  const showConfigSnippet = selectedGroup.id !== 'data'
  const copyText = (text: string) => {
    void navigator.clipboard?.writeText(text)
  }

  const missingItemsFor = (setupStatus: SetupStatus, group: SetupGroup) => {
    const nextMissingSet = new Set(setupStatus.missing)
    return group.items.filter((item) => nextMissingSet.has(item))
  }

  const checkCurrentGroup = async () => {
    if (checking) return
    setChecking(true)
    try {
      const nextSetup = await onRefresh({ commit: !isLastGroup })
      const currentDefinition = setupGroups.find((group) => group.id === selectedGroup.id) ?? setupGroups[0]
      const sequentialNext = setupGroups[selectedIndex + 1]
      if (missingItemsFor(nextSetup, currentDefinition).length === 0 && sequentialNext) {
        setSelectedGroupId(sequentialNext.id)
      } else if (isLastGroup) {
        if (nextSetup.configured) {
          safeSetLocalStorage('setup-login-transition', '1')
          setCompleting(true)
          window.setTimeout(() => {
            void onRefresh()
          }, embedded ? 180 : 380)
        } else {
          await onRefresh()
        }
      }
    } finally {
      if (!completing) setChecking(false)
    }
  }

  const body = (
    <div className={mergeClasses(localStyles.shellContent, completing && localStyles.shellContentCompleting)}>
      <header className={styles.header}>
        <Title1>{t('setup.title')}</Title1>
        <Body1>{t('setup.description')}</Body1>
        <div className={styles.row}>
          <StatusBadge status={setup.configured ? 'success' : 'danger'}>
            {setup.configured ? t('setup.configured') : t('setup.incomplete')}
          </StatusBadge>
          <Text className={localStyles.muted}>{t('setup.progress', { done: completedGroups, total: groups.length })}</Text>
        </div>
      </header>

      <section className={localStyles.wizard}>
        <nav className={localStyles.steps} aria-label={t('setup.stepsLabel')}>
          {groups.map((group) => {
            const complete = group.missingItems.length === 0
            const selected = group.id === selectedGroup.id
            const index = groups.findIndex((item) => item.id === group.id)
            const locked = index > currentAllowedIndex
            return (
              <Button
                key={group.id}
                appearance="secondary"
                className={mergeClasses(localStyles.stepButton, selected && localStyles.selectedStep, locked && localStyles.disabledStep)}
                icon={complete ? <CheckmarkCircleRegular /> : <CircleRegular />}
                disabled={locked}
                onClick={() => {
                  if (!locked) setSelectedGroupId(group.id)
                }}
              >
                <span className={localStyles.stepText}>
                  <Text weight="semibold">{t(group.titleKey)}</Text>
                  <Text size={200}>{complete ? t('setup.groupComplete') : t('setup.groupMissing', { count: group.missingItems.length })}</Text>
                </span>
              </Button>
            )
          })}
        </nav>

        <section key={selectedGroup.id} className={localStyles.detail}>
          <section className={mergeClasses(styles.card, selectedGroup.missingItems.length === 0 && selectedGroup.id !== 'data' && localStyles.okPanel)}>
            <Title3>{t(selectedGroup.titleKey)}</Title3>
            <Body1>{t(selectedGroup.descriptionKey)}</Body1>
            {selectedGroup.id === 'data' ? (
              <Text>{selectedGroup.missingItems.length === 0 ? t('setup.groupReady') : t('setup.groupMissing', { count: selectedGroup.missingItems.length })}</Text>
            ) : selectedGroup.missingItems.length === 0 ? (
              <Text>{t('setup.groupReady')}</Text>
            ) : (
              <ul className={localStyles.missingList}>
                {selectedGroup.missingItems.map((item) => (
                  <li key={item} className={localStyles.missingItem}>
                    <span className={localStyles.missingItemText}>
                      <Text weight="semibold">
                        <code>{item}</code>
                      </Text>
                      <Text>{t(setupInstructionKey(item), { item })}</Text>
                    </span>
                    <Button appearance="subtle" icon={<CopyRegular />} aria-label={t('setup.copyName', { item })} onClick={() => copyText(item)} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selectedGroup.id === 'data' ? (
            <section className={styles.card}>
              <div className={localStyles.bindingGrid}>
                {bindingItems.map((item) => {
                  const ready = !missingSet.has(item)
                  return (
                    <section key={item} className={mergeClasses(localStyles.bindingCard, ready && localStyles.bindingCardReady)}>
                      <div className={localStyles.bindingNameRow}>
                        <Text weight="semibold">
                          <code>{item}</code>
                        </Text>
                        <Button appearance="subtle" icon={<CopyRegular />} aria-label={t('setup.copyName', { item })} onClick={() => copyText(item)} />
                      </div>
                      <StatusBadge status={ready ? 'success' : 'danger'}>
                        {ready ? t('setup.bindingReady') : t('setup.bindingMissing')}
                      </StatusBadge>
                      <Text>{t(setupInstructionKey(item), { item })}</Text>
                    </section>
                  )
                })}
                {missingSet.has('BLOG_ADMIN_DB_SCHEMA') ? (
                  <section className={localStyles.bindingCard}>
                    <div className={localStyles.bindingNameRow}>
                      <Text weight="semibold">
                        <code>BLOG_ADMIN_DB_SCHEMA</code>
                      </Text>
                      <Button appearance="subtle" icon={<CopyRegular />} aria-label={t('setup.copyName', { item: 'BLOG_ADMIN_DB_SCHEMA' })} onClick={() => copyText('BLOG_ADMIN_DB_SCHEMA')} />
                    </div>
                    <StatusBadge status="danger">{t('setup.bindingMissing')}</StatusBadge>
                    <Text>{t(setupInstructionKey('BLOG_ADMIN_DB_SCHEMA'), { item: 'BLOG_ADMIN_DB_SCHEMA' })}</Text>
                  </section>
                ) : null}
                {optionalDataVariables.map((item) => {
                  const configured = Boolean(setup.config[item]?.trim())
                  const snippet = `${item}=${setupValuePlaceholder(item)}`
                  return (
                    <section key={item} className={mergeClasses(localStyles.bindingCard, configured && localStyles.bindingCardReady)}>
                      <div className={localStyles.bindingNameRow}>
                        <Text weight="semibold">
                          <code>{item}</code>
                        </Text>
                        <Button appearance="subtle" icon={<CopyRegular />} aria-label={t('setup.copyName', { item })} onClick={() => copyText(item)} />
                      </div>
                      <StatusBadge status={configured ? 'success' : 'warning'}>
                        {configured ? t('setup.optionalConfigured') : t('setup.optionalFallback')}
                      </StatusBadge>
                      <Text>{t('setup.instructions.assetPublicUrl', { item })}</Text>
                      <pre className={styles.codeBlock}>
                        <code>{snippet}</code>
                      </pre>
                    </section>
                  )
                })}
              </div>
            </section>
          ) : null}

          {showConfigSnippet ? (
            <section className={styles.card}>
              <div className={localStyles.codeHeader}>
                <Title3>{t('setup.copyBlockTitle')}</Title3>
                <Button appearance="secondary" icon={<CopyRegular />} onClick={() => copyText(currentSnippet)}>
                  {t('actions.copy')}
                </Button>
              </div>
              <pre className={styles.codeBlock}>
                <code>{currentSnippet}</code>
              </pre>
            </section>
          ) : null}

          <section className={styles.card}>
            <Title3>{t(selectedGroup.id === 'data' ? 'setup.automaticTitle' : 'setup.nextStepTitle')}</Title3>
            <Body1>{selectedGroup.id === 'data' ? t('setup.automaticInit') : t('setup.dashboardInit')}</Body1>
            <div className={localStyles.actions}>
              <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={checkCurrentGroup} disabled={checking}>
                {isLastGroup && selectedGroup.missingItems.length === 0 ? t('setup.enterAdmin') : t('setup.check')}
              </Button>
              <Button appearance="secondary" icon={<ArrowClockwiseRegular />} onClick={() => void onRefresh()} disabled={checking}>
                {t('actions.refresh')}
              </Button>
            </div>
          </section>

          <section className={styles.card}>
            <Title3>{t('setup.config')}</Title3>
            <pre className={styles.codeBlock}>
              <code>{JSON.stringify(setup.config, null, 2)}</code>
            </pre>
          </section>
        </section>
      </section>
    </div>
  )

  if (embedded) return body

  const content = (
    <section className={localStyles.overlay}>
      <div className={mergeClasses(localStyles.shell, completing && localStyles.shellCompleting)}>
        {body}
      </div>
    </section>
  )

  return createPortal(
    <FluentProvider className={localStyles.portalProvider} theme={resolvedMode === 'dark' ? webDarkTheme : webLightTheme}>
      {content}
    </FluentProvider>,
    document.body,
  )
}
