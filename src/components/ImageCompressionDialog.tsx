import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { formatBytes } from '../lib/formatBytes'

const useStyles = makeStyles({
  surface: {
    width: 'min(640px, calc(100vw - 32px))',
    maxWidth: 'calc(100vw - 32px)',
  },
  content: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
  },
  meta: {
    display: 'grid',
    gap: tokens.spacingVerticalXS,
  },
  actions: {
    display: 'flex',
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    '& button': {
      width: 'max-content',
      whiteSpace: 'nowrap',
    },
    '@media (max-width: 520px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
      '& button': {
        width: '100%',
      },
    },
  },
})

type ImageCompressionDialogProps = {
  open: boolean
  file: File | null
  busy?: boolean
  busyLabel?: string
  onCompress: () => void
  onUploadOriginal: () => void
  onCancel: () => void
}

export function ImageCompressionDialog({
  open,
  file,
  busy,
  busyLabel,
  onCompress,
  onUploadOriginal,
  onCancel,
}: ImageCompressionDialogProps) {
  const styles = useStyles()
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && !busy && onCancel()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>{t('assets.largeImageTitle')}</DialogTitle>
          <DialogContent className={styles.content}>
            {busy ? <Spinner label={busyLabel} /> : null}
            <Text>{t('assets.largeImageDescription')}</Text>
            <div className={styles.meta}>
              <Text>{t('assets.originalSize')}: {formatBytes(file?.size)}</Text>
              <Text>{t('assets.compressionMethod')}</Text>
              <Text>{t('assets.compressionClearTextNote')}</Text>
            </div>
          </DialogContent>
          <DialogActions className={styles.actions}>
            <Button onClick={onCancel} disabled={busy}>{t('assets.cancelUpload')}</Button>
            <Button onClick={onUploadOriginal} disabled={busy}>{t('assets.uploadOriginal')}</Button>
            <Button appearance="primary" onClick={onCompress} disabled={busy}>{t('assets.compressAndUpload')}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
