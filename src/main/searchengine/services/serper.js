import axios from 'axios';

export default class SerperService {
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    async search(query) {
        try {
            const response = await axios.post(
                this.baseUrl,
                { q: query },
                {
                    headers: {
                        'X-API-KEY': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data && response.data.organic) {
                return {
                    code: 200,
                    data: response.data.organic.map(item => ({
                        title: item.title,
                        url: item.link,
                        content: item.snippet
                    })),
                    msg: 'success'
                };
            }

            return {
                code: 500,
                data: null,
                msg: 'No results found'
            };
        } catch (error) {
            return {
                code: 500,
                data: null,
                msg: error.message
            };
        }
    }
}