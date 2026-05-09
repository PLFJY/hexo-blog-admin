import { Button, Link, Text, makeStyles, mergeClasses, tokens } from '@fluentui/react-components'
import { ArrowLeftRegular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { StatusBadge } from '../components/StatusBadge'
import type { CustomizeSaveStatus } from '../shared/customizeTypes'

const useStyles = makeStyles({
  statusPanel: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderTop: `1px solid ${tokens.colorBrandStroke1}`,
    borderRight: `1px solid ${tokens.colorBrandStroke1}`,
    borderBottom: `1px solid ${tokens.colorBrandStroke1}`,
    borderLeft: `4px solid ${tokens.colorBrandForeground1}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground2,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  success: {
    borderTopColor: tokens.colorPaletteGreenBorder2,
    borderRightColor: tokens.colorPaletteGreenBorder2,
    borderBottomColor: tokens.colorPaletteGreenBorder2,
    borderLeftColor: tokens.colorPaletteGreenBorder2,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  error: {
    borderTopColor: tokens.colorPaletteRedBorder2,
    borderRightColor: tokens.colorPaletteRedBorder2,
    borderBottomColor: tokens.colorPaletteRedBorder2,
    borderLeftColor: tokens.colorPaletteRedBorder2,
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
  },
})

export function CustomizeSaveStatusPanel({ status }: { status: CustomizeSaveStatus }) {
  const styles = useStyles()
  const { t } = useTranslation()
  if (!status.message && !status.commitSha && !status.deploy && !status.indexSynced) return null
  const tone = status.deploy?.status === 'failed' ? styles.error : status.deploy?.status === 'success' || status.indexSynced ? styles.success : ''
  return (
    <section className={mergeClasses(styles.statusPanel, tone)}>
      <div className={styles.header}>
        <Text weight="semibold">{t('customize.saveDeployStatus')}</Text>
        {status.deploy ? (
          <StatusBadge status={status.deploy.status === 'success' ? 'success' : status.deploy.status === 'failed' ? 'danger' : 'informative'}>
            {status.deploy.status}
          </StatusBadge>
        ) : null}
      </div>
      {status.message ? <Text>{status.message}</Text> : null}
      <div className={styles.meta}>
        {status.commitSha ? <Text size={200}>{t('deploy.commit')}: {status.commitSha}</Text> : null}
        {status.indexSynced ? <Text size={200}>{t('customize.indexSynced')}</Text> : null}
        {status.deploy?.workflowRunUrl ? (
          <Link href={status.deploy.workflowRunUrl} target="_blank" rel="noreferrer">
            {t('deploy.run')}
          </Link>
        ) : null}
      </div>
    </section>
  )
}

export function BackToCustomizeButton({ adapterId }: { adapterId?: string }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const target = adapterId === 'common' ? '/hexo-settings' : '/theme-settings'
  return (
    <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate(target)}>
      {t('actions.back')}
    </Button>
  )
}
