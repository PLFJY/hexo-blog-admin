export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export function getAppBasePath() {
  const pathname = window.location.pathname
  return pathname === '/admin' || pathname.startsWith('/admin/') ? '/admin' : ''
}

export function buildApiUrl(path: string) {
  let normalized = path.startsWith('/') ? path : `/${path}`

  if (normalized.startsWith('/api/')) {
    normalized = normalized.slice('/api'.length)
  }

  return `${getAppBasePath()}/api${normalized}`
}

export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  })
  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      payload = { message: text }
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : response.statusText || 'Request failed'
    throw new ApiError(message, response.status, payload)
  }

  return payload as T
}

export async function sendJson<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  return getJson<T>(path, {
    method,
    headers: {
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
