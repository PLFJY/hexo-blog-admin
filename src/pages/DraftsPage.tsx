import { Body1, Title1 } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { AssetCachePlaceholder } from '../features/assets/AssetCachePlaceholder'
import { DraftListPlaceholder } from '../features/drafts/DraftListPlaceholder'
import { usePageStyles } from './pageStyles'

export function DraftsPage() {
  const styles = usePageStyles()
  const { t } = useTranslation()

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('drafts.title')}</Title1>
        <Body1>{t('drafts.description')}</Body1>
      </header>
      <DraftListPlaceholder />
      <AssetCachePlaceholder />
    </section>
  )
}
