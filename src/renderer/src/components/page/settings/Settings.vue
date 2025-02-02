<script setup>
import SettingMenu from './SettingMenu.vue';
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
onMounted(() => {
  if (route.name === 'settings') {
    router.push({ name: 'general' });
  }
});
const settingItems = ref([
  { key: 'general', label: t('settingMenu.preferences'), icon: 'ri-user-settings-line' },
  { key: 'model', label: t('settingMenu.modelsetting'), icon: 'ri-apps-2-ai-line' },
  { key: 'advanced', label: t('settingMenu.advanced'), icon: 'ri-equalizer-line' },
  { key: 'searchengine', label: t('settingMenu.searchengine'), icon: 'ri-chat-search-line' }
]);
</script>


<template>
  <div class="settings-header"></div>
  <div class="settings-page">
    <SettingMenu :items="settingItems" />
    <div class="setting-content">
      <router-view></router-view>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  height:calc(100vh - 31px);
}
.setting-content {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: var(--el-bg-color);
}
.settings-header{
  height: 30px;
  background-color: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #333;
  font-size: 18px;
  font-weight: bold;
  line-height: 30px;
  -webkit-app-region: drag;
}
</style>
