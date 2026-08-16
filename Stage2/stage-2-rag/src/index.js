import readline from 'readline';
import { ingestData } from './ingest.js';
import { answerQuestion } from './answer.js';

/**
 * RAG 系统的交互入口  运行下面命令就可以启动
 * cd Stage2/stage-2-rag
 * node src/index.js
 */

console.log(`
=========================================
🚀 手写 RAG 实验记录
=========================================
本实验覆盖 RAG（检索增强生成）的四个核心：
1. Chunk (分块)
2. Embed (向量化)
3. Retrieve (检索相似度)
4. Answer (带引用回答)
=========================================
`);

// 步骤 1: 离线注入数据（构建知识库）
// 生产环境通常由后台定时运行，无须在每次对话前执行。
// 为了完整演示流程，启动时先将 handbook.md 处理为向量数据库。
ingestData();

console.log("\n✅ 知识库加载完毕，现在可以开始提问了！");
console.log("💡 可测试主题：考勤、报销或外星人。");
console.log("💡 也可输入与公司无关的问题，观察系统是否拒绝编造。\n");

// 步骤 2: 启动在线对话 (交互式 CLI)
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function chatLoop() {
    rl.question('🤖 输入问题（输入 exit 退出）：\n> ', async (query) => {
        if (query.trim().toLowerCase() === 'exit') {
            console.log("👋 再见！");
            rl.close();
            return;
        }

        if (query.trim()) {
            const answer = await answerQuestion(query.trim());
            console.log(`\n=========================================`);
            console.log(`📝 【Agent 最终回答】: \n${answer}`);
            console.log(`=========================================\n`);
        }
        
        chatLoop();
    });
}

chatLoop();
