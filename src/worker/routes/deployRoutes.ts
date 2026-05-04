import type { TodoResponse } from '../../shared/apiTypes'
import type { DeployLatestResponse } from '../../shared/deployTypes'
import type { WorkerEnv } from '../env'
import { getLatestDeploy } from '../services/kv/kvDeploy'
import { json } from '../utils/response'

export async function handleLatestDeploy(env: WorkerEnv): Promise<Response> {
  const response: TodoResponse<DeployLatestResponse> = {
    deploy: await getLatestDeploy(env),
    message: 'TODO: query GitHub Actions workflow runs',
  }

  return json(response)
}
