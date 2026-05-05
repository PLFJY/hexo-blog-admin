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

const hasUsableDate = (value: string) => {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
  if (!trimmed) return false
  return Number.isFinite(Date.parse(trimmed))
}

export function ensureFrontMatterDate(markdown: string, dateIso = new Date().toISOString()) {
  const normalized = markdown.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return `---\ndate: ${dateIso}\n---\n\n${normalized}`
  }

  const end = normalized.indexOf('\n---', 4)
  if (end === -1) return normalized

  const frontMatter = normalized.slice(4, end)
  const body = normalized.slice(end)
  const lines = frontMatter.split('\n')
  const dateIndex = lines.findIndex((line) => /^\s*date\s*:/.test(line))
  if (dateIndex >= 0) {
    const currentValue = lines[dateIndex].replace(/^\s*date\s*:\s*/, '')
    if (hasUsableDate(currentValue)) return normalized
    lines[dateIndex] = `date: ${dateIso}`
    return `---\n${lines.join('\n')}${body}`
  }

  const titleIndex = lines.findIndex((line) => /^\s*title\s*:/.test(line))
  lines.splice(titleIndex >= 0 ? titleIndex + 1 : 0, 0, `date: ${dateIso}`)
  return `---\n${lines.join('\n')}${body}`
}
