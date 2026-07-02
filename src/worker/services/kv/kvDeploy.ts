import type { DeployRecord } from '../../../shared/deployTypes'
import type { WorkerEnv } from '../../env'

export async function getLatestDeploy(env: WorkerEnv): Promise<DeployRecord> {
  void env
  return {
    id: 'latest',
    status: 'idle',
    updatedAt: new Date().toISOString(),
  }
}

export async function saveDeployRecord(env: WorkerEnv, deploy: DeployRecord): Promise<DeployRecord> {
  void env
  return deploy
}
