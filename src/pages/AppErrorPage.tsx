import { Button, Text, Title2, makeStyles, tokens } from '@fluentui/react-components'
import { ArrowClockwiseRegular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, useRouteError } from 'react-router'

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: tokens.spacingHorizontalXXL,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
  panel: {
    width: 'min(520px, 100%)',
    display: 'grid',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalXXL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
    boxShadow: tokens.shadow16,
  },
})

function getErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return undefined
}

export function AppErrorPage() {
  const styles = useStyles()
  const error = useRouteError()
  const { t } = useTranslation()
  const message = getErrorMessage(error)

  return (
    <main className={styles.root}>
      <section className={styles.panel}>
        <Title2>{t('states.error')}</Title2>
        {message ? <Text>{message}</Text> : null}
        <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={() => window.location.reload()}>
          {t('actions.retry')}
        </Button>
      </section>
    </main>
  )
}
