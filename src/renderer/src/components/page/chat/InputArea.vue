<template>
  <div class="input-area" ref="inputArea">
    <div class="toolbar">
      <el-tooltip :content="t('chatPage.uploadfiles')" placement="top" :show-after="300">
        <div class="toolbar-item">
          <label>
            <i class="ri-file-upload-line"></i>
            <input type="file" style="display: none" @change="handleFileUpload" />
          </label>
        </div>
      </el-tooltip>
      <el-tooltip :content="t('chatPage.uploadimages')" placement="top" :show-after="300">
        <div class="toolbar-item">
          <label>
            <i class="ri-image-line"></i>
            <input type="file" accept="image/*" style="display: none" @change="handleImageUpload" />
          </label>
        </div>
      </el-tooltip>
      <el-tooltip :content="isOnline ? t('chatPage.disconnect') : t('chatPage.gettingConnected')" placement="top"
        :show-after="300">
        <div class="toolbar-item" :class="{ online: isOnline }" @click="toggleOnlineStatus">
          <i :class="isOnline ? 'ri-planet-fill' : 'ri-planet-line'"></i>
        </div>
      </el-tooltip>
      <el-tooltip :content="isCapturing ? t('chatPage.stopCapture') : t('chatPage.screenshot')" placement="top"
        :show-after="300">
        <div class="toolbar-item" :class="{ 'capturing': isCapturing }">
          <i :class="isCapturing ? 'ri-stop-circle-line' : 'ri-screenshot-2-line'" @click="toggleScreenshot"></i>
        </div>
      </el-tooltip>
    </div>
    <!-- 截图区域信息 -->
    <div v-if="isCapturing" class="screenshot-preview">
      <div class="screenshot-info">
        <div class="capture-controls">
          <span>{{ t('chatPage.capturing') }}</span>
          <span v-if="captureArea">{{ Math.round(captureArea.width) }} x {{ Math.round(captureArea.height) }}</span>
          <span>{{ t('chatPage.hideWindow') }}:</span>
          <el-switch v-model="hideWindow" inline-prompt size="small" style="margin: 0 10px" />
        </div>
        <el-button link type="danger" @click="clearScreenshot">
          <i class="ri-close-line"></i>
        </el-button>
      </div>
    </div>
    <!-- 图片预览区域 -->
    <div class="image-preview" v-if="imageList.length > 0">
      <div v-for="(image, index) in imageList" :key="index" class="image-item">
        <img :src="image" class="preview-image" @click="$emit('preview-image', image)" />
        <div class="image-remove" @click="removeImage(index)">
          <i class="ri-close-line"></i>
        </div>
      </div>
    </div>
    <!-- 文件预览区域 -->
    <div class="file-preview" v-if="fileList.length > 0">
      <div v-for="(file, index) in fileList" :key="index" class="file-item">
        <i class="ri-file-text-line"></i>
        <span class="file-name">{{ file.name }}</span>
        <div class="file-remove" @click="removeFile(index)">
          <i class="ri-close-line"></i>
        </div>
      </div>
    </div>
    <div class="input-box-wrapper">
      <textarea class="input-box" v-model="inputMessage" :placeholder="t('chatPage.pleaseWrite')" @input="handleInput"
        @keydown="handleKeydown" @paste="handlePaste" ref="inputBox"></textarea>
      <i class="ri-send-plane-fill send-icon" :class="{ 'send-icon-active': inputMessage }" @click="sendMessage"></i>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, createApp, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElImageViewer, ElTooltip } from 'element-plus';
const { t } = useI18n();
const imageList = ref([]);
const fileList = ref([]);
const props = defineProps({
  isSending: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(['send', 'heightChange', 'preview-image']);
const inputMessage = ref('');
const isOnline = ref(false);
const inputArea = ref(null);
const inputBox = ref(null);

onMounted(() => {
  nextTick(() => {
    emitHeightChange();
  });
});

const sendMessage = async () => {
  if (inputMessage.value.trim() !== '' || (isCapturing.value && captureArea.value)) {
    if (isCapturing.value && captureArea.value) {
      try {
        const screenshot = await window.electron.ipcRenderer.invoke('capture-selected-area', {
          hideWindow: hideWindow.value
        });
        if (screenshot) {
          // 将截图添加到 imageList 的开头
          imageList.value.unshift(screenshot);
        }
      } catch (error) {
        console.error('Capture error:', error);
        ElMessage.error(t('chatPage.captureError'));
      }
    }

    emit('send', {
      text: inputMessage.value,
      images: imageList.value,
      files: fileList.value,
      online: isOnline.value
    });

    if (!props.isSending) {
      inputMessage.value = '';
      imageList.value = [];
      fileList.value = [];
    }
    nextTick(() => {
      autoResizeInput();
      emitHeightChange();
    });
  }
};

const handleFileUpload = async (event) => {
  const files = Array.from(event.target.files);
  await processFiles(files);
  event.target.value = '';
};

const handleImageUpload = async (event) => {
  const files = Array.from(event.target.files);
  await processImageFiles(files);
  event.target.value = ''; // 重置input以允许重复选择相同文件
};

const processImageFiles = async (files) => {
  if (imageList.value.length + files.length > 4) {
    ElMessage.warning(t('chatPage.only4image'));
    return;
  }

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      ElMessage.error(t('chatPage.onlyimage'));
      continue;
    }

    try {
      const base64 = await fileToBase64(file);
      imageList.value.push(base64);
      nextTick(() => {
        emitHeightChange();
      });
    } catch (error) {
      console.error('Error:', error);
      ElMessage.error('Error');
    }
  }
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const processFiles = async (files) => {
  if (fileList.value.length + files.length > 4) {
    ElMessage.warning(t('chatPage.only4files'));
    return;
  }

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      ElMessage.warning(t('chatPage.unimage'));
      continue;
    }

    try {
      const content = await readFileContent(file);
      fileList.value.push({
        name: file.name,
        content: content
      });
      nextTick(() => {
        emitHeightChange();
      });
    } catch (error) {
      console.error('Error:', error);
      ElMessage.error('Error');
    }
  }
};

const readFileContent = async (file) => {
  try {
    // 对于文本文件，直接在渲染进程读取
    if (file.type.startsWith('text/')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }

    // 首先获取文件的临时路径
    const filePath = file.path;
    if (!filePath) {
      throw new Error('Unable to retrieve file path.');
    }

    // 调用主进程处理文件
    const content = await window.electron.ipcRenderer.invoke('read-file-content', filePath, file.type);
    return content;
  } catch (error) {
    console.error('Error:', error);
    ElMessage.error('Error: ' + error.message);
    throw error;
  }
};

// 文件移除函数
const removeFile = (index) => {
  fileList.value.splice(index, 1);
  emitHeightChange();
};


const handlePaste = async (event) => {
  const items = (event.clipboardData || event.originalEvent.clipboardData).items;
  const imageFiles = [];
  const textFiles = [];

  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      imageFiles.push(item.getAsFile());
    } else if (item.kind === 'file') {
      textFiles.push(item.getAsFile());
    }
  }

  if (imageFiles.length > 0) {
    await processImageFiles(imageFiles);
  }
  if (textFiles.length > 0) {
    await processFiles(textFiles);
  }
};

const removeImage = (index) => {
  imageList.value.splice(index, 1);
  emitHeightChange();
};

const handleInput = () => {
  autoResizeInput();
  nextTick(() => {
    emitHeightChange();
  });
};

const toggleOnlineStatus = () => {
  isOnline.value = !isOnline.value;
};

const handleKeydown = (event) => {
  if (event.key === 'Enter') {
    // 检查是否正在使用输入法
    if (event.isComposing) {
      return;
    }

    if (event.shiftKey) {
      event.preventDefault();
      inputMessage.value += '\n';
      autoResizeInput();
      emitHeightChange();
    } else {
      event.preventDefault();
      sendMessage();
    }
  }
};

const autoResizeInput = () => {
  inputBox.value.style.height = 'auto';
  inputBox.value.style.height = inputBox.value.scrollHeight + 'px';
};

const emitHeightChange = () => {
  if (inputArea.value) {
    emit('heightChange', inputArea.value.offsetHeight);
  }
};

const hideWindow = ref(false);
const isCapturing = ref(false);
const captureArea = ref(null);

const toggleScreenshot = async () => {
  if (isCapturing.value) {
    // 如果正在捕获，则停止
    await clearScreenshot();
  } else {
    try {
      const result = await window.electron.ipcRenderer.invoke('select-capture-area');
      if (result) {
        captureArea.value = {
          x: Math.round(result.x),
          y: Math.round(result.y),
          width: Math.round(result.width),
          height: Math.round(result.height)
        };
        isCapturing.value = true;
        ElMessage.success(t('chatPage.areaSelected'));
        // 更新输入框高度
        nextTick(() => {
          emitHeightChange();
        });
      }
    } catch (error) {
      console.error('Screenshot error:', error);
      ElMessage.error(error.message);
    }
  }
};

const clearScreenshot = async () => {
  isCapturing.value = false;
  captureArea.value = null;
  await window.electron.ipcRenderer.invoke('clear-capture-area');
  // 更新输入框高度
  nextTick(() => {
    emitHeightChange();
  });
};

</script>

<style scoped>
.input-area {
  border-top: 1px solid var(--el-border-color-light);
  padding: 10px;
}

.toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.toolbar-item {
  margin-right: 10px;
  cursor: pointer;
  font-size: 20px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.toolbar-item:hover {
  color: var(--el-text-color-light);
}

.toolbar-item i:hover {
  cursor: pointer;
}

.toolbar-item.online {
  color: #1d91ee;
}

.input-box-wrapper {
  display: flex;
  align-items: flex-end;
  position: relative;
}

.input-box {
  box-sizing: border-box;
  width: 100%;
  min-height: 80px;
  max-height: 200px;
  padding: 0 30px 0 0;
  border: none;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  overflow-y: auto;
  background-color: var(--el-bg-color);
  font-family: inherit;
}

.input-box:focus {
  outline: none;
  border-color: #409eff;
}

.send-icon {
  position: absolute;
  bottom: 10px;
  right: 10px;
  cursor: pointer;
  color: #999;
  font-size: 20px;
  padding: 5px;
}

.send-icon:hover {
  color: var(--el-text-color-primary);
}

.send-icon-active {
  color: #66b1ff;
}

.image-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.image-item {
  position: relative;
  width: 80px;
  height: 80px;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.image-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  font-size: 14px;
}

.image-remove:hover {
  background-color: rgba(0, 0, 0, 0.7);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
  /* 添加鼠标指针样式 */
  transition: opacity 0.2s;
  /* 添加过渡效果 */
}

.preview-image:hover {
  opacity: 0.8;
  /* 添加悬停效果 */
}

.file-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background-color: var(--el-border-color-light);
  border-radius: 4px;
  max-width: 200px;
}

.file-item i {
  margin-right: 6px;
  color: var(--el-text-color-primary);
}

.file-name {
  font-size: 12px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-remove {
  margin-left: 6px;
  cursor: pointer;
  color: #999;
  display: flex;
  align-items: center;
}

.file-remove:hover {
  color: #666;
}

.screenshot-preview {
  margin: 8px 0;
  padding: 8px;
  background-color: var(--el-border-color-light);
  border-radius: 4px;
}

.screenshot-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--el-text-color-primary);
  font-size: 12px;
}

.toolbar-item.capturing {
  color: #67c23a;
  background-color: rgba(103, 194, 58, 0.1);
}

.screenshot-preview {
  margin: 8px 0;
  padding: 8px;
  background-color: var(--el-border-color-light);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.capture-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>