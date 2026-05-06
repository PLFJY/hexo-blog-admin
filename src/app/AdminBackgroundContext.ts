import { createContext, useContext } from 'react'

export type AdminBackgroundContextValue = {
  backgroundUrl: string
  setBackgroundUrl: (backgroundUrl: string) => void
}

export const AdminBackgroundContext = createContext<AdminBackgroundContextValue | undefined>(undefined)

export function useAdminBackground() {
  const context = useContext(AdminBackgroundContext)
  if (!context) throw new Error('useAdminBackground must be used inside AdminBackgroundProvider')
  return context
}
