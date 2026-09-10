import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'

const useStyles = makeStyles({
  surface: {
    width: 'fit-content',
    maxWidth: 'calc(100vw - 32px)',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 'calc(100vw - 64px)',
    maxHeight: 'calc(100vh - 180px)',
    overflow: 'auto',
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  image: {
    display: 'block',
    maxWidth: 'calc(100vw - 80px)',
    maxHeight: 'calc(100vh - 196px)',
    objectFit: 'contain',
    borderRadius: tokens.borderRadiusMedium,
  },
})

type ImagePreviewDialogProps = {
  open: boolean
  src?: string
  fallbackSrc?: string
  alt?: string
  onClose: () => void
}

export function ImagePreviewDialog({ open, src, fallbackSrc, alt, onClose }: ImagePreviewDialogProps) {
  const styles = useStyles()
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle>{alt || t('assets.preview')}</DialogTitle>
          <DialogContent className={styles.content}>
            {src ? (
              <img
                className={styles.image}
                src={src}
                alt={alt ?? ''}
                onError={(event) => {
                  if (!fallbackSrc) return
                  const fallbackUrl = new URL(fallbackSrc, window.location.href).href
                  if (event.currentTarget.src !== fallbackUrl) event.currentTarget.src = fallbackUrl
                }}
              />
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={onClose}>{t('actions.close')}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
