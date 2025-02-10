<template>
  <div class="update-page">
    <div class="update-container">
      <div class="update-header">
        <h2>{{ t('update.title') }}</h2>
        <span class="current-version">v{{ currentVersion }}</span>
      </div>

      <div class="update-content">
        <!-- 检查更新状态 -->
        <div v-if="status === 'checking'" class="status-box checking">
          <el-icon class="rotating">
            <Loading />
          </el-icon>
          <span>{{ t('update.checking') }}</span>
          <div class="check-progress">
            <el-progress :percentage="checkProgress" :format="() => t('update.checkingProgress')" :stroke-width="4"
              :show-text="false" class="progress-bar" />
          </div>
        </div>

        <!-- 最新版本状态 -->
        <div v-if="status === 'not-available'" class="status-box up-to-date">
          <el-icon>
            <CircleCheck />
          </el-icon>
          <span>{{ t('update.notAvailable') }}</span>
          <el-button @click="checkForUpdates">{{ t('systemmenu.refresh') }}</el-button>
          <span class="last-check-time">{{ t('update.lastCheck') }}: {{ lastCheckTime }}</span>
        </div>
        <!-- 发现新版本状态 -->
        <div v-if="status === 'available'" class="status-box available">
          <el-icon>
            <Bell />
          </el-icon>
          <div class="version-info">
            <span>{{ t('update.newVersion') }}: v{{ updateInfo?.version }}</span>
            <div class="release-notes" v-if="updateInfo?.releaseNotes">
              <el-collapse>
                <el-collapse-item :title="t('update.releaseNotes')">
                  <div v-html="updateInfo.releaseNotes"></div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
          <el-button type="primary" @click="startDownload">
            {{ t('system.update') }}
          </el-button>
        </div>

        <!-- 下载进度状态 -->
        <div v-if="status === 'progress'" class="status-box downloading">
          <div class="progress-info">
            <span>{{ t('update.downloading') }}</span>
            <span class="progress-text">
              {{ downloadProgress }}%
              ({{ formatSpeed(downloadSpeed) }})
            </span>
          </div>
          <el-progress :percentage="downloadProgress" :format="progressFormat" />
          <span class="eta-text" v-if="estimatedTime">
            {{ t('update.estimatedTime') }}: {{ estimatedTime }}
          </span>
        </div>

        <!-- 下载完成状态 -->
        <div v-if="status === 'downloaded'" class="status-box downloaded">
          <el-icon>
            <Success />
          </el-icon>
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
          <el-icon>
            <Warning />
          </el-icon>
          <div class="error-info">
            <span>{{ t('update.error') }}</span>
            <p class="error-message">{{ errorMessage }}</p>
          </div>
          <div class="action-buttons">
            <el-button type="primary" @click="checkForUpdates">
              {{ t('systemmenu.refresh') }}
            </el-button>
            <el-button @click="openGithubReleases">
              {{ t('update.manual') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'

const { t } = useI18n()
const status = ref('')
const downloadProgress = ref(0)
const downloadSpeed = ref(0)
const estimatedTime = ref('')
const errorMessage = ref('')
const currentVersion = ref('')
const updateInfo = ref(null)
const lastCheckTime = ref('')
const checkProgress = ref(0)
let progressInterval = null

// 更新状态处理函数
const handleUpdateStatus = (_event, payload) => {
  if (!payload || typeof payload !== 'object') {
    return
  }

  // 更新组件状态
  status.value = payload.status

  switch (payload.status) {
    case 'progress':
      downloadProgress.value = Math.round(payload.data?.percent || 0)
      downloadSpeed.value = payload.data?.bytesPerSecond || 0
      if (payload.data?.total && payload.data?.transferred) {
        calculateETA(payload.data)
      }
      break
    case 'available':
      updateInfo.value = payload.data
      break
    case 'not-available':
      updateInfo.value = null
      break
    case 'error':
      errorMessage.value = payload.data?.message || t('update.unknownError')
      break
    case 'downloaded':
      updateInfo.value = payload.data
      break
  }
}

onMounted(async () => {
  try {
    // 获取当前版本
    currentVersion.value = await window.electron.ipcRenderer.invoke('get-app-version')

    // 获取上次检查时间
    lastCheckTime.value = localStorage.getItem('lastUpdateCheck') || ''

    // 注册更新状态监听
    window.electron.ipcRenderer.on('update-status', handleUpdateStatus)

    // 开始检查更新
    await checkForUpdates()
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error.message || t('update.unknownError')
  }
})

onUnmounted(() => {
  // 清理事件监听
  stopFakeProgress()
  window.electron.ipcRenderer.removeListener('update-status', handleUpdateStatus)
})

const startFakeProgress = () => {
  checkProgress.value = 0
  progressInterval = setInterval(() => {
    if (checkProgress.value < 90) {
      checkProgress.value += Math.random() * 10
    }
  }, 300)
}

const stopFakeProgress = () => {
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
  checkProgress.value = 100
}

const checkForUpdates = async () => {
  try {
    status.value = 'checking'
    errorMessage.value = ''
    updateInfo.value = null
    startFakeProgress()
    
    await window.electron.ipcRenderer.invoke('check-for-updates')
    stopFakeProgress()
    
    lastCheckTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
    localStorage.setItem('lastUpdateCheck', lastCheckTime.value)
  } catch (error) {
    stopFakeProgress()
    console.error('检查更新失败:', error)
    status.value = 'error'
    errorMessage.value = error.message || t('update.unknownError')
  }
}


const startDownload = async () => {
  try {
    // 重置所有状态
    downloadProgress.value = 0
    downloadSpeed.value = 0
    estimatedTime.value = ''
    errorMessage.value = ''
    status.value = 'progress'
    const result = await window.electron.ipcRenderer.invoke('start-download')

    if (!result) {
      throw new Error(t('update.downloadFailed'))
    }
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error.message || t('update.unknownError')
  }
}

const installUpdate = async () => {
  try {
    // 显示确认对话框
    const { response } = await window.electron.ipcRenderer.invoke('show-message-box', {
      type: 'info',
      title: t('update.confirmTitle'),
      message: t('update.confirmRestart'),
      buttons: [t('update.yes'), t('update.no')],
      defaultId: 0,
      cancelId: 1
    })

    if (response === 0) {
      // 先关闭所有窗口
      await window.electron.ipcRenderer.invoke('close-all-windows')
      // 然后执行更新安装
      await window.electron.ipcRenderer.invoke('quit-and-install')
    }
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error.message || t('update.unknownError')
  }
}

const postponeUpdate = () => {
  status.value = 'available'
}

const calculateETA = (data) => {
  if (data.bytesPerSecond > 0) {
    const remainingBytes = data.total - data.transferred
    const remainingSeconds = remainingBytes / data.bytesPerSecond
    estimatedTime.value = formatTime(remainingSeconds)
  }
}

const formatSpeed = (bytesPerSecond) => {
  const units = ['B/s', 'KB/s', 'MB/s']
  let speed = bytesPerSecond
  let unitIndex = 0

  while (speed > 1024 && unitIndex < units.length - 1) {
    speed /= 1024
    unitIndex++
  }

  return `${speed.toFixed(1)} ${units[unitIndex]}`
}

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const progressFormat = (percentage) => {
  return `${percentage}%`
}

const openGithubReleases = () => {
  window.electron.ipcRenderer.invoke('open-external-link',
    'https://github.com/MayDay-wpf/Think/releases')
}
</script>

<style scoped>
.update-page {
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
  position: relative;
}

.current-version {
  font-size: 0.9em;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
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

.version-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.release-notes {
  text-align: left;
  max-height: 200px;
  overflow-y: auto;
  width: 100%;
}

.error-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.error-message {
  color: var(--el-color-danger);
  font-size: 0.9em;
}

.last-check-time {
  font-size: 0.8em;
  color: var(--el-text-color-secondary);
}

.eta-text {
  font-size: 0.9em;
  color: var(--el-text-color-secondary);
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.release-notes-content {
  padding: 16px 20px;
}

.check-progress {
  width: 200px;
  margin-top: 8px;
}

.progress-bar :deep(.el-progress-bar__inner) {
  transition: all 0.3s ease;
}

.progress-bar :deep(.el-progress-bar__outer) {
  background-color: var(--el-fill-color-dark);
}
</style>