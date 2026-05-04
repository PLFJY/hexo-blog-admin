import type { DraftAsset } from '../../../shared/assetTypes'
import type { WorkerEnv } from '../../env'

export async function putDraftAsset(
  _env: WorkerEnv,
  asset: DraftAsset,
  _body: ReadableStream | ArrayBuffer | string,
): Promise<DraftAsset> {
  return asset
}

export async function getDraftAsset(_env: WorkerEnv, _key: string): Promise<R2ObjectBody | null> {
  return null
}

export async function deleteDraftAsset(_env: WorkerEnv, _key: string): Promise<{ deleted: boolean }> {
  return { deleted: false }
}
