/**
 * 文本向量化 (Embedding) 的底层实现
 * 
 * 记录：
 * 什么是向量化？大模型不懂人类的文字，它只懂数字。
 * Embedding 就是把一段文字变成一个由很多小数组成的数组（向量）。
 * 意思越相近的文本，它们在多维空间中的“距离”就越近。
 * 
 * 真实场景：
 * 生产环境可调用 OpenAI 的 text-embedding-3-small 或 BGE 模型：
 * ```javascript
 * const response = await openai.embeddings.create({
 *     model: "text-embedding-3-small",
 *     input: text,
 * });
 * return response.data[0].embedding; // 这是一个 1536 维的浮点数组
 * ```
 * 
 * 本地模拟：
 * 为了在不依赖额外 Embedding API 的前提下跑通流程并观察数学结构，
 * 此处手写一个简单的“词频特征哈希算法”，将文本变成 100 维浮点数组。
 * 它的数据结构和真实的 Embedding 是一模一样的！
 */

function embedText(text) {
    const VECTOR_DIMENSION = 100;
    const vector = new Array(VECTOR_DIMENSION).fill(0);
    
    // 简单的分词过滤 (去除标点符号)
    const words = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '').split('');
    
    // 利用字符的 Unicode 编码将其映射到 100 维空间。
    // 这相当于一个极其简陋的“词袋模型 (Bag of Words)”
    for (let i = 0; i < words.length; i++) {
        if (!words[i]) continue;
        const charCode = words[i].charCodeAt(0);
        // 通过取模算出一个在 0~99 之间的索引
        const index = charCode % VECTOR_DIMENSION;
        // 增加该维度的权重
        vector[index] += 1;
    }
    
    // 向量归一化 (Normalization)
    // 这是真实 Embedding 模型输出前必须做的一步：让向量的长度变成 1
    // 归一化后，后续余弦相似度可直接计算点积。
    let magnitude = 0;
    for (let i = 0; i < VECTOR_DIMENSION; i++) {
        magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);
    
    if (magnitude === 0) return vector; // 防止除以0
    
    for (let i = 0; i < VECTOR_DIMENSION; i++) {
        vector[i] = vector[i] / magnitude;
    }
    
    return vector;
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

// 供内部测试
if (process.argv[1] === __filename) {
    const v1 = embedText("打卡时间是几点？");
    console.log("生成的向量前10维：", v1.slice(0, 10));
}

export { embedText };
