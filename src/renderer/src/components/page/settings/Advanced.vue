<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

const { t } = useI18n()
let watchStop = null
const isReady = ref(false)
const settings = ref({
  Temperature: 0,
  TopP: 1,
  MaxTokens: 2000,
  PresencePenalty: 0,
  FrequencyPenalty: 0,
  IsEnable: 0
})

const loadSettings = async () => {
  try {
    const data = await window.electron.ipcRenderer.invoke('get-advance-settings')
    settings.value = data
    await nextTick()
    if (watchStop) watchStop()
    watchStop = watch(settings, (newVal) => {
      autoSave(newVal)
    }, { deep: true })
    isReady.value = true
  } catch (error) {
    ElMessage.error('Error:' + error)
  }
}

const debounce = (fn, delay) => {
  let timer = null
  return (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

const autoSave = debounce(async (newSettings) => {
  try {
    const settingsToSave = {
      Temperature: Number(newSettings.Temperature),
      TopP: Number(newSettings.TopP),
      MaxTokens: Number(newSettings.MaxTokens),
      PresencePenalty: Number(newSettings.PresencePenalty),
      FrequencyPenalty: Number(newSettings.FrequencyPenalty),
      IsEnable: Number(newSettings.IsEnable)
    }
    await window.electron.ipcRenderer.invoke('update-advance-settings', settingsToSave)
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
  <div class="advanced-settings" v-if="isReady">
    <h2>{{ t('advanced.title') }}</h2>
    <div class="settings-form">
      <el-form :model="settings" label-width="140px">
        <el-form-item :label="t('advanced.enable')">
          <el-switch v-model="settings.IsEnable" :active-value="1" :inactive-value="0" />
          <div class="hint">{{ t('advanced.enableHint') }}</div>
        </el-form-item>
        <el-form-item label="Temperature">
          <el-slider v-model="settings.Temperature" :min="0" :max="2" :step="0.1" show-input />
          <div class="hint">{{ t('advanced.temperatureHint') }}</div>
        </el-form-item>

        <el-form-item label="Top P">
          <el-slider v-model="settings.TopP" :min="0" :max="1" :step="0.1" show-input />
          <div class="hint">{{ t('advanced.topPHint') }}</div>
        </el-form-item>

        <el-form-item label="Max Tokens">
          <el-input-number v-model="settings.MaxTokens" :min="1" :max="32000" :step="100" />
          <div class="hint">{{ t('advanced.maxTokensHint') }}</div>
        </el-form-item>

        <el-form-item label="Presence Penalty">
          <el-slider v-model="settings.PresencePenalty" :min="-2" :max="2" :step="0.1" show-input />
          <div class="hint">{{ t('advanced.presencePenaltyHint') }}</div>
        </el-form-item>

        <el-form-item label="Frequency Penalty">
          <el-slider v-model="settings.FrequencyPenalty" :min="-2" :max="2" :step="0.1" show-input />
          <div class="hint">{{ t('advanced.frequencyPenaltyHint') }}</div>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.advanced-settings {
  padding: 20px;
}

.settings-form {
  max-width: 600px;
  margin-top: 20px;
}

.hint {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
  width: 100%;
}

:deep(.el-slider) {
  width: 100%;
}

.loading-placeholder {
  max-width: 600px;
  margin-top: 20px;
}
</style>
