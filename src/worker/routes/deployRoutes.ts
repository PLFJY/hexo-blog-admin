import type { DeployLatestResponse, DeployStatusResponse, DispatchDeployResponse } from '../../shared/deployTypes'
import type { WorkerEnv } from '../env'
import { dispatchWorkflow, getLatestWorkflowRunStatus, getWorkflowRunStatusByCommit } from '../services/github/githubActions'
import { json } from '../utils/response'

export async function handleLatestDeploy(env: WorkerEnv): Promise<Response> {
  const response: DeployLatestResponse = {
    deploy: await getLatestWorkflowRunStatus(env),
  }

  return json(response)
}

export async function handleDispatchDeploy(env: WorkerEnv, request: Request): Promise<Response> {
  const text = await request.text()
  const body = text ? (JSON.parse(text) as { ref?: string }) : {}
  const response: DispatchDeployResponse = await dispatchWorkflow(env, body.ref)
  return json(response, { status: 202 })
}

export async function handleDeployStatus(env: WorkerEnv, request: Request): Promise<Response> {
  const commitSha = new URL(request.url).searchParams.get('commitSha')
  if (!commitSha) return json({ error: 'BAD_REQUEST', message: 'commitSha is required' }, { status: 400 })

  const response: DeployStatusResponse = {
    deploy: await getWorkflowRunStatusByCommit(env, commitSha),
  }

  return json(response)
}
