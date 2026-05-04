import type { TodoResponse } from '../../shared/apiTypes'
import type { PostTreeResponse } from '../../shared/postTypes'
import type { WorkerEnv } from '../env'
import { getAdminIndex } from '../services/indexer/adminIndex'
import { json } from '../utils/response'

export async function handleAdminIndex(env: WorkerEnv): Promise<Response> {
  const index = await getAdminIndex(env)
  const response: TodoResponse<PostTreeResponse> = {
    ...index,
    message: 'TODO: read admin-index.json from blog build output',
  }

  return json(response)
}
