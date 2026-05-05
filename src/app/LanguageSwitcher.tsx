import { Button, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger } from '@fluentui/react-components'
import { TranslateRegular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import { safeSetLocalStorage } from '../lib/storage'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const changeLanguage = (language: 'zh' | 'en') => {
    safeSetLocalStorage('language', language)
    void i18n.changeLanguage(language)
  }

  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="subtle" aria-label={t('actions.language')} icon={<TranslateRegular />} />
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItem onClick={() => changeLanguage('zh')}>{t('actions.chinese')}</MenuItem>
          <MenuItem onClick={() => changeLanguage('en')}>{t('actions.english')}</MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  )
}
