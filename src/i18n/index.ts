import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'

const storedLanguage = () => {
  if (typeof window === 'undefined') return undefined
  const language = window.localStorage.getItem('language')
  return language === 'zh' || language === 'en' ? language : undefined
}

const browserLanguage = () => {
  if (typeof navigator === 'undefined') return 'zh'
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLanguage() ?? browserLanguage(),
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
})

export default i18n
