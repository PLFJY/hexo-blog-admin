import { Button } from '@fluentui/react-components'
import { ArrowLeftRegular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

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
