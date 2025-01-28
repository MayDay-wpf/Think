export const webSearchTool = {
    tools: [{
        type: "function",
        function: {
            name: "web_search",
            description: "Generate search keywords based on user queries and perform the search.",
            parameters: {
                type: "object",
                properties: {
                    keywords: {
                        type: "string",
                        description: "Key search terms extracted from user queries."
                    }
                },
                required: ["keywords"]
            }
        }
    }],
    tool_choice: {
        type: "function",
        function: { name: "web_search" }
    }
};