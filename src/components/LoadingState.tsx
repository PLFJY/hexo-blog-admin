import { Spinner, makeStyles } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'

const useStyles = makeStyles({
  root: {
    display: 'grid',
    minHeight: '220px',
    placeItems: 'center',
  },
})

export function LoadingState() {
  const styles = useStyles()
  const { t } = useTranslation()

  return (
    <div className={styles.root}>
      <Spinner label={t('states.loading')} />
    </div>
  )
}
