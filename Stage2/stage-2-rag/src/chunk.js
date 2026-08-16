import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 文本分块 (Chunking) 的底层实现
 * 
 * 记录：
 * 分块的原因：
 * 1. 大模型的上下文窗口是有限的，不可能把一个几百MB的文档全部塞进去。
 * 2. 就算能塞进去，内容太多会导致大模型“分心”，找不到重点（Lost in the middle 现象）。
 * 3. 向量化（Embedding）模型也有输入长度限制（比如 OpenAI 的 text-embedding 限制 8191 个 Token）。
 * 
 * 常见的分块策略：
 * - 按字符长度（比如每 500 个字切一刀）
 * - 按标点符号（遇到句号切）
 * - 按文档结构（例如 Markdown 的标题 H1、H2、H3 切分）<- 当前实现采用此方式以保留语义。
 */

function chunkMarkdown(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 基于 Markdown 二级标题 "## " 切分。
    // 正则保留分隔符，使每个块仍包含标题。
    const rawChunks = content.split(/(?=\n## )/g);
    
    const chunks = [];
    for (let i = 0; i < rawChunks.length; i++) {
        const text = rawChunks[i].trim();
        if (text) {
            chunks.push({
                id: `chunk_${i}`,
                content: text
            });
        }
    }
    
    console.log(`✅ 成功将文档切分为 ${chunks.length} 个 Chunk。`);
    return chunks;
}

// 如果直接运行此文件进行测试
if (process.argv[1] === __filename) {
    const targetPath = path.join(__dirname, '../data/handbook.md');
    const result = chunkMarkdown(targetPath);
    console.log("演示第一个 Chunk 的内容：\n", result[0]);
}

export { chunkMarkdown };
