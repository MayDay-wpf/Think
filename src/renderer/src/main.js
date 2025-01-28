import './assets/main.css'
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import App from './App.vue'
import 'element-plus/dist/index.css'
import 'remixicon/fonts/remixicon.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import i18n from './i18n'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import en from 'element-plus/dist/locale/en.mjs'
import router from './router'

const app = createApp(App)
const locale = localStorage.getItem('language') || 'zh'
app.use(ElementPlus, {
  locale: locale === 'zh' ? zhCn : en
})
app.use(i18n)
app.use(router)
app.mount('#app')
