import YahooService from '../../searchengine/services/localhost.js';
import SerperService from '../../searchengine/services/serper.js';
import { getPreferredSearchEngine } from '../../searchengineSetting.js';

export async function handleWebSearch(toolCalls) {
    if (!toolCalls || !toolCalls.length) return null;

    const searchCall = toolCalls.find(call => call.function.name === 'web_search');
    if (!searchCall) return null;

    try {
        const { keywords } = JSON.parse(searchCall.function.arguments);
        if (!keywords) return null;
        // 获取首选搜索引擎
        const preferredEngine = await getPreferredSearchEngine();
        if (!preferredEngine) {
            console.error('No preferred search engine found');
            return null;
        }
        const config = JSON.parse(preferredEngine.Config)
        let searchService;
        switch (preferredEngine.Name) {
            case 'Localhost':
                searchService = new YahooService(config.proxy_port, config.count);
                break;
            case 'Serper':
                searchService = new SerperService(config.apikey, config.baseurl);
                break;
            default:
                searchService = new YahooService(config.proxy_port);
        }

        const response = await searchService.search(keywords);

        // 检查响应状态
        if (response.code !== 200 || !response.data) {
            console.error('Search failed:', response.msg);
            return null;
        }

        // 使用 response.data 来格式化结果
        const formattedResults = response.data.map(result =>
            `Title: ${result.title}\n Url: ${result.url}\n Abstract: ${result.content}\n`
        ).join('\n');

        return formattedResults;
    } catch (error) {
        console.error('Search error:', error);
        return null;
    }
}