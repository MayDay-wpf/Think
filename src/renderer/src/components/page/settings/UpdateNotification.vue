<template>
  <div class="update-page">
    <div class="update-container">
      <div class="update-header">
        <h2>{{ t('update.title') }}</h2>
      </div>
      
      <div class="update-content">
        <!-- 检查更新状态 -->
        <div v-if="status === 'checking'" class="status-box checking">
          <el-icon class="rotating"><Loading /></el-icon>
          <span>{{ t('update.checking') }}</span>
        </div>

        <!-- 最新版本状态 -->
        <div v-if="status === 'not-available'" class="status-box up-to-date">
          <el-icon><Select /></el-icon>
          <span>{{ t('update.notAvailable') }}</span>
        </div>

        <!-- 发现新版本状态 -->
        <div v-if="status === 'available'" class="status-box available">
          <el-icon><Bell /></el-icon>
          <span>{{ t('update.available') }}</span>
          <el-button type="primary" @click="startDownload">
            {{ t('system.update') }}
          </el-button>
        </div>

        <!-- 下载进度状态 -->
        <div v-if="status === 'progress'" class="status-box downloading">
          <div class="progress-info">
            <span>{{ t('update.downloading') }}</span>
            <span class="progress-text">{{ downloadProgress }}%</span>
          </div>
          <el-progress :percentage="downloadProgress" />
        </div>

        <!-- 下载完成状态 -->
        <div v-if="status === 'downloaded'" class="status-box downloaded">
          <el-icon><Success /></el-icon>
          <span>{{ t('update.downloaded') }}</span>
          <div class="action-buttons">
            <el-button type="primary" @click="installUpdate">
              {{ t('update.restart') }}
            </el-button>
            <el-button @click="postponeUpdate">
              {{ t('update.later') }}
            </el-button>
          </div>
        </div>

        <!-- 错误状态 -->
        <div v-if="status === 'error'" class="status-box error">
          <el-icon><Warning /></el-icon>
          <span>{{ t('update.error') }}</span>
          <el-button @click="checkForUpdates">
            {{ t('systemmenu.refresh') }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const status = ref('')
const downloadProgress = ref(0)

onMounted(() => {
  checkForUpdates()
  
  window.electron.ipcRenderer.on('update-status', (event) => {
    status.value = event.status
    if (event.status === 'progress') {
      downloadProgress.value = event.data.percent
    }
  })
})

const checkForUpdates = async () => {
  status.value = 'checking'
  await window.electron.ipcRenderer.invoke('check-for-updates')
}

const startDownload = async () => {
  status.value = 'progress'
  await window.electron.ipcRenderer.invoke('start-download')
}

const installUpdate = async () => {
  await window.electron.ipcRenderer.invoke('quit-and-install')
}

const postponeUpdate = () => {
  status.value = 'available'
}
</script>

<style scoped>
.update-page {
  height: 100vh-30px;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.update-container {
  width: 100%;
  max-width: 600px;
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 24px;
  box-shadow: var(--el-box-shadow-light);
}

.update-header {
  margin-bottom: 24px;
  text-align: center;
}

.update-content {
  min-height: 200px;
}

.status-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
  text-align: center;
}

.progress-info {
  width: 100%;
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.rotating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>