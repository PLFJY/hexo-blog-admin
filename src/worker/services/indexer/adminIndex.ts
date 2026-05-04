import type { PostTreeResponse } from '../../../shared/postTypes'
import type { WorkerEnv } from '../../env'

export async function getAdminIndex(_env: WorkerEnv): Promise<PostTreeResponse> {
  return {
    posts: [],
    tree: [],
  }
}
