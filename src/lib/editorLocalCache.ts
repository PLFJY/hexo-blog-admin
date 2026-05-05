import { safeGetLocalStorage, safeSetLocalStorage } from './storage'

export type EditorCacheSnapshot = {
  key: string
  markdown: string
  savedAt: string
}

const cacheKey = (key: string) => `editor-cache:${key}`

export function getEditorSnapshot(key: string): EditorCacheSnapshot | null {
  const raw = safeGetLocalStorage(cacheKey(key))
  if (!raw) return null
  try {
    return JSON.parse(raw) as EditorCacheSnapshot
  } catch {
    return null
  }
}

export function saveEditorSnapshot(key: string, markdown: string) {
  safeSetLocalStorage(cacheKey(key), JSON.stringify({ key, markdown, savedAt: new Date().toISOString() }))
}

export function deleteEditorSnapshot(key: string) {
  try {
    window.localStorage.removeItem(cacheKey(key))
  } catch {
    // Storage can be unavailable in privacy/sandboxed contexts.
  }
}
