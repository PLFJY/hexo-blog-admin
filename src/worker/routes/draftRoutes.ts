import type { TodoResponse } from '../../shared/apiTypes'
import type { DraftListResponse } from '../../shared/draftTypes'
import type { WorkerEnv } from '../env'
import { listDrafts } from '../services/kv/kvDrafts'
import { json } from '../utils/response'

export async function handleDrafts(env: WorkerEnv): Promise<Response> {
  const response: TodoResponse<DraftListResponse> = {
    drafts: await listDrafts(env),
    message: 'TODO: list Markdown drafts from KV',
  }

  return json(response)
}
