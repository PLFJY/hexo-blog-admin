import type { DeployRecord } from '../../../shared/deployTypes'
import type { WorkerEnv } from '../../env'
import { requireConfig } from '../../utils/config'
import { githubFetch, githubJson } from './githubClient'

type WorkflowRun = {
  id: number
  html_url?: string
  head_sha?: string
  status?: string
  conclusion?: string | null
  updated_at?: string
}

type WorkflowRunsResponse = {
  workflow_runs?: WorkflowRun[]
}

const mapStatus = (run?: WorkflowRun): DeployRecord['status'] => {
  if (!run) return 'idle'
  if (run.status === 'queued') return 'queued'
  if (run.status === 'in_progress' || run.status === 'waiting' || run.status === 'requested') return 'in_progress'
  if (run.conclusion === 'success') return 'success'
  if (run.conclusion === 'failure' || run.conclusion === 'cancelled' || run.conclusion === 'timed_out') return 'failed'
  return 'idle'
}

export async function getLatestWorkflowRunStatus(env: WorkerEnv): Promise<DeployRecord> {
  const config = requireConfig(env)
  const owner = encodeURIComponent(env.GITHUB_OWNER ?? '')
  const repo = encodeURIComponent(env.GITHUB_REPO ?? '')
  const workflow = encodeURIComponent(config.WORKFLOW_FILE)
  const payload = await githubJson<WorkflowRunsResponse>(
    env,
    `/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?branch=${encodeURIComponent(config.GITHUB_BRANCH)}&per_page=1`,
  )
  const run = payload.workflow_runs?.[0]

  return {
    id: run ? String(run.id) : 'latest',
    status: mapStatus(run),
    commitSha: run?.head_sha,
    workflowRunUrl: run?.html_url,
    updatedAt: run?.updated_at,
  }
}

export async function getWorkflowRunStatusByCommit(env: WorkerEnv, commitSha: string): Promise<DeployRecord> {
  const config = requireConfig(env)
  const owner = encodeURIComponent(env.GITHUB_OWNER ?? '')
  const repo = encodeURIComponent(env.GITHUB_REPO ?? '')
  const workflow = encodeURIComponent(config.WORKFLOW_FILE)
  const payload = await githubJson<WorkflowRunsResponse>(
    env,
    `/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?head_sha=${encodeURIComponent(commitSha)}&per_page=1`,
  )
  const run = payload.workflow_runs?.[0]

  return {
    id: run ? String(run.id) : commitSha,
    status: mapStatus(run),
    commitSha,
    workflowRunUrl: run?.html_url,
    updatedAt: run?.updated_at,
  }
}

export async function dispatchWorkflow(env: WorkerEnv, ref?: string): Promise<{ queued: boolean }> {
  const config = requireConfig(env)
  const owner = encodeURIComponent(env.GITHUB_OWNER ?? '')
  const repo = encodeURIComponent(env.GITHUB_REPO ?? '')
  const workflow = encodeURIComponent(config.WORKFLOW_FILE)
  const response = await githubFetch(env, `/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({
      ref: ref || config.GITHUB_BRANCH,
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Failed to dispatch workflow: ${response.status}`)
  }

  return { queued: true }
}
