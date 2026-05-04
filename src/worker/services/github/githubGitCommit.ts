import type { WorkerEnv } from '../../env'

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
  _env: WorkerEnv,
  _request: GitBatchCommitRequest,
): Promise<{ commitSha: string }> {
  throw new Error('TODO: implement GitHub batch commit')
}
