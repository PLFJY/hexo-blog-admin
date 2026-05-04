import { Body1, Title1 } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { DeployStatusPlaceholder } from '../features/deploy/DeployStatusPlaceholder'
import { usePageStyles } from './pageStyles'

export function DeployPage() {
  const styles = usePageStyles()
  const { t } = useTranslation()

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('deploy.title')}</Title1>
        <Body1>{t('deploy.description')}</Body1>
      </header>
      <DeployStatusPlaceholder />
    </section>
  )
}
