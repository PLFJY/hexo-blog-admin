import type { WorkerEnv } from '../../env'
import { requireConfig } from '../../utils/config'
import { githubFetch, githubJson } from './githubClient'

type GitHubContentResponse = {
  type: string
  content?: string
  encoding?: string
  sha?: string
}

const cleanBase64 = (value: string) => value.replace(/\s/g, '')

const decodeBase64Utf8 = (value: string) => {
  const binary = atob(cleanBase64(value))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export async function getGitHubFileBase64(env: WorkerEnv, repoPath: string): Promise<{ contentBase64: string; sha?: string }> {
  const config = requireConfig(env)
  const owner = encodeURIComponent(env.GITHUB_OWNER ?? '')
  const repo = encodeURIComponent(env.GITHUB_REPO ?? '')
  const path = repoPath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  const payload = await githubJson<GitHubContentResponse>(
    env,
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(config.GITHUB_BRANCH)}`,
  )

  if (payload.type !== 'file' || payload.encoding !== 'base64' || !payload.content) {
    throw new Error('GitHub content response is not a base64 file')
  }

  return {
    contentBase64: cleanBase64(payload.content),
    sha: payload.sha,
  }
}

export async function getGitHubFile(env: WorkerEnv, repoPath: string): Promise<{ content: string; sha?: string }> {
  const config = requireConfig(env)
  const owner = encodeURIComponent(env.GITHUB_OWNER ?? '')
  const repo = encodeURIComponent(env.GITHUB_REPO ?? '')
  const path = repoPath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  const payload = await githubJson<GitHubContentResponse>(
    env,
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(config.GITHUB_BRANCH)}`,
  )

  if (payload.type !== 'file' || payload.encoding !== 'base64' || !payload.content) {
    throw new Error('GitHub content response is not a base64 file')
  }

  return {
    content: decodeBase64Utf8(payload.content),
    sha: payload.sha,
  }
}

type GitHubDirEntry = {
  name: string
  type: string
}

/**
 * Names of the files inside a repo directory on the configured branch.
 * Returns [] when the directory does not exist, so callers can treat a shared
 * asset directory as empty until the first image is published.
 */
export async function listGitHubDirNames(env: WorkerEnv, repoPath: string): Promise<string[]> {
  const config = requireConfig(env)
  const owner = encodeURIComponent(env.GITHUB_OWNER ?? '')
  const repo = encodeURIComponent(env.GITHUB_REPO ?? '')
  const path = repoPath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')
  const response = await githubFetch(
    env,
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(config.GITHUB_BRANCH)}`,
  )
  if (response.status === 404) return []
  if (!response.ok) throw new Error(`GitHub contents request failed: ${response.status}`)

  const payload = (await response.json()) as GitHubDirEntry[] | GitHubDirEntry
  if (!Array.isArray(payload)) return []
  return payload.filter((entry) => entry.type === 'file').map((entry) => entry.name)
}
