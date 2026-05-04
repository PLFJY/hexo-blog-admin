import { Text, Title3 } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { usePageStyles } from '../../pages/pageStyles'

export function DeployStatusPlaceholder() {
  const styles = usePageStyles()
  const { t } = useTranslation()

  return (
    <section className={styles.card}>
      <Title3>{t('deploy.statusPlaceholder')}</Title3>
      <Text>{t('deploy.description')}</Text>
    </section>
  )
}
