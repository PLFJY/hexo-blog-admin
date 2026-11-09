import type { WorkerEnv } from '../../env'

/**
 * Draft image blob storage.
 *
 * Upstream requires an R2 bucket (`BLOG_ASSET_CACHE`), which needs an R2
 * subscription (and a payment method) on the Cloudflare account. This module
 * keeps R2 as the preferred backend and falls back to the always-available KV
 * namespace that the app already requires, so the admin panel runs on a free
 * account with no billing setup.
 *
 * KV constraints: 25 MiB per value, 1k writes/day on the free plan — fine for
 * draft image staging (published images are committed to the blog repo).
 */
const KV_PREFIX = 'asset:'

export type AssetBlob = {
  body: ReadableStream
  contentType: string
  size?: number
  arrayBuffer: () => Promise<ArrayBuffer>
}

export function hasAssetBlobStore(env: WorkerEnv): boolean {
  return Boolean(env.BLOG_ASSET_CACHE || env.BLOG_ADMIN_KV)
}

function requireStore(env: WorkerEnv) {
  if (env.BLOG_ASSET_CACHE) return { kind: 'r2' as const, bucket: env.BLOG_ASSET_CACHE }
  if (env.BLOG_ADMIN_KV) return { kind: 'kv' as const, kv: env.BLOG_ADMIN_KV }
  throw new Error('BLOG_ASSET_CACHE binding is not configured and BLOG_ADMIN_KV is unavailable')
}

export async function putAssetBlob(
  env: WorkerEnv,
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const store = requireStore(env)
  if (store.kind === 'r2') {
    await store.bucket.put(key, body, { httpMetadata: { contentType } })
    return
  }
  await store.kv.put(KV_PREFIX + key, body, { metadata: { contentType } })
}

export async function getAssetBlob(env: WorkerEnv, key: string): Promise<AssetBlob | null> {
  if (!hasAssetBlobStore(env)) return null

  const store = requireStore(env)
  if (store.kind === 'r2') {
    const object = await store.bucket.get(key)
    if (!object) return null
    return {
      body: object.body,
      contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
      size: object.size,
      arrayBuffer: () => object.arrayBuffer(),
    }
  }

  const result = await store.kv.getWithMetadata<{ contentType?: string }>(KV_PREFIX + key, 'arrayBuffer')
  const buffer = result.value
  if (!buffer) return null
  return {
    body: new Response(buffer).body as ReadableStream,
    contentType: result.metadata?.contentType ?? 'application/octet-stream',
    size: buffer.byteLength,
    arrayBuffer: async () => buffer,
  }
}

export async function deleteAssetBlob(env: WorkerEnv, key: string): Promise<void> {
  if (!hasAssetBlobStore(env)) return
  const store = requireStore(env)
  if (store.kind === 'r2') {
    await store.bucket.delete(key)
    return
  }
  await store.kv.delete(KV_PREFIX + key)
}
