import { hashMarkdown } from './editorSnapshot'
import type { EditorSnapshotReadResult } from './editorSnapshot'

export type EditorConflictDecision =
  | { kind: 'use-cloud'; reason: 'no-snapshot' | 'same' | 'local-behind-cloud' }
  | { kind: 'use-local'; reason: 'cloud-behind-local'; localMarkdown: string }
  | { kind: 'legacy-snapshot'; localMarkdown: string }
  | {
      kind: 'conflict'
      baseMarkdown: string
      cloudMarkdown: string
      localMarkdown: string
    }

export function decideEditorConflict(options: {
  cloudMarkdown: string
  snapshot: EditorSnapshotReadResult
}): EditorConflictDecision {
  const { cloudMarkdown, snapshot } = options
  if (snapshot.kind === 'none') return { kind: 'use-cloud', reason: 'no-snapshot' }

  if (snapshot.kind === 'legacy') {
    return snapshot.snapshot.markdown === cloudMarkdown
      ? { kind: 'use-cloud', reason: 'same' }
      : { kind: 'legacy-snapshot', localMarkdown: snapshot.snapshot.markdown }
  }

  const { baseHash } = snapshot.snapshot
  const localMarkdown = snapshot.snapshot.markdown
  const baseMarkdown = snapshot.snapshot.baseMarkdown
  const localHash = hashMarkdown(localMarkdown)
  const cloudHash = hashMarkdown(cloudMarkdown)
  const localMatchesCloud = localHash === cloudHash && localMarkdown === cloudMarkdown
  const localMatchesBase = localHash === baseHash && localMarkdown === baseMarkdown
  const cloudMatchesBase = cloudHash === baseHash && cloudMarkdown === baseMarkdown
  // Treat the editor snapshot as a three-way merge: base is what the user originally opened.
  if (localMatchesCloud) return { kind: 'use-cloud', reason: 'same' }
  if (localMatchesBase && !cloudMatchesBase) return { kind: 'use-cloud', reason: 'local-behind-cloud' }
  if (cloudMatchesBase && !localMatchesBase) {
    return { kind: 'use-local', reason: 'cloud-behind-local', localMarkdown }
  }
  return { kind: 'conflict', baseMarkdown, cloudMarkdown, localMarkdown }
}
