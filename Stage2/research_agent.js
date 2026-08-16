import 'dotenv/config';
import OpenAI from 'openai';
import axios from 'axios';

// ==============================================================================
// 【Stage 2 记录：RAG、工具调用与记忆】
// ==============================================================================
// 1. RAG (检索增强生成): 
//    此处不使用本地向量数据库，而以“维基百科搜索 API”代替 Retrieve（检索）。
//    搜回来的文本片段就是 Chunk，喂给大模型后大模型生成的回答就是 Augmented Generation。
// 2. 记忆 (Memory):
//    - 短期上下文 (Context Window): 这里用 chatHistory 数组保存过去几轮的对话和工具结果。
// 3. 错误处理与来源引用:
//    - 已处理无结果情况以防止幻觉，并在 System Prompt 中约束模型输出引用链接。
// ==============================================================================

// 1. 定义外部工具函数 (Tools) - 模拟 RAG 里的检索环节
async function searchWikipedia(query) {
    console.log(`\n🔍 [工具执行] 正在维基百科搜索: "${query}"...`);
    try {
        // 使用维基百科的公开 API，注意：维基百科 API 强制要求提供 User-Agent，否则会返回 403 错误
        const url = `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Agent-to-learn ResearchAgent/1.0 (contact@example.com)'
            }
        });
        const results = response.data.query.search;
        
        if (results.length === 0) {
            // 【处理空结果】告诉模型没找到，避免它胡编乱造（控制幻觉）
            return "没有找到相关的搜索结果，请尝试其他关键词。";
        }
        
        // 提取前 3 条结果的片段，作为模型上下文
        const summaries = results.slice(0, 3).map(item => {
            // 生成维基百科的 URL 格式
            const pageUrl = `https://zh.wikipedia.org/wiki/${encodeURIComponent(item.title)}`;
            // 清理 API 结果自带的 HTML 标签
            const cleanSnippet = item.snippet.replace(/<\/?[^>]+(>|$)/g, ""); 
            return `【标题】: ${item.title}\n【摘要】: ${cleanSnippet}\n【来源链接】: ${pageUrl}`;
        });
        
        return summaries.join("\n\n");
    } catch (error) {
        // 【处理工具失败】
        return `搜索失败: ${error.message}`;
    }
}

// 2. 将工具暴露给大模型 (JSON Schema)
const TOOLS = [
    {
        type: "function",
        function: {
            name: "search_wikipedia",
            description: "在维基百科上搜索指定的关键词，获取相关事实资料和来源链接。",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "要搜索的关键词"
                    }
                },
                required: ["query"]
            }
        }
    }
];

// 3. 记忆与上下文管理 (Memory)
// chatHistory 扮演了短期记忆 (Short-term memory) 的角色
const chatHistory = [
    { 
        role: "system", 
        content: `角色：严谨的资料研究助手。
任务：
1. 分析主题，并使用 search_wikipedia 工具检索资料。
2. 筛选和总结搜索到的真实信息。
3. 回答保持客观，并在末尾附上实际参考的资料来源链接（Citations）。
未检索到结果时，如实说明；不得依赖不确定的内部知识编造内容。`
    }
];

async function runResearchAgent(userTopic) {
    // 初始化 OpenAI 客户端
    const client = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: process.env.DEEPSEEK_BASE_URL
    });

    console.log(`\n========================================`);
    console.log(`👨‍💻 User: ${userTopic}`);
    console.log(`========================================`);

    // 记录用户的输入到全局的 "会话记忆" 中 (所以绝对是有上下文的！)
    chatHistory.push({ role: "user", content: userTopic });

    let maxSteps = 8;
    let finished = false;
    
    // Agent 思考循环
    for (let step = 1; step <= maxSteps; step++) {
        console.log(`\n▶ [Agent 思考中 - 步骤 ${step}]...`);
        
        try {
            const response = await client.chat.completions.create({
                model: "deepseek-chat", // DeepSeek 模型
                messages: chatHistory,
                tools: TOOLS,
                tool_choice: "auto" 
            });

            const message = response.choices[0].message;
            // 将助手的回复(包含内部思考或函数调用)加入记忆，作为下一次请求的上下文
            chatHistory.push(message);

            // 判断是否调用了工具
            if (message.tool_calls) {
                for (const toolCall of message.tool_calls) {
                    const funcName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments);

                    if (funcName === "search_wikipedia") {
                        const toolResult = await searchWikipedia(args.query);
                        
                        // 🌟 把检索到的知识作为工具返回值存入上下文
                        chatHistory.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            name: funcName,
                            content: toolResult
                        });
                    }
                }
                continue;
            } else {
                // 如果没有调用工具，说明得出了最终答案
                console.log(`\n✅ [最终回答]:\n`);
                console.log(message.content);
                finished = true;
                break;
            }
        } catch (error) {
            console.error("\n❌ [Agent 报错]:", error.message);
            // 发生报错时回退当前回合，防止污染后续对话上下文
            chatHistory.pop();
            break;
        }
    }

    // 处理达到最大步数依然没得出结果的情况
    if (!finished) {
        console.log(`\n⚠️ [Agent 提示]: 已经达到了最大思考步数 (${maxSteps} 步)，未能得出最终结论。`);
        // 关键修复：API 规定 tool 的返回必须紧接着 assistant。如果在此强制中断，
        // 补充中断说明，防止后续请求因上下文序列不完整而报错。
        chatHistory.push({ 
            role: "assistant", 
            content: "（由于步数限制，本轮思考被迫中断）" 
        });
    }
}

// 交互式输入 (Interactive CLI) - 实现多轮对话循环
import readline from 'readline';
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion() {
    rl.question('\n📝 输入研究主题（输入 exit 退出，或按 Ctrl+C）：\n> ', async (topic) => {
        if (topic.trim().toLowerCase() === 'exit') {
            console.log("👋 已退出研究助手。");
            rl.close();
            return;
        }
        
        if (topic.trim()) {
            await runResearchAgent(topic);
        }
        
        // 🌟 递归调用，实现无限循环。
        // 因为 chatHistory 定义在外面，所以多轮对话的上下文记忆会自然保留！
        askQuestion();
    });
}

console.log("💡 记录：连续提问时，Agent 会通过 chatHistory 保留对话上下文。");
// 启动对话循环
askQuestion();
