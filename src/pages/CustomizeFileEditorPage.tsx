import { Body1, Button, Text, Title1, Title3 } from '@fluentui/react-components'
import { SaveRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { getJson, sendJson } from '../lib/apiClient'
import type { CustomizeFileResponse, CustomizeSaveResponse } from '../shared/customizeTypes'
import { usePageStyles } from './pageStyles'
import { BackToCustomizeButton, CustomizeSaveStatusPanel } from './customizeShared'
import { useCommitDeployTracker } from './useCommitDeployTracker'

type State =
  | { status: 'loading' }
  | { status: 'ready'; file: CustomizeFileResponse; content: string; saving?: boolean; message?: string }
  | { status: 'error'; message: string }

export function CustomizeFileEditorPage() {
  const styles = usePageStyles()
  const params = useParams()
  const fileId = params.fileId ?? ''
  const [state, setState] = useState<State>({ status: 'loading' })
  const tracker = useCommitDeployTracker()
  const { t } = useTranslation()

  const load = () => {
    if (!fileId) {
      setState({ status: 'error', message: 'fileId is required' })
      return
    }
    setState({ status: 'loading' })
    void getJson<CustomizeFileResponse>(`/customize/file?id=${encodeURIComponent(fileId)}`)
      .then((file) => setState({ status: 'ready', file, content: file.content }))
      .catch((error: unknown) => setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  useEffect(() => {
    let active = true
    if (!fileId) {
      setTimeout(() => {
        if (active) setState({ status: 'error', message: 'fileId is required' })
      }, 0)
      return () => {
        active = false
      }
    }
    void getJson<CustomizeFileResponse>(`/customize/file?id=${encodeURIComponent(fileId)}`)
      .then((file) => {
        if (active) setState({ status: 'ready', file, content: file.content })
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' })
      })
    return () => {
      active = false
    }
  }, [fileId])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  const save = () => {
    setState({ ...state, saving: true, message: undefined })
    void sendJson<CustomizeSaveResponse>('/customize/file', 'PUT', {
      id: fileId,
      content: state.content,
    })
      .then((response) => {
        setState({ ...state, saving: false, file: { ...state.file, content: state.content, exists: true } })
        tracker.start(response.commitSha)
      })
      .catch((error: unknown) => setState({ ...state, saving: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <BackToCustomizeButton />
        </div>
        <Title1>{state.file.file.label}</Title1>
        <Body1>{state.file.file.path}</Body1>
      </header>

      {state.message ? (
        <section className={styles.card}>
          <Text>{state.message}</Text>
        </section>
      ) : null}
      <CustomizeSaveStatusPanel status={tracker.status} />

      <section className={styles.card}>
        <div className={styles.row}>
          <Title3>{t('customize.rawEditor')}</Title3>
          <Button appearance="primary" icon={<SaveRegular />} onClick={save} disabled={state.saving}>
            {state.saving ? t('actions.saving') : t('actions.save')}
          </Button>
        </div>
        <MarkdownEditor value={state.content} onChange={(content) => setState({ ...state, content })} />
      </section>
    </section>
  )
}
