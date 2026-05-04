import type { WorkerEnv } from '../env'
import { json } from '../utils/response'
import { getSetupStatus } from '../utils/setup'

export function handleSetupStatus(env: WorkerEnv): Response {
  return json(getSetupStatus(env))
}
