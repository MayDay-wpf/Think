import OpenAI from 'openai';
import { saveChatHistory, saveUsageHistory } from '../../chatServer';
import * as tiktoken from 'js-tiktoken';
import { handleWebSearch } from '../systemplugin/websearch.js';
import { webSearchTool } from '../systemplugin/tools.js';

class OpenAIService {
    constructor(apiKey, baseURL) {
        this.client = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL || 'https://api.openai.com/v1'
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
                            options.model || 'gpt-4o-mini',
                            channel,
                            imageList,
                            fileList
                        );
                        // 如果有 token 数据，直接保存
                        if (totalInputTokens > 0 && totalOutputTokens > 0) {
                            await saveUsageHistory(
                                groupId,
                                options.model,
                                totalInputTokens,
                                totalOutputTokens
                            );
                        } else {
                            // 如果没有 token 数据，计算所有历史消息的 token
                            const model = options.model;
                            const enc = await tiktoken.encodingForModel('gpt-4o');
                            try {
                                let inputTokens = 0;
                                // 计算所有历史消息的 token
                                for (const msg of messages) {
                                    const content = msg.content;
                                    console.log('content:' + content);
                                    inputTokens += enc.encode(content).length;
                                }
                                const outputTokens = enc.encode(accumulatedResponse).length;

                                console.log('Calculated tokens:', inputTokens, outputTokens);
                                if (inputTokens > 0 || outputTokens > 0) {
                                    await saveUsageHistory(
                                        groupId,
                                        model,
                                        inputTokens,
                                        outputTokens
                                    );
                                }
                            } finally {

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
                      # Ensure your response is accurate and objective, citing relevant information from the search results and including links to the sources
                      ：\n${searchResults}`
        });

        const completion = await this.client.chat.completions.create({
            model: options.model || 'gpt-4o-mini',
            messages: requestMessages,
            temperature: options.temperature,
            max_tokens: options.maxTokens,
            presence_penalty: options.presencePenalty,
            frequency_penalty: options.frequencyPenalty,
            top_p: options.topP,
            stream: options.stream || false
        });

        return completion;
    }

    async chatCompletion(messages, options = {}) {
        try {
            console.log('Starting chatCompletion with messages:', messages);
            const chatId = options.chatId;
            const groupId = options.groupId;
            const channel = options.channel;

            const requestMessages = messages.map(msg => this._formatMessage(msg));
            const hasOnlineMessage = messages.some(msg => msg.online);

            const completion = await this.client.chat.completions.create({
                model: options.model || 'gpt-4o-mini',
                messages: requestMessages,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                presence_penalty: options.presencePenalty,
                frequency_penalty: options.frequencyPenalty,
                top_p: options.topP,
                ...(hasOnlineMessage && webSearchTool)
            });

            const userContent = messages[messages.length - 1].content;
            const imageList = messages.filter(msg => msg.images && msg.images.length > 0).map(msg => msg.images).flat();
            const fileList = messages.filter(msg => msg.files && msg.files.length > 0).map(msg => msg.files).flat();

            // 处理工具调用
            let assistantContent = '';
            if (completion.choices[0].message.tool_calls) {
                const searchResults = await handleWebSearch(completion.choices[0].message.tool_calls);
                const newCompletion = await this._processSearchResults(searchResults, requestMessages, options);
                if (newCompletion) {
                    assistantContent = newCompletion.choices[0].message.content;
                }
            } else {
                assistantContent = completion.choices[0].message.content;
            }

            await saveChatHistory(
                chatId,
                groupId,
                userContent,
                assistantContent,
                options.model || 'gpt-4o-mini',
                channel,
                imageList,
                fileList
            );

            if (completion.usage) {
                await saveUsageHistory(
                    groupId,
                    options.model,
                    completion.usage.prompt_tokens,
                    completion.usage.completion_tokens
                );
            }

            return {
                chatId,
                groupId,
                content: assistantContent,
                usage: completion.usage
            };
        } catch (error) {
            console.error('OpenAI API Error:', error);
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
        console.log(messages);
        try {
            this.abortController = new AbortController();
            const chatId = options.chatId;
            const groupId = options.groupId;
            const channel = options.channel;
            const hasOnlineMessage = messages.some(msg => msg.online);
            let accumulatedResponse = '';

            const requestMessages = messages.map(msg => this._formatMessage(msg));
            console.log('requestMessages:', requestMessages);
            const stream = await this.client.chat.completions.create({
                model: options.model || 'gpt-4o-mini',
                messages: requestMessages,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                presence_penalty: options.presencePenalty,
                frequency_penalty: options.frequencyPenalty,
                top_p: options.topP,
                stream: true,
                ...(hasOnlineMessage && webSearchTool)
            });

            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            let accumulatedToolCalls = new Map(); // 用于累积函数调用数据

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                const reasoningContent = chunk.choices[0]?.delta?.reasoning_content || '';
                const toolCalls = chunk.choices[0]?.delta?.tool_calls;

                if (toolCalls) {
                    for (const toolCall of toolCalls) {
                        if (!accumulatedToolCalls.has(toolCall.index)) {
                            accumulatedToolCalls.set(toolCall.index, {
                                id: toolCall.id,
                                function: {
                                    name: toolCall.function?.name || '',
                                    arguments: ''
                                }
                            });
                        }

                        const accumulated = accumulatedToolCalls.get(toolCall.index);
                        if (toolCall.function?.arguments) {
                            accumulated.function.arguments += toolCall.function.arguments;
                        }

                        // 检查是否是完整的函数调用
                        try {
                            const json = JSON.parse(accumulated.function.arguments);
                            if (accumulated.function.name === 'web_search') {
                                const searchResults = await handleWebSearch([accumulated]);
                                if (searchResults) {
                                    const newStream = await this._processSearchResults(searchResults, requestMessages, { ...options, stream: true });

                                    for await (const newChunk of newStream) {
                                        const newContent = newChunk.choices[0]?.delta?.content || '';
                                        if (newContent) {
                                            accumulatedResponse += newContent;
                                            this.currentSession.accumulatedResponse = accumulatedResponse;
                                            onData(newContent, false);
                                        }
                                        if (newChunk.usage) {
                                            totalInputTokens = newChunk.usage.prompt_tokens;
                                            totalOutputTokens = newChunk.usage.completion_tokens;
                                        }
                                    }
                                    accumulatedToolCalls.delete(toolCall.index);
                                }
                            }
                        } catch (e) {
                            // JSON 解析失败，说明参数还不完整
                            continue;
                        }
                    }
                }

                if (content) {
                    accumulatedResponse += content;
                    this.currentSession.accumulatedResponse = accumulatedResponse;
                    onData(content, false);
                }
                if (reasoningContent) {
                    accumulatedResponse += reasoningContent;
                    this.currentSession.accumulatedResponse = accumulatedResponse;
                    onData(reasoningContent, false);
                }

                if (chunk.usage) {
                    totalInputTokens = chunk.usage.prompt_tokens;
                    totalOutputTokens = chunk.usage.completion_tokens;
                }
            }

            // 保存完整的对话记录
            const userContent = messages[messages.length - 1].content;
            const imageList = messages.filter(msg => msg.images && msg.images.length > 0).map(msg => msg.images).flat();
            const fileList = messages.filter(msg => msg.files && msg.files.length > 0).map(msg => msg.files).flat();

            await saveChatHistory(
                chatId,
                groupId,
                userContent,
                accumulatedResponse,
                options.model || 'gpt-4o-mini',
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
            console.error('ERROR NAME:', error.name);
            if (error.name === 'TypeError') {
                console.log('Request aborted');
                onData('', true);
                return;
            }
            //console.error('OpenAI Stream Error:', error);
            onData(`Error: ${error.message}`, false);
            onData('', true);
            throw error;
        } finally {
            this.abortController = null;
        }
    }

    _formatMessage(msg) {
        if (msg.images && msg.images.length > 0) {
            return {
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: [
                    {
                        type: "text",
                        text: msg.content + (msg.files && msg.files.length > 0
                            ? '\nFiles: ' + msg.files.map(file => file.toString()).join(', ')
                            : '')
                    },
                    ...msg.images.map(img => ({
                        type: "image_url",
                        image_url: { url: img }
                    }))
                ]
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

export default OpenAIService
