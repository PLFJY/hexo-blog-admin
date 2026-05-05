import { Button, Text, Title1, makeStyles, tokens } from '@fluentui/react-components'
import { HomeRegular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { usePageStyles } from './pageStyles'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXXXL,
    textAlign: 'center',
    gap: tokens.spacingVerticalL,
  },
  errorCode: {
    fontSize: '120px',
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorBrandForeground1,
    lineHeight: 1,
    margin: 0,
    opacity: 0.2,
  },
})

export function NotFoundPage() {
  const pageStyles = usePageStyles()
  const styles = useStyles()
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section className={pageStyles.page}>
      <div className={styles.container}>
        <h1 className={styles.errorCode}>404</h1>
        <Title1>{t('notFound.title')}</Title1>
        <Text size={500}>{t('notFound.description')}</Text>
        <Button
          appearance="primary"
          size="large"
          icon={<HomeRegular />}
          onClick={() => navigate('/')}
        >
          {t('notFound.backToHome')}
        </Button>
      </div>
    </section>
  )
}
