export function stripFrontMatter(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) return normalized

  const end = normalized.indexOf('\n---', 4)
  if (end === -1) return normalized

  const afterFence = normalized.slice(end + 4)
  return afterFence.startsWith('\n') ? afterFence.slice(1) : afterFence
}

export function extractFrontMatterTitle(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) return ''

  const end = normalized.indexOf('\n---', 4)
  if (end === -1) return ''

  const frontMatter = normalized.slice(4, end).split('\n')
  const titleLine = frontMatter.find((line) => /^\s*title\s*:/.test(line))
  if (!titleLine) return ''

  return titleLine
    .replace(/^\s*title\s*:\s*/, '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
}
