import Anthropic from '@anthropic-ai/sdk';
import { saveChatHistory, saveUsageHistory } from '../../chatServer';
import * as tiktoken from 'js-tiktoken';
import { handleWebSearch } from '../systemplugin/websearch.js';
import { webSearchToolAnthropic } from '../systemplugin/tools.js';

class AnthropicService {
    constructor(apiKey, baseURL) {
        this.client = new Anthropic({
            apiKey: apiKey,
            baseURL: baseURL || 'https://api.anthropic.com'
        });
        this.currentSession = null;
    }

    async stopGeneration() {
        if (this.abortController) {
            try {
                this.abortController.abort();

                if (this.currentSession) {
                    const { messages, options, accumulatedResponse, totalInputTokens, totalOutputTokens } = this.currentSession;
                    const chatId = options.chatId;
                    const groupId = options.groupId;
                    const channel = options.channel;

                    if (accumulatedResponse) {
                        const userContent = messages[messages.length - 1].content;
                        const imageList = messages.filter(msg => msg.images && msg.images.length > 0)
                            .map(msg => msg.images).flat();
                        const fileList = messages.filter(msg => msg.files && msg.files.length > 0)
                            .map(msg => msg.files).flat();

                        await saveChatHistory(
                            chatId,
                            groupId,
                            userContent,
                            accumulatedResponse,
                            options.model || 'claude-3-opus-20240229',
                            channel,
                            imageList,
                            fileList
                        );

                        if (totalInputTokens > 0 && totalOutputTokens > 0) {
                            await saveUsageHistory(
                                groupId,
                                options.model,
                                totalInputTokens,
                                totalOutputTokens
                            );
                        } else {
                            const enc = await tiktoken.encodingForModel('claude-3');
                            try {
                                let inputTokens = 0;
                                for (const msg of messages) {
                                    const content = msg.content;
                                    inputTokens += enc.encode(content).length;
                                }
                                const outputTokens = enc.encode(accumulatedResponse).length;

                                if (inputTokens > 0 || outputTokens > 0) {
                                    await saveUsageHistory(
                                        groupId,
                                        options.model,
                                        inputTokens,
                                        outputTokens
                                    );
                                }
                            } finally {
                                // cleanup if needed
                            }
                        }
                    }
                    this.currentSession = null;
                }

                this.abortController = null;
            } catch (error) {
                console.error('Error during stopGeneration:', error);
            } finally {
                this.currentSession = null;
                this.abortController = null;
            }
        }
    }

    async _processSearchResults(searchResults, requestMessages, options) {
        if (!searchResults) return null;

        requestMessages.push({
            role: 'user',
            content: `# Language using the user's language.\n
                      # Current time:${new Date().toLocaleString()} \n
                      # Please answer the user's question based on the search results provided below.\n
                      # Ensure your response is accurate and objective, citing relevant information from the search results.\n
                      # Including links to the sources
                      ：\n${searchResults}`
        });
        console.log('Request Body:', JSON.stringify(requestMessages, null, 2));
        const completion = await this.client.messages.create({
            model: options.model || 'claude-3-opus-20240229',
            messages: requestMessages,
            temperature: options.temperature,
            max_tokens: options.maxTokens || 4000,
            top_p: options.topP,
            stream: options.stream || false
        });

        return completion;
    }

    async chatCompletion(messages, options = {}) {
        try {
            const chatId = options.chatId;
            const groupId = options.groupId;
            const channel = options.channel;

            const requestMessages = messages.map(msg => this._formatMessage(msg));
            const hasOnlineMessage = messages.some(msg => msg.online);
            const completion = await this.client.messages.create({
                model: options.model || 'claude-3-opus-20240229',
                messages: requestMessages,
                temperature: options.temperature,
                max_tokens: options.maxTokens || 4000,
                top_p: options.topP,
                ...(hasOnlineMessage && webSearchToolAnthropic)
            });
            let assistantContent = '';
            if (completion.content[0].type === 'tool_use') {
                let accumulatedToolCalls = new Map();
                accumulatedToolCalls.set(0, {
                    id: completion.id,
                    function: {
                        name: completion.content[0].name || '',
                        arguments: JSON.stringify(completion.content[0].input, null)
                    }
                });
                let accumulated = accumulatedToolCalls.get(0);
                const searchResults = await handleWebSearch([accumulated]);
                console.log('searchResults:', searchResults);
                const newCompletion = await this._processSearchResults(searchResults, requestMessages, options);
                if (newCompletion) {
                    assistantContent = newCompletion.content[0].text;
                }
            } else {
                assistantContent = completion.content[0].text;
            }

            const userContent = messages[messages.length - 1].content;
            const imageList = messages.filter(msg => msg.images && msg.images.length > 0).map(msg => msg.images).flat();
            const fileList = messages.filter(msg => msg.files && msg.files.length > 0).map(msg => msg.files).flat();

            await saveChatHistory(
                chatId,
                groupId,
                userContent,
                assistantContent,
                options.model || 'claude-3-opus-20240229',
                channel,
                imageList,
                fileList
            );

            if (completion.usage) {
                await saveUsageHistory(
                    groupId,
                    options.model,
                    completion.usage.input_tokens,
                    completion.usage.output_tokens
                );
            }

            return {
                chatId,
                groupId,
                content: assistantContent,
                usage: completion.usage
            };
        } catch (error) {
            console.error('Anthropic API Error:', error);
            throw error;
        }
    }

    async streamChatCompletion(messages, options = {}, onData) {
        this.currentSession = {
            messages,
            options,
            accumulatedResponse: '',
            totalInputTokens: 0,
            totalOutputTokens: 0
        };

        try {
            this.abortController = new AbortController();
            const chatId = options.chatId;
            const groupId = options.groupId;
            const channel = options.channel;
            let accumulatedResponse = '';

            const requestMessages = messages.map(msg => this._formatMessage(msg));
            //打印请求体
            console.log('Request Body:', JSON.stringify(requestMessages, null, 2));
            const hasOnlineMessage = messages.some(msg => msg.online);

            const stream = await this.client.messages.create({
                model: options.model || 'claude-3-opus-20240229',
                messages: requestMessages,
                temperature: options.temperature,
                max_tokens: options.maxTokens || 4000,
                top_p: options.topP,
                stream: true,
                ...(hasOnlineMessage && webSearchToolAnthropic)
            });
            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            let accumulatedToolCalls = new Map();
            let accumulated = null;

            for await (const chunk of stream) {
                const content = chunk.delta?.text || '';
                if (chunk.content_block && chunk.content_block.type === 'tool_use') {
                    const toolCall = chunk;
                    if (!accumulatedToolCalls.has(toolCall.index)) {
                        accumulatedToolCalls.set(toolCall.index, {
                            id: toolCall.content_block.id,
                            function: {
                                name: toolCall.content_block?.name || '',
                                arguments: ''
                            }
                        });
                    }
                }

                if (chunk.delta && chunk.delta.type === 'input_json_delta' && chunk.delta.partial_json) {

                    accumulated = accumulatedToolCalls.get(chunk.index);
                    accumulated.function.arguments += chunk.delta.partial_json;
                    try {
                        const json = JSON.parse(accumulated.function.arguments);
                        console.log('json:', json);
                        accumulatedToolCalls.delete(chunk.index);
                    } catch (e) {
                        continue;
                    }

                }

                if (content) {
                    accumulatedResponse += content;
                    this.currentSession.accumulatedResponse = accumulatedResponse;
                    onData(content, false);
                }
                if (chunk.type && chunk.type === 'message_start') {
                    totalInputTokens = chunk.message.usage.input_tokens;
                }
                if (chunk.usage) {
                    totalOutputTokens = chunk.usage.output_tokens;
                }
            }

            let searchResults = null;
            if (accumulated && accumulated.function.name === 'web_search') {
                searchResults = await handleWebSearch([accumulated]);
                console.log('searchResults:', searchResults);
                if (searchResults) {
                    const newStream = await this._processSearchResults(searchResults, requestMessages, { ...options, stream: true });

                    for await (const newChunk of newStream) {
                        const newContent = newChunk.delta?.text || '';
                        if (newContent) {
                            accumulatedResponse += newContent;
                            this.currentSession.accumulatedResponse = accumulatedResponse;
                            onData(newContent, false);
                        }
                    }
                }
            }

            const userContent = messages[messages.length - 1].content;
            const imageList = messages.filter(msg => msg.images && msg.images.length > 0).map(msg => msg.images).flat();
            const fileList = messages.filter(msg => msg.files && msg.files.length > 0).map(msg => msg.files).flat();

            await saveChatHistory(
                chatId,
                groupId,
                userContent,
                accumulatedResponse,
                options.model || 'claude-3-opus-20240229',
                channel,
                imageList,
                fileList
            );

            if (totalInputTokens > 0 || totalOutputTokens > 0) {
                await saveUsageHistory(
                    groupId,
                    options.model,
                    totalInputTokens,
                    totalOutputTokens
                );
            }

            onData('', true);
        } catch (error) {
            if (error.name === 'TypeError') {
                console.log('Request aborted');
                console.log('error', error)
                onData('', true);
                return;
            }
            onData(`Error: ${error.message}`, false);
            onData('', true);
            throw error;
        } finally {
            this.abortController = null;
        }
    }

    _formatMessage(msg) {
        if (msg.images && msg.images.length > 0) {
            const contents = [];

            // 添加文本内容
            if (msg.content) {
                contents.push({
                    type: "text",
                    text: msg.content
                });
            }

            // 添加图片内容
            for (const imgBase64 of msg.images) {
                // 从 base64 中提取 MIME 类型
                const mimeType = imgBase64.match(/^data:([^;]+);base64,/)?.[1] || 'image/jpeg';
                // 移除 base64 的 data 头
                const cleanBase64 = imgBase64.replace(/^data:[^;]+;base64,/, '');

                contents.push({
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: mimeType,
                        data: cleanBase64
                    }
                });
            }

            return {
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: contents
            };
        }

        return {
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.files && msg.files.length > 0
                ? msg.content + '\nFiles: ' + msg.files.map(file => file.toString()).join(', ')
                : msg.content
        };
    }
}

export default AnthropicService