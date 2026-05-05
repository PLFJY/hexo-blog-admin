import type { WorkerEnv } from '../env'
import { getAdminIndex, syncOnlineAdminIndex } from '../services/indexer/adminIndex'
import { json } from '../utils/response'

export async function handleAdminIndex(env: WorkerEnv): Promise<Response> {
  return json(await getAdminIndex(env))
}

export async function handleSyncOnlineAdminIndex(env: WorkerEnv): Promise<Response> {
  return json(await syncOnlineAdminIndex(env))
}
