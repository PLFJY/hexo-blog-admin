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
  const payload = (await response.json()) as unknown

  if (!response.ok) {
    throw new ApiError(response.statusText || 'Request failed', response.status, payload)
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
