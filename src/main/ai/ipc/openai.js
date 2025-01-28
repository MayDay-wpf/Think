import { ipcMain } from 'electron'
import OpenAIService from '../services/openai'

let openaiService = null

function initOpenAIHandlers() {
    ipcMain.handle('openai:init', (event, { apiKey, baseURL }) => {
        openaiService = new OpenAIService(apiKey, baseURL)
    })

    ipcMain.handle('openai:chat', async (event, { messages, options }) => {
        if (!openaiService) throw new Error('OpenAI service not initialized')
        return await openaiService.chatCompletion(messages, options)
    })

    ipcMain.on('openai:stream-chat', async (event, { messages, options }) => {
        if (!openaiService) {
            event.reply('openai:stream-error', 'OpenAI service not initialized')
            return
        }

        try {
            await openaiService.streamChatCompletion(
                messages,
                options,
                (content, isDone) => {
                    event.reply('openai:stream-data', { content, isDone })
                }
            )
        } catch (error) {
            event.reply('openai:stream-error', error.message)
        }
    })

    ipcMain.on('openai:stop-generation', () => {
        if (openaiService) {
            openaiService.stopGeneration();
        }
    })
}

export { initOpenAIHandlers }