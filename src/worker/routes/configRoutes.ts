import type { WorkerEnv } from '../env'
import { publicConfig } from '../utils/config'
import { json } from '../utils/response'
import { getSetupStatus } from '../utils/setup'

export function handleSetupStatus(env: WorkerEnv): Response {
  return json(getSetupStatus(env))
}

export function handlePublicConfig(env: WorkerEnv): Response {
  return json(publicConfig(env))
}
