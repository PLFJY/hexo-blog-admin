import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Text,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { CopyRegular, DeleteRegular, ImageAddRegular, OpenRegular, RenameRegular } from '@fluentui/react-icons'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildApiUrl, getJson, sendJson } from '../lib/apiClient'
import type { DraftAsset, DraftAssetListResponse, DraftAssetUploadResponse, ImageWarehouseSourceAsset, RenameDraftAssetResponse } from '../shared/assetTypes'
import type { PostAsset } from '../shared/postTypes'
import { usePageStyles } from '../pages/pageStyles'

const useStyles = makeStyles({
  hiddenInput: { display: 'none' },
  assetList: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
  assetItem: {
    display: 'grid',
    gridTemplateColumns: '72px minmax(0, 1fr) auto',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    padding: tokens.spacingVerticalS,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    '@media (max-width: 600px)': {
      gridTemplateColumns: '72px 1fr',
      alignItems: 'start',
    },
    ':hover': {
      borderTopColor: tokens.colorNeutralStroke1Hover,
      borderRightColor: tokens.colorNeutralStroke1Hover,
      borderBottomColor: tokens.colorNeutralStroke1Hover,
      borderLeftColor: tokens.colorNeutralStroke1Hover,
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  preview: {
    width: '72px',
    height: '48px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  meta: {
    display: 'grid',
    gap: '2px',
    minWidth: 0,
    '& > *': {
      overflowWrap: 'anywhere',
      whiteSpace: 'normal',
    },
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXS,
    '@media (max-width: 600px)': {
      gridColumn: '1 / span 2',
      justifyContent: 'flex-start',
      marginTop: tokens.spacingVerticalS,
    },
  },
  message: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  successMessage: {
    borderTopColor: tokens.colorPaletteGreenBorder2,
    borderRightColor: tokens.colorPaletteGreenBorder2,
    borderBottomColor: tokens.colorPaletteGreenBorder2,
    borderLeftColor: tokens.colorPaletteGreenBorder2,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  errorMessage: {
    borderTopColor: tokens.colorPaletteRedBorder2,
    borderRightColor: tokens.colorPaletteRedBorder2,
    borderBottomColor: tokens.colorPaletteRedBorder2,
    borderLeftColor: tokens.colorPaletteRedBorder2,
    backgroundColor: tokens.colorPaletteRedBackground1,
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
  popoverSurface: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    width: '300px',
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
  },
})

type MarkdownAssetPanelProps = {
  relativeId: string
  draftId?: string
  assets: DraftAsset[]
  sourceAssets?: PostAsset[]
  onAssetsChange: (assets: DraftAsset[]) => void
  onInsertMarkdown: (markdown: string) => void
  onMarkdownPathReplace?: (oldPath: string, newPath: string) => void
  onSourceAssetRename?: (asset: PostAsset, filename: string) => void
  onSourceAssetDelete?: (asset: PostAsset) => void
  uploadDisabled?: boolean
}

const formatSize = (size?: number) => {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function MarkdownAssetPanel({
  relativeId,
  draftId,
  assets,
  sourceAssets = [],
  onAssetsChange,
  onInsertMarkdown,
  onMarkdownPathReplace,
  onSourceAssetRename,
  onSourceAssetDelete,
  uploadDisabled,
}: MarkdownAssetPanelProps) {
  const styles = useStyles()
  const pageStyles = usePageStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()
  const [message, setMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [sourceRenameAsset, setSourceRenameAsset] = useState<ImageWarehouseSourceAsset | null>(null)

  const warehouseAssets: Array<ImageWarehouseSourceAsset | (DraftAsset & { kind: 'temp' })> = [
    ...sourceAssets.map((asset) => ({ ...asset, kind: 'source' as const })),
    ...assets.map((asset) => ({ ...asset, kind: 'temp' as const })),
  ]

  const refresh = async (targetDraftId = draftId) => {
    if (!targetDraftId) return
    const response = await getJson<DraftAssetListResponse>(`/assets?draftId=${encodeURIComponent(targetDraftId)}&relativeId=${encodeURIComponent(relativeId)}`)
    onAssetsChange(response.manifest.assets)
  }

  const readFileAsArrayBuffer = (file: File) =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
      reader.onload = () => (reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('Failed to read file')))
      reader.readAsArrayBuffer(file)
    })

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }

  const upload = async (file: File) => {
    try {
      setMessage({ kind: 'info', text: t('assets.uploading') })
      const buffer = await readFileAsArrayBuffer(file)
      const response = await getJson<DraftAssetUploadResponse>('/assets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          relativeId,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          contentBase64: arrayBufferToBase64(buffer),
        }),
      })
      onAssetsChange(response.manifest.assets)
      await refresh(response.asset.draftId)
      setMessage({ kind: 'success', text: t('assets.uploadSuccess') })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  const removeTemp = (asset: DraftAsset) => {
    setBusyKey(asset.key)
    void sendJson<{ deleted: boolean }>(`/assets?key=${encodeURIComponent(asset.key)}`, 'DELETE')
      .then(() => {
        onAssetsChange(assets.filter((item) => item.key !== asset.key))
        setMessage({ kind: 'success', text: t('assets.deleted') })
      })
      .catch((error: unknown) => setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unknown error' }))
      .finally(() => setBusyKey(null))
  }

  const renameTemp = (asset: DraftAsset, filename: string) => {
    setBusyKey(asset.key)
    void sendJson<RenameDraftAssetResponse>('/assets/rename', 'POST', { key: asset.key, filename })
      .then((response) => {
        onAssetsChange(response.manifest.assets)
        onMarkdownPathReplace?.(asset.markdownPath, response.asset.markdownPath)
        setMessage({ kind: 'success', text: t('assets.renameSuccess') })
      })
      .catch((error: unknown) => setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unknown error' }))
      .finally(() => setBusyKey(null))
  }

  const previewUrl = (asset: ImageWarehouseSourceAsset | (DraftAsset & { kind: 'temp' })) => {
    if (asset.kind === 'source') {
      return asset.publicUrl || buildApiUrl(`/posts/asset/blob?repoPath=${encodeURIComponent(asset.repoPath)}`)
    }
    return buildApiUrl(`/assets/blob?key=${encodeURIComponent(asset.key)}`)
  }

  const copyPath = (path: string) => {
    void navigator.clipboard?.writeText(path)
    setMessage({ kind: 'success', text: t('assets.pathCopied') })
  }

  const openPreview = (asset: ImageWarehouseSourceAsset | (DraftAsset & { kind: 'temp' })) => {
    window.open(previewUrl(asset), '_blank', 'noopener,noreferrer')
  }

  return (
    <section className={pageStyles.card}>
      <div className={pageStyles.row}>
        <Title3>{t('assets.warehouse')}</Title3>
        <Button appearance="secondary" icon={<ImageAddRegular />} onClick={() => inputRef.current?.click()} disabled={!relativeId || uploadDisabled}>
          {t('assets.upload')}
        </Button>
        <Button appearance="secondary" onClick={() => void refresh()} disabled={!draftId}>
          {t('actions.refresh')}
        </Button>
      </div>
      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const input = event.currentTarget
          const file = input.files?.[0]
          if (!file) return
          void upload(file).finally(() => {
            if (inputRef.current) inputRef.current.value = ''
          })
        }}
      />
      {message ? (
        <div className={`${styles.message} ${message.kind === 'success' ? styles.successMessage : message.kind === 'error' ? styles.errorMessage : ''}`}>
          <Text>{message.text}</Text>
        </div>
      ) : null}
      <ul className={styles.assetList}>
        {warehouseAssets.map((asset) => (
          <li className={styles.assetItem} key={asset.kind === 'source' ? asset.repoPath : asset.key}>
            <img className={styles.preview} src={previewUrl(asset)} alt={asset.filename} loading="lazy" />
            <span className={styles.meta}>
              <span>
                <Badge appearance="tint" color={asset.kind === 'source' ? 'brand' : 'success'}>{asset.kind === 'source' ? t('assets.source') : t('assets.temp')}</Badge>
              </span>
              <Text weight="semibold" truncate>{asset.filename}</Text>
              <Text size={200} truncate>{asset.markdownPath}</Text>
              <Text size={200}>{formatSize(asset.size)}</Text>
            </span>
            <span className={styles.actions}>
              <Button appearance="subtle" icon={<CopyRegular />} onClick={() => copyPath(asset.markdownPath)}>{t('actions.copy')}</Button>
              <Button appearance="subtle" icon={<ImageAddRegular />} onClick={() => onInsertMarkdown(`![${asset.filename}](${asset.markdownPath})`)}>{t('actions.insert')}</Button>
              <Button appearance="subtle" icon={<OpenRegular />} onClick={() => openPreview(asset)}>{t('assets.preview')}</Button>
              {asset.kind === 'source' ? (
                <Button appearance="subtle" icon={<RenameRegular />} onClick={() => setSourceRenameAsset(asset)}>{t('actions.rename')}</Button>
              ) : (
                <RenameAssetPopover
                  initialFilename={asset.filename}
                  busy={busyKey === asset.key}
                  source={asset.kind}
                  onConfirm={(filename) => renameTemp(asset, filename)}
                />
              )}
              {asset.kind === 'temp' ? (
                <DeleteAssetPopover busy={busyKey === asset.key} onConfirm={() => removeTemp(asset)} />
              ) : (
                <DeleteAssetPopover busy={false} onConfirm={() => onSourceAssetDelete?.(asset)} />
              )}
            </span>
          </li>
        ))}
      </ul>
      {sourceRenameAsset ? (
        <SourceAssetRenameDialog
          asset={sourceRenameAsset}
          onClose={() => setSourceRenameAsset(null)}
          onConfirm={(filename) => {
            onSourceAssetRename?.(sourceRenameAsset, filename)
            setSourceRenameAsset(null)
          }}
        />
      ) : null}
    </section>
  )
}

function SourceAssetRenameDialog({
  asset,
  onClose,
  onConfirm,
}: {
  asset: ImageWarehouseSourceAsset
  onClose: () => void
  onConfirm: (filename: string) => void
}) {
  const styles = useStyles()
  const { t } = useTranslation()
  const [filename, setFilename] = useState(asset.filename)
  return (
    <Dialog open onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t('assets.renameSourceAsset')}</DialogTitle>
          <DialogContent>
            <Text>{t('assets.renameSourceDescription')}</Text>
            <Input value={filename} onChange={(_, data) => setFilename(data.value)} style={{margin: '10px 0px 0px 0px'}} />
            <Popover>
              <PopoverTrigger disableButtonEnhancement>
                <Button appearance="primary" disabled={!filename.trim() || filename === asset.filename} style={{margin: '10px 0px 0px 10px'}}>{t('assets.renameSourceAsset')}</Button>
              </PopoverTrigger>
              <PopoverSurface className={styles.popoverSurface}>
                <Text weight="semibold">{t('assets.confirmRenameTitle')}</Text>
                <Text>{t('assets.confirmRenameDescription')}</Text>
                <div className={styles.confirmActions}>
                  <Button onClick={onClose}>{t('actions.cancel')}</Button>
                  <Button appearance="primary" onClick={() => onConfirm(filename)}>{t('actions.confirm')}</Button>
                </div>
              </PopoverSurface>
            </Popover>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

function RenameAssetPopover({
  initialFilename,
  source,
  busy,
  onConfirm,
}: {
  initialFilename: string
  source: 'source' | 'temp'
  busy?: boolean
  onConfirm: (filename: string) => void
}) {
  const styles = useStyles()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [filename, setFilename] = useState(initialFilename)
  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="subtle" icon={<RenameRegular />} disabled={busy}>{t('actions.rename')}</Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.popoverSurface}>
        <Text weight="semibold">{source === 'source' ? t('assets.renameSourceAsset') : t('assets.renameTempAsset')}</Text>
        {source === 'source' ? <Text>{t('assets.renameSourceWarning')}</Text> : null}
        <Input value={filename} onChange={(_, data) => setFilename(data.value)} />
        <div className={styles.confirmActions}>
          <Button onClick={() => setOpen(false)}>{t('actions.cancel')}</Button>
          <Button appearance="primary" onClick={() => { setOpen(false); onConfirm(filename) }} disabled={!filename.trim() || busy}>
            {t('actions.confirm')}
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  )
}

function DeleteAssetPopover({ busy, onConfirm }: { busy?: boolean; onConfirm: () => void }) {
  const styles = useStyles()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="primary" className={styles.dangerPrimaryButton} icon={<DeleteRegular />} disabled={busy}>
          {t('actions.delete')}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.popoverSurface}>
        <Text weight="semibold">{t('assets.confirmDeleteTitle')}</Text>
        <Text>{t('assets.confirmDeleteDescription')}</Text>
        <div className={styles.confirmActions}>
          <Button appearance="secondary" onClick={() => setOpen(false)}>{t('actions.close')}</Button>
          <Button appearance="primary" className={styles.dangerPrimaryButton} icon={<DeleteRegular />} onClick={() => { setOpen(false); onConfirm() }}>
            {t('actions.delete')}
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  )
}
