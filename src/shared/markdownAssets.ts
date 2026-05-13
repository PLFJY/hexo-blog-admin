export function removeMarkdownImageReferences(markdown: string, markdownPath: string): string {
  const escaped = markdownPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return markdown
    .replace(new RegExp(`!?\\[[^\\]]*\\]\\(${escaped}\\)\\n?`, 'g'), '')
    .replace(new RegExp(escaped, 'g'), '')
}
