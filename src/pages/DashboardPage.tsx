import { Body1, Button, Link, Spinner, Text, Title1, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { ArrowRightRegular, DocumentEditRegular, OpenRegular, RocketRegular, SettingsRegular } from '@fluentui/react-icons'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { getJson } from '../lib/apiClient'
import { getCachedAdminIndex, setCachedAdminIndex } from '../lib/indexCache'
import type { GitHubRepoStatus, SetupStatus } from '../shared/apiTypes'
import type { DeployLatestResponse } from '../shared/deployTypes'
import type { DraftListResponse } from '../shared/draftTypes'
import { extractFrontMatterTitle } from '../shared/frontMatter'
import type { PostTreeResponse } from '../shared/postTypes'
import { usePageStyles } from './pageStyles'

const useStyles = makeStyles({
  syncingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    color: tokens.colorBrandForeground1,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    fontSize: tokens.fontSizeBase200,
  },
  metrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalM,
    '@media (max-width: 960px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    '@media (max-width: 560px)': {
      gridTemplateColumns: '1fr',
    },
  },
  metricCard: {
    display: 'grid',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    ':hover': {
      borderColor: tokens.colorNeutralStroke1Hover,
      boxShadow: tokens.shadow4,
      transform: 'translateY(-2px)',
    },
  },
  metricValue: {
    fontSize: '28px',
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: '36px',
  },
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.3fr) minmax(280px, 0.7fr)',
    gap: tokens.spacingHorizontalL,
    '@media (max-width: 960px)': {
      gridTemplateColumns: '1fr',
    },
  },
  list: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
  listItem: {
    display: 'grid',
    gap: tokens.spacingVerticalXXS,
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)',
    ':hover': {
      borderColor: tokens.colorNeutralStroke1Hover,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  actions: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
  },
  actionButton: {
    justifyContent: 'space-between',
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
})

type DashboardState =
  | { status: 'loading' }
  | {
      status: 'ready'
      setup: SetupStatus
      github: GitHubRepoStatus
      posts: PostTreeResponse
      drafts: DraftListResponse
      deploy: DeployLatestResponse
      syncing?: boolean
    }
  | { status: 'error'; message: string }

function statusColor(ok: boolean) {
  return ok ? 'success' : 'danger'
}

function deployColor(status: DeployLatestResponse['deploy']['status']) {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  return 'informative'
}

export function DashboardPage() {
  const styles = usePageStyles()
  const localStyles = useStyles()
  const { t } = useTranslation()
  const [state, setState] = useState<DashboardState>({ status: 'loading' })

  const load = () => {
    const cachedPosts = getCachedAdminIndex()
    if (cachedPosts) {
      // 如果有缓存，先显示缓存内容，标记为正在同步
      void Promise.all([
        getJson<SetupStatus>('/setup/status'),
        getJson<GitHubRepoStatus>('/github/repo'),
        getJson<DraftListResponse>('/drafts'),
        getJson<DeployLatestResponse>('/deploy/latest'),
      ]).then(([setup, github, drafts, deploy]) => {
        setState({ status: 'ready', setup, github, posts: cachedPosts, drafts, deploy, syncing: true })
        // 然后去同步最新的 posts
        void getJson<PostTreeResponse>('/posts/tree').then((index) => {
          setCachedAdminIndex(index)
          setState(current => current.status === 'ready' ? { ...current, posts: index, syncing: false } : current)
        })
      }).catch(error => setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }))
    } else {
      // 没缓存，走原逻辑
      setState({ status: 'loading' })
      void Promise.all([
        getJson<SetupStatus>('/setup/status'),
        getJson<GitHubRepoStatus>('/github/repo'),
        getJson<PostTreeResponse>('/posts/tree'),
        getJson<DraftListResponse>('/drafts'),
        getJson<DeployLatestResponse>('/deploy/latest'),
      ])
        .then(([setup, github, posts, drafts, deploy]) => {
          setCachedAdminIndex(posts)
          setState({ status: 'ready', setup, github, posts, drafts, deploy })
        })
        .catch((error: unknown) =>
          setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
        )
    }
  }

  useEffect(load, [])

  const recentDrafts = useMemo(() => {
    if (state.status !== 'ready') return []
    return state.drafts.drafts.slice(0, 4)
  }, [state])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
          <Title1>{t('dashboard.title')}</Title1>
          {state.status === 'ready' && state.syncing && (
            <div className={localStyles.syncingIndicator}>
              <Spinner size="tiny" />
              <Text size={200}>正在拉取最新数据...</Text>
            </div>
          )}
        </div>
        <Body1>{t('dashboard.description')}</Body1>
      </header>
      <section className={localStyles.metrics}>
        <article className={localStyles.metricCard}>
          <Text className={localStyles.muted}>{t('dashboard.posts')}</Text>
          <Text className={localStyles.metricValue}>{state.posts.posts.length}</Text>
          <StatusBadge status={state.posts.stale ? 'warning' : 'success'}>
            {state.posts.stale ? t('dashboard.indexStale') : t('dashboard.indexFresh')}
          </StatusBadge>
        </article>
        <article className={localStyles.metricCard}>
          <Text className={localStyles.muted}>{t('dashboard.drafts')}</Text>
          <Text className={localStyles.metricValue}>{state.drafts.drafts.length}</Text>
          <Text className={localStyles.muted}>{t('dashboard.unsentWork')}</Text>
        </article>
        <article className={localStyles.metricCard}>
          <Text className={localStyles.muted}>{t('dashboard.github')}</Text>
          <Text className={localStyles.metricValue}>{state.github.connected ? t('settings.connected') : t('settings.failed')}</Text>
          <StatusBadge status={statusColor(state.github.connected)}>
            {state.github.fullName ?? state.github.error ?? '-'}
          </StatusBadge>
        </article>
        <article className={localStyles.metricCard}>
          <Text className={localStyles.muted}>{t('dashboard.deploy')}</Text>
          <Text className={localStyles.metricValue}>{state.deploy.deploy.status}</Text>
          <StatusBadge status={deployColor(state.deploy.deploy.status)}>{state.deploy.deploy.status}</StatusBadge>
        </article>
      </section>
      <section className={localStyles.twoColumn}>
        <section className={styles.card}>
          <div className={styles.row}>
            <Title3>{t('dashboard.systemStatus')}</Title3>
            <StatusBadge status={statusColor(state.setup.configured)}>
              {state.setup.configured ? t('setup.configured') : t('setup.incomplete')}
            </StatusBadge>
          </div>
          <Text>{t('dashboard.repo')}: {state.github.fullName ?? `${state.setup.config.GITHUB_OWNER ?? '-'} / ${state.setup.config.GITHUB_REPO ?? '-'}`}</Text>
          <Text>{t('dashboard.branch')}: {state.setup.config.GITHUB_BRANCH}</Text>
          <Text>{t('dashboard.postsDir')}: {state.setup.config.POSTS_DIR}</Text>
          <Text>{t('dashboard.indexGeneratedAt')}: {state.posts.generatedAt ?? '-'}</Text>
          {state.deploy.deploy.workflowRunUrl ? (
            <Link href={state.deploy.deploy.workflowRunUrl} target="_blank" rel="noreferrer">
              {t('deploy.run')}
            </Link>
          ) : null}
        </section>
        <section className={styles.card}>
          <Title3>{t('dashboard.quickActions')}</Title3>
          <div className={localStyles.actions}>
            <Button as={NavLink} to="/posts" icon={<DocumentEditRegular />} className={localStyles.actionButton}>
              {t('dashboard.openPosts')} <ArrowRightRegular />
            </Button>
            <Button as={NavLink} to="/drafts" icon={<DocumentEditRegular />} className={localStyles.actionButton}>
              {t('dashboard.openDrafts')} <ArrowRightRegular />
            </Button>
            <Button as={NavLink} to="/deploy" icon={<RocketRegular />} className={localStyles.actionButton}>
              {t('dashboard.openDeploy')} <ArrowRightRegular />
            </Button>
            <Button as={NavLink} to="/settings" icon={<SettingsRegular />} className={localStyles.actionButton}>
              {t('dashboard.openSettings')} <ArrowRightRegular />
            </Button>
            <Button
              as="a"
              href={state.setup.config.BLOG_PUBLIC_URL}
              target="_blank"
              rel="noreferrer"
              icon={<OpenRegular />}
              className={localStyles.actionButton}
              disabled={!state.setup.config.BLOG_PUBLIC_URL}
            >
              {t('dashboard.openSite')} <ArrowRightRegular />
            </Button>
          </div>
        </section>
      </section>
      <section className={styles.card}>
        <div className={styles.row}>
          <Title3>{t('dashboard.recentDrafts')}</Title3>
          <Button as={NavLink} to="/drafts" appearance="subtle">
            {t('dashboard.viewAll')}
          </Button>
        </div>
        {recentDrafts.length > 0 ? (
          <ul className={localStyles.list}>
            {recentDrafts.map((draft) => (
              <li className={localStyles.listItem} key={draft.id}>
                <Text weight="semibold">{extractFrontMatterTitle(draft.markdown) || draft.relativeId || t('dashboard.untitledDraft')}</Text>
                <Text className={localStyles.muted}>{draft.relativeId || '-'}</Text>
                <Text className={localStyles.muted}>{t('dashboard.updatedAt')}: {new Date(draft.updatedAt).toLocaleString()}</Text>
              </li>
            ))}
          </ul>
        ) : (
          <Text className={localStyles.muted}>{t('dashboard.noDrafts')}</Text>
        )}
      </section>
    </section>
  )
}
