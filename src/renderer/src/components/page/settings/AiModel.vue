<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, ArrowDown, ArrowRight, Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { v4 as uuidv4 } from 'uuid'
import draggable from 'vuedraggable'
const { t } = useI18n();
const isEditMode = ref(false)
const editingModelId = ref(null)
const editingChannelCode = ref(null)
const channelList = ref([])
const modelList = ref([])
const channelModels = ref({})
const dialogVisible = ref(false)
const formData = ref({
  channelCode: '',
  nick: '',
  name: '',
  overWriteBaseURL: '',
  overWriteAPIKey: '',
  isEnabled: true,
  isVisionModel: false,
  seq: 0
})
// 渠道编码选项
const channelCodeOptions = [
  {
    label: 'OpenAI',
    value: 'openai'
  }, {
    label: 'DeepSeek',
    value: 'deepseek'
  }, {
    label: 'Anthropic',
    value: 'anthropic'
  },{
    label:'Gemini',
    value:'gemini'
  },{
    label:'Qwen',
    value:'qwen'
  },{
    label:'SiliconFlow',
    value:'siliconflow'
  },{
    label:'Ollama',
    value:'ollama'
  }
]

// 加载渠道和模型列表
const loadData = async () => {
  try {
    const [channels, models] = await Promise.all([
      window.electron.ipcRenderer.invoke('get-channels'),
      window.electron.ipcRenderer.invoke('get-models')
    ])
    // 处理图标路径
    for (const channel of channels) {
      if (channel.IconPath.startsWith('data:') || channel.IconPath.startsWith('blob:')) {
        continue
      }
      // 获取资源的绝对路径
      channel.IconPath = await window.electron.ipcRenderer.invoke('get-asset-path', channel.IconPath)
    }
    channelList.value = channels
    modelList.value = models
    // 更新渠道模型数据
    const modelsByChannel = {}
    channels.forEach(channel => {
      modelsByChannel[channel.ChannelsCode] = models.filter(
        model => model.ChannelCode === channel.ChannelsCode
      )
    })
    channelModels.value = modelsByChannel
  } catch (error) {
    ElMessage.error('Error loading data')
  }
}
// 获取渠道信息
const getChannelInfo = (channelCode) => {
  return channelList.value.find(channel => channel.ChannelsCode === channelCode)
}

// 添加新模型
const addModel = async () => {
  try {
    // 创建一个新的对象，只包含需要的数据
    const modelData = {
      channelCode: formData.value.channelCode,
      nick: formData.value.nick,
      name: formData.value.name,
      overWriteBaseURL: formData.value.overWriteBaseURL || '',
      overWriteAPIKey: formData.value.overWriteAPIKey || '',
      isEnabled: Boolean(formData.value.isEnabled),
      isVisionModel: Boolean(formData.value.isVisionModel),
      seq: Number(formData.value.seq) || 0
    }
    await window.electron.ipcRenderer.invoke('add-model', modelData)
    ElMessage.success(t('modelsetting.addmodelsuccess'))
    dialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.error(t('modelsetting.addmodelfailed'))
  }
}
onMounted(() => {
  loadData()
})
const expandedChannels = ref(new Set())

// 切换展开状态
const toggleExpand = (channelCode) => {
  if (expandedChannels.value.has(channelCode)) {
    expandedChannels.value.delete(channelCode)
  } else {
    expandedChannels.value.add(channelCode)
  }
}

const channelDialogVisible = ref(false)
const channelFormData = ref({
  channelsCode: '',
  name: '',
  baseURL: '',
  apiKey: '',
  isEnabled: true,
  seq: 0
})
const uploadedIcon = ref(null)
// 处理图标上传
const handleIconUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      uploadedIcon.value = e.target.result
    }
    reader.readAsDataURL(file)
  }
}
// 检查渠道是否已存在
const handleChannelChange = (channelCode) => {
  // 检查渠道编码是否已存在
  const existingChannel = channelList.value.find(
    channel => channel.ChannelsCode === channelCode
  )
  if (existingChannel) {
    ElMessage.warning(t('modelsetting.channelexist'))
    channelFormData.value.channelsCode = ''
  }
}
// 添加渠道
const addChannel = async () => {
  try {
    if (!uploadedIcon.value) {
      ElMessage.warning(t('modelsetting.uploadicon'))
      return
    }

    // 检查渠道编码是否已存在
    const existingChannel = channelList.value.find(
      channel => channel.ChannelsCode === channelFormData.value.channelsCode
    )
    if (existingChannel) {
      ElMessage.warning(t('modelsetting.channelexist'))
      channelFormData.value.channelsCode = ''
      return
    }

    const channelData = {
      ...channelFormData.value,
      iconData: uploadedIcon.value
    }

    await window.electron.ipcRenderer.invoke('add-channel', channelData)
    ElMessage.success(t('modelsetting.addchannelsuccess'))
    channelDialogVisible.value = false
    uploadedIcon.value = null
    loadData()
  } catch (error) {
    ElMessage.error(t('modelsetting.addchannelfailed'))
  }
}

// 编辑模型
const editModel = (row) => {
  isEditMode.value = true
  editingModelId.value = row.Id
  formData.value = {
    channelCode: row.ChannelCode,
    nick: row.Nick,
    name: row.Name,
    overWriteBaseURL: row.OverWriteBaseURL || '',
    overWriteAPIKey: row.OverWriteAPIKey || '',
    isEnabled: Boolean(row.IsEnabled),
    isVisionModel: Boolean(row.IsVisionModel),
    seq: row.Seq
  }
  dialogVisible.value = true
}

// 更新模型
const updateModel = async () => {
  try {
    const modelData = {
      id: editingModelId.value,
      ...formData.value
    }
    await window.electron.ipcRenderer.invoke('update-model', modelData)
    ElMessage.success(t('modelsetting.updatechannelsuccess'))
    dialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.error(t('modelsetting.updatechannelfailed'))
  }
}

// 删除模型
const deleteModel = async (id) => {
  try {
    await ElMessageBox.confirm(t('modelsetting.deletemodelconfirm'), t('chatPage.warning'), {
      confirmButtonText: t('system.yes'),
      cancelButtonText: t('system.no'),
      type: 'warning'
    })
    await window.electron.ipcRenderer.invoke('delete-model', id)
    ElMessage.success(t('modelsetting.deletemodelsucess'))
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除模型失败')
    }
  }
}

// 编辑渠道
const editChannel = (channel) => {
  editingChannelCode.value = channel.ChannelsCode
  channelFormData.value = {
    channelsCode: channel.ChannelsCode,
    name: channel.Name,
    baseURL: channel.BaseURL,
    apiKey: channel.APIKey,
    isEnabled: Boolean(channel.IsEnabled),
    seq: channel.Seq,
    iconPath: channel.IconPath // 保存原图片路径
  }
  uploadedIcon.value = null
  channelDialogVisible.value = true
}

// 更新渠道
const updateChannel = async () => {
  try {
    const channelData = {
      ...channelFormData.value,
      channelsCode: editingChannelCode.value,
      iconData: uploadedIcon.value,
      iconPath: uploadedIcon.value ? null : channelFormData.value.iconPath // 如果没有新图片，保留原图片路径
    }
    await window.electron.ipcRenderer.invoke('update-channel', channelData)
    ElMessage.success(t('modelsetting.updatechannelsuccess'))
    channelDialogVisible.value = false
    uploadedIcon.value = null
    loadData()
  } catch (error) {
    ElMessage.error(t('modelsetting.updatechannelfailed'))
  }
}


// 删除渠道
const deleteChannel = async (channelCode) => {
  try {
    await ElMessageBox.confirm(t('modelsetting.deletechannelconfirm'), t('chatPage.warning'), {
      confirmButtonText: t('system.yes'),
      cancelButtonText: t('system.no'),
      type: 'warning'
    })
    await window.electron.ipcRenderer.invoke('delete-channel', channelCode)
    ElMessage.success(t('modelsetting.deletechannelsuccess'))
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('modelsetting.deletechannelfailed'))
    }
  }
}

// 重置表单
const resetForm = () => {
  isEditMode.value = false
  editingModelId.value = null
  editingChannelCode.value = null
  formData.value = {
    channelCode: '',
    nick: '',
    name: '',
    overWriteBaseURL: '',
    overWriteAPIKey: '',
    isEnabled: true,
    isVisionModel: false,
    seq: 0
  }
  channelFormData.value = {
    channelsCode: '',
    name: '',
    baseURL: '',
    apiKey: '',
    isEnabled: true,
    seq: 0
  }
  uploadedIcon.value = null
}
const handleDialogOpen = () => {
  if (!editingChannelCode.value && !isEditMode.value) {
    resetForm()
  }
}
const closeDialog = () => {
  dialogVisible.value = false
  channelDialogVisible.value = false
  resetForm()
}
// 渠道拖拽排序
const onDragEnd = async () => {
  try {
    const plainChannels = channelList.value.map(channel => ({
      ChannelsCode: channel.ChannelsCode,
      Seq: channel.Seq
    }))
    await window.electron.ipcRenderer.invoke('update-channels-order', plainChannels)
    ElMessage.success(t('modelsetting.updateordersuccess'))
  } catch (error) {
    ElMessage.error(t('modelsetting.updateorderfailed'))
    // 重新加载数据以恢复原始顺序
    loadData()
  }
}

// 添加获取渠道模型的计算属性
const getChannelModels = computed(() => {
  const modelsByChannel = {}
  channelList.value.forEach(channel => {
    modelsByChannel[channel.ChannelsCode] = modelList.value.filter(
      model => model.ChannelCode === channel.ChannelsCode
    )
  })
  return modelsByChannel
})

// 修改模型拖拽排序处理函数
const onModelDragEnd = async (evt, channelCode) => {
  try {
    // 获取当前渠道的所有模型
    const updatedModels = channelModels.value[channelCode].map((model, index) => ({
      Id: model.Id,
      Seq: index + 1
    }))

    await window.electron.ipcRenderer.invoke('update-models-order', updatedModels)
    ElMessage.success(t('modelsetting.updateordersuccess'))
    // 不需要重新加载数据，因为本地数据已经通过 v-model 更新
  } catch (error) {
    ElMessage.error(t('modelsetting.updateorderfailed'))
    loadData() // 只在失败时重新加载数据
  }
}
</script>

<template>
  <div class="ai-model-container">
    <div class="header">
      <h2>{{ t('settingMenu.modelsetting') }}</h2>
      <div class="header-buttons">
        <el-button type="primary" :icon="Plus" @click="channelDialogVisible = true">
          {{ t('modelsetting.addchannel') }}
        </el-button>
        <el-button type="primary" :icon="Plus" @click="dialogVisible = true">
          {{ t('modelsetting.addmodel') }}
        </el-button>
      </div>
    </div>

    <draggable v-model="channelList" item-key="ChannelsCode" handle=".drag-handle" @end="onDragEnd">
      <template #item="{ element: channel }">
        <div class="channel-section">
          <div class="channel-header">
            <div class="channel-info">
              <el-icon class="drag-handle">
                <svg viewBox="0 0 24 24" width="1em" height="1em">
                  <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                </svg>
              </el-icon>
              <el-icon class="expand-icon" @click.stop="toggleExpand(channel.ChannelsCode)">
                <component :is="expandedChannels.has(channel.ChannelsCode) ? ArrowDown : ArrowRight" />
              </el-icon>
              <el-image :src="channel.IconPath" class="channel-icon" @click.stop="toggleExpand(channel.ChannelsCode)" />
              <h3 @click.stop="toggleExpand(channel.ChannelsCode)">{{ channel.Name }}</h3>
              <el-tag :type="channel.IsEnabled ? 'success' : 'info'">
                {{ channel.IsEnabled ? t('modelsetting.enable') : t('modelsetting.disable') }}
              </el-tag>
            </div>
            <div class="channel-actions">
              <el-button type="primary" :icon="Edit" text @click.stop="editChannel(channel)">
                {{ t('modelsetting.edit') }}
              </el-button>
              <el-button type="danger" :icon="Delete" text @click.stop="deleteChannel(channel.ChannelsCode)">
                {{ t('modelsetting.delete') }}
              </el-button>
            </div>
          </div>

          <el-collapse-transition>
            <div v-show="expandedChannels.has(channel.ChannelsCode)">
              <template v-if="channelModels[channel.ChannelsCode]?.length">
                <draggable v-model="channelModels[channel.ChannelsCode]" item-key="Id" handle=".model-drag-handle"
                  tag="div" class="model-list" @end="(evt) => onModelDragEnd(evt, channel.ChannelsCode)">
                  <template #item="{ element: model }">
                    <div class="model-card">
                      <div class="model-drag-handle">
                        <el-icon>
                          <svg viewBox="0 0 24 24" width="1em" height="1em">
                            <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                          </svg>
                        </el-icon>
                      </div>
                      <div class="model-info">
                        <div class="model-name">
                          <span class="label">{{ t('modelsetting.modelNick') }}：</span>
                          <span>{{ model.Nick }}</span>
                        </div>
                        <div class="model-name">
                          <span class="label">{{ t('modelsetting.modelName') }}：</span>
                          <span>{{ model.Name }}</span>
                        </div>
                        <div class="model-tags">
                          <el-tag :type="model.IsEnabled ? 'success' : 'info'" size="small">
                            {{ model.IsEnabled ? t('modelsetting.enable') : t('modelsetting.disable') }}
                          </el-tag>
                          <el-tag :type="model.IsVisionModel ? 'primary' : 'info'" size="small">
                            {{ model.IsVisionModel ? t('modelsetting.visionModel') : t('modelsetting.textModel') }}
                          </el-tag>
                        </div>
                      </div>
                      <div class="model-actions">
                        <el-button type="primary" :icon="Edit" text @click="editModel(model)">
                          {{ t('modelsetting.edit') }}
                        </el-button>
                        <el-button type="danger" :icon="Delete" text @click="deleteModel(model.Id)">
                          {{ t('modelsetting.delete') }}
                        </el-button>
                      </div>
                    </div>
                  </template>
                </draggable>
              </template>
              <div v-else class="empty-models">
                <el-empty :description="t('modelsetting.nothavemodel')" :image-size="60">
                  <el-button type="primary" @click="dialogVisible = true">{{ t('modelsetting.addmodel') }}</el-button>
                </el-empty>
              </div>
            </div>
          </el-collapse-transition>
        </div>
      </template>
    </draggable>



    <!-- 添加模型对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEditMode ? t('modelsetting.editmodel') : t('modelsetting.addmodel')"
      width="500px" @open="handleDialogOpen" @closed="resetForm">
      <el-form :model="formData" label-width="120px">
        <el-form-item :label="t('modelsetting.selectChannel')">
          <el-select v-model="formData.channelCode" :placeholder="t('modelsetting.selectChannel')">
            <el-option v-for="channel in channelList" :key="channel.ChannelsCode" :label="channel.Name"
              :value="channel.ChannelsCode" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('modelsetting.modelNick')">
          <el-input v-model="formData.nick" />
        </el-form-item>
        <el-form-item :label="t('modelsetting.modelName')">
          <el-input v-model="formData.name" />
        </el-form-item>
        <el-form-item :label="t('modelsetting.newurl')">
          <el-input v-model="formData.overWriteBaseURL" />
        </el-form-item>
        <el-form-item :label="t('modelsetting.newapikey')">
          <el-input v-model="formData.overWriteAPIKey" type="password" />
        </el-form-item>
        <el-form-item :label="t('modelsetting.enable')">
          <el-switch v-model="formData.isEnabled" />
        </el-form-item>
        <el-form-item :label="t('modelsetting.visionModel')">
          <el-switch v-model="formData.isVisionModel" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ t('system.no') }}</el-button>
          <el-button type="primary" @click="isEditMode ? updateModel() : addModel()">
            {{ t('system.yes') }}
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 添加渠道对话框 -->
    <el-dialog v-model="channelDialogVisible"
      :title="editingChannelCode ? t('modelsetting.editchannel') : t('modelsetting.addchannel')" width="500px"
      @open="handleDialogOpen" @closed="resetForm">
      <el-form :model="channelFormData" label-width="120px">
        <el-form-item :label="t('modelsetting.selectChannel')" required>
          <el-select v-model="channelFormData.channelsCode" :placeholder="t('modelsetting.selectChannel')"
            :disabled="!!editingChannelCode" @change="handleChannelChange">
            <el-option v-for="option in channelCodeOptions" :key="option.value" :label="option.label"
              :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('modelsetting.channelName')">
          <el-input v-model="channelFormData.name" />
        </el-form-item>
        <el-form-item :label="t('modelsetting.baseurl')">
          <el-input v-model="channelFormData.baseURL" />
        </el-form-item>
        <el-form-item :label="t('modelsetting.apikey')">
          <el-input v-model="channelFormData.apiKey" type="password" />
        </el-form-item>
        <el-form-item :label="t('modelsetting.channelimage')">
          <input type="file" accept="image/*" @change="handleIconUpload" style="display: none" ref="iconInput">
          <el-button @click="$refs.iconInput.click()">
            {{ t('modelsetting.selectchannelimage') }}
          </el-button>
          <div v-if="uploadedIcon" class="preview-icon">
            <el-image :src="uploadedIcon" class="channel-icon" />
          </div>
        </el-form-item>
        <el-form-item :label="t('modelsetting.enable')">
          <el-switch v-model="channelFormData.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="channelDialogVisible = false">{{ t('system.no') }}</el-button>
          <el-button type="primary" @click="editingChannelCode ? updateChannel() : addChannel()">
            {{ t('system.yes') }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ai-model-container {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.channel-section {
  margin-bottom: 30px;
}

.channel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background-color: var(--el-bg-color-page);
  border-radius: 6px;
  transition: background-color 0.2s;
}

.channel-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.channel-actions {
  display: flex;
  gap: 12px;
}


.channel-actions .el-button {
  font-size: 14px;
}

.table-actions {
  display: flex;
  gap: 12px;
}

.table-actions .el-button {
  font-size: 14px;
}

.channel-header:hover {
  background-color: var(--el-fill-color-light);
}

.expand-icon {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.channel-icon {
  width: 24px;
  height: 24px;
  background-color: #fff;
  border-radius: 6px;
  padding: 5px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.header-buttons {
  display: flex;
  gap: 10px;
}

.el-button {
  cursor: pointer;
}

.drag-handle {
  cursor: move;
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}

.drag-handle:hover {
  color: var(--el-text-color-primary);
}

.model-drag-handle {
  cursor: move;
  color: var(--el-text-color-secondary);
}

.model-drag-handle:hover {
  color: var(--el-text-color-primary);
}

.model-item {
  margin-bottom: 1px;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.model-card {
  display: flex;
  align-items: center;
  padding: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  transition: all 0.3s;
}

.model-card:hover {
  box-shadow: var(--el-box-shadow-light);
}

.model-drag-handle {
  cursor: move;
  padding: 8px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
}

.model-info {
  flex: 1;
  margin: 0 16px;
}

.model-name {
  margin-bottom: 4px;
}

.model-name .label {
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}

.model-tags {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.model-actions {
  display: flex;
  gap: 8px;
}
</style>
