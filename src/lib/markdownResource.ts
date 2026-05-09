import { buildApiUrl } from './apiClient'
import type { PublicConfigResponse } from '../shared/apiTypes'
import type { DraftAsset } from '../shared/assetTypes'

type ResolveMarkdownResourceOptions = {
  src: string
  relativeId: string
  publicConfig?: PublicConfigResponse
  assets?: DraftAsset[]
  assetObjectUrls?: Record<string, string>
}

const isSpecialUrl = (src: string) => {
  const lower = src.toLowerCase()
  return src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//') || lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('data:') || src.startsWith('#')
}

function articleFolderPublicBase(publicUrl: string, relativeId: string) {
  const base = publicUrl.replace(/\/+$/g, '')
  const normalizedId = relativeId.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
  const folderPath = normalizedId.split('/').slice(0, -1).join('/')
  return `${base}/${folderPath ? `${folderPath}/` : ''}`
}

export function resolveMarkdownResourceUrl({
  src,
  relativeId,
  publicConfig,
  assets = [],
  assetObjectUrls = {},
}: ResolveMarkdownResourceOptions) {
  const trimmed = src.trim()
  const cached = assets.find((asset) => asset.markdownPath === trimmed)
  if (cached) return cached.publicUrl ?? assetObjectUrls[cached.key] ?? buildApiUrl(`/assets/blob?key=${encodeURIComponent(cached.key)}`)
  if (isSpecialUrl(trimmed)) return trimmed
  if (!publicConfig?.BLOG_PUBLIC_URL || !relativeId) return trimmed

  if (trimmed.startsWith('/')) {
    return `${publicConfig.BLOG_PUBLIC_URL.replace(/\/+$/g, '')}${trimmed}`
  }

  return new URL(trimmed, articleFolderPublicBase(publicConfig.BLOG_PUBLIC_URL, relativeId)).toString()
}
