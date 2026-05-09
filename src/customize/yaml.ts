import { parse, parseDocument, stringify } from 'yaml'

export type YamlRecord = Record<string, unknown>

export function parseYaml<T = unknown>(content: string, fallback: T): T {
  if (!content.trim()) return fallback
  const value = parse(content) as unknown
  return value === null || value === undefined ? fallback : value as T
}

export function parseYamlRecord(content: string): YamlRecord {
  const value = parseYaml<unknown>(content, {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value as YamlRecord : {}
}

export function stringifyYaml(value: unknown): string {
  return stringify(value, {
    indent: 2,
    lineWidth: 0,
    singleQuote: false,
  })
}

export function setYamlPaths(content: string, updates: Array<{ path: Array<string | number>; value: unknown }>): string {
  const document = parseDocument(content.trim() ? content : '{}')
  for (const update of updates) {
    document.setIn(update.path, update.value)
  }
  return document.toString({ lineWidth: 0 })
}

export function getRecord(value: unknown): YamlRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as YamlRecord : {}
}

export function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function getString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  return typeof value === 'string' ? value : String(value)
}

export function getNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function getBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

export function getIn(root: unknown, path: Array<string | number>): unknown {
  let current = root
  for (const segment of path) {
    if (typeof segment === 'number') {
      current = Array.isArray(current) ? current[segment] : undefined
    } else {
      current = getRecord(current)[segment]
    }
  }
  return current
}

export function asStringArray(value: unknown): string[] {
  return getArray(value).map((item) => getString(item)).filter((item) => item.length > 0)
}

export function mapToKeyValueItems(value: unknown): Array<{ key: string; value: string }> {
  if (Array.isArray(value)) {
    return value.map((raw) => {
      const item = getRecord(raw)
      return { key: getString(item.key), value: getString(item.value) }
    })
  }
  return Object.entries(getRecord(value)).map(([key, item]) => ({ key, value: getString(item) }))
}

export function keyValueItemsToMap(items: Array<{ key: string; value: string }>): YamlRecord {
  return Object.fromEntries(items.filter((item) => item.key.trim()).map((item) => [item.key.trim(), item.value]))
}

export function linkMapToList(value: unknown): Array<{ name: string; path: string; icon: string }> {
  if (Array.isArray(value)) {
    return value.map((raw) => {
      const item = getRecord(raw)
      return {
        name: getString(item.name),
        path: getString(item.path),
        icon: getString(item.icon),
      }
    })
  }
  return Object.entries(getRecord(value)).map(([name, raw]) => {
    const item = getRecord(raw)
    return {
      name,
      path: getString(item.path),
      icon: getString(item.icon),
    }
  })
}

export function linkListToMap(items: Array<{ name: string; path: string; icon: string }>): YamlRecord {
  const result: YamlRecord = {}
  for (const item of items) {
    const name = item.name.trim()
    if (!name) continue
    result[name] = {
      path: item.path,
      icon: item.icon,
    }
  }
  return result
}

export function parseMarkdownPage(markdown: string, path: string): {
  exists: boolean
  path: string
  frontMatter: YamlRecord
  body: string
} {
  const normalized = markdown.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---')) {
    return { exists: Boolean(markdown), path, frontMatter: {}, body: normalized }
  }

  const end = normalized.indexOf('\n---', 3)
  if (end === -1) {
    return { exists: Boolean(markdown), path, frontMatter: {}, body: normalized }
  }

  const afterFence = normalized.indexOf('\n', end + 4)
  const bodyStart = afterFence === -1 ? normalized.length : afterFence + 1
  return {
    exists: Boolean(markdown),
    path,
    frontMatter: parseYamlRecord(normalized.slice(3, end).trim()),
    body: normalized.slice(bodyStart),
  }
}

export function stringifyMarkdownPage(frontMatter: YamlRecord, body: string): string {
  const rawFrontMatter = stringifyYaml(frontMatter).trimEnd()
  const normalizedBody = body.replace(/\r\n/g, '\n')
  return `---\n${rawFrontMatter}\n---\n${normalizedBody.startsWith('\n') ? '' : '\n'}${normalizedBody}`
}
