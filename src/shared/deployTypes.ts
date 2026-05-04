export type DeployRecord = {
  id: string
  status: 'idle' | 'queued' | 'in_progress' | 'success' | 'failed'
  commitSha?: string
  workflowRunUrl?: string
  updatedAt?: string
}

export type DeployLatestResponse = {
  deploy: DeployRecord
}

export type DispatchDeployResponse = {
  queued: boolean
}
