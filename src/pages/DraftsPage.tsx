import {
  Body1,
  Button,
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
import { useNavigate } from 'react-router'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { deleteEditorSnapshot } from '../lib/editorSnapshot'
import { getJson, sendJson } from '../lib/apiClient'
import type { DraftListResponse, DraftRecord } from '../shared/draftTypes'
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
    gridTemplateColumns: 'minmax(0, 1fr) auto',
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
  | { status: 'ready'; drafts: DraftRecord[]; openingDraftId?: string; deletingDraftId?: string; message?: string }
  | { status: 'error'; message: string }

export function DraftsPage() {
  const styles = usePageStyles()
  const draftStyles = useDraftStyles()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [state, setState] = useState<DraftsState>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    void getJson<DraftListResponse>('/drafts')
      .then(({ drafts }) => setState({ status: 'ready', drafts }))
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

  useEffect(load, [])

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
        <ul className={draftStyles.draftList}>
          {state.drafts.map((draft) => (
            <li className={draftStyles.draftItem} key={draft.id}>
              <Button
                appearance="subtle"
                className={draftStyles.draftOpenButton}
                icon={state.openingDraftId === draft.id ? <Spinner size="tiny" /> : <DocumentEditRegular />}
                disabled={state.openingDraftId === draft.id}
                onClick={() => openDraft(draft)}
              >
                <span className={draftStyles.draftMeta}>
                  <Text truncate>{extractFrontMatterTitle(draft.markdown) || draft.relativeId || t('dashboard.untitledDraft')}</Text>
                  <Text size={200} truncate>{draft.relativeId || '-'}</Text>
                </span>
              </Button>
              <DeleteDraftPopover
                disabled={!draft.id || state.deletingDraftId === draft.id}
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
