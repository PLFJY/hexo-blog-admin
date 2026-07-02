import { createContext, useContext } from 'react'

export type AppThemeMode = 'system' | 'light' | 'dark'
export type ResolvedThemeMode = 'light' | 'dark'

export type ThemeContextValue = {
  mode: AppThemeMode
  resolvedMode: ResolvedThemeMode
  toggleTheme: () => void
  setThemeMode: (mode: AppThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function useAppTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider')
  return context
}
