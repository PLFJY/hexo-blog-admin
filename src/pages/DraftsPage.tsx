import {
  Body1,
  Button,
  Checkbox,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Spinner,
  Text,
  Title1,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { DeleteRegular, DocumentEditRegular } from '@fluentui/react-icons'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { deleteEditorSnapshot } from '../lib/editorSnapshot'
import { getJson, sendJson } from '../lib/apiClient'
import type { BatchDraftsResponse, DraftListResponse, DraftRecord } from '../shared/draftTypes'
import { extractFrontMatterTitle } from '../shared/frontMatter'
import { usePageStyles } from './pageStyles'

const useDraftStyles = makeStyles({
  draftList: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
  draftItem: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    ':hover': {
      borderTopColor: tokens.colorNeutralStroke1Hover,
      borderRightColor: tokens.colorNeutralStroke1Hover,
      borderBottomColor: tokens.colorNeutralStroke1Hover,
      borderLeftColor: tokens.colorNeutralStroke1Hover,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  draftMeta: {
    display: 'grid',
    justifyItems: 'start',
    minWidth: 0,
    width: '100%',
    textAlign: 'left',
  },
  draftOpenButton: {
    justifyContent: 'flex-start',
    minWidth: 0,
    width: '100%',
    textAlign: 'left',
  },
  selectionCheckbox: { marginTop: tokens.spacingVerticalXS },
  bulkBar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    margin: `${tokens.spacingVerticalM} 0`,
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  dangerPrimaryButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorPaletteRedBackground3,
    ':hover': {
      color: tokens.colorNeutralForegroundOnBrand,
      backgroundColor: tokens.colorPaletteRedForeground1,
    },
    ':disabled': {
      backgroundColor: tokens.colorNeutralBackgroundDisabled,
      color: tokens.colorNeutralForegroundDisabled,
      borderTopColor: tokens.colorNeutralStrokeDisabled,
      borderRightColor: tokens.colorNeutralStrokeDisabled,
      borderBottomColor: tokens.colorNeutralStrokeDisabled,
      borderLeftColor: tokens.colorNeutralStrokeDisabled,
    },
  },
  confirmSurface: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    maxWidth: '280px',
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
})

type DraftsState =
  | { status: 'loading' }
  | { status: 'ready'; drafts: DraftRecord[]; openingDraftId?: string; deletingDraftId?: string; batchDeleting?: boolean; selectedDraftIds: string[]; message?: string }
  | { status: 'error'; message: string }

export function DraftsPage() {
  const styles = usePageStyles()
  const draftStyles = useDraftStyles()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const routeMessage = typeof (location.state as { message?: unknown } | null)?.message === 'string'
    ? (location.state as { message: string }).message
    : undefined
  const [state, setState] = useState<DraftsState>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    void getJson<DraftListResponse>('/drafts')
      .then(({ drafts }) => setState({ status: 'ready', drafts, selectedDraftIds: [], message: routeMessage }))
      .catch((error: unknown) => setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  const openDraft = (draft: DraftRecord) => {
    if (state.status !== 'ready') return
    setState({ ...state, openingDraftId: draft.id })
    navigate(`/drafts/edit?draftId=${encodeURIComponent(draft.id)}`)
  }

  const removeDraft = (draft: DraftRecord) => {
    if (state.status !== 'ready' || !draft.id) return
    setState({ ...state, deletingDraftId: draft.id })
    void sendJson<{ deleted: boolean }>(`/drafts/${encodeURIComponent(draft.id)}`, 'DELETE')
      .then(() => {
        deleteEditorSnapshot(`draft:${draft.id}`)
        setState((current) =>
          current.status === 'ready'
            ? { ...current, drafts: current.drafts.filter((item) => item.id !== draft.id), deletingDraftId: undefined }
            : current,
        )
      })
      .catch((error: unknown) =>
        setState((current) =>
          current.status === 'ready'
            ? { ...current, deletingDraftId: undefined, message: error instanceof Error ? error.message : 'Unknown error' }
            : current,
        ),
      )
  }

  const toggleDraftSelection = (draft: DraftRecord) => {
    if (state.status !== 'ready' || state.batchDeleting) return
    const selected = new Set(state.selectedDraftIds)
    if (selected.has(draft.id)) selected.delete(draft.id)
    else selected.add(draft.id)
    setState({ ...state, selectedDraftIds: Array.from(selected) })
  }

  const selectAllDrafts = () => {
    if (state.status !== 'ready' || state.batchDeleting) return
    const allSelected = state.selectedDraftIds.length === state.drafts.length
    setState({ ...state, selectedDraftIds: allSelected ? [] : state.drafts.map((draft) => draft.id) })
  }

  const removeSelectedDrafts = () => {
    if (state.status !== 'ready' || state.selectedDraftIds.length === 0 || state.batchDeleting) return
    if (!window.confirm(t('drafts.confirmBatchDeleteDescription', { count: state.selectedDraftIds.length }))) return
    const ids = state.selectedDraftIds
    setState({ ...state, batchDeleting: true, message: undefined })
    void sendJson<BatchDraftsResponse>('/drafts/batch', 'POST', { draftIds: ids, action: 'delete' })
      .then((response) => {
        response.draftIds.forEach((draftId) => deleteEditorSnapshot(`draft:${draftId}`))
        const deleted = new Set(response.draftIds)
        setState({ ...state, drafts: state.drafts.filter((draft) => !deleted.has(draft.id)), selectedDraftIds: [], batchDeleting: false, message: t('drafts.batchDeleteSuccess', { count: response.deleted }) })
      })
      .catch((error: unknown) => setState({ ...state, batchDeleting: false, message: error instanceof Error ? error.message : 'Unknown error' }))
  }

  useEffect(() => {
    queueMicrotask(load)
  }, [])

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={load} />

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('drafts.title')}</Title1>
        <Body1>{t('drafts.description')}</Body1>
      </header>
      <section className={styles.card}>
        <div className={styles.row}>
          <Title3>{t('drafts.draftList')}</Title3>
          <Button onClick={() => navigate('/drafts/edit')}>{t('drafts.newDraft')}</Button>
        </div>
        {state.message ? <Text>{state.message}</Text> : null}
        <div className={draftStyles.bulkBar}>
          <Checkbox checked={state.drafts.length > 0 && state.selectedDraftIds.length === state.drafts.length} disabled={state.drafts.length === 0 || state.batchDeleting} onChange={selectAllDrafts} label={t('drafts.selectAll')} />
          {state.selectedDraftIds.length > 0 ? <Text>{t('drafts.selectedCount', { count: state.selectedDraftIds.length })}</Text> : null}
          <Button appearance="primary" className={draftStyles.dangerPrimaryButton} disabled={state.selectedDraftIds.length === 0 || state.batchDeleting} icon={state.batchDeleting ? <Spinner size="tiny" /> : <DeleteRegular />} onClick={removeSelectedDrafts}>{t('drafts.deleteSelected')}</Button>
        </div>
        <ul className={draftStyles.draftList}>
          {state.drafts.map((draft) => (
            <li className={draftStyles.draftItem} key={draft.id}>
              <Checkbox className={draftStyles.selectionCheckbox} checked={state.selectedDraftIds.includes(draft.id)} onChange={() => toggleDraftSelection(draft)} aria-label={draft.relativeId || t('dashboard.untitledDraft')} />
              <Button
                appearance="subtle"
                className={draftStyles.draftOpenButton}
                icon={state.openingDraftId === draft.id ? <Spinner size="tiny" /> : <DocumentEditRegular />}
                disabled={state.openingDraftId === draft.id || state.batchDeleting}
                onClick={() => openDraft(draft)}
              >
                <span className={draftStyles.draftMeta}>
                  <Text truncate>{extractFrontMatterTitle(draft.markdown) || draft.relativeId || t('dashboard.untitledDraft')}</Text>
                  <Text size={200} truncate>{draft.relativeId || '-'}</Text>
                </span>
              </Button>
              <DeleteDraftPopover
                disabled={!draft.id || state.deletingDraftId === draft.id || state.batchDeleting}
                busy={state.deletingDraftId === draft.id}
                onConfirm={() => removeDraft(draft)}
              />
            </li>
          ))}
        </ul>
      </section>
    </section>
  )
}

function DeleteDraftPopover({ disabled, busy, onConfirm }: { disabled?: boolean; busy?: boolean; onConfirm: () => void }) {
  const { t } = useTranslation()
  const draftStyles = useDraftStyles()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="primary" className={draftStyles.dangerPrimaryButton} icon={busy ? <Spinner size="tiny" /> : <DeleteRegular />} disabled={disabled}>
          {t('drafts.deleteDraft')}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={draftStyles.confirmSurface}>
        <Text weight="semibold">{t('drafts.confirmDeleteTitle')}</Text>
        <Text>{t('drafts.confirmDeleteDescription')}</Text>
        <div className={draftStyles.confirmActions}>
          <Button appearance="secondary" onClick={() => setOpen(false)}>{t('actions.close')}</Button>
          <Button
            appearance="primary"
            className={draftStyles.dangerPrimaryButton}
            icon={<DeleteRegular />}
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            {t('drafts.deleteDraft')}
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  )
}
