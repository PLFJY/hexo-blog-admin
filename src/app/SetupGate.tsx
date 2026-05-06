import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { getJson } from '../lib/apiClient'
import { SetupRequiredPage } from '../pages/SetupRequiredPage'
import type { SetupStatus } from '../shared/apiTypes'

type SetupGateState =
  | { status: 'loading' }
  | { status: 'ready'; setup: SetupStatus }
  | { status: 'error'; message: string }

export function SetupGate() {
  const [state, setState] = useState<SetupGateState>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    void getJson<SetupStatus>('/setup/status')
      .then((setup) => setState({ status: 'ready', setup }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error'
        setState({ status: 'error', message })
      })
  }

  const refreshSetup = async (options?: { commit?: boolean }) => {
    const setup = await getJson<SetupStatus>('/setup/status')
    if (options?.commit !== false) setState({ status: 'ready', setup })
    return setup
  }

  useEffect(load, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />
  if (!state.setup.configured) return <SetupRequiredPage setup={state.setup} onRefresh={refreshSetup} />

  return <Outlet />
}
