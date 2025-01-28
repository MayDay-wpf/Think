<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus'
const { t } = useI18n();

let watchStop = null
const isReady = ref(false)  // 添加数据准备状态
const settings = ref({
  IsStream: 0,
  IsAutoScroll: 0,
  ModelAutoChange: 0,
  HistoryLength: 5
})

const loadSettings = async () => {
  try {
    const result = await window.electron.ipcRenderer.invoke('get-user-settings')
    settings.value = result
    await nextTick()
    if (watchStop) watchStop()
    watchStop = watch(settings, (newVal) => {
      autoSave(newVal)
    }, { deep: true })
    isReady.value = true  // 数据加载完成后设置为 true
  } catch (error) {
    ElMessage.error('加载设置失败:', error)
  }
}

// 添加防抖函数
const debounce = (fn, delay) => {
  let timer = null
  return (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// 自动保存函数
const autoSave = debounce(async (newSettings) => {
  try {
    const settingsToSave = {
      IsStream: Number(newSettings.IsStream),
      IsAutoScroll: Number(newSettings.IsAutoScroll),
      ModelAutoChange: Number(newSettings.ModelAutoChange),
      HistoryLength: Number(newSettings.HistoryLength)
    }
    await window.electron.ipcRenderer.invoke('update-user-settings', settingsToSave)
    ElMessage.success(t('settingMenu.savesuccess'))
  } catch (error) {
    console.error('Save settings error:', error?.message || 'Unknown error')
    ElMessage.error(`Error: ${error?.message || 'unknown error'}`)
  }
}, 500)


onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="general-settings" v-if="isReady">
    <h2>{{ t('settingMenu.preferences') }}</h2>
    <div class="settings-form">
      <el-form :model="settings" label-width="140px">
        <el-form-item :label="t('preferences.stream')">
          <el-switch v-model="settings.IsStream" :active-value="1" :inactive-value="0" />
          <div class="hint">{{ t('preferences.streaminfo') }}</div>
        </el-form-item>

        <el-form-item :label="t('preferences.autoscroll')">
          <el-switch v-model="settings.IsAutoScroll" :active-value="1" :inactive-value="0" />
          <div class="hint">{{ t('preferences.autoscrollinfo') }}</div>
        </el-form-item>

        <el-form-item :label="t('preferences.automaticmodelswitching')">
          <el-switch v-model="settings.ModelAutoChange" :active-value="1" :inactive-value="0" />
          <div class="hint">{{ t('preferences.automaticmodelswitchinginfo') }}</div>
        </el-form-item>

        <el-form-item :label="t('preferences.historylength')">
          <el-input-number v-model="settings.HistoryLength" :min="1" :max="20" :step="1" />
          <div class="hint">{{ t('preferences.historylengthinfo') }}</div>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.general-settings {
  padding: 20px;
}

.settings-form {
  max-width: 600px;
  margin-top: 20px;
}

.hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  width: 100%;
}

.loading-placeholder {
  max-width: 600px;
  margin-top: 20px;
}
</style>
