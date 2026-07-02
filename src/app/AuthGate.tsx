import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { getJson } from '../lib/apiClient'
import { AdminBackgroundProvider } from './AdminBackgroundProvider'

type AuthState =
  | { status: 'loading' }
  | { status: 'ready'; authenticated: boolean }
  | { status: 'error'; message: string }

export function AuthGate() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    void getJson<{ authenticated: boolean }>('/auth/status')
      .then((result) => setState({ status: 'ready', authenticated: result.authenticated }))
      .catch((error: unknown) =>
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      )
  }

  useEffect(() => {
    queueMicrotask(load)
  }, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />
  if (!state.authenticated) return <Navigate to="/login" replace />

  return (
    <AdminBackgroundProvider>
      <Outlet />
    </AdminBackgroundProvider>
  )
}
