import type { WorkerEnv } from '../env'
import { requireConfig } from './config'

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'])

export function normalizeRelativeId(relativeId: string) {
  return relativeId.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
}

export function assertSafeRelativeId(relativeId: string) {
  const normalized = normalizeRelativeId(relativeId)
  if (!normalized) throw new Error('relativeId is required')
  if (relativeId.startsWith('/') || normalized.includes('..')) throw new Error('Invalid relativeId')
  if (normalized.split('/').some((part) => !part || part === '.' || part === '..' || part === '.git')) {
    throw new Error('Invalid relativeId')
  }
  return normalized
}

export function assertSafeImageFilename(filename: string) {
  const normalized = filename.trim()
  if (!normalized || normalized.includes('/') || normalized.includes('\\') || normalized.includes('..')) {
    throw new Error('Invalid filename')
  }
  const dotIndex = normalized.lastIndexOf('.')
  const ext = dotIndex >= 0 ? normalized.slice(dotIndex).toLowerCase() : ''
  if (!imageExtensions.has(ext)) throw new Error('Unsupported image extension')
  return normalized.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, '-')
}

export function assertSafeRepoPath(env: WorkerEnv, repoPath: string) {
  const postsDir = requireConfig(env).POSTS_DIR.replace(/^\/+|\/+$/g, '')
  const normalized = repoPath.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
  if (!normalized.startsWith(`${postsDir}/`)) throw new Error('repoPath must be under POSTS_DIR')
  if (normalized.includes('..') || normalized.split('/').includes('.git')) throw new Error('Invalid repoPath')
  return normalized
}
