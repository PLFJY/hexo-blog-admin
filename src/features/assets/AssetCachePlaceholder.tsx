import { Text, Title3 } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { usePageStyles } from '../../pages/pageStyles'

export function AssetCachePlaceholder() {
  const styles = usePageStyles()
  const { t } = useTranslation()

  return (
    <section className={styles.card}>
      <Title3>{t('drafts.assetCacheTitle')}</Title3>
      <Text>{t('drafts.assetCacheDescription')}</Text>
    </section>
  )
}
