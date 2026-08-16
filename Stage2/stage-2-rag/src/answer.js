import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieveKnowledge } from './retrieve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../../.env') }); // Fallback
dotenv.config({ path: path.join(__dirname, '../../../.env') });

/**
 * 组装生成 (Answer) 的底层实现
 * 
 * 记录重点：
 * 1. 怎么把检索到的结果喂给大模型？
 * 2. 怎么防范幻觉？（如果查不到资料，绝不能让它乱编）
 * 3. 怎么强制引用来源？（Answer with Citations）
 */

// 1. 定义 RAG 的系统提示词 (Prompt Engineering 核心)
// 这个提示词决定了大模型在回答时是否“老实”。
const RAG_SYSTEM_PROMPT = `角色：公司内部资料问答助手。
必须遵循以下规则：
1. 回答仅基于提供的【检索资料】。
2. 若【检索资料】未包含答案，直接回答：“很抱歉，内部手册中未包含相关信息。”；不得借助通用知识编造内容。
3. 回答末尾清晰标注资料来源部分，使用资料标题或编号作为引用。
`;

// 初始化 OpenAI 客户端
const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com/v1" 
});

async function answerQuestion(query) {
    console.log(`\n👨‍💻 用户提问: ${query}`);
    
    // 步骤 1: 检索资料 (Retrieve)
    let retrievedContext = "";
    try {
        const topDocs = retrieveKnowledge(query, 2); // 召回最相关的2段话
        
        if (topDocs.length === 0) {
            console.log(`⚠️ [Retrieve] 未能检索到任何资料。`);
            retrievedContext = "没有找到任何相关的参考资料。";
        } else {
            console.log(`✅ [Retrieve] 成功检索到 ${topDocs.length} 个资料块。`);
            // 将检索到的多段资料拼接到一起，供大模型阅读
            topDocs.forEach((doc, idx) => {
                retrievedContext += `\n[资料 ${idx + 1}] :\n${doc.content}\n`;
            });
        }
    } catch (error) {
        console.error("❌ [Retrieve] 检索失败:", error.message);
        return "抱歉，知识库系统出现异常，请检查是否已经执行过 ingest.js 构建数据库。";
    }

    // 步骤 2: 组装 Prompt，交给大模型生成答案 (Generate / Answer)
    const finalPrompt = `用户的问题是：${query}\n\n以下是从知识库中检索到的【检索资料】：\n${retrievedContext}`;
    
    console.log(`▶ [Agent 思考中] 正在阅读检索到的资料并生成最终回答...`);
    try {
        const response = await client.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: RAG_SYSTEM_PROMPT },
                { role: "user", content: finalPrompt }
            ]
        });

        const answer = response.choices[0].message.content;
        return answer;
    } catch (error) {
        console.error("❌ [Agent 生成失败]:", error.message);
        return "抱歉，调用大模型生成答案时发生错误。";
    }
}

// 供内部测试
if (process.argv[1] === __filename) {
    (async () => {
        const answer1 = await answerQuestion("弹性工作制的打卡时间是几点？");
        console.log(`\n✅ [最终回答]:\n${answer1}\n`);
        
        console.log("-------------------------------------------------");
        
        // 故意问一个不存在的问题，测试防幻觉能力
        const answer2 = await answerQuestion("公司的宇宙飞船能报销星巴克咖啡吗？");
        console.log(`\n✅ [最终回答]:\n${answer2}\n`);
    })();
}

export { answerQuestion };
