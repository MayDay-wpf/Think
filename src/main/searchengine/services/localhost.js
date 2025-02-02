import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'

export default class YahooService {
  constructor(proxyport, count) {
    this.clientInitialized = false;
    this.clientInitializing = null;
    this.proxyPort = proxyport;
    this.count = count;
  }

  async ensureClientInitialized() {
    if (this.clientInitialized) return;

    if (!this.clientInitializing) {
      this.clientInitializing = this.initializeClient();
    }

    await this.clientInitializing;
    this.clientInitialized = true;
  }

  async initializeClient() {
    try {
      this.client = axios.create({
        timeout: 10000,
        httpsAgent: new HttpsProxyAgent(`http://127.0.0.1:${this.proxyPort}`),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
          'Accept': 'text/html,application/xhtml+xml...',
          'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7...'
        }
      })
    } catch (err) {
      console.error('初始化客户端错误:', err)
      this.client = axios.create({
        timeout: 10000,
        httpsAgent: new HttpsProxyAgent('http://127.0.0.1:7890'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
          'Accept': 'text/html,application/xhtml+xml...',
          'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7...'
        }
      })
    }
  }

  async search(query) {
    // 确保客户端已初始化
    await this.ensureClientInitialized();

    const encodedQuery = encodeURIComponent(query)
    const url = `https://sg.search.yahoo.com/search?p=${encodedQuery}&ei=UTF-8`
    try {
      const response = await this.client.get(url)
      const html = response.data
      const result = this.parseResults(html)
      return result;
    } catch (err) {
      console.error('搜索错误:', err.message)
      return {
        code: 500,
        msg: "搜索失败"
      }
    }
  }

  fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'Host': 'sg.search.yahoo.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
          'Accept': 'text/html,application/xhtml+xml...',
          'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7...'
        }
      }

      https.get(url, options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => resolve(data))
      }).on('error', reject)
    })
  }

  parseResults(html) {
    try {
      // 解析标题 - 使用更精确的选择器
      const titleRegex = /<h3[^>]*class="title"[^>]*>.*?<a[^>]*>(.*?)<\/a>/g;
      const titles = [...html.matchAll(titleRegex)]
        .map(m => m[1].replace(/<[^>]+>/g, '')) // 移除HTML标签
        .filter(title => title && !title.includes('Images') && !title.includes('Videos'));

      // 解析内容 - 查找带有 fc-falcon 类的内容
      const contentRegex = /<span class="fc-falcon">(.*?)<\/span>/g;
      const contents = [...html.matchAll(contentRegex)]
        .map(m => m[1].replace(/<[^>]+>/g, '')) // 移除HTML标签
        .map(content => content.replace(/&ldquo;|&rdquo;|&hellip;/g, '')); // 移除特殊字符

      // 解析URL - 查找搜索结果链接
      const urlRegex = /<h3[^>]*class="title"[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>/g;
      const urls = [...html.matchAll(urlRegex)]
        .map(m => {
          try {
            const url = new URL(m[1]);
            return url.searchParams.get('RU') || m[1];
          } catch {
            return m[1];
          }
        })
        .filter(url => url && !url.includes('/images/') && !url.includes('/video/'));

      // 组装前this.count条结果
      const results = [];
      for (let i = 0; i < Math.min(this.count, titles.length); i++) {
        if (titles[i] && contents[i] && urls[i]) {
          results.push({
            title: titles[i].trim(),
            content: contents[i].trim(),
            url: urls[i].trim()
          });
        }
      }

      return {
        code: 200,
        msg: "获取成功",
        data: results
      };
    } catch (err) {
      console.error('解析错误:', err);
      return {
        code: 500,
        msg: "解析失败",
        data: []
      };
    }
  }
}
