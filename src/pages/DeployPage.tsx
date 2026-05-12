import { Body1, Button, Link, Spinner, Text, Title1, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { RocketRegular } from '@fluentui/react-icons'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { getJson, sendJson } from '../lib/apiClient'
import { getCachedDeployStatus, setCachedAdminIndex, setCachedDeployStatus } from '../lib/indexCache'
import type { DeployLatestResponse, DispatchDeployResponse } from '../shared/deployTypes'
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
})

type DeployState =
  | { status: 'loading' }
  | { status: 'ready'; data: DeployLatestResponse; message?: string; syncing?: boolean }
  | { status: 'error'; message: string }

const PENDING_DEPLOY_STATUSES = new Set(['idle', 'queued', 'in_progress'])
const VISIBLE_POLL_BASE_MS = 3000
const VISIBLE_POLL_MAX_MS = 30000
const HIDDEN_POLL_BASE_MS = 45000
const HIDDEN_POLL_MAX_MS = 120000

function isPendingDeploy(data: DeployLatestResponse) {
  return PENDING_DEPLOY_STATUSES.has(data.deploy.status)
}

function nextPollDelay(attempt: number, failed: boolean) {
  const hidden = document.visibilityState === 'hidden'
  const base = hidden ? HIDDEN_POLL_BASE_MS : failed ? 5000 : VISIBLE_POLL_BASE_MS
  const max = hidden ? HIDDEN_POLL_MAX_MS : VISIBLE_POLL_MAX_MS
  return Math.min(max, base * 2 ** Math.min(attempt, 4))
}

function deploySyncKey(data: DeployLatestResponse) {
  return data.deploy.id || data.deploy.commitSha || data.deploy.updatedAt || 'latest'
}

export function DeployPage() {
  const styles = usePageStyles()
  const localStyles = useStyles()
  const { t } = useTranslation()
  const [state, setState] = useState<DeployState>({ status: 'loading' })
  const pollTimer = useRef<number | undefined>(undefined)
  const latestData = useRef<DeployLatestResponse | undefined>(undefined)
  const syncedDeployKey = useRef<string | undefined>(undefined)

  const load = (message?: string) => {
    const cached = getCachedDeployStatus()
    if (cached) {
      latestData.current = cached
      setState({ status: 'ready', data: cached, syncing: true, message })
      if (isPendingDeploy(cached)) startPolling()
    } else {
      setState({ status: 'loading' })
    }

    void getJson<DeployLatestResponse>('/deploy/latest')
      .then((data) => {
        latestData.current = data
        setCachedDeployStatus(data)
        setState({ status: 'ready', data, syncing: false, message })
        if (isPendingDeploy(data)) startPolling()
      })
      .catch((error: unknown) => {
        const errMessage = error instanceof Error ? error.message : 'Unknown error'
        setState((current) => current.status === 'ready' ? { ...current, syncing: false, message: errMessage } : { status: 'error', message: errMessage })
      })
  }

  const syncAdminIndex = (data: DeployLatestResponse) => {
    const syncKey = deploySyncKey(data)
    if (syncedDeployKey.current === syncKey) return
    syncedDeployKey.current = syncKey
    void sendJson<PostTreeResponse>('/index/sync-online', 'POST')
      .then((index) => {
        setCachedAdminIndex(index)
        setState((current) => current.status === 'ready' ? { ...current, message: t('customize.indexSynced') } : current)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error'
        setState((current) => current.status === 'ready' ? { ...current, message } : current)
      })
  }

  const startPolling = (attempt = 0, failed = false) => {
    window.clearTimeout(pollTimer.current)
    pollTimer.current = window.setTimeout(() => {
      void getJson<DeployLatestResponse>('/deploy/latest')
        .then((data) => {
          latestData.current = data
          setCachedDeployStatus(data)
          const shouldContinue = isPendingDeploy(data)
          setState({
            status: 'ready',
            data,
            message: shouldContinue ? t('deploy.polling') : undefined,
          })
          if (data.deploy.status === 'success') syncAdminIndex(data)
          if (shouldContinue) startPolling(attempt + 1)
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Unknown error'
          setState((current) => current.status === 'ready' ? { ...current, message } : { status: 'error', message })
          startPolling(attempt + 1, true)
        })
    }, nextPollDelay(attempt, failed))
  }

  const dispatch = () => {
    if (state.status !== 'ready') return
    void sendJson<DispatchDeployResponse>('/deploy/dispatch', 'POST', {}).then(() =>
      {
        syncedDeployKey.current = undefined
        setState({ ...state, message: t('deploy.queued') })
        startPolling()
      },
    )
  }

  useEffect(() => {
    const bootTimer = window.setTimeout(() => void load(), 0)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && latestData.current && isPendingDeploy(latestData.current)) startPolling()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearTimeout(bootTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearTimeout(pollTimer.current)
    }
    // DeployPage owns a single page-lifetime poller; refs keep the latest deploy data across callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={() => void load()} />

  const deploy = state.data.deploy

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalM }}>
          <Title1>{t('deploy.title')}</Title1>
          {state.status === 'ready' && state.syncing && (
            <div className={localStyles.syncingIndicator}>
              <Spinner size="tiny" />
              <Text size={200}>正在同步部署状态...</Text>
            </div>
          )}
        </div>
        <Body1>{t('deploy.description')}</Body1>
      </header>
      <section className={styles.card}>
        <div className={styles.row}>
          <Title3>{t('deploy.latest')}</Title3>
          <StatusBadge status={deploy.status === 'success' ? 'success' : deploy.status === 'failed' ? 'danger' : 'informative'}>
            {deploy.status}
          </StatusBadge>
        </div>
        {state.message ? <Text>{state.message}</Text> : null}
        <Text>{t('deploy.commit')}: {deploy.commitSha ?? '-'}</Text>
        {deploy.workflowRunUrl ? (
          <Link href={deploy.workflowRunUrl} target="_blank" rel="noreferrer">
            {t('deploy.run')}
          </Link>
        ) : null}
        <Button appearance="primary" icon={<RocketRegular />} onClick={dispatch}>
          {t('deploy.dispatch')}
        </Button>
      </section>
    </section>
  )
}
