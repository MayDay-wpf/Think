import { ipcMain } from 'electron'
import AnthropicService from '../services/anthropic'

let anthropicService = null

function initAnthropicHandlers() {
    ipcMain.handle('anthropic:init', (event, { apiKey, baseURL }) => {
        anthropicService = new AnthropicService(apiKey, baseURL)
    })

    ipcMain.handle('anthropic:chat', async (event, { messages, options }) => {
        if (!anthropicService) throw new Error('Anthropic service not initialized')
        return await anthropicService.chatCompletion(messages, options)
    })

    ipcMain.on('anthropic:stream-chat', async (event, { messages, options }) => {
        if (!anthropicService) {
            event.reply('anthropic:stream-error', 'Anthropic service not initialized')
            return
        }

        try {
            await anthropicService.streamChatCompletion(
                messages,
                options,
                (content, isDone) => {
                    event.reply('anthropic:stream-data', { content, isDone })
                }
            )
        } catch (error) {
            event.reply('anthropic:stream-error', error.message)
        }
    })

    ipcMain.on('anthropic:stop-generation', () => {
        if (anthropicService) {
            anthropicService.stopGeneration();
        }
    })
}

export { initAnthropicHandlers }