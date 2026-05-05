import { Button } from '@fluentui/react-components'
import { DarkThemeRegular, WeatherMoonRegular, WeatherSunnyRegular } from '@fluentui/react-icons'
import { useTranslation } from 'react-i18next'
import { useAppTheme } from './ThemeProvider'

export function ThemeSwitcher() {
  const { t } = useTranslation()
  const { mode, toggleTheme } = useAppTheme()
  const label =
    mode === 'system' ? t('actions.systemTheme') : mode === 'light' ? t('actions.lightTheme') : t('actions.darkTheme')
  const nextLabel =
    mode === 'system' ? t('actions.lightTheme') : mode === 'light' ? t('actions.darkTheme') : t('actions.systemTheme')
  const icon = mode === 'system' ? <DarkThemeRegular /> : mode === 'light' ? <WeatherSunnyRegular /> : <WeatherMoonRegular />

  return (
    <Button
      appearance="subtle"
      aria-label={`${label}: ${nextLabel}`}
      icon={icon}
      onClick={toggleTheme}
      title={nextLabel}
    />
  )
}
