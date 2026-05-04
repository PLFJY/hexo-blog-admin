import type { GitHubRepoStatus } from '../../../shared/apiTypes'
import type { WorkerEnv } from '../../env'
import { hasGitHubConfig } from '../../utils/setup'
import { githubFetch } from './githubClient'

type GitHubRepoApiResponse = {
  full_name?: string
  default_branch?: string
  private?: boolean
  html_url?: string
  message?: string
}

export async function getGitHubRepoStatus(env: WorkerEnv): Promise<GitHubRepoStatus> {
  if (!hasGitHubConfig(env)) {
    return { connected: false, error: 'Missing GitHub configuration' }
  }

  const owner = encodeURIComponent(env.GITHUB_OWNER ?? '')
  const repo = encodeURIComponent(env.GITHUB_REPO ?? '')
  const response = await githubFetch(env, `/repos/${owner}/${repo}`)
  const payload = (await response.json()) as GitHubRepoApiResponse

  if (!response.ok) {
    return {
      connected: false,
      error: payload.message || `GitHub request failed with status ${response.status}`,
    }
  }

  return {
    connected: true,
    fullName: payload.full_name,
    defaultBranch: payload.default_branch,
    private: payload.private,
    htmlUrl: payload.html_url,
  }
}
