import { safeGetLocalStorage, safeRemoveLocalStorage, safeSetLocalStorage } from './storage'

export type EditorSnapshot = {
  markdown: string
  updatedAt: string
}

const snapshotKey = (scope: string) => `editor-snapshot:${scope}`

export function readEditorSnapshot(scope: string): EditorSnapshot | null {
  const raw = safeGetLocalStorage(snapshotKey(scope))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<EditorSnapshot>
    return typeof parsed.markdown === 'string' && typeof parsed.updatedAt === 'string'
      ? { markdown: parsed.markdown, updatedAt: parsed.updatedAt }
      : null
  } catch {
    return null
  }
}

export function writeEditorSnapshot(scope: string, markdown: string) {
  safeSetLocalStorage(snapshotKey(scope), JSON.stringify({ markdown, updatedAt: new Date().toISOString() }))
}

export function deleteEditorSnapshot(scope: string) {
  safeRemoveLocalStorage(snapshotKey(scope))
}
