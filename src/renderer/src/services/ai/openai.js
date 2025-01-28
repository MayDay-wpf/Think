const { ipcRenderer } = window.electron

class OpenAIService {
    constructor(apiKey, baseURL) {
        // 确保传递的是简单对象
        ipcRenderer.invoke('openai:init', {
            apiKey: apiKey || '',
            baseURL: baseURL || ''
        })
    }

    stopGeneration() {
        ipcRenderer.send('openai:stop-generation');
    }

    async chatCompletion(messages, options = {}) {
        try {
            const cleanMessages = messages.map(msg => ({
                sender: msg.sender,
                content: msg.content,
                images: msg.images ? msg.images.map(img => img.toString()) : [],
                files: msg.files ? msg.files.map(file => JSON.stringify(file)) : []
            }))

            return await ipcRenderer.invoke('openai:chat', {
                messages: cleanMessages,
                options: {
                    channel: options.channel,
                    chatId: options.chatId,
                    model: options.model,
                    groupId: options.groupId,
                    ...(options.temperature !== undefined && { temperature: options.temperature }),
                    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
                    ...(options.presencePenalty !== undefined && { presencePenalty: options.presencePenalty }),
                    ...(options.frequencyPenalty !== undefined && { frequencyPenalty: options.frequencyPenalty }),
                    ...(options.topP !== undefined && { topP: options.topP })
                }
            })
        } catch (error) {
            console.error('OpenAI API Error:', error)
            throw error
        }
    }

    async streamChatCompletion(messages, options = {}, onData) {
        try {
            const cleanMessages = messages.map(msg => ({
                sender: msg.sender,
                content: msg.content,
                images: msg.images ? msg.images.map(img => img.toString()) : [],
                files: msg.files ? msg.files.map(file => JSON.stringify(file)) : [],
                online: msg.online
            }))

            const cleanOptions = {
                channel: options.channel,
                model: options.model,
                chatId: options.chatId,
                groupId: options.groupId,
                ...(options.temperature !== undefined && { temperature: options.temperature }),
                ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
                ...(options.presencePenalty !== undefined && { presencePenalty: options.presencePenalty }),
                ...(options.frequencyPenalty !== undefined && { frequencyPenalty: options.frequencyPenalty }),
                ...(options.topP !== undefined && { topP: options.topP })
            }

            // 先移除之前的监听器
            ipcRenderer.removeAllListeners('openai:stream-data')
            ipcRenderer.removeAllListeners('openai:stream-error')
            ipcRenderer.removeAllListeners('openai:stream-stop')

            // 添加新的监听器
            ipcRenderer.on('openai:stream-data', (event, { content, isDone }) => {
                onData(content, isDone)
            })

            ipcRenderer.on('openai:stream-error', (event, error) => {
                throw new Error(error)
            })

            ipcRenderer.on('openai:stream-stop', () => {
                onData('', true)
            })

            ipcRenderer.send('openai:stream-chat', {
                messages: cleanMessages,
                options: cleanOptions
            })
        } catch (error) {
            console.error('OpenAI Stream Error:', error)
            throw error
        }
    }
}

export default OpenAIService