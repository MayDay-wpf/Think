<template>
    <div class="chat-container">
        <div class="chat-main">
            <div class="model-list">
                <div class="left-controls">
                    <el-dropdown @command="handleModelChange" trigger="click" v-if="models.length > 0">
                        <div class="dropdown-trigger">
                            <img :src="selectedModelSvg" class="model-icon" alt="Model Icon" />
                            <span class="model-name">{{ selectedModelLabel }}</span>
                            <el-icon class="el-icon--right">
                                <arrow-down />
                            </el-icon>
                        </div>
                        <template #dropdown>
                            <el-dropdown-menu class="model-dropdown-menu">
                                <div class="search-box">
                                    <el-input v-model="searchQuery" :placeholder="t('chatPage.searchModel')" clearable
                                        @input="handleSearch" />
                                </div>
                                <div class="model-list-container">
                                    <el-dropdown-item v-for="model in filteredModels" :key="model.value"
                                        :command="model.value">
                                        <div class="model-option">
                                            <img :src="model.svg" class="model-icon" alt="Model Icon" />
                                            {{ model.label }}
                                        </div>
                                    </el-dropdown-item>
                                </div>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                    <el-dropdown trigger="click" class="system-prompt">
                        <div class="dropdown-trigger">
                            <i class="ri-sparkling-line"></i>
                            <span class="prompt-label">{{ t('chatPage.systemPrompt') }}</span>
                            <el-icon class="el-icon--right"><arrow-down /></el-icon>
                        </div>
                        <template #dropdown>
                            <el-dropdown-menu>
                                <div class="prompt-input-box">
                                    <el-input v-model="systemPrompt" type="textarea" :rows="4"
                                        :placeholder="t('chatPage.enterSystemPrompt')" />
                                </div>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                </div>
                <div class="right-controls">
                    <el-button class="pin-button" :class="{ 'is-pinned': isAlwaysOnTop }" @click="toggleAlwaysOnTop"
                        size="small">
                        <i class="ri-pushpin-line"></i>
                    </el-button>
                    <el-dropdown @command="handleLanguageChange" trigger="click">
                        <div class="dropdown-trigger">&nbsp;
                            <i class="ri-earth-fill"></i>
                            <span class="language-name">{{ selectedLanguageLabel }}</span>
                            <el-icon class="el-icon--right">
                                <arrow-down />
                            </el-icon>
                        </div>
                        <template #dropdown>
                            <el-dropdown-menu>
                                <el-dropdown-item v-for="lang in languages" :key="lang.value" :command="lang.value">
                                    <div class="model-option">
                                        {{ lang.label }}
                                    </div>
                                </el-dropdown-item>
                            </el-dropdown-menu>
                        </template>
                    </el-dropdown>
                    <el-switch v-model="isDark" @change="toggleDark" :active-icon="Moon" :inactive-icon="Sunny" />
                </div>
            </div>
            <div class="chat-window" ref="chatWindow">
                <div v-for="message in messages" :key="message.id" :class="['message', message.sender]">
                    <div class="message-content" v-if="message.sender === 'user'">
                        {{ message.content }}
                        <div v-if="message.images && message.images.length" class="message-images">
                            <img v-for="(img, index) in message.images" :key="index" :src="img" class="message-image"
                                @click="previewImage(img)" />
                        </div>
                        <!-- 文件内容显示 -->
                        <div v-if="message.files && message.files.length" class="message-files">
                            <div v-for="(file, index) in message.files" :key="index" class="message-file">
                                <span class="file-content"><i class="ri-file-text-line"></i>{{ file.name }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="message-content-wrapper" v-else>
                        <div class="message-actions" v-if="!message.loading">
                            <el-button-group>
                                <el-button size="small" @click="copyMarkdown(message.content)">
                                    <el-icon>
                                        <DocumentCopy />
                                    </el-icon>
                                </el-button>
                                <el-button size="small" @click="deleteGroup(message.groupId)" type="danger">
                                    <el-icon>
                                        <Delete />
                                    </el-icon>
                                </el-button>
                                <el-button size="small" type="info">
                                    <i class="ri-bard-line"></i>&nbsp;
                                    <span class="model-name-text">{{ message.modelName }}</span>
                                </el-button>
                            </el-button-group>
                        </div>
                        <span class="message-content markdown-body" v-html="renderMarkdown(message.content)"></span>
                        <div v-if="message.loading" class="message-loading-wrapper">
                            <i class="ri-circle-fill message-loading"></i>
                        </div>
                    </div>
                </div>
            </div>
            <div class="fixed-stop-btn" v-if="isSending">
                <el-button size="small" type="danger" @click="stopGeneration">
                    <el-icon>
                        <CircleClose />
                    </el-icon>
                    &nbsp;
                    {{ t('chatPage.stop') }}
                </el-button>
            </div>
            <InputArea @send="handleSend" @heightChange="handleHeightChange" @preview-image="previewImage"
                :isSending="isSending" />
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick, computed, inject, defineEmits, createApp, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElDropdown, ElDropdownMenu, ElDropdownItem, ElIcon, ElInput, ElMessage, ElMessageBox, ElImageViewer } from 'element-plus';
import { ArrowDown, DocumentCopy, Delete, CircleClose, Moon, Sunny } from '@element-plus/icons-vue';
import { useDark, useToggle } from '@vueuse/core'
import InputArea from './InputArea.vue';
import ChatService from '@renderer/services/chat/chatService';
import { v4 as uuidv4 } from 'uuid';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import 'highlight.js/lib/languages/xml';
import 'highlight.js/lib/languages/javascript';
import 'highlight.js/lib/languages/css';
import texmath from 'markdown-it-texmath'
import katex from 'katex'
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';



// 多语言- start
const { t, locale } = useI18n();
const languages = ref([
    { value: 'en', label: 'English' },
    { value: 'zh', label: '简体中文' }

]);
const selectedLanguage = computed(() => locale.value);
const selectedLanguageLabel = computed(() => {
    const lang = languages.value.find(l => l.value === locale.value);
    return lang ? lang.label : '';
});


const handleLanguageChange = (lang) => {
    locale.value = lang;
    localStorage.setItem('language', lang);
};
// 多语言- end
const isAlwaysOnTop = ref(false);
const systemPrompt = ref('');
const isDark = useDark()
const toggleDark = useToggle(isDark)
const messages = ref([]);
const chatWindow = ref(null);
const selectedModel = ref('');
const searchQuery = ref('');
const models = ref([]);
const generalSettings = ref(null);
const advanceSettings = ref(null);
const isSending = ref(false);
const currentChatId = inject('currentChatId');
const emit = defineEmits(['chat-completed']);
const updateHistoryList = ref(false);
const toggleAlwaysOnTop = async () => {
    try {
        isAlwaysOnTop.value = !isAlwaysOnTop.value;
        await window.electron.ipcRenderer.invoke('toggle-always-on-top');
    } catch (error) {
        console.error('Failed to toggle always on top:', error);
        ElMessage.error('toggleAlwaysOnTop Error' + error.message);
    }
};

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
        // 处理 Vue 文件
        if (lang === 'vue') {
            try {
                // Vue 文件主要使用 XML 高亮
                return `<div class="code-block-wrapper"><div class="code-copy-btn"><i class="ri-file-copy-2-line"></i></div><pre><code class="hljs language-xml">${hljs.highlight(str, { language: 'xml' }).value}</code></pre></div>`;
            } catch (__) { }
        }
        if (lang === 'mermaid') {
            return `<pre class="mermaid">${str}</pre>`;
        }
        // 处理其他语言
        if (lang && hljs.getLanguage(lang)) {
            try {
                const code = hljs.highlight(str, { language: lang }).value;
                return `<div class="code-block-wrapper"><div class="code-copy-btn"><i class="ri-file-copy-2-line"></i></div><pre><code class="hljs language-${lang}">${code}</code></pre></div>`;
            } catch (__) { }
        }
        // 如果没有指定语言或语言不支持，使用普通文本
        return `<div class="code-block-wrapper"><div class="code-copy-btn"><i class="ri-file-copy-2-line"></i></div><pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre></div>`;
    }
});

md.use(texmath, {
    engine: katex,
    delimiters: ['dollars', 'brackets'], // 同时支持 $ 和 [ 作为分隔符
    katexOptions: {
        macros: {
            // 基本运算符
            '\\defeq': ':=',
            '\\bm': '\\boldsymbol',

            // 集合论
            '\\set': '\\left\\{ #1 \\right\\}', // \set{x}
            '\\N': '\\mathbb{N}',
            '\\Z': '\\mathbb{Z}',
            '\\Q': '\\mathbb{Q}',
            '\\R': '\\mathbb{R}',
            '\\C': '\\mathbb{C}',

            // 线性代数
            '\\mat': '\\begin{matrix} #1 \\end{matrix}', // \mat{...}
            '\\vec': '\\mathbf{#1}', // \vec{v}
            '\\det': '\\operatorname{det}',
            '\\tr': '\\operatorname{tr}',

            // 微积分
            '\\d': '\\mathrm{d}',
            '\\diff': '\\frac{\\d}{\\d #1}', // \diff{x}
            '\\pd': '\\frac{\\partial}{\\partial #1}', // \pd{x}

            // 概率论
            '\\P': '\\operatorname{P}',
            '\\E': '\\operatorname{E}',
            '\\Var': '\\operatorname{Var}',
            '\\Cov': '\\operatorname{Cov}',

            // 函数和极限
            '\\lim': '\\operatorname{lim}',
            '\\sup': '\\operatorname{sup}',
            '\\inf': '\\operatorname{inf}',
            '\\max': '\\operatorname{max}',
            '\\min': '\\operatorname{min}',

            // 三角函数
            '\\sin': '\\operatorname{sin}',
            '\\cos': '\\operatorname{cos}',
            '\\tan': '\\operatorname{tan}',
            '\\csc': '\\operatorname{csc}',
            '\\sec': '\\operatorname{sec}',
            '\\cot': '\\operatorname{cot}',

            // 双曲函数
            '\\sinh': '\\operatorname{sinh}',
            '\\cosh': '\\operatorname{cosh}',
            '\\tanh': '\\operatorname{tanh}',

            // 对数函数
            '\\log': '\\operatorname{log}',
            '\\ln': '\\operatorname{ln}',
            '\\lg': '\\operatorname{lg}',

            // 特殊函数
            '\\exp': '\\operatorname{exp}',
            '\\sgn': '\\operatorname{sgn}',

            // 复分析
            '\\Re': '\\operatorname{Re}',
            '\\Im': '\\operatorname{Im}',
            '\\arg': '\\operatorname{arg}',

            // 向量分析
            '\\grad': '\\operatorname{grad}',
            '\\div': '\\operatorname{div}',
            '\\rot': '\\operatorname{rot}',
            '\\curl': '\\operatorname{curl}',

            // 常用箭头
            '\\ra': '\\rightarrow',
            '\\Ra': '\\Rightarrow',
            '\\la': '\\leftarrow',
            '\\La': '\\Leftarrow',
            '\\lra': '\\leftrightarrow',
            '\\Lra': '\\Leftrightarrow',

            // 其他常用符号
            '\\eps': '\\varepsilon',
            '\\phi': '\\varphi',
            '\\ell': '\\ell',

            // 矩阵简写
            '\\pmatrix': '\\begin{pmatrix} #1 \\end{pmatrix}',
            '\\bmatrix': '\\begin{bmatrix} #1 \\end{bmatrix}',
            '\\vmatrix': '\\begin{vmatrix} #1 \\end{vmatrix}',

            // 定界符
            '\\abs': '\\left|#1\\right|',
            '\\norm': '\\left\\|#1\\right\\|',
            '\\ceil': '\\left\\lceil#1\\right\\rceil',
            '\\floor': '\\left\\lfloor#1\\right\\rfloor',

            // 求和、积分等
            '\\sum': '\\sum\\limits',
            '\\prod': '\\prod\\limits',
            '\\lim': '\\lim\\limits',

            // 自定义环境
            '\\cases': '\\begin{cases} #1 \\end{cases}',
            '\\align': '\\begin{align} #1 \\end{align}',
        },
        throwOnError: false, // 防止渲染错误导致整个公式失败
        errorColor: '#cc0000', // 错误时显示红色
        strict: false // 不要太严格的语法检查
    }
})
mermaid.initialize({
    startOnLoad: true,  // 改为 true
    theme: isDark.value ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace',
    flowchart: {
        htmlLabels: true,
        curve: 'basis'
    }
});

watch(isDark, async (newValue) => {
    mermaid.initialize({
        theme: newValue ? 'dark' : 'default'
    });

    // 重新渲染所有 mermaid 图表
    try {
        // 清除所有图表的处理标记
        document.querySelectorAll('.mermaid').forEach(div => {
            div.removeAttribute('data-processed');
            div.innerHTML = div.getAttribute('data-graph');
        });

        // 重新初始化所有图表
        await mermaid.init(undefined, document.querySelectorAll('.mermaid'));
    } catch (error) {
        console.error('Mermaid re-rendering error:', error);
    }
});

const renderMarkdown = (content) => {
    if (!content) return '';
    try {
        // 处理 think 标签
        let isThinking = false;
        let thinkContent = '';
        const processedContent = content.replace(/<think>([\s\S]*?)(?:<\/think>|$)/g, (match, p1) => {
            isThinking = true;
            thinkContent = p1;
            const hasEndTag = match.includes('</think>');
            return `<div class="thinking-block">
                <div class="thinking-header">
                    <i class="ri-brain-line"></i>
                    ${hasEndTag ? 'AI 的思考过程' : 'AI 正在思考...'}
                    <el-button class="toggle-btn" size="small">
                        <i class="ri-arrow-down-s-line"></i>
                    </el-button>
                </div>
                <div class="thinking-content">${md.render(p1)}</div>
            </div>`;
        });

        const html = DOMPurify.sanitize(md.render(processedContent), {
            ADD_TAGS: ['el-button'],
            ADD_ATTR: ['size', 'class', 'style'],
            ALLOW_DATA_ATTR: true
        });
        // 在 nextTick 中添加事件监听
        nextTick(async () => {
            const thinkingBlocks = document.querySelectorAll('.thinking-block');
            thinkingBlocks.forEach(block => {
                if (!block.dataset.hasListener) {
                    block.dataset.hasListener = 'true';
                    const toggleBtn = block.querySelector('.thinking-header');
                    const content = block.querySelector('.thinking-content');
                    if (toggleBtn && content) {
                        toggleBtn.addEventListener('click', () => {
                            const isExpanded = content.style.display !== 'none';
                            content.style.display = isExpanded ? 'none' : 'block';
                            toggleBtn.querySelector('i').style.transform =
                                isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
                        });
                        // 默认展开
                        toggleBtn.querySelector('i').style.transform = 'rotate(180deg)';
                        content.style.display = 'block';
                    }
                }
            });
            const copyButtons = document.querySelectorAll('.code-copy-btn');
            copyButtons.forEach(button => {
                if (!button.dataset.hasListener) {
                    button.dataset.hasListener = 'true';
                    button.addEventListener('click', async (e) => {
                        const wrapper = e.target.closest('.code-block-wrapper');
                        const code = wrapper.querySelector('code');
                        try {
                            await navigator.clipboard.writeText(code.textContent);
                            ElMessage.success(t('chatPage.copysuccess'));
                        } catch (err) {
                            ElMessage.error('Error:' + err);
                        }
                    });
                }
            });
            // 添加外部链接的处理
            const links = document.querySelectorAll('.markdown-body a[href]');
            links.forEach(link => {
                if (!link.dataset.hasListener) {
                    link.dataset.hasListener = 'true';
                    link.addEventListener('click', async (e) => {
                        e.preventDefault();
                        const href = link.getAttribute('href');
                        if (href) {
                            try {
                                await window.electron.ipcRenderer.invoke('open-external-link', href);
                            } catch (error) {
                                console.error('Failed to open external link:', error);
                                ElMessage.error('Error' + error.message);
                            }
                        }
                    });
                }
            });
            // 处理 mermaid 图表
            try {
                const mermaidDivs = document.querySelectorAll('.mermaid:not([data-processed="true"])');
                mermaidDivs.forEach(div => {
                    // 保存原始图表数据
                    div.setAttribute('data-graph', div.textContent);
                });
                await mermaid.init(undefined, mermaidDivs);
                mermaidDivs.forEach(div => {
                    div.dataset.processed = 'true';
                });
            } catch (error) {
                console.error('Mermaid rendering error:', error);
            }
        });

        return html;
    } catch (error) {
        console.error('Markdown rendering error:', error);
        return content;
    }
};

onMounted(async () => {
    await loadModels();
    // 获取窗口置顶状态
    isAlwaysOnTop.value = await window.electron.ipcRenderer.invoke('get-always-on-top');
    await Promise.all([
        loadGeneralSettings(),
        loadAdvanceSettings()
    ]);
    console.log('Settings loaded:', {
        general: generalSettings.value,
        advance: advanceSettings.value
    });
});

// 添加清空聊天记录的方法
const clearChat = () => {
    if (isSending.value) {
        ElMessage.warning(t('chatPage.wait'));
        return;
    }
    messages.value = [];
    currentChatId.value = null;
};

// 从主进程获取模型列表
const loadModels = async () => {
    try {
        const modelList = await window.electron.ipcRenderer.invoke('get-models-chat');
        // 处理每个模型的图标路径
        for (const model of modelList) {
            if (model.svg.startsWith('data:') || model.svg.startsWith('blob:')) {
                continue;
            }
            // 获取图标的绝对路径
            model.svg = await window.electron.ipcRenderer.invoke('get-asset-path', model.svg);
        }
        models.value = modelList;
        if (modelList.length > 0) {
            selectedModel.value = modelList[0].value;
        }
    } catch (error) {
        console.error('Failed to load models:', error);
    }
};

// 计算当前选中模型的标签
const selectedModelLabel = computed(() => {
    const model = models.value.find((m) => m.value === selectedModel.value);
    return model ? model.label : '';
});

// 计算当前选中模型的图标
const selectedModelSvg = computed(() => {
    const model = models.value.find((m) => m.value === selectedModel.value);
    return model ? model.svg : '';
});

// 加载用户偏好设置
const loadGeneralSettings = async () => {
    try {
        const settings = await window.electron.ipcRenderer.invoke('get-user-settings');
        generalSettings.value = settings;
    } catch (error) {
        console.error('Failed to load general settings:', error);
    }
};

// 加载高级设置
const loadAdvanceSettings = async () => {
    try {
        const settings = await window.electron.ipcRenderer.invoke('get-advance-settings');
        advanceSettings.value = settings;
    } catch (error) {
        console.error('Failed to load advance settings:', error);
    }
};

// 模型列表模糊搜索
const filteredModels = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) return models.value;

    return models.value.filter(model =>
        model.label.toLowerCase().includes(query) ||
        model.value.toLowerCase().includes(query)
    );
});

// 滚动到最新的消息
const scrollToBottom = () => {
    if (chatWindow.value) {
        chatWindow.value.scrollTop = chatWindow.value.scrollHeight;
    }
};

// 处理模型切换
const handleModelChange = async (command) => {
    console.log('Model change triggered:', command);
    selectedModel.value = command;
    const currentModel = models.value.find(m => m.value === command);
    console.log('Current model:', currentModel);

    if (currentModel) {
        try {
            ChatService.initializeChannel(currentModel.channel, {
                apiKey: currentModel.apiKey,
                baseURL: currentModel.baseURL
            });
        } catch (error) {
            console.error('Failed to initialize chat service:', error);
        }
    }
};

// 发送消息
const handleSend = async (message) => {
    console.log('Sending message:', message);
    if (isSending.value) {
        ElMessage.warning('请等待当前对话完成');
        return;
    }
    const currentModel = models.value.find(m => m.value === selectedModel.value);
    if (!currentModel.isVisionModel && message.images.length > 0) {
        ElMessage.error(t('chatPage.unVision'));
        return;
    }
    const groupId = uuidv4().replace(/-/g, '');
    isSending.value = true;
    // 添加用户消息
    messages.value.push({
        id: uuidv4(),
        sender: 'user',
        groupId: groupId,
        content: message.text,
        images: message.images || [],
        files: message.files || [],
        online: message.online || false
    });

    // 添加 AI 消息（loading 状态）
    const aiMessageId = uuidv4();
    const aiMessage = {
        id: aiMessageId,
        sender: 'ai',
        groupId: groupId,
        content: '',
        loading: true,
        modelName: currentModel.value
    };
    messages.value.push(aiMessage);
    if (!currentChatId.value) {
        currentChatId.value = uuidv4().replace(/-/g, '');
        updateHistoryList.value = true;
    } else {
        updateHistoryList.value = false;
    }
    try {
        if (!currentModel) throw new Error('No model selected');
        // 确保 ChatService 已初始化
        try {
            ChatService.initializeChannel(currentModel.channel, {
                apiKey: currentModel.apiKey,
                baseURL: currentModel.baseURL
            });
        } catch (error) {
            console.error('Failed to initialize chat service:', error);
            ElMessage.error('Error：' + error.message);
        }
        const chatMessages = messages.value.filter(m => !m.loading && (m.sender === 'user' || m.sender === 'ai')).map(m => {
            // 复制消息对象，避免修改原始消息
            const processedMessage = { ...m };
            // 如果是 AI 消息，移除所有 think 标签及其内容
            if (m.sender === 'ai') {
                processedMessage.content = m.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '');
            }
            return processedMessage;
        });
        if (systemPrompt.value) {
            chatMessages.unshift({
                role: 'system',
                content: systemPrompt.value
            });
        }
        const useStream = generalSettings.value?.IsStream === 1 ?? false;
        const chatOptions = {
            chatId: currentChatId.value,
            groupId: groupId,
            model: currentModel.value,
        };
        nextTick(() => {
            scrollToBottom();
        });
        if (useStream) {
            let streamContent = '';
            await ChatService.sendMessage(
                currentModel.channel,
                chatMessages,
                currentModel.value,
                {
                    ...chatOptions,
                    general: generalSettings.value,
                    advance: advanceSettings.value
                },
                (content, isDone) => {
                    const aiMessageIndex = messages.value.findIndex(
                        (message) => message.id === aiMessageId
                    );
                    if (aiMessageIndex > -1) {
                        if (content) {
                            streamContent += content;
                            messages.value[aiMessageIndex].content = streamContent;
                            // 根据 IsAutoScroll 参数决定是否自动滚动
                            if (generalSettings.value?.IsAutoScroll === 1) {
                                nextTick(() => {
                                    scrollToBottom();
                                });
                            }
                        }
                        if (isDone) {
                            messages.value[aiMessageIndex].loading = false;
                            isSending.value = false;
                            if (updateHistoryList.value)
                                emit('chat-completed');
                        }
                    }
                }
            );
        } else {
            const response = await ChatService.sendMessage(
                currentModel.channel,
                chatMessages,
                currentModel.value,
                {
                    ...chatOptions,
                    general: generalSettings.value,
                    advance: advanceSettings.value
                }
            );

            const aiMessageIndex = messages.value.findIndex(
                (message) => message.id === aiMessageId
            );
            if (aiMessageIndex > -1) {
                messages.value[aiMessageIndex].content = response.content;
                messages.value[aiMessageIndex].loading = false;
                // 根据 IsAutoScroll 参数决定是否自动滚动
                if (generalSettings.value?.IsAutoScroll === 1) {
                    nextTick(() => {
                        scrollToBottom();
                    });
                }
            }
            isSending.value = false;
            if (updateHistoryList.value)
                emit('chat-completed');
        }
    } catch (error) {
        console.error('Chat error:', error);
        const aiMessageIndex = messages.value.findIndex(
            (message) => message.id === aiMessageId
        );
        if (aiMessageIndex > -1) {
            messages.value[aiMessageIndex].content = 'Error：' + error.message;
            messages.value[aiMessageIndex].loading = false;
        }
        isSending.value = false;
    }
};

// 添加停止生成的方法
const stopGeneration = () => {
    if (!isSending.value) return;

    const currentModel = models.value.find(m => m.value === selectedModel.value);
    if (!currentModel) return;

    try {
        ChatService.stopGeneration(currentModel.channel);
        isSending.value = false;
        messages.value.forEach(message => {
            message.loading = false;
        });
    } catch (error) {
        console.error('Failed to stop generation:', error);
        ElMessage.error('Error:' + error.message);
    }
};


// 高度纠正
const handleHeightChange = (height) => {
    if (chatWindow.value) {
        chatWindow.value.style.height = `calc(100vh - ${height + 74}px)`;
    }
};

onUnmounted(() => {
    // 清理流式输出的事件监听器
    window.electron.ipcRenderer.removeAllListeners('openai:stream-data');
    window.electron.ipcRenderer.removeAllListeners('openai:stream-error');
});

// 加载历史记录详情
const loadChatHistory = async (chat) => {
    if (isSending.value) {
        ElMessage.warning(t('chatPage.wait'));
        return;
    }

    try {
        // 切换到对应的模型
        if (chat.modelName && generalSettings.value?.ModelAutoChange === 1) {
            selectedModel.value = chat.modelName;
            const currentModel = models.value.find(m => m.value === chat.modelName);
            if (currentModel) {
                ChatService.initializeChannel(currentModel.channel, {
                    apiKey: currentModel.apiKey,
                    baseURL: currentModel.baseURL
                });
            }
        }

        // 获取聊天历史
        const chatDetail = await window.electron.ipcRenderer.invoke('get-chat-detail', chat.chatId);
        if (isSending.value) {
            ElMessage.warning(t('chatPage.wait'));
            return;
        }
        currentChatId.value = chat.chatId;
        messages.value = chatDetail.flatMap(msg => {
            const messages = [];
            // 如果有用户消息，添加用户消息
            if (msg.userContent) {
                messages.push({
                    id: `${msg.id}-user`,
                    sender: 'user',
                    groupId: msg.groupId,
                    content: msg.userContent,
                    images: msg.imageList || [],
                    files: msg.fileList || [],
                    loading: false
                });
                console.log('user message:', msg.fileList);
            }
            // 如果有AI回复，添加AI消息
            if (msg.assistantContent) {
                messages.push({
                    id: `${msg.id}-ai`,
                    sender: 'ai',
                    groupId: msg.groupId,
                    content: msg.assistantContent,
                    loading: false,
                    modelName: msg.modelName
                });
            }
            return messages;
        });

        // 滚动到底部
        nextTick(() => {
            scrollToBottom();
        });
    } catch (error) {
        ElMessage.error('Error：' + error.message);
    }
};

// 暴露方法
defineExpose({
    clearChat,
    loadChatHistory
});

const copyMarkdown = async (content) => {
    try {
        await navigator.clipboard.writeText(content);
        ElMessage.success(t('chatPage.copysuccess'));
    } catch (err) {
        ElMessage.error(t('chatPage.copyfailed') + ":" + err.message);
    }
};

const deleteGroup = async (groupId) => {
    if (!groupId) {
        ElMessage.warning('Invalid conversation group ID.');
        return;
    }

    try {
        await ElMessageBox.confirm(
            t("chatPage.delete"),
            t("chatPage.warning"),
            {
                confirmButtonText: t("system.yes"),
                cancelButtonText: t("system.no"),
                type: 'warning',
            }
        );

        await window.electron.ipcRenderer.invoke('delete-chat-groupId', groupId);
        // 从当前消息列表中移除该组对话
        messages.value = messages.value.filter(msg => msg.groupId !== groupId);
        ElMessage.success(t("chatPage.deletesuccess"));

        // 修改这里的逻辑
        if (messages.value.length === 0) {
            currentChatId.value = null; // 重置当前聊天ID
            await nextTick(); // 等待 DOM 更新
            emit('chat-completed'); // 先触发聊天完成事件
            emit('new-session'); // 再触发新会话事件
        }
    } catch (err) {
        if (err !== 'cancel') {
            ElMessage.error(t("chatPage.deletefailed") + ':' + err.message);
        }
    }
};

const previewImage = (url) => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const app = createApp({
        render() {
            return h(ElImageViewer, {
                urlList: [url],
                initialIndex: 0,
                onClose: () => {
                    app.unmount();
                    div.remove();
                }
            });
        }
    });

    app.mount(div);
};


</script>

<style scoped>
.chat-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.chat-main {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    background-color: var(--el-bg-color);
}

.chat-window {
    overflow-y: auto;
    padding: 10px 10px 10px 10px;
    flex-grow: 1;
    overflow-x: hidden;
    word-wrap: break-word;
    word-break: break-word;
}

.message {
    margin-bottom: 10px;
    display: flex;
    align-items: flex-start;
}

.message.user {
    justify-content: flex-end;
    padding-right: 20px;
    font-size: 15px;
}

.message.ai {
    justify-content: flex-start;
    align-items: flex-end;
}

.message-content-wrapper {
    display: inline-block;
    background-color: transparent;
    padding: 30px;
    padding: 30px;
    border-radius: 5px;
    /* 修改最大宽度 */
    max-width: calc(100% - 60px);
    /* 减去左右padding的值 */
    position: relative;
    /* 添加以下属性 */
    overflow-wrap: break-word;
    word-break: break-word;
}

.message-content {
    word-wrap: break-word;
    white-space: pre-line;
}

.message.user .message-content {
    background-color: var(--el-color-primary-light-9);
    padding: 10px;
    border-radius: 5px;
}

.message.ai .message-content {
    background-color: transparent;
    padding: 0;
    white-space: normal;
    color: var(--el-text-color-primary);
}

.message-content.markdown-body {
    display: inline;
}

.message-loading {
    display: inline-block;
    animation: pulse 1s infinite ease-in-out;
    font-size: 12px;
    margin-left: 2px;
    vertical-align: middle;
}

@keyframes pulse {
    0% {
        opacity: 0.3;
    }

    50% {
        opacity: 1;
    }

    100% {
        opacity: 0.3;
    }
}

.model-list {
    z-index: 10;
    margin: 10px;
    -webkit-app-region: drag;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.model-dropdown-menu {
    max-height: 500px;
    overflow: hidden;
}

.model-list-container {
    max-height: 400px;
    overflow-y: auto;
    overflow-x: hidden;
}

.right-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    -webkit-app-region: no-drag;
}

.language-name {
    margin-right: 5px;
    font-weight: bold;
    font-size: 14px;
}

.model-list .dropdown-trigger {
    -webkit-app-region: no-drag;
}

.model-list .el-switch {
    -webkit-app-region: no-drag;
    padding: 0;
}

.dropdown-trigger {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 5px;
    border: none;
}

.model-name {
    margin-right: 5px;
    font-weight: bold;
}

.model-option {
    display: flex;
    align-items: center;
}

.model-icon {
    width: 20px;
    height: 20px;
    margin-right: 5px;
    vertical-align: middle;
    background-color: #fff;
    padding: 2px;
    border-radius: 5px;
}

.search-box {
    padding: 8px;
    border-bottom: 1px solid var(--el-fill-color-light);
}

.search-box .el-input {
    width: 100%;
}

/* Markdown styles */
.markdown-body {
    font-size: 14px;
    line-height: 1.6;
}

.markdown-body :deep(pre) {
    background-color: var(--el-fill-color-light);
    border-radius: 6px;
    padding: 12px;
    overflow-x: auto;
    margin: 8px 0;
    /* 添加以下属性 */
    white-space: pre-wrap;
    word-wrap: break-word;
}

.markdown-body :deep(code) {
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
    font-size: 12px;
    padding: 0.2em 0.4em;
    background-color: var(--el-fill-color-darker);
    border-radius: 6px;
    color: var(--el-text-color-primary);
}

.markdown-body :deep(pre code) {
    padding: 0;
    background-color: transparent;
    color: inherit;
}

.markdown-body :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 16px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
    padding: 6px 13px;
    border: 1px solid #d0d7de;
}

.markdown-body :deep(th) {
    background-color: #f6f8fa;
}

.markdown-body :deep(img) {
    max-width: 100%;
    height: auto;
}

.markdown-body :deep(.katex-display) {
    margin: 1em 0;
    overflow-x: auto;
    overflow-y: hidden;
}

.markdown-body :deep(.katex) {
    font-size: 1.1em;
    text-rendering: auto;
    font-family: KaTeX_Main, Times New Roman, serif;
}

.markdown-body :deep(.katex-html) {
    overflow-x: auto;
    overflow-y: hidden;
}

:deep(.code-block-wrapper) {
    position: relative;
}

:deep(.code-copy-btn) {
    position: absolute;
    right: 10px;
    bottom: 10px;
    padding: 1px 8px;
    font-size: 15px;
    color: #666;
    background-color: var(--el-fill-color-darker);
    border: 1px solid var(--el-fill-color-darker);
    border-radius: 4px;
    cursor: pointer;
    transition: opacity 0.2s;
}

:deep(.code-copy-btn:hover) {
    background-color: var(--el-fill-color-light);
    border-color: var(--el-fill-color-darker);
}

:deep(.code-copy-btn:active) {
    background-color: var(--el-fill-color-light);
}

.message-actions {
    position: absolute;
    left: 20px;
    bottom: 0px;
    opacity: 0;
    transition: opacity 0.2s;
}

.message-content-wrapper:hover .message-actions {
    opacity: 1;
}

.message-actions .el-button-group {
    margin-left: 5px;
}

.message-actions .el-button {
    padding: 4px 8px;
}

.message-actions .el-icon {
    font-size: 14px;
}

.message-images {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
    /* 添加以下属性 */
    max-width: 100%;
}

.message-image {
    width: 100px;
    height: 100px;
    object-fit: cover;
    border-radius: 4px;
    cursor: pointer;
}

.fixed-stop-btn {
    position: fixed;
    bottom: 140px;
    right: 35%;
    z-index: 1000;
}

.fixed-stop-btn .el-button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    font-size: 14px;

    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.fixed-stop-btn .el-icon {
    font-size: 16px;
}

.message-files {
    margin-top: 8px;
    border-top: 1px solid var(--el-border-color);
    padding-top: 8px;
}

.message-file {
    display: flex;
    align-items: flex-start;
    padding: 4px 0;
    font-size: 14px;
    color: var(--el-text-color-primary);
}

.message-file i {
    margin-right: 8px;
    color: var(--el-text-color-primary);
    font-size: 16px;
}

.file-content {
    white-space: pre-wrap;
    word-break: break-word;
    font-family: monospace;
    background-color: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    padding: 5px;
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;
    /* 添加以下属性 */
    max-width: 100%;
    overflow-x: hidden;
}

.left-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    -webkit-app-region: no-drag;
}

.system-prompt {
    margin-left: 8px;
}

.system-prompt i {
    font-size: 20px;
}

.prompt-label {
    margin: 0 4px;
    font-size: 14px;
}

.prompt-input-box {
    padding: 12px;
    min-width: 300px;
}

.prompt-input-box .el-input {
    width: 100%;
}

.pin-button {
    padding: 6px 8px;
    border: none;
    background: transparent;
    -webkit-app-region: no-drag;
}

.pin-button:hover {
    background-color: var(--el-fill-color-light);
}

.pin-button.is-pinned {
    color: var(--el-color-primary);
}

.pin-button i {
    font-size: 16px;
}

:deep(.mermaid) {
    text-align: center;
    margin: 1em 0;
    background-color: var(--el-fill-color-light);
    border-radius: 6px;
    padding: 16px;
}

:deep(.mermaid svg) {
    max-width: 100%;
    height: auto;
}

:deep(.mermaid-error) {
    color: #ff4d4f;
    padding: 8px;
    margin: 8px 0;
    background-color: #fff2f0;
    border: 1px solid #ffccc7;
    border-radius: 4px;
}

:deep(.thinking-block) {
    margin: 1em 0;
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    background-color: var(--el-fill-color-lighter);
}

:deep(.thinking-header) {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    border-radius: 8px 8px 0 0;
    font-size: 14px;
    color: var(--el-text-color-regular);
    cursor: pointer;
}

:deep(.thinking-header i.ri-brain-line) {
    margin-right: 8px;
    font-size: 16px;
    color: var(--el-color-primary);
}

:deep(.thinking-content) {
    padding: 16px;
    border-top: 1px solid var(--el-border-color);
}

:deep(.toggle-btn) {
    margin-left: auto;
    padding: 2px 4px;
}

:deep(.toggle-btn i) {
    transition: transform 0.3s ease;
}

:deep(.thinking-block.expanded .toggle-btn i) {
    transform: rotate(180deg);
}
</style>