import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { embedText } from './embed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 检索 (Retrieve) 的底层实现
 * 
 * 记录：
 * 接收问题后，如何从已切分资料中找到相关内容？
 * 答案是：
 * 1. 把用户的问题也向量化（变成数学数组）。
 * 2. 把【问题向量】和数据库里每一个【资料块向量】进行“余弦相似度”计算。
 * 3. 相似度越接近 1，说明两段话在语义上越相关。
 * 4. 挑出得分最高的 Top K 个结果。
 */

// 计算余弦相似度 (Cosine Similarity)
// 数学公式：A · B / (|A| * |B|)
// embed.js 已完成归一化（长度为 1），此处只需计算点积（Dot Product）。
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct;
}

function retrieveKnowledge(query, topK = 2) {
    const dbPath = path.join(__dirname, '../data/vector_db.json');
    if (!fs.existsSync(dbPath)) {
        throw new Error("找不到向量数据库，请先运行 ingest.js");
    }

    // 读取本地的“向量数据库”
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    
    // 1. 把用户的问题变成向量
    const queryVector = embedText(query);
    
    // 2. 遍历数据库，计算相似度打分
    const results = [];
    for (const item of db) {
        const score = cosineSimilarity(queryVector, item.embedding);
        results.push({
            id: item.id,
            content: item.content,
            score: score
        });
    }
    
    // 3. 按得分从高到低排序，取出前 K 个 (Top K)
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, topK);
    
    return topResults;
}

// 供内部测试
if (process.argv[1] === __filename) {
    const query = "飞船出问题后如何报警？";
    console.log(`🔍 [Retrieve] 正在搜索: "${query}"`);
    const results = retrieveKnowledge(query);
    
    console.log(`\n找到了最相关的 ${results.length} 条资料：`);
    results.forEach((r, idx) => {
        console.log(`\n[排名 ${idx + 1}] (相似度得分: ${r.score.toFixed(4)})`);
        console.log(r.content);
    });
}

export { retrieveKnowledge };
