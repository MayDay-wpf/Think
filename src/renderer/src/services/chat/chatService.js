import OpenAIService from '../ai/openai';
import AnthropicService from '../ai/anthropic';

class ChatService {
  constructor() {
    this.services = {};
  }

  initializeChannel(channel, config) {
    switch (channel) {
      case 'openai':
      case 'deepseek':
      case 'ollama':
      case 'qwen':
      case 'siliconflow':
      case 'gemini':
        this.services[channel] = new OpenAIService(
          config.apiKey,
          config.baseURL || undefined
        );
        break;
      case 'anthropic':
        // 初始化 Anthropic 服务
        this.services[channel] = new AnthropicService(
          config.apiKey,
          config.baseURL || undefined
        );
        break;
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  stopGeneration(channel) {
    const service = this.services[channel];
    if (!service) {
      throw new Error(`Channel ${channel} not initialized`);
    }

    switch (channel) {
      case 'openai':
      case 'deepseek':
      case 'ollama':
      case 'qwen':
      case 'siliconflow':
      case 'gemini':
        service.stopGeneration();
        break;
      case 'anthropic':
        service.stopGeneration();
        break;
      // 其他渠道的处理逻辑
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  processMessageHistory(messages, historyLength = 5) {
    if (!messages || messages.length === 0) return messages;

    const currentGroups = new Set(messages.map(msg => msg.groupId));
    if (currentGroups.size <= historyLength) return messages;

    // 获取需要保留的最新的组
    const groupsArray = [...currentGroups];
    const groupsToKeep = groupsArray.slice(-historyLength);
    return messages.filter(msg => groupsToKeep.includes(msg.groupId));
  }


  async sendMessage(channel, messages, model, settings, onData) {
    const service = this.services[channel];
    if (!service) {
      throw new Error(`Channel ${channel} not initialized`);
    }
    const historyLength = settings.general?.HistoryLength ?? 5;
    messages = this.processMessageHistory(messages, historyLength);
    const useStream = settings.general?.IsStream === 1 ?? false;
    const advancedOptions = settings.advance?.IsEnable === 1 ? {
      temperature: settings.advance?.Temperature,
      maxTokens: settings.advance?.MaxTokens,
      presencePenalty: settings.advance?.PresencePenalty,
      frequencyPenalty: settings.advance?.FrequencyPenalty,
      topP: settings.advance?.TopP,
    } : {};

    switch (channel) {
      case 'openai':
      case 'deepseek':
      case 'ollama':
      case 'qwen':
      case 'siliconflow':
      case 'gemini':
        if (useStream) {
          return await service.streamChatCompletion(
            messages,
            {
              channel: channel,
              model: model,
              chatId: settings.chatId,
              groupId: settings.groupId,
              ...advancedOptions
            },
            onData  // 传递回调函数
          );
        } else {
          return await service.chatCompletion(
            messages,
            {
              channel: channel,
              model: model,
              chatId: settings.chatId,
              groupId: settings.groupId,
              ...advancedOptions
            }
          );
        }
        break;
      case 'anthropic':
        if (useStream) {
          return await service.streamChatCompletion(
            messages,
            {
              channel: channel,
              model: model,
              chatId: settings.chatId,
              groupId: settings.groupId,
              ...advancedOptions
            },
            onData  // 传递回调函数
          );
        } else {
          return await service.chatCompletion(
            messages,
            {
              channel: channel,
              model: model,
              chatId: settings.chatId,
              groupId: settings.groupId,
              ...advancedOptions
            }
          );
        }
        break;
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }
}

export default new ChatService();