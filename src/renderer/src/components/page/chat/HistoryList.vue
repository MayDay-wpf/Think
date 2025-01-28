<template>
  <div class="sidebar">
    <div class="sticky-top">
      <el-button type="primary" class="new-session-button" @click="createNewSession">
        <i class="ri-add-line"></i> {{t('historylist.newchat')}}
      </el-button>
      <el-input :placeholder="t('historylist.searchHistory')" v-model="searchQuery" class="search-input" @keyup.enter="handleSearch"
        @compositionstart="isComposing = true" @compositionend="isComposing = false">
        <template #prefix>
          <i class="ri-search-line"></i>
        </template>
      </el-input>
    </div>
    <el-scrollbar ref="scrollbarRef" @scroll="handleScroll" class="scrollbar-wrapper">
      <el-menu class="history-list" :default-active="activeIndex" @select="handleSelect" :collapse="isCollapse">
        <el-menu-item v-for="item in filteredHistory" :key="item.chatId" :index="item.chatId">
          <template #title>
            <span class="history-item-title">{{ item.title || item.userContent }}</span>
            <div class="history-item-actions" @click.stop>
              <span class="history-item-time">{{ formatTime(item.createdAt) }}</span>
              <el-popconfirm :confirm-button-text="t('system.yes')"  :cancel-button-text="t('system.no')" :title="t('historylist.delete')"
                @confirm="confirmDelete(item.chatId)">
                <template #reference>
                  <i class="ri-delete-bin-line delete-button"></i>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-menu-item>
        <div v-if="loading" class="loading-more">
          <el-icon class="is-loading">
            <Loading />
          </el-icon>
          加载中...
        </div>
      </el-menu>
    </el-scrollbar>
    <el-button type="text" @click="toggleCollapse" class="collapse-button">
      <i :class="isCollapse ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'"></i>
    </el-button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElIcon, ElScrollbar } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn'; 

const { t, locale } = useI18n();
dayjs.extend(relativeTime);
const mapLocale = (loc) => {
  const localeMap = {
    'zh': 'zh-cn',
    'en': 'en'
  };
  return localeMap[loc] || 'en';
};

// 设置初始语言
dayjs.locale(mapLocale(locale.value));

// 监听语言变化
watch(locale, (newLocale) => {
  dayjs.locale(mapLocale(newLocale));
}, { immediate: true });

const emit = defineEmits(['new-session', 'select-chat']);
const activeIndex = ref('');
const searchQuery = ref('');
const isCollapse = ref(false);
const isComposing = ref(false);
const historyData = ref([]);
const loading = ref(false);
const currentPage = ref(1);
const currentChatId = inject('currentChatId');
const hasMore = ref(true);
const pageSize = 20;

// 格式化时间
const formatTime = (time) => {
  const date = dayjs(time);
  if (dayjs().diff(date, 'day') <= 7) {
    return date.fromNow();
  }
  return date.format('YYYY-MM-DD HH:mm');
};

// 加载历史记录
const loadHistory = async (page = 1, searchKey = '') => {
  if (!hasMore.value || loading.value) return;

  loading.value = true;
  try {
    const result = await window.electron.ipcRenderer.invoke('get-chat-history', {
      page,
      pageSize,
      searchKey
    });

    if (page === 1) {
      historyData.value = result.data;
    } else {
      historyData.value = [...historyData.value, ...result.data];
    }

    hasMore.value = historyData.value.length < result.total;
    currentPage.value = page;
  } catch (error) {
    console.error('加载历史记录失败:', error);
  } finally {
    loading.value = false;
  }
};
// 处理搜索
const handleSearch = () => {
  if (isComposing.value) return;
  currentPage.value = 1;
  hasMore.value = true;
  loadHistory(1, searchQuery.value);
};
// 监听搜索输入框的回车事件
const handleKeyPress = (e) => {
  if (e.key === 'Enter') {
    handleSearch();
  }
};

// 添加刷新方法
const refresh = async () => {
  currentPage.value = 1;
  hasMore.value = true;
  await loadHistory(1, searchQuery.value);
};

// 暴露刷新方法
defineExpose({
  refresh
});
// 处理滚动加载
const handleScroll = (e) => {
  const { scrollTop, clientHeight, scrollHeight } = e.target;
  if (scrollHeight - scrollTop - clientHeight < 50 && hasMore.value) {
    loadHistory(currentPage.value + 1, searchQuery.value);
  }
};

// 新建会话
const createNewSession = () => {
  emit('new-session');
};

const filteredHistory = computed(() => {
  return historyData.value;
});

const handleSelect = (chatId) => {
  activeIndex.value = chatId;
  const selectedChat = historyData.value.find(item => item.chatId === chatId);
  emit('select-chat', selectedChat);
};

const confirmDelete = async (chatId) => {
  try {
    console.log('删除会话:', chatId);
    await window.electron.ipcRenderer.invoke('delete-chat', chatId);
    historyData.value = historyData.value.filter((item) => item.chatId !== chatId);
    if (chatId === currentChatId.value)
      createNewSession();
  } catch (error) {
    console.error('删除失败:', error);
  }
};

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value;
};

onMounted(() => {
  loadHistory();
});
</script>

<style scoped>
.sidebar {
  width: 220px;
  height: 100vh;
  overflow: auto;
  border-right: 1px solid var(--el-border-color-lighter);
  background-color: var(--el-bg-color);
}

.sticky-top {
  position: sticky;
  top: 0;
  background-color: var(--el-bg-color);
  z-index: 10;
  padding: 10px;
}

.new-session-button {
  width: 100%;
  margin-bottom: 12px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
}

.search-wrapper {
  position: relative;
}

.search-input {
  width: 100%;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 6px;
}

.search-input :deep(.el-input__inner) {
  height: 36px;
}

.history-list {
  width: 100%;
  border-right: none;
  position: relative;
  z-index: 1;
}

.el-menu-item {
  position: relative;
  z-index: 2;
}

.history-item-title {
  display: block;
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  flex: 1;
}

.history-item-actions {
  display: none;
  align-items: center;
  pointer-events: none;
}

.delete-button {
  cursor: pointer;
  color: #f56c6c;
  pointer-events: auto;
}

.history-list.el-menu--collapse .history-item-title {
  display: none;
}

.history-list.el-menu--collapse .history-item-actions .history-item-time {
  display: none;
}

.history-item-actions {
  display: none;
  float: right;
}

.history-item-time {
  font-size: 12px;
  color: #999;
  margin-right: 5px;
}

.el-menu-item:hover .history-item-actions {
  display: flex;
  align-items: center;
}

.delete-button {
  cursor: pointer;
  color: #f56c6c;
}

.delete-button:hover {
  color: #f83939;
}

.collapse-button {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  border: 1px solid #e6e6e6;
  transition: background-color 0.3s;
}

.collapse-button:hover {
  background-color: #e6e6e6;
}

.sidebar.el-menu--collapse {
  width: 64px;
}

.scrollbar-wrapper {
  height: calc(100vh - 110px);
}

.loading-more {
  text-align: center;
  padding: 10px 0;
  color: #999;
  font-size: 14px;
}

.loading-more .el-icon {
  margin-right: 5px;
}
</style>
