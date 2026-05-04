import type { DeployRecord } from '../../../shared/deployTypes'
import type { WorkerEnv } from '../../env'

export async function getLatestDeploy(_env: WorkerEnv): Promise<DeployRecord> {
  return {
    id: 'latest',
    status: 'idle',
    updatedAt: new Date().toISOString(),
  }
}

export async function saveDeployRecord(_env: WorkerEnv, deploy: DeployRecord): Promise<DeployRecord> {
  return deploy
}
