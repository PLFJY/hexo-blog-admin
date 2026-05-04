import { Button, Text, Title3, makeStyles, tokens } from '@fluentui/react-components'
import { ArrowClockwiseRegular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXXL,
    border: `1px solid ${tokens.colorPaletteRedBorder2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
})

type ErrorStateProps = {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const styles = useStyles()
  const { t } = useTranslation()

  return (
    <section className={styles.root}>
      <Title3>{t('states.error')}</Title3>
      {message ? <Text>{message}</Text> : null}
      {onRetry ? (
        <Button appearance="secondary" icon={<ArrowClockwiseRegular />} onClick={onRetry}>
          {t('actions.retry')}
        </Button>
      ) : null}
    </section>
  )
}
