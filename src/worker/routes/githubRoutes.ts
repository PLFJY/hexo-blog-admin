import type { WorkerEnv } from '../env'
import { getGitHubRepoStatus } from '../services/github/githubRepo'
import { json } from '../utils/response'

export async function handleGitHubRepo(env: WorkerEnv): Promise<Response> {
  return json(await getGitHubRepoStatus(env))
}
