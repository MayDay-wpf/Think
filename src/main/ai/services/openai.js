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
                    const { messages, options, accumulatedResponse } = this.currentSession;
                    const chatId = options.chatId;
                    const groupId = options.groupId;
                    const channel = options.channel;

                    if (accumulatedResponse && !this.currentSession.historySaved) {
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

                        // 标记历史记录已保存
                        this.currentSession.historySaved = true;

                        // 计算并保存 token 使用情况
                        const model = options.model;
                        const enc = await tiktoken.encodingForModel('gpt-4o');
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
                                    model,
                                    inputTokens,
                                    outputTokens
                                );
                            }
                        } finally {
                            //enc.free();
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
            content: `# Instructions
                    1. Use the user's language for the response
                    2. Current time: ${new Date().toLocaleString()}
                    3. Answer based on the search results below
                    4. Format requirements:
                       - Use markdown syntax for all Url links
                       - Quote relevant information using markdown blockquotes (>)
                       - Organize information with proper markdown headings
                       - Always cite sources at the end using numbered references
                       - In your response, please include a source link at any position
                    5. Ensure your response is accurate and objective
                    
                    Search Results:
                    ${searchResults}`
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

        try {
            this.abortController = new AbortController();
            const chatId = options.chatId;
            const groupId = options.groupId;
            const channel = options.channel;
            let accumulatedResponse = '';

            const requestMessages = messages.map(msg => this._formatMessage(msg));
            const hasOnlineMessage = messages.some(msg => msg.online);
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
            let accumulatedToolCalls = new Map();
            let accumulated = null;
            let startthink = false;
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                const reasoning_content = chunk.choices[0]?.delta?.reasoning_content || '';
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

                        accumulated = accumulatedToolCalls.get(toolCall.index);
                        if (toolCall.function?.arguments) {
                            accumulated.function.arguments += toolCall.function.arguments;
                        }

                        try {
                            JSON.parse(accumulated.function.arguments);
                            accumulatedToolCalls.delete(toolCall.index);
                        } catch (e) {
                            continue;
                        }
                    }
                }
                if (reasoning_content) {
                    if (!startthink) {
                        startthink = true;
                        accumulatedResponse = '<think>' + reasoning_content;
                        onData(accumulatedResponse, false);
                    } else {
                        accumulatedResponse += reasoning_content;
                        onData(reasoning_content, false);
                    }
                }
                else if (!reasoning_content && content) {
                    if(startthink){
                        startthink = false;
                        onData('</think>', false);
                    }
                    accumulatedResponse += content;
                    onData(content, false);
                }
                this.currentSession.accumulatedResponse = accumulatedResponse;

                if (chunk.usage) {
                    totalInputTokens = chunk.usage.prompt_tokens;
                    totalOutputTokens = chunk.usage.completion_tokens;
                }
            }

            let searchResults = null;
            if (accumulated && accumulated.function.name === 'web_search') {
                searchResults = await handleWebSearch([accumulated]);
                if (searchResults) {
                    const newStream = await this._processSearchResults(searchResults, requestMessages, { ...options, stream: true });

                    for await (const newChunk of newStream) {
                        const newContent = newChunk.choices[0]?.delta?.content || '';
                        if (newContent) {
                            accumulatedResponse += newContent;
                            this.currentSession.accumulatedResponse = accumulatedResponse;
                            onData(newContent, false);
                        }
                    }
                }
            }

            if (totalInputTokens === 0 || totalOutputTokens === 0) {
                // 如果 API 没有返回 token 使用情况，手动计算
                const enc = await tiktoken.encodingForModel('gpt-4o');
                try {
                    for (const msg of messages) {
                        const content = msg.content;
                        totalInputTokens += enc.encode(content).length;
                    }
                    totalOutputTokens = enc.encode(accumulatedResponse).length;
                } finally {
                    //enc.free();
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
                console.log('Error message:', error.message);
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
