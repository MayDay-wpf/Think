<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowRight, Edit } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import draggable from 'vuedraggable'

const { t } = useI18n()
const searchEngineList = ref([])
const dialogVisible = ref(false)
const expandedEngines = ref(new Set())
const editingEngine = ref(null)
const configForm = ref({})

// 加载搜索引擎列表
const loadData = async () => {
  try {
    const engines = await window.electron.ipcRenderer.invoke('get-search-engines')
    // 处理图标路径
    for (const engine of engines) {
      if (engine.ImagePath.startsWith('data:') || engine.ImagePath.startsWith('blob:')) {
        continue
      }
      engine.ImagePath = await window.electron.ipcRenderer.invoke('get-asset-path', engine.ImagePath)
    }
    searchEngineList.value = engines
  } catch (error) {
    ElMessage.error('Error loading data')
  }
}

// 切换展开状态
const toggleExpand = (engineId) => {
  if (expandedEngines.value.has(engineId)) {
    expandedEngines.value.delete(engineId)
  } else {
    expandedEngines.value.add(engineId)
  }
}

// 获取配置对象的所有键值对
const getConfigEntries = (config) => {
  try {
    const entries = Object.entries(JSON.parse(config))
    return entries.map(([key, value]) => ({
      key,
      value: key.toLowerCase().includes('key') || key.toLowerCase().includes('token') 
        ? '******' 
        : value
    }))
  } catch {
    return []
  }
}

// 编辑配置
const editConfig = (engine) => {
  editingEngine.value = engine
  if (engine.Config) {
    try {
      const config = JSON.parse(engine.Config)
      configForm.value = { ...config }
    } catch (error) {
      configForm.value = {}
    }
  } else {
    configForm.value = {}
  }
  dialogVisible.value = true
}

// 更新配置
const updateConfig = async () => {
  try {
    const engineData = {
      id: editingEngine.value.Id,
      config: JSON.stringify(configForm.value)
    }
    
    await window.electron.ipcRenderer.invoke('update-search-engine-config', engineData)
    ElMessage.success(t('searchengine.updateconfigsuccess'))
    dialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.error(t('searchengine.updateconfigfailed'))
  }
}

// 搜索引擎拖拽排序
const onDragEnd = async () => {
  try {
    const updatedEngines = searchEngineList.value.map((engine, index) => ({
      Id: engine.Id,
      Seq: index + 1
    }))
    await window.electron.ipcRenderer.invoke('update-search-engines-order', updatedEngines)
    ElMessage.success(t('searchengine.updateordersuccess'))
  } catch (error) {
    ElMessage.error(t('searchengine.updateorderfailed'))
    loadData()
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="search-engine-container">
    <div class="header">
      <h2>{{ t('settingMenu.searchengine') }}</h2>
    </div>

    <draggable v-model="searchEngineList" item-key="Id" handle=".drag-handle" @end="onDragEnd">
      <template #item="{ element: engine }">
        <div class="engine-section">
          <div class="engine-header">
            <div class="engine-info">
              <el-icon class="drag-handle">
                <svg viewBox="0 0 24 24" width="1em" height="1em">
                  <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                </svg>
              </el-icon>
              <el-icon class="expand-icon" @click.stop="toggleExpand(engine.Id)">
                <component :is="expandedEngines.has(engine.Id) ? ArrowDown : ArrowRight" />
              </el-icon>
              <el-image :src="engine.ImagePath" class="engine-icon" @click.stop="toggleExpand(engine.Id)" />
              <h3 @click.stop="toggleExpand(engine.Id)">{{ engine.Name }}</h3>
            </div>
            <div class="engine-actions">
              <el-button type="primary" :icon="Edit" text @click.stop="editConfig(engine)">
                {{ t('searchengine.editconfig') }}
              </el-button>
            </div>
          </div>

          <el-collapse-transition>
            <div v-show="expandedEngines.has(engine.Id)" class="engine-details">
              <div v-if="engine.Config" class="config-info">
                <el-table :data="getConfigEntries(engine.Config)" :show-header="true">
                  <el-table-column prop="key" :label="t('searchengine.key')" width="180" />
                  <el-table-column prop="value" :label="t('searchengine.value')" />
                </el-table>
              </div>
              <div v-else class="no-config">
                {{ t('searchengine.noconfig') }}
              </div>
            </div>
          </el-collapse-transition>
        </div>
      </template>
    </draggable>

    <!-- 编辑配置对话框 -->
    <el-dialog v-model="dialogVisible" :title="t('searchengine.editconfig')" width="500px">
      <el-form :model="configForm" label-width="120px">
        <el-form-item 
          v-for="(value, key) in configForm" 
          :key="key" 
          :label="key"
        >
          <el-input 
            v-model="configForm[key]" 
            :type="key.toLowerCase().includes('key') || key.toLowerCase().includes('token') ? 'password' : 'text'"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ t('system.no') }}</el-button>
          <el-button type="primary" @click="updateConfig">
            {{ t('system.yes') }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.search-engine-container {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.engine-section {
  margin-bottom: 16px;
}

.engine-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background-color: var(--el-bg-color-page);
  border-radius: 6px;
  transition: background-color 0.2s;
}

.engine-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.engine-actions {
  display: flex;
  gap: 12px;
}

.engine-header:hover {
  background-color: var(--el-fill-color-light);
}

.expand-icon {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.engine-icon {
  width: 24px;
  height: 24px;
}

.drag-handle {
  cursor: move;
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}

.drag-handle:hover {
  color: var(--el-text-color-primary);
}

.engine-details {
  padding: 16px;
  margin-top: 8px;
  background-color: var(--el-bg-color);
  border-radius: 6px;
}

.config-info {
  font-family: monospace;
  white-space: pre-wrap;
}

/* 添加表格样式 */
:deep(.el-table) {
  background-color: transparent;
}

:deep(.el-table th) {
  background-color: var(--el-fill-color-light);
}

:deep(.el-table td, .el-table th) {
  padding: 8px;
}
.no-config {
  color: var(--el-text-color-secondary);
  font-style: italic;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>