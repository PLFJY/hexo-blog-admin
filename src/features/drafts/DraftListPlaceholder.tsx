import { Text, Title3 } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { usePageStyles } from '../../pages/pageStyles'

export function DraftListPlaceholder() {
  const styles = usePageStyles()
  const { t } = useTranslation()

  return (
    <section className={styles.card}>
      <Title3>{t('drafts.kvPlaceholder')}</Title3>
      <Text>{t('drafts.description')}</Text>
    </section>
  )
}
