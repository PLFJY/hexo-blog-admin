import type { WorkerEnv } from '../../env'

export async function getConfigValue(_env: WorkerEnv, _key: string): Promise<string | null> {
  return null
}

export async function setConfigValue(
  _env: WorkerEnv,
  key: string,
  value: string,
): Promise<{ key: string; value: string }> {
  return { key, value }
}
