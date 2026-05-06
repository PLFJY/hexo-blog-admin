import type { WorkerEnv } from '../env'
import { publicConfig } from '../utils/config'
import { json } from '../utils/response'
import { getSetupStatus } from '../utils/setup'
import { clearSessionCookie } from '../utils/auth'

export async function handleSetupStatus(env: WorkerEnv, request: Request): Promise<Response> {
  const setup = await getSetupStatus(env)
  return json(setup, setup.configured ? undefined : { headers: { 'set-cookie': clearSessionCookie(request) } })
}

export function handlePublicConfig(env: WorkerEnv): Response {
  return json(publicConfig(env))
}
