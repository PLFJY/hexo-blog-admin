import type { WorkerEnv } from '../env'
import type { AdminUiSettingsResponse, UpdateAdminUiSettingsRequest } from '../../shared/apiTypes'
import { getConfigValue, setConfigValue } from '../services/kv/kvConfig'
import { publicConfig } from '../utils/config'
import { json } from '../utils/response'
import { getSetupStatus } from '../utils/setup'
import { clearSessionCookie } from '../utils/auth'

const ADMIN_BACKGROUND_URL_KEY = 'adminBackgroundUrl'
const ASSET_PUBLIC_URL_DEBUG_KEY = 'assetPublicUrlDebug'

export async function handleSetupStatus(env: WorkerEnv, request: Request): Promise<Response> {
  const setup = await getSetupStatus(env)
  return json(setup, setup.configured ? undefined : { headers: { 'set-cookie': clearSessionCookie(request) } })
}

export function handlePublicConfig(env: WorkerEnv): Response {
  return json(publicConfig(env))
}

function normalizeBackgroundUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('backgroundUrl must be a string')

  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.length > 2048) throw new Error('backgroundUrl is too long')

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('backgroundUrl must be a valid URL')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('backgroundUrl must use http or https')
  }

  return parsed.href
}

export async function handleAdminUiSettings(env: WorkerEnv): Promise<Response> {
  const backgroundUrl = (await getConfigValue(env, ADMIN_BACKGROUND_URL_KEY)) ?? ''
  const assetPublicUrlDebug = (await getConfigValue(env, ASSET_PUBLIC_URL_DEBUG_KEY)) === 'true'
  return json({ backgroundUrl, assetPublicUrlDebug } satisfies AdminUiSettingsResponse)
}

export async function handleUpdateAdminUiSettings(env: WorkerEnv, request: Request): Promise<Response> {
  const payload = (await request.json()) as Partial<UpdateAdminUiSettingsRequest>
  let backgroundUrl: string
  try {
    backgroundUrl = payload.backgroundUrl === undefined
      ? (await getConfigValue(env, ADMIN_BACKGROUND_URL_KEY)) ?? ''
      : normalizeBackgroundUrl(payload.backgroundUrl)
  } catch (error) {
    return json(
      { error: 'INVALID_BACKGROUND_URL', message: error instanceof Error ? error.message : 'Invalid backgroundUrl' },
      { status: 400 },
    )
  }
  const assetPublicUrlDebug = typeof payload.assetPublicUrlDebug === 'boolean'
    ? payload.assetPublicUrlDebug
    : (await getConfigValue(env, ASSET_PUBLIC_URL_DEBUG_KEY)) === 'true'

  await setConfigValue(env, ADMIN_BACKGROUND_URL_KEY, backgroundUrl)
  await setConfigValue(env, ASSET_PUBLIC_URL_DEBUG_KEY, assetPublicUrlDebug ? 'true' : '')
  return json({ backgroundUrl, assetPublicUrlDebug } satisfies AdminUiSettingsResponse)
}
