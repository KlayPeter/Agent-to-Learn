# GPT Researcher 阅读记录：从搜索工具到研究工作流

关联代码：

- `research_agent.js`：基于 Function Calling 的资料研究助手。
- `stage-2-rag/`：手写的 `chunk → embed → retrieve → answer` RAG 实验。

阅读目标：弄清楚如何将一次“搜索后回答”扩展为可并发、可追溯、可控制成本的研究工作流。

项目主页与源码：<https://github.com/assafelovic/gpt-researcher>

---

## 我的第一层理解

GPT Researcher 的常规流程并非每一轮都由 LLM 自由决定是否调用工具。主干更接近预先编排的研究流水线：

```text
研究问题
  │
  ├─ 选择研究角色（agent / role）
  ├─ 初步搜索，并生成多个子查询
  ├─ 并发处理每个子查询
  │    ├─ 搜索（一个或多个 retriever）
  │    ├─ 抓取网页正文（scraper）
  │    ├─ 分块、向量相似度过滤（context compression）
  │    └─ 保留带 URL / 标题的证据片段
  ├─ 合并或筛选证据上下文（context）
  └─ Writer 基于上下文生成带引用的报告
```

Agent 的作用主要出现在角色选择、子问题规划、总结和写作；程序负责扇出并发、抓取、去重、限流、压缩与失败降级。这种分工比单一 ReAct / Function Calling 循环更适合长篇研究，也更容易限制成本和追踪错误。

官方 README 将架构概括为 planner 生成问题、execution agents 收集信息、publisher 汇总报告。参考：[Architecture](https://github.com/assafelovic/gpt-researcher#architecture)。

---

## 与 Stage 2 代码的对应关系

| 已有概念 | 当前文件 | GPT Researcher 中的对应位置 | 新增的工程认识 |
| --- | --- | --- | --- |
| 工具定义与循环 | `research_agent.js` | `skills/researcher.py` | 工具可扩展为搜索、抓取和 MCP 数据源；工作流控制主路径。 |
| 单次 Web 检索 | `searchWikipedia()` | `retrievers/`、`actions/retriever.py` | 搜索结果只是 URL 候选；网页正文才是可引用证据。 |
| RAG 数据注入 | `stage-2-rag/src/ingest.js` | `vector_store/vector_store.py` | 索引除向量外还需要保存 `source` 等元数据。 |
| 分块与检索 | `chunk.js`、`embed.js`、`retrieve.js` | `context/compression.py` | 针对当前问题压缩网页正文，而非把整页塞进 Prompt。 |
| 防幻觉与引用 | `answer.js` | `skills/writer.py`、`actions/report_generation.py` | 引用从抓取阶段开始保存，不能只靠 Writer 临时补链接。 |
| 对话上下文 | `chatHistory` | `GPTResearcher.context`、`visited_urls` | 研究状态应保存证据和已访问 URL，而非无限累积聊天记录。 |

---

## 关于 Memory 的修正理解

此前笔记中将记忆区分为短期、会话和长期记忆。阅读项目后需要补充：当前 [`memory/embeddings.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/memory/embeddings.py) 中的 `Memory` 主要负责提供 embedding 模型，用于相似度检索；它不是跨会话保存用户偏好或经历的长期记忆系统。

一次研究的主要状态是：

- `self.context`：本次收集并准备交给 Writer 的证据上下文；
- `self.visited_urls`：用于避免多个子查询重复抓取同一 URL；
- 可选 `vector_store`：外部或本地文档的检索索引。

因此，判断一个项目是否具备长期记忆时，重点应放在状态写入位置、持久化介质、过期策略和读取条件，而不应仅依据类名或目录名。

---

## 我的源码阅读路线

第一次阅读刻意忽略 `frontend/`、`deep_agents/`、`multi_agents/` 以及具体搜索服务商的实现，先沿核心调用链梳理。

1. [`gpt_researcher/agent.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/agent.py)
   - 关注 `GPTResearcher.__init__`、`conduct_research()`、`write_report()`。
   - 记录总控制器保存的状态，以及委托给各 skill 的职责。

2. [`gpt_researcher/skills/researcher.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/skills/researcher.py)
   - 关注 `conduct_research()`、`plan_research()`、`_get_context_by_web_search()`、`_process_sub_query()`。
   - 记录原问题如何转换为子查询，以及 `asyncio.gather` 在何处扇出并发。

3. [`gpt_researcher/actions/query_processing.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/actions/query_processing.py)
   - 关注 `get_search_results()`、`generate_sub_queries()`、`plan_research_outline()`。
   - 记录初搜、规划和模型输出异常时的回退机制。

4. [`gpt_researcher/actions/retriever.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/actions/retriever.py)
   - 记录 Retriever factory 的边界：配置选择 provider，主流程只依赖统一接口。

5. [`gpt_researcher/skills/browser.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/skills/browser.py) 与 [`gpt_researcher/scraper/scraper.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/scraper/scraper.py)
   - 记录搜索摘要与网页正文的边界，以及抓取失败的隔离方式。

6. [`gpt_researcher/skills/context_manager.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/skills/context_manager.py) 与 [`gpt_researcher/context/compression.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/context/compression.py)
   - 记录分块、embedding 相似度过滤、阈值和 Top-K 的作用。

7. [`gpt_researcher/skills/writer.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/skills/writer.py) 与 [`gpt_researcher/actions/report_generation.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/actions/report_generation.py)
   - 记录空上下文拒答的处理，以及研究收集与报告写作分离的原因。

8. [`gpt_researcher/utils/workers.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/utils/workers.py)
   - 记录并发数限制和全局限流分别解决的问题。

---

## 一次请求的调用链

假设研究主题是：`2026 年企业使用 AI Agent 的主要风险与治理措施`。

### 1. 总控制器：`GPTResearcher`

典型入口：

```python
researcher = GPTResearcher(query=query)
await researcher.conduct_research()
report = await researcher.write_report()
```

`GPTResearcher` 初始化并持有以下组件：

- `Config`：模型、检索器、限制和数据源配置；
- `retrievers`：搜索后端的类列表；
- `memory`：embedding 提供者；
- `research_conductor`：研究阶段；
- `context_manager`：证据压缩阶段；
- `report_generator`：成文阶段；
- `visited_urls`、`context`、成本统计：一次运行的状态。

这一层的价值在于依赖边界：替换抓取器或 embedding 时，不需要改报告写作；每个阶段也可以独立测试。

### 2. 研究规划：初搜后生成子查询

`ResearchConductor.plan_research()` 先用 retriever 搜索原问题，拿到近期标题、摘要和链接。随后 `plan_research_outline()` 调用 `generate_sub_queries()`，由 strategic LLM 返回 JSON 形式的子查询列表。

可能得到的拆分：

```text
1. 2026 AI agent enterprise security risks prompt injection data exfiltration
2. NIST AI RMF generative AI agent governance controls
3. enterprise AI agent audit logging human approval best practices
```

`research_agent.js` 中“搜索哪些关键词、搜索几次”的决策隐含在工具循环里；此项目将其变成显式计划产物，因此可以记录、审计、限制 `max_iterations`，并在解析失败时回退为原 query。

### 3. 并发执行：按子查询处理研究分支

`_get_context_by_web_search()` 使用 `asyncio.gather(...)` 并发处理子查询。每个 `_process_sub_query()` 完成搜索、URL 去重、抓取和压缩。并发单位是独立的研究分支，而不是同时输出多段 LLM 文本。

对应的 JavaScript 形状：

```js
const contexts = await Promise.allSettled(
  subQueries.map((query) => processSubQuery(query))
);
```

实际运行还需要 semaphore 和全局 rate limiter。子问题数量与 URL 数量叠加后，若无限制并发，搜索和抓取服务很容易触发限流。相关实现位于 [`utils/workers.py`](https://github.com/assafelovic/gpt-researcher/blob/main/gpt_researcher/utils/workers.py)。

### 4. 证据压缩：网页正文进入 Context 前的筛选

当前手写 RAG 将固定的 `handbook.md` 入库，再在问答时取 Top-K。GPT Researcher 则先围绕主题发现网页、抓取正文，再将页面切为约 `1000` 字符、`100` 重叠的块，用 query embedding 过滤低相关部分，最后保留带标题与 URL 的证据片段。

```text
网页集合
  → RecursiveCharacterTextSplitter
  → EmbeddingsFilter（相似度 ≥ threshold）
  → 每题最相关的证据片段，保留来源 URL
  → Writer 的输入 Context
```

与 `retrieve.js` 的对照：

- `retrieve.js` 只按分数排序，固定返回 Top-K；
- 项目同时使用 `similarity_threshold`，允许证据不足时少给或不给；
- `ContextCompressor` 在素材总量较小时跳过 embedding 压缩，以降低成本与延迟。

### 5. 报告生成：证据为空时拒绝成文

`ReportGenerator.write_report()` 会先检查 context。所有检索或抓取都失败时，方法会明确返回无来源材料，避免生成貌似可靠的报告。

这与 `answer.js` 中“检索资料未包含相关信息”属于同一可靠性原则。引用可信度的前提是证据片段从抓取开始便保存 `source`；只在 Writer Prompt 中要求附链接，无法保证链接实际支撑结论。

---

## RAG、Web Research 与 Memory 的边界

| 层 | 输入 | 输出 | 项目中的位置 |
| --- | --- | --- | --- |
| Web research / discovery | query | URL、搜索摘要 | retrievers |
| Scraping / extraction | URL | 网页主文本、标题、图片 | scraper / browser |
| RAG compression | 问题 + 文本集合 | 少量相关证据片段 | `ContextCompressor` |
| Vector-store RAG（可选） | 问题 + 预建索引 | 本地文档片段 | `VectorStoreWrapper` |
| Research state | 本次运行过程 | context、visited URL、成本 | `GPTResearcher` 实例 |
| Long-term memory | 历史任务 | 可检索持久事实或经历 | 默认流程未提供 |

后续实现可以保持三套清晰接口：

```js
search(query)         // 发现候选 URL
scrape(urls)          // 取得正文与 source
compress(query, docs) // 选择可回答问题的证据片段
```

搜索 snippet 不应视为网页正文；会话数组也不应视为长期记忆数据库。

---

## 值得记录的工程决策

### Provider 边界

`retrievers/` 有多个搜索后端，`scraper/` 有多种抓取策略，`memory/embeddings.py` 支持多种 embedding provider。核心流程依赖统一数据形状，不绑定 Tavily、Google 或特定模型 SDK。

可以抽象出如下数据契约：

```js
// 搜索结果
[{ title, href, body }]

// 抓取结果
[{ url, title, raw_content, status }]
```

### 失败隔离

研究系统应追求部分成功：记录失败的 query、URL 和 provider，其余分支继续运行；报告仅基于成功获得的证据。`research_agent.js` 已具备工具异常捕获，后续可将自然语言错误扩展为结构化状态，例如 `{ status: 'failed', source, error }`，并将失败结果排除出证据上下文。

### 幂等与去重

`visited_urls` 跨子问题共享，避免重复抓取、重复付费和重复引用。同源内容的重复计入还会放大单一来源对结论的影响，因此去重也属于证据质量控制。

### 模型分工与成本

项目区分 strategic LLM（规划）与 smart LLM（总结、报告），并追踪每一步成本。由此得到的实现原则：

- 强模型用于少量全局规划；
- 大量页面处理受字数、批量和并发限制；
- 每个阶段记录 token、延迟、失败率和来源数量。

---

## 后续实践记录计划

### A. 三阶段证据流水线

目标：在已有 JavaScript 代码中实现清晰的 `search → fetchEvidence → selectEvidence → write` 边界，不引入 LangChain。

1. 将 `searchWikipedia()` 拆为 `search(query)`，返回对象数组而非拼接字符串。
2. 增加 `fetchEvidence(results)`，返回 `{ title, url, content, status }`。
3. 增加 `selectEvidence(query, documents)`，复用 `embedText()` 和余弦相似度，并过滤低于阈值的内容。
4. Writer Prompt 接收 `evidence[]`；无 evidence 时拒答；引用使用实际 URL。

完成状态：终端输出可显示规划 query、各 query 成功/失败数和最终证据 URL。

### B. 子问题规划与并发

目标：复刻 `plan_research()` 与 `_get_context_by_web_search()` 的最小结构。

1. 增加 `planQueries(topic)`，约束模型返回最多 3 个 JSON 子查询。
2. 解析失败时回退为 `[topic]`。
3. 使用 `Promise.allSettled()` 执行子查询，隔离单分支失败。
4. 使用自写 semaphore，将并发抓取限制为 2。
5. 使用 `Set` 按 URL 去重。

完成状态：一个子查询失败时，其余分支仍可产出带引用的结果。

### C. 带元数据的证据库

目标：将 `vector_db.json` 从纯文本向量改为可追溯的证据记录。

```json
{
  "id": "handbook:attendance:0",
  "content": "...",
  "embedding": [],
  "metadata": {
    "source": "data/handbook.md",
    "section": "考勤",
    "indexedAt": "..."
  }
}
```

`answer.js` 随后引用 `metadata.source + section`，替代“资料 1”之类的内部编号。

### D. RAG 评估记录

为 `handbook.md` 准备 8 个问题：4 个可答、2 个不可答、1 个措辞近似但实际无关、1 个需要同时引用两段资料。每题记录：

| 指标 | 记录内容 |
| --- | --- |
| Recall | 正确资料块是否进入 Top-K。 |
| Groundedness | 回答中的事实是否能在所引证据中找到。 |
| Abstention | 无答案时是否明确拒答。 |
| Citation correctness | 引用是否真实支撑前文结论。 |
| Cost & latency | 模型调用次数与总耗时。 |

完成 A–D 后，再阅读仓库中的 `evals/` 与 `tests/`，可以更具体地理解测试所覆盖的实际故障模式。

---

## 当前结论

GPT Researcher 的价值不在于堆叠大量工具，而在于将“规划、检索、抓取、证据压缩、写作、限流、去重、成本记录”组织为可观察的研究流程。当前 Stage 2 已具备工具调用和最小 RAG 的基础；后续重点应放在证据数据模型、并发编排、上下文压缩和评估，而不是直接复制完整 Python 仓库。

完整项目运行需要 Python 3.11+、LLM API key 和至少一个搜索 provider 的 key。官方 quick start 使用 `OPENAI_API_KEY` 与 `TAVILY_API_KEY`，再通过 Uvicorn 启动服务。参考：[Getting Started](https://github.com/assafelovic/gpt-researcher#getting-started)。
