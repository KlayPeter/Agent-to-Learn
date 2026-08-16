import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chunkMarkdown } from './chunk.js';
import { embedText } from './embed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 数据注入 (Ingestion) 的底层实现
 * 
 * 每次用户提问时，如果都去把上百页的 PDF 重新读一遍、分块、向量化，那速度就太慢了！
 * 所以 RAG 系统的标准做法是：
 * 1. 离线（提前）把资料准备好。
 * 2. 把资料分块。
 * 3. 把分好的块转换成向量。
 * 4. 存入“向量数据库”（Vector Database, 比如 Milvus, Pinecone, Qdrant）。
 * 
 * 当前实验使用简单的 JSON 文件 `vector_db.json` 模拟向量数据库，便于直接观察数据形状。
 */

function ingestData() {
    const inputPath = path.join(__dirname, '../data/handbook.md');
    const outputPath = path.join(__dirname, '../data/vector_db.json');

    console.log("🚀 [Ingest] 开始构建本地向量数据库...");

    // 1. 分块 (Chunk)
    const chunks = chunkMarkdown(inputPath);
    
    // 2. 向量化 (Embed) 并且构建数据库记录
    const db = [];
    for (const chunk of chunks) {
        // 调用上一步写好的向量化函数
        const vector = embedText(chunk.content);
        
        db.push({
            id: chunk.id,
            content: chunk.content,
            embedding: vector
        });
    }

    // 3. 存储 (Store)
        // 生产环境通常写入专门的数据库引擎；当前实验写入本地 JSON 以便观察。
    fs.writeFileSync(outputPath, JSON.stringify(db, null, 2));
    console.log(`✅ [Ingest] 成功将 ${db.length} 条数据及其向量写入 ${outputPath}`);
}

if (process.argv[1] === __filename) {
    ingestData();
}

export { ingestData };
