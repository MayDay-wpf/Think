<script setup>
import SystemMenu from './components/system/SystemMenu.vue'
import HistoryList from './components/page/chat/HistoryList.vue'
import { provide, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const showHistoryList = ref(false)
const chatRef = ref(null)
const historyListRef = ref(null)
const currentChatId = ref(null)
provide('currentChatId', currentChatId)

const handleNewSession = async () => {
  // 确保当前路由是 chat
  if (route.path !== '/chat') {
    await router.push('/chat')
  }
  // 等待下一个 tick，确保组件已经挂载
  currentChatId.value = null
  await nextTick()
  if (chatRef.value) {
    chatRef.value.clearChat()
  }
};

// 处理历史记录选择
const handleChatSelect = async (chat) => {
  if (route.path !== '/chat') {
    await router.push('/chat')
  }
  currentChatId.value = chat.chatId
  await nextTick()
  if (chatRef.value) {
    chatRef.value.loadChatHistory(chat)
  }
};

// 监听路由变化，判断是否显示 HistoryList
watch(
  () => route.path,
  async(newPath) => {
    showHistoryList.value = newPath === '/chat'
    if (newPath === '/chat') {
      await nextTick()
      if (chatRef.value) {
        chatRef.value.clearChat()
      }
    }
  },
  { immediate: true }
);

const handleChatCompleted = () => {
  if (historyListRef.value) {
    historyListRef.value.refresh()
  }
}
</script>

<template>
  <el-config-provider :theme="isDark ? darkTheme : null">
    <el-container>
      <el-aside style="display: flex">
        <SystemMenu />
        <HistoryList v-if="showHistoryList" ref="historyListRef" @new-session="handleNewSession"
          @select-chat="handleChatSelect" />
      </el-aside>
      <el-container>
        <el-main>
          <router-view v-slot="{ Component }">
            <component :is="Component" ref="chatRef" @chat-completed="handleChatCompleted" />
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </el-config-provider>
</template>
<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
}

.el-aside {
  width: auto !important;
}

.el-main {
  padding: 0 !important;
  overflow: hidden;
  /* Prevent el-main from creating scrollbars */
}
</style>
