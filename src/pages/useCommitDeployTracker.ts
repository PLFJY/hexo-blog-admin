import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getJson, sendJson } from '../lib/apiClient'
import type { CustomizeSaveStatus } from '../shared/customizeTypes'
import type { DeployRecord, DeployStatusResponse } from '../shared/deployTypes'

export function useCommitDeployTracker() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<CustomizeSaveStatus>({})
  const pollTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(pollTimer.current), [])

  const syncIndex = (commitSha: string, deploy: DeployRecord) => {
    void sendJson('/index/sync-online', 'POST')
      .then(() => setStatus({ commitSha, deploy, indexSynced: true, message: t('customize.indexSynced') }))
      .catch((error: unknown) => setStatus({
        commitSha,
        deploy,
        message: error instanceof Error ? error.message : 'Unknown error',
      }))
  }

  const poll = (commitSha: string, attempt = 0) => {
    window.clearTimeout(pollTimer.current)
    pollTimer.current = window.setTimeout(() => {
      void getJson<DeployStatusResponse>(`/deploy/status?commitSha=${encodeURIComponent(commitSha)}`)
        .then((data) => {
          const deploy = data.deploy
          const shouldContinue = attempt < 24 && (deploy.status === 'idle' || deploy.status === 'queued' || deploy.status === 'in_progress')
          setStatus({
            commitSha,
            deploy,
            message: shouldContinue ? t('customize.deployTracking') : undefined,
          })
          if (deploy.status === 'success') syncIndex(commitSha, deploy)
          else if (shouldContinue) poll(commitSha, attempt + 1)
        })
        .catch((error: unknown) => setStatus({
          commitSha,
          message: error instanceof Error ? error.message : 'Unknown error',
        }))
    }, attempt === 0 ? 3000 : 8000)
  }

  const start = (commitSha: string) => {
    setStatus({
      commitSha,
      deploy: { id: commitSha, status: 'queued', commitSha },
      indexSynced: false,
      message: t('customize.savedWaitingDeploy'),
    })
    poll(commitSha)
  }

  return { status, setStatus, start }
}
