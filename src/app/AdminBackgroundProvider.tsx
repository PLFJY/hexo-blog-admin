import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getJson } from '../lib/apiClient'
import type { AdminUiSettingsResponse } from '../shared/apiTypes'
import { AdminBackgroundContext, type AdminBackgroundContextValue } from './AdminBackgroundContext'

function cssUrl(url: string) {
  return `url("${url.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
}

export function AdminBackgroundProvider({ children }: { children: ReactNode }) {
  const [backgroundUrl, setBackgroundUrl] = useState('')
  const [assetPublicUrlDebug, setAssetPublicUrlDebug] = useState(false)

  useEffect(() => {
    let active = true
    void getJson<AdminUiSettingsResponse>('/settings/ui')
      .then((settings) => {
        if (!active) return
        setBackgroundUrl(settings.backgroundUrl)
        setAssetPublicUrlDebug(settings.assetPublicUrlDebug)
      })
      .catch(() => {
        if (!active) return
        setBackgroundUrl('')
        setAssetPublicUrlDebug(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement

    if (backgroundUrl) {
      root.dataset.adminBackground = 'true'
      root.style.setProperty(
        '--admin-background-layer',
        `linear-gradient(var(--admin-background-overlay), var(--admin-background-overlay)), ${cssUrl(backgroundUrl)}`,
      )
    } else {
      delete root.dataset.adminBackground
      root.style.setProperty('--admin-background-layer', 'none')
    }

    return () => {
      delete root.dataset.adminBackground
      root.style.removeProperty('--admin-background-layer')
    }
  }, [backgroundUrl])

  const value = useMemo<AdminBackgroundContextValue>(
    () => ({ backgroundUrl, setBackgroundUrl, assetPublicUrlDebug, setAssetPublicUrlDebug }),
    [assetPublicUrlDebug, backgroundUrl],
  )

  return <AdminBackgroundContext.Provider value={value}>{children}</AdminBackgroundContext.Provider>
}
