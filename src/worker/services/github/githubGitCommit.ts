import type { WorkerEnv } from '../../env'
import { requireConfig } from '../../utils/config'
import { githubJson } from './githubClient'

export type GitCommitFile = {
  path: string
  encoding: 'utf-8' | 'base64'
  content: string
}

export type GitBatchCommitRequest = {
  branch: string
  message: string
  files: GitCommitFile[]
  deletions?: string[]
}

export async function createBatchCommit(
  env: WorkerEnv,
  request: GitBatchCommitRequest,
): Promise<{ commitSha: string }> {
  const owner = encodeURIComponent(env.GITHUB_OWNER ?? '')
  const repo = encodeURIComponent(env.GITHUB_REPO ?? '')
  const branch = request.branch || requireConfig(env).GITHUB_BRANCH
  const ref = await githubJson<{ object: { sha: string } }>(
    env,
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
  )
  const currentCommit = await githubJson<{ tree: { sha: string } }>(
    env,
    `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`,
  )

  const blobs = await Promise.all(
    request.files.map(async (file) => ({
      file,
      blob: await githubJson<{ sha: string }>(env, `/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({
          content: file.content,
          encoding: file.encoding === 'base64' ? 'base64' : 'utf-8',
        }),
      }),
    })),
  )

  const tree = [
    ...blobs.map(({ file, blob }) => ({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    })),
    ...(request.deletions ?? []).map((path) => ({
      path,
      mode: '100644',
      type: 'blob',
      sha: null,
    })),
  ]

  const newTree = await githubJson<{ sha: string }>(env, `/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: currentCommit.tree.sha,
      tree,
    }),
  })

  const newCommit = await githubJson<{ sha: string }>(env, `/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: request.message,
      tree: newTree.sha,
      parents: [ref.object.sha],
    }),
  })

  await githubJson(env, `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      sha: newCommit.sha,
      force: false,
    }),
  })

  return { commitSha: newCommit.sha }
}
