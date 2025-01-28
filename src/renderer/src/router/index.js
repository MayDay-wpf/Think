import { createRouter, createWebHashHistory } from 'vue-router'
import Chat from '../components/page/chat/Chat.vue'
import Settings from '../components/page/settings/Settings.vue'
import General from '../components/page/settings/GeneralSettings.vue'
import AiModel from '../components/page/settings/AiModel.vue'
import Advanced from '../components/page/settings/Advanced.vue'
import SearchEngine from '../components/page/settings/SearchEngine.vue'
const routes = [
  { path: '/', redirect: '/chat' },
  {
    path: '/chat',
    name: 'chat',
    component: Chat
  },
  {
    path: '/settings',
    name: 'settings',
    component: Settings,
    children: [
      {
        path: '',
        redirect: 'general'
      },
      {
        path: 'general',
        name: 'general',
        component: General
      },
      {
        path: 'model',
        name: 'model',
        component: AiModel
      },
      {
        path: 'advanced',
        name: 'advanced',
        component: Advanced
      },
      {
        path: 'searchengine',
        name: 'searchengine',
        component: SearchEngine
      }
    ]
  }
]
const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
