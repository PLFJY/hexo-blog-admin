import type { WorkerEnv } from '../../env'

const configKey = (key: string) => `config:${key}`

export async function getConfigValue(env: WorkerEnv, key: string): Promise<string | null> {
  return (await env.BLOG_ADMIN_KV?.get(configKey(key))) ?? null
}

export async function setConfigValue(
  env: WorkerEnv,
  key: string,
  value: string,
): Promise<{ key: string; value: string }> {
  if (!env.BLOG_ADMIN_KV) throw new Error('BLOG_ADMIN_KV is not configured')

  if (value) {
    await env.BLOG_ADMIN_KV.put(configKey(key), value)
  } else {
    await env.BLOG_ADMIN_KV.delete(configKey(key))
  }

  return { key, value }
}
