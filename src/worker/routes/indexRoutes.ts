import type { WorkerEnv } from '../env'
import { getAdminIndex } from '../services/indexer/adminIndex'
import { json } from '../utils/response'

export async function handleAdminIndex(env: WorkerEnv): Promise<Response> {
  return json(await getAdminIndex(env))
}
