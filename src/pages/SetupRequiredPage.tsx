import { Button, Body1, Title1, Title3 } from '@fluentui/react-components'
import { ArrowClockwiseRegular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../components/StatusBadge'
import type { SetupStatus } from '../shared/apiTypes'
import { usePageStyles } from './pageStyles'

type SetupRequiredPageProps = {
  setup: SetupStatus
  onRefresh: () => void
}

export function SetupRequiredPage({ setup, onRefresh }: SetupRequiredPageProps) {
  const styles = usePageStyles()
  const { t } = useTranslation()

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <Title1>{t('setup.title')}</Title1>
        <Body1>{t('setup.description')}</Body1>
        <StatusBadge status={setup.configured ? 'success' : 'danger'}>
          {setup.configured ? t('setup.configured') : t('setup.incomplete')}
        </StatusBadge>
      </header>
      <section className={styles.card}>
        <Title3>{t('setup.missing')}</Title3>
        <ul>
          {setup.missing.map((item) => (
            <li key={item}>
              <code>{item}</code>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.card}>
        <Title3>{t('setup.config')}</Title3>
        <pre className={styles.codeBlock}>
          <code>{JSON.stringify(setup.config, null, 2)}</code>
        </pre>
      </section>
      <section className={styles.card}>
        <Title3>{t('setup.howToFix')}</Title3>
        <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={onRefresh}>
          {t('actions.refresh')}
        </Button>
      </section>
    </section>
  )
}
