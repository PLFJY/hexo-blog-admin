import { buildApiUrl } from './apiClient'
import type { PublicConfigResponse } from '../shared/apiTypes'
import type { DraftAsset } from '../shared/assetTypes'

type ResolveMarkdownResourceOptions = {
  src: string
  relativeId: string
  publicConfig?: PublicConfigResponse
  assets?: DraftAsset[]
  assetObjectUrls?: Record<string, string>
  debugPublicUrl?: boolean
}

export type ResolvedMarkdownResourceUrl = string | {
  url: string
  publicAsset?: boolean
  fallbackUrl?: string
}

const isSpecialUrl = (src: string) =>
  /^(https?:)?\/\//.test(src) || /^(mailto|tel|data):/i.test(src) || src.startsWith('#')

const isConfiguredAssetPublicUrl = (publicConfig: PublicConfigResponse | undefined, url: string) => {
  const base = publicConfig?.BLOG_ASSET_PUBLIC_URL?.trim().replace(/\/+$/g, '')
  return Boolean(base && (url === base || url.startsWith(`${base}/`)))
}

const buildConfiguredAssetFallbackUrl = (publicConfig: PublicConfigResponse | undefined, url: string) => {
  const base = publicConfig?.BLOG_ASSET_PUBLIC_URL?.trim().replace(/\/+$/g, '')
  if (!base || !url.startsWith(`${base}/`)) return undefined

  const encodedKey = url.slice(base.length + 1).split(/[?#]/)[0]
  const key = encodedKey.split('/').map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  }).join('/')

  return key ? buildApiUrl(`/assets/blob?key=${encodeURIComponent(key)}`) : undefined
}

function articleFolderPublicBase(publicUrl: string, relativeId: string) {
  const base = publicUrl.replace(/\/+$/g, '')
  const normalizedId = relativeId.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const folderPath = normalizedId.split('/').slice(0, -1).join('/')
  return `${base}/${folderPath ? `${folderPath}/` : ''}`
}

export function resolveMarkdownResourceUrl({
  src,
  relativeId,
  publicConfig,
  assets = [],
  assetObjectUrls = {},
  debugPublicUrl = false,
}: ResolveMarkdownResourceOptions): ResolvedMarkdownResourceUrl {
  const trimmed = src.trim()
  const cached = assets.find((asset) => asset.markdownPath === trimmed)
  if (cached) {
    const fallbackUrl = assetObjectUrls[cached.key] ?? buildApiUrl(`/assets/blob?key=${encodeURIComponent(cached.key)}`)
    if (cached.publicUrl) {
      return {
        url: cached.publicUrl,
        publicAsset: debugPublicUrl,
        fallbackUrl,
      }
    }
    return fallbackUrl
  }
  if (isSpecialUrl(trimmed)) {
    const fallbackUrl = buildConfiguredAssetFallbackUrl(publicConfig, trimmed)
    return isConfiguredAssetPublicUrl(publicConfig, trimmed)
      ? { url: trimmed, publicAsset: debugPublicUrl, fallbackUrl }
      : trimmed
  }
  if (!publicConfig?.BLOG_PUBLIC_URL || !relativeId) return trimmed

  if (trimmed.startsWith('/')) {
    return `${publicConfig.BLOG_PUBLIC_URL.replace(/\/+$/g, '')}${trimmed}`
  }

  return new URL(trimmed, articleFolderPublicBase(publicConfig.BLOG_PUBLIC_URL, relativeId)).toString()
}
