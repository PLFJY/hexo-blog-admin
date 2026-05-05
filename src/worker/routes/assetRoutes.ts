import type { WorkerEnv } from '../env'
import { getDraftAsset, getDraftAssetManifest, putDraftAsset, deleteDraftAsset } from '../services/assets/draftAssetCache'
import { requireConfig } from '../utils/config'
import { json } from '../utils/response'

type JsonAssetUploadRequest = {
  relativeId?: string
  filename?: string
  contentType?: string
  contentBase64?: string
}

const base64ToArrayBuffer = (base64: string) => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

export async function handleAssets(env: WorkerEnv, request: Request): Promise<Response> {
  const url = new URL(request.url)
  const draftId = url.searchParams.get('draftId')
  const relativeId = url.searchParams.get('relativeId') ?? draftId ?? ''

  if (request.method === 'GET') {
    if (!draftId) return json({ error: 'BAD_REQUEST', message: 'draftId is required' }, { status: 400 })
    return json({ manifest: await getDraftAssetManifest(env, draftId, relativeId) })
  }

  if (request.method === 'POST') {
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = (await request.json()) as JsonAssetUploadRequest
      if (!body.filename || !body.relativeId || !body.contentBase64) {
        return json({ error: 'BAD_REQUEST', message: 'filename, relativeId and contentBase64 are required' }, { status: 400 })
      }

      return json(
        await putDraftAsset(env, {
          postsDir: requireConfig(env).POSTS_DIR,
          relativeId: body.relativeId,
          filename: body.filename,
          contentType: body.contentType ?? 'application/octet-stream',
          body: base64ToArrayBuffer(body.contentBase64),
        }),
        { status: 201 },
      )
    }

    const headerFilename = request.headers.get('x-asset-filename')
    const headerRelativeId = request.headers.get('x-post-relative-id')
    if (headerFilename && headerRelativeId) {
      const filename = decodeURIComponent(headerFilename)
      const postRelativeId = decodeURIComponent(headerRelativeId)
      if (!filename || !postRelativeId) {
        return json({ error: 'BAD_REQUEST', message: 'filename and relativeId are required' }, { status: 400 })
      }

      return json(
        await putDraftAsset(env, {
          postsDir: requireConfig(env).POSTS_DIR,
          relativeId: postRelativeId,
          filename,
          contentType: request.headers.get('content-type') ?? 'application/octet-stream',
          body: await request.arrayBuffer(),
        }),
        { status: 201 },
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const postRelativeId = String(formData.get('relativeId') ?? '')
    if (!(file instanceof File) || !postRelativeId) {
      return json({ error: 'BAD_REQUEST', message: 'file and relativeId are required' }, { status: 400 })
    }

    return json(
      await putDraftAsset(env, {
        postsDir: requireConfig(env).POSTS_DIR,
        relativeId: postRelativeId,
        filename: file.name,
        contentType: file.type,
        body: await file.arrayBuffer(),
      }),
      { status: 201 },
    )
  }

  if (request.method === 'DELETE') {
    const key = url.searchParams.get('key')
    if (!key) return json({ error: 'BAD_REQUEST', message: 'key is required' }, { status: 400 })
    return json(await deleteDraftAsset(env, key))
  }

  return json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
}

export async function handleAssetBlob(env: WorkerEnv, request: Request): Promise<Response> {
  const key = new URL(request.url).searchParams.get('key')
  if (!key) return json({ error: 'BAD_REQUEST', message: 'key is required' }, { status: 400 })
  const object = await getDraftAsset(env, key)
  if (!object) return json({ error: 'NOT_FOUND' }, { status: 404 })

  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'private, max-age=60',
    },
  })
}
