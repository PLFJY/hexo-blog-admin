import { Body1, Title1 } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { usePageStyles } from './pageStyles'

export function DashboardPage() {
  const styles = usePageStyles()
  const { t } = useTranslation()

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('dashboard.title')}</Title1>
        <Body1>{t('dashboard.description')}</Body1>
      </header>
    </section>
  )
}
