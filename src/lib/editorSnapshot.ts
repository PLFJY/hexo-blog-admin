import { safeGetLocalStorage, safeRemoveLocalStorage, safeSetLocalStorage } from './storage'

export type EditorSnapshotSource = 'draft' | 'source' | 'file'

export type LegacyEditorSnapshot = {
  markdown: string
  updatedAt: string
}

export type EditorSnapshotV2 = {
  version: 2
  scope: string
  source: EditorSnapshotSource
  markdown: string
  updatedAt: string
  baseMarkdown: string
  baseHash: string
  baseRevision?: string
  baseUpdatedAt?: string
}

export type EditorSnapshotReadResult =
  | { kind: 'none' }
  | { kind: 'legacy'; snapshot: LegacyEditorSnapshot }
  | { kind: 'v2'; snapshot: EditorSnapshotV2 }

const snapshotKey = (scope: string) => `editor-snapshot:${scope}`

export function hashMarkdown(markdown: string) {
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  for (let index = 0; index < markdown.length; index += 1) {
    hash ^= BigInt(markdown.charCodeAt(index))
    hash = (hash * prime) & mask
  }
  return hash.toString(16).padStart(16, '0')
}

export function readEditorSnapshot(scope: string): EditorSnapshotReadResult {
  const raw = safeGetLocalStorage(snapshotKey(scope))
  if (!raw) return { kind: 'none' }
  try {
    const parsed = JSON.parse(raw) as Partial<EditorSnapshotV2 & LegacyEditorSnapshot>
    if (
      parsed.version === 2 &&
      parsed.scope === scope &&
      (parsed.source === 'draft' || parsed.source === 'source' || parsed.source === 'file') &&
      typeof parsed.markdown === 'string' &&
      typeof parsed.updatedAt === 'string' &&
      typeof parsed.baseMarkdown === 'string' &&
      typeof parsed.baseHash === 'string'
    ) {
      return {
        kind: 'v2',
        snapshot: {
          version: 2,
          scope: parsed.scope,
          source: parsed.source,
          markdown: parsed.markdown,
          updatedAt: parsed.updatedAt,
          baseMarkdown: parsed.baseMarkdown,
          baseHash: parsed.baseHash,
          baseRevision: typeof parsed.baseRevision === 'string' ? parsed.baseRevision : undefined,
          baseUpdatedAt: typeof parsed.baseUpdatedAt === 'string' ? parsed.baseUpdatedAt : undefined,
        },
      }
    }
    return typeof parsed.markdown === 'string' && typeof parsed.updatedAt === 'string'
      ? { kind: 'legacy', snapshot: { markdown: parsed.markdown, updatedAt: parsed.updatedAt } }
      : { kind: 'none' }
  } catch {
    return { kind: 'none' }
  }
}

export function writeEditorSnapshot({
  scope,
  source,
  markdown,
  baseMarkdown,
  baseRevision,
  baseUpdatedAt,
}: {
  scope: string
  source: EditorSnapshotSource
  markdown: string
  baseMarkdown: string
  baseRevision?: string
  baseUpdatedAt?: string
}) {
  const snapshot: EditorSnapshotV2 = {
    version: 2,
    scope,
    source,
    markdown,
    updatedAt: new Date().toISOString(),
    baseMarkdown,
    baseHash: hashMarkdown(baseMarkdown),
    baseRevision,
    baseUpdatedAt,
  }
  safeSetLocalStorage(snapshotKey(scope), JSON.stringify(snapshot))
}

export function deleteEditorSnapshot(scope: string) {
  safeRemoveLocalStorage(snapshotKey(scope))
}
