import type { DeployRecord } from '../../../shared/deployTypes'
import type { WorkerEnv } from '../../env'

export async function getWorkflowRunStatusByCommit(
  _env: WorkerEnv,
  commitSha: string,
): Promise<DeployRecord> {
  return {
    id: commitSha,
    commitSha,
    status: 'idle',
    updatedAt: new Date().toISOString(),
  }
}

export async function dispatchWorkflow(_env: WorkerEnv, _ref: string): Promise<{ queued: boolean }> {
  return { queued: false }
}
