import { Button, Popover, PopoverSurface, PopoverTrigger, Text, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { DeleteRegular, ImageAddRegular, OpenRegular } from '@fluentui/react-icons'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildApiUrl, getJson, sendJson } from '../lib/apiClient'
import type { DraftAsset, DraftAssetListResponse, DraftAssetUploadResponse } from '../shared/assetTypes'
import { usePageStyles } from '../pages/pageStyles'

const useStyles = makeStyles({
  hiddenInput: {
    display: 'none',
  },
  assetList: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },
  assetItem: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
  message: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  successMessage: {
    borderColor: tokens.colorPaletteGreenBorder2,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  errorMessage: {
    borderColor: tokens.colorPaletteRedBorder2,
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  dangerPrimaryButton: {
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorPaletteRedBackground3,
    ':hover': {
      color: tokens.colorNeutralForegroundOnBrand,
      backgroundColor: tokens.colorPaletteRedForeground1,
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

type MarkdownAssetPanelProps = {
  relativeId: string
  draftId?: string
  assets: DraftAsset[]
  onAssetsChange: (assets: DraftAsset[]) => void
  onInsertMarkdown: (markdown: string) => void
}

export function MarkdownAssetPanel({
  relativeId,
  draftId,
  assets,
  onAssetsChange,
  onInsertMarkdown,
}: MarkdownAssetPanelProps) {
  const styles = useStyles()
  const pageStyles = usePageStyles()
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()
  const [message, setMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null)

  const refresh = async (targetDraftId = draftId) => {
    if (!targetDraftId) return
    const response = await getJson<DraftAssetListResponse>(`/assets?draftId=${encodeURIComponent(targetDraftId)}&relativeId=${encodeURIComponent(relativeId)}`)
    onAssetsChange(response.manifest.assets)
  }

  const readFileAsArrayBuffer = (file: File) =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result)
          return
        }
        reject(new Error('Failed to read file'))
      }
      reader.readAsArrayBuffer(file)
    })

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    return btoa(binary)
  }

  const upload = async (file: File) => {
    const filename = file.name
    const type = file.type || 'application/octet-stream'
    try {
      setMessage({ kind: 'info', text: t('assets.uploading') })
      const buffer = await readFileAsArrayBuffer(file)
      const response = await getJson<DraftAssetUploadResponse>('/assets', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          relativeId,
          filename,
          contentType: type,
          contentBase64: arrayBufferToBase64(buffer),
        }),
      })
      onAssetsChange(response.manifest.assets)
      onInsertMarkdown(`![${response.asset.filename}](${response.asset.markdownPath})`)
      await refresh(response.asset.draftId)
      setMessage({ kind: 'success', text: t('assets.uploaded') })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  const remove = (asset: DraftAsset) => {
    void sendJson<{ deleted: boolean }>(`/assets?key=${encodeURIComponent(asset.key)}`, 'DELETE').then(() => {
      onAssetsChange(assets.filter((item) => item.key !== asset.key))
      setMessage({ kind: 'success', text: t('assets.deleted') })
    })
  }

  const preview = async (asset: DraftAsset) => {
    try {
      const response = await fetch(buildApiUrl(`/assets/blob?key=${encodeURIComponent(asset.key)}`), {
        credentials: 'include',
      })
      if (!response.ok) throw new Error(response.statusText || 'Request failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  return (
    <section className={pageStyles.card}>
      <div className={pageStyles.row}>
        <Title3>{t('assets.title')}</Title3>
        <Button
          appearance="secondary"
          icon={<ImageAddRegular />}
          onClick={() => inputRef.current?.click()}
          disabled={!relativeId}
        >
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
        <div
          className={`${styles.message} ${
            message.kind === 'success' ? styles.successMessage : message.kind === 'error' ? styles.errorMessage : ''
          }`}
        >
          <Text>{message.text}</Text>
        </div>
      ) : null}
      <ul className={styles.assetList}>
        {assets.map((asset) => (
          <li className={styles.assetItem} key={asset.key}>
            <Text truncate>{asset.markdownPath}</Text>
            <Button
              appearance="subtle"
              icon={<OpenRegular />}
              onClick={() => void preview(asset)}
            >
              {t('assets.preview')}
            </Button>
            <DeleteAssetPopover onConfirm={() => remove(asset)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

type DeleteAssetPopoverProps = {
  onConfirm: () => void
}

function DeleteAssetPopover({ onConfirm }: DeleteAssetPopoverProps) {
  const styles = useStyles()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)}>
      <PopoverTrigger disableButtonEnhancement>
        <Button appearance="primary" className={styles.dangerPrimaryButton} icon={<DeleteRegular />}>
          {t('actions.delete')}
        </Button>
      </PopoverTrigger>
      <PopoverSurface className={styles.confirmSurface}>
        <Text weight="semibold">{t('assets.confirmDeleteTitle')}</Text>
        <Text>{t('assets.confirmDeleteDescription')}</Text>
        <div className={styles.confirmActions}>
          <Button appearance="secondary" onClick={() => setOpen(false)}>
            {t('actions.close')}
          </Button>
          <Button
            appearance="primary"
            className={styles.dangerPrimaryButton}
            icon={<DeleteRegular />}
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            {t('actions.delete')}
          </Button>
        </div>
      </PopoverSurface>
    </Popover>
  )
}
