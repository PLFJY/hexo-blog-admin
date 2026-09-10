export type MarkdownTextReplacement = {
  oldText: string
  newText: string
}

export function createMarkdownAssetReplacements(
  oldPath: string,
  newPath: string,
  oldFilename?: string,
  newFilename?: string,
): MarkdownTextReplacement[] {
  const replacements: MarkdownTextReplacement[] = []
  if (oldFilename && newFilename) {
    const oldImage = `![${oldFilename}](${oldPath})`
    const newImage = `![${newFilename}](${newPath})`
    if (oldImage !== newImage) replacements.push({ oldText: oldImage, newText: newImage })
  }
  if (oldPath !== newPath) replacements.push({ oldText: oldPath, newText: newPath })
  return replacements
}

export function applyMarkdownTextReplacements(markdown: string, replacements: MarkdownTextReplacement[]): string {
  return replacements.reduce(
    (current, replacement) => replacement.oldText ? current.split(replacement.oldText).join(replacement.newText) : current,
    markdown,
  )
}

export function removeMarkdownImageReferences(markdown: string, markdownPath: string): string {
  const escaped = markdownPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return markdown
    .replace(new RegExp(`!?\\[[^\\]]*\\]\\(${escaped}\\)\\n?`, 'g'), '')
    .replace(new RegExp(escaped, 'g'), '')
}
