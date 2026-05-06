import { diffLines } from 'diff'

export type MergeHunk = {
  id: string
  type: 'equal' | 'changed' | 'added' | 'removed'
  cloudLines: string[]
  localLines: string[]
  selected: 'cloud' | 'local' | 'both' | 'manual'
  manualText?: string
}

const splitMarkdownLines = (markdown: string) => markdown.match(/[^\n]*\n|[^\n]+/g) ?? []

const hunkType = (cloudLines: string[], localLines: string[]): MergeHunk['type'] => {
  if (cloudLines.length > 0 && localLines.length > 0) return cloudLines.join('') === localLines.join('') ? 'equal' : 'changed'
  if (cloudLines.length > 0) return 'removed'
  return 'added'
}

const makeHunk = (index: number, cloudLines: string[], localLines: string[]): MergeHunk => {
  const type = hunkType(cloudLines, localLines)
  return {
    id: `hunk-${index}`,
    type,
    cloudLines,
    localLines,
    selected: type === 'equal' || type === 'removed' ? 'cloud' : type === 'added' ? 'local' : 'cloud',
  }
}

export function createMergeHunks(options: {
  cloudMarkdown: string
  localMarkdown: string
}): MergeHunk[] {
  const hunks: MergeHunk[] = []
  let pendingRemoved: string[] = []
  let hunkIndex = 0

  for (const part of diffLines(options.cloudMarkdown, options.localMarkdown, { newlineIsToken: false })) {
    const lines = splitMarkdownLines(part.value)
    if (part.removed) {
      pendingRemoved = pendingRemoved.concat(lines)
      continue
    }
    if (part.added) {
      hunks.push(makeHunk(hunkIndex, pendingRemoved, lines))
      hunkIndex += 1
      pendingRemoved = []
      continue
    }
    if (pendingRemoved.length > 0) {
      hunks.push(makeHunk(hunkIndex, pendingRemoved, []))
      hunkIndex += 1
      pendingRemoved = []
    }
    hunks.push(makeHunk(hunkIndex, lines, lines))
    hunkIndex += 1
  }

  if (pendingRemoved.length > 0) {
    hunks.push(makeHunk(hunkIndex, pendingRemoved, []))
  }

  return hunks
}

export function buildMergedMarkdown(hunks: MergeHunk[]) {
  return hunks
    .map((hunk) => {
      if (hunk.selected === 'manual') return hunk.manualText ?? ''
      if (hunk.selected === 'local') return hunk.localLines.join('')
      if (hunk.selected === 'both') return `${hunk.cloudLines.join('')}${hunk.localLines.join('')}`
      return hunk.cloudLines.join('')
    })
    .join('')
}
