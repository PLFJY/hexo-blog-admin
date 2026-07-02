import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { safeGetLocalStorage, safeSetLocalStorage } from '../lib/storage'
import { ThemeContext, type AppThemeMode, type ResolvedThemeMode, type ThemeContextValue } from './themeContext'

function getInitialTheme(): AppThemeMode {
  const stored = safeGetLocalStorage('theme')
  return stored === 'system' || stored === 'light' || stored === 'dark' ? stored : 'system'
}

function getSystemTheme(): ResolvedThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function resolveTheme(mode: AppThemeMode, systemMode: ResolvedThemeMode): ResolvedThemeMode {
  return mode === 'system' ? systemMode : mode
}

function nextThemeMode(mode: AppThemeMode): AppThemeMode {
  if (mode === 'system') return 'light'
  if (mode === 'light') return 'dark'
  return 'system'
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppThemeMode>(getInitialTheme)
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(getSystemTheme)
  const resolvedMode = resolveTheme(mode, systemMode)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined

    const media = window.matchMedia('(prefers-color-scheme: light)')
    const handleChange = () => setSystemMode(media.matches ? 'light' : 'dark')
    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    safeSetLocalStorage('theme', mode)
    document.documentElement.dataset.theme = resolvedMode
    document.documentElement.dataset.themePreference = mode
  }, [mode, resolvedMode])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      toggleTheme: () => setMode((current) => nextThemeMode(current)),
      setThemeMode: setMode,
    }),
    [mode, resolvedMode],
  )

  return (
    <ThemeContext.Provider value={value}>
      <FluentProvider theme={resolvedMode === 'dark' ? webDarkTheme : webLightTheme}>{children}</FluentProvider>
    </ThemeContext.Provider>
  )
}
