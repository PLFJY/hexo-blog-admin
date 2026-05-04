import type { DraftRecord } from '../../../shared/draftTypes'
import type { WorkerEnv } from '../../env'

export async function listDrafts(_env: WorkerEnv): Promise<DraftRecord[]> {
  return []
}

export async function getDraft(_env: WorkerEnv, _id: string): Promise<DraftRecord | null> {
  return null
}

export async function saveDraft(_env: WorkerEnv, draft: DraftRecord): Promise<DraftRecord> {
  return draft
}

export async function deleteDraft(_env: WorkerEnv, _id: string): Promise<{ deleted: boolean }> {
  return { deleted: false }
}
