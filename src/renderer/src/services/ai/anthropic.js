const { ipcRenderer } = window.electron

class AnthropicService {
    constructor(apiKey, baseURL) {
        ipcRenderer.invoke('anthropic:init', {
            apiKey: apiKey || '',
            baseURL: baseURL || ''
        })
    }

    stopGeneration() {
        ipcRenderer.send('anthropic:stop-generation');
    }

    async chatCompletion(messages, options = {}) {
        try {
            const cleanMessages = messages.map(msg => ({
                sender: msg.sender,
                content: msg.content,
                images: msg.images ? msg.images.map(img => img.toString()) : [],
                files: msg.files ? msg.files.map(file => JSON.stringify(file)) : [],
                online: msg.online
            }))

            return await ipcRenderer.invoke('anthropic:chat', {
                messages: cleanMessages,
                options: {
                    channel: options.channel,
                    chatId: options.chatId,
                    model: options.model,
                    groupId: options.groupId,
                    ...(options.temperature !== undefined && { temperature: options.temperature }),
                    ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
                    ...(options.topP !== undefined && { topP: options.topP })
                }
            })
        } catch (error) {
            console.error('Anthropic API Error:', error)
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
                ...(options.topP !== undefined && { topP: options.topP })
            }

            // 先移除之前的监听器
            ipcRenderer.removeAllListeners('anthropic:stream-data')
            ipcRenderer.removeAllListeners('anthropic:stream-error')
            ipcRenderer.removeAllListeners('anthropic:stream-stop')

            // 添加新的监听器
            ipcRenderer.on('anthropic:stream-data', (event, { content, isDone }) => {
                onData(content, isDone)
            })

            ipcRenderer.on('anthropic:stream-error', (event, error) => {
                throw new Error(error)
            })

            ipcRenderer.on('anthropic:stream-stop', () => {
                onData('', true)
            })

            ipcRenderer.send('anthropic:stream-chat', {
                messages: cleanMessages,
                options: cleanOptions
            })
        } catch (error) {
            console.error('Anthropic Stream Error:', error)
            throw error
        }
    }
}

export default AnthropicService