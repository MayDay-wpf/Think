import { createI18n } from 'vue-i18n'
import en from './lang/en'
import zh from './lang/zh'

const i18n = createI18n({
  locale: localStorage.getItem('language') || 'en', // 默认语言
  fallbackLocale: 'zh', // 备用语言
  messages: {
    en,
    zh
  }
})

export default i18n
