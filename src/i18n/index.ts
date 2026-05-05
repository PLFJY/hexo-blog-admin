import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { safeGetLocalStorage } from '../lib/storage'
import { resources } from './resources'

const storedLanguage = () => {
  const language = safeGetLocalStorage('language')
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
