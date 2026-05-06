import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildMergedMarkdown, createMergeHunks } from '../lib/markdownDiff'
import type { MergeHunk } from '../lib/markdownDiff'

const useStyles = makeStyles({
  surface: {
    width: 'min(1040px, calc(100vw - 32px))',
    maxWidth: 'min(1040px, calc(100vw - 32px))',
  },
  content: {
    display: 'grid',
    gap: tokens.spacingVerticalL,
    maxHeight: 'min(74vh, 760px)',
    overflowY: 'auto',
  },
  topActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  hunkList: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
  },
  hunk: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  activeHunk: {
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    borderLeftColor: tokens.colorBrandStroke1,
    boxShadow: tokens.shadow4,
  },
  hunkActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  diffGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: tokens.spacingHorizontalM,
    '@media (max-width: 720px)': {
      gridTemplateColumns: '1fr',
    },
  },
  diffPane: {
    display: 'grid',
    gap: tokens.spacingVerticalXS,
    minWidth: 0,
  },
  cloudPane: {
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorPaletteBlueBackground2,
  },
  localPane: {
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorPaletteGreenBackground2,
  },
  code: {
    minHeight: '84px',
    maxHeight: '220px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  textarea: {
    width: '100%',
    minHeight: '140px',
    resize: 'vertical',
    boxSizing: 'border-box',
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  preview: {
    display: 'block',
    minHeight: '140px',
    maxHeight: '260px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  previewEqual: {
    backgroundColor: 'transparent',
  },
  previewCloud: {
    display: 'inline',
    backgroundColor: tokens.colorPaletteBlueBackground2,
  },
  previewLocal: {
    display: 'inline',
    backgroundColor: tokens.colorPaletteGreenBackground2,
  },
  previewManual: {
    display: 'inline',
    backgroundColor: tokens.colorPaletteYellowBackground2,
  },
})

type PreviewSegment = {
  id: string
  text: string
  tone: 'equal' | 'cloud' | 'local' | 'manual'
}

const buildPreviewSegments = (hunks: MergeHunk[]): PreviewSegment[] =>
  hunks.flatMap((hunk) => {
    if (hunk.type === 'equal') return [{ id: `${hunk.id}:equal`, text: hunk.cloudLines.join(''), tone: 'equal' as const }]
    if (hunk.selected === 'manual') return [{ id: `${hunk.id}:manual`, text: hunk.manualText ?? '', tone: 'manual' as const }]
    if (hunk.selected === 'local') return [{ id: `${hunk.id}:local`, text: hunk.localLines.join(''), tone: 'local' as const }]
    if (hunk.selected === 'both') {
      return [
        { id: `${hunk.id}:cloud`, text: hunk.cloudLines.join(''), tone: 'cloud' as const },
        { id: `${hunk.id}:local`, text: hunk.localLines.join(''), tone: 'local' as const },
      ]
    }
    return [{ id: `${hunk.id}:cloud`, text: hunk.cloudLines.join(''), tone: 'cloud' as const }]
  })

type EditorConflictResolverDialogProps = {
  open: boolean
  title: string
  cloudLabel: string
  localLabel: string
  cloudMarkdown: string
  localMarkdown: string
  legacy?: boolean
  onUseCloud: () => void
  onUseLocal: () => void
  onApplyMerged: (markdown: string) => void
}

export function EditorConflictResolverDialog({
  open,
  title,
  cloudLabel,
  localLabel,
  cloudMarkdown,
  localMarkdown,
  legacy,
  onUseCloud,
  onUseLocal,
  onApplyMerged,
}: EditorConflictResolverDialogProps) {
  const styles = useStyles()
  const { t } = useTranslation()
  const [mergeOpen, setMergeOpen] = useState(false)
  const [activeHunkId, setActiveHunkId] = useState<string>()
  const hunkRefs = useRef<Record<string, HTMLElement | null>>({})
  const initialHunks = useMemo(() => createMergeHunks({ cloudMarkdown, localMarkdown }), [cloudMarkdown, localMarkdown])
  const [hunks, setHunks] = useState<MergeHunk[]>(initialHunks)

  useEffect(() => {
    if (!open) return
    setHunks(initialHunks)
    setMergeOpen(false)
    setActiveHunkId(undefined)
  }, [initialHunks, open])

  const mergedMarkdown = useMemo(() => buildMergedMarkdown(hunks), [hunks])
  const selectableHunks = useMemo(() => hunks.filter((hunk) => hunk.type !== 'equal'), [hunks])
  const previewSegments = useMemo(() => buildPreviewSegments(hunks), [hunks])
  const scrollToHunk = (id: string) => {
    setActiveHunkId(id)
    window.requestAnimationFrame(() => hunkRefs.current[id]?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }
  const setHunk = (id: string, patch: Partial<MergeHunk>) => {
    setHunks((current) => current.map((hunk) => (hunk.id === id ? { ...hunk, ...patch } : hunk)))
    scrollToHunk(id)
  }
  const openMergeTool = () => {
    setMergeOpen(true)
    const firstHunk = selectableHunks[0]
    if (firstHunk) scrollToHunk(firstHunk.id)
  }
  const previewClass = (tone: PreviewSegment['tone']) => {
    if (tone === 'cloud') return styles.previewCloud
    if (tone === 'local') return styles.previewLocal
    if (tone === 'manual') return styles.previewManual
    return styles.previewEqual
  }

  return (
    <Dialog open={open} modalType="modal" onOpenChange={() => undefined}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent className={styles.content}>
            <Text>{legacy ? t('conflict.legacySnapshotDescription') : t('conflict.description')}</Text>
            {!mergeOpen ? (
              <div className={styles.topActions}>
                <Button appearance="primary" onClick={onUseCloud}>{t('conflict.useCloud')}</Button>
                <Button onClick={onUseLocal}>{t('conflict.useLocal')}</Button>
                {!legacy ? <Button onClick={openMergeTool}>{t('conflict.openMergeTool')}</Button> : null}
              </div>
            ) : null}
            {mergeOpen && !legacy ? (
              <div className={styles.hunkList}>
                {selectableHunks.map((hunk) => (
                  <section
                    className={`${styles.hunk} ${activeHunkId === hunk.id ? styles.activeHunk : ''}`}
                    key={hunk.id}
                    ref={(element) => {
                      hunkRefs.current[hunk.id] = element
                    }}
                  >
                    <div className={styles.hunkActions}>
                      <Button appearance={hunk.selected === 'cloud' ? 'primary' : 'secondary'} onClick={() => setHunk(hunk.id, { selected: 'cloud' })}>
                        {t('conflict.keepCloud')}
                      </Button>
                      <Button appearance={hunk.selected === 'local' ? 'primary' : 'secondary'} onClick={() => setHunk(hunk.id, { selected: 'local' })}>
                        {t('conflict.keepLocal')}
                      </Button>
                      <Button appearance={hunk.selected === 'both' ? 'primary' : 'secondary'} onClick={() => setHunk(hunk.id, { selected: 'both' })}>
                        {t('conflict.keepBoth')}
                      </Button>
                      <Button
                        appearance={hunk.selected === 'manual' ? 'primary' : 'secondary'}
                        onClick={() => setHunk(hunk.id, { selected: 'manual', manualText: hunk.manualText ?? hunk.cloudLines.join('') })}
                      >
                        {t('conflict.manualEdit')}
                      </Button>
                    </div>
                    <div className={styles.diffGrid}>
                      <div className={`${styles.diffPane} ${styles.cloudPane}`}>
                        <Text weight="semibold">{cloudLabel}</Text>
                        <pre className={styles.code}>{hunk.cloudLines.join('')}</pre>
                      </div>
                      <div className={`${styles.diffPane} ${styles.localPane}`}>
                        <Text weight="semibold">{localLabel}</Text>
                        <pre className={styles.code}>{hunk.localLines.join('')}</pre>
                      </div>
                    </div>
                    {hunk.selected === 'manual' ? (
                      <textarea
                        className={styles.textarea}
                        value={hunk.manualText ?? ''}
                        onChange={(event) => setHunk(hunk.id, { manualText: event.target.value })}
                      />
                    ) : null}
                  </section>
                ))}
                <label>
                  <Text weight="semibold">{t('conflict.mergedPreview')}</Text>
                  <pre className={styles.preview} aria-label={t('conflict.mergedPreview')}>
                    {previewSegments.map((segment) => (
                      <span className={previewClass(segment.tone)} key={segment.id}>{segment.text}</span>
                    ))}
                  </pre>
                </label>
              </div>
            ) : null}
          </DialogContent>
          <DialogActions>
            {mergeOpen && !legacy ? <Button appearance="primary" onClick={() => onApplyMerged(mergedMarkdown)}>{t('conflict.applyMerged')}</Button> : null}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
