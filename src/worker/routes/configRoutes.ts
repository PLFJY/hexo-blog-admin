import type { WorkerEnv } from '../env'
import { publicConfig } from '../utils/config'
import { json } from '../utils/response'
import { getSetupStatus } from '../utils/setup'

export async function handleSetupStatus(env: WorkerEnv): Promise<Response> {
  return json(await getSetupStatus(env))
}

export function handlePublicConfig(env: WorkerEnv): Response {
  return json(publicConfig(env))
}
