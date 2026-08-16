### Stage 2：工具调用、RAG 与记忆记录

这一阶段记录工具调用、RAG 与记忆相关的理解。

RAG：
其实有一篇教程讲RAG的，非常详细的，我已经基本看过两遍了
RAG 直接翻译 过来就是   检索增强生成
从名字就可以知道，检索 增强 生成
检索：围绕问题查找相关内容，这里涉及向量数据库。
增强：将检索结果加入提问上下文，使生成结果更准确。

RAG 可以类比为开卷考试：直接使用 LLM 像仅靠大脑答题；模型的知识来自训练，细节可能被压缩、过期或缺失，也可能产生幻觉。RAG 像查阅资料，在回答前先找到可追溯的证据。

向量数据库中的检索内容相当于参考资料。只有资料来源可靠、索引更新及时、检索结果相关时，回答才可能更客观、全面、可追溯并具有时效性；RAG 本身不自动保证这些属性。

更深入的 RAG 资料：https://datawhalechina.github.io/all-in-rag/#/
以下是阅读后整理的知识点，用于回忆和查漏补缺。
1. 数据准备
    - 数据加载
    - 文本分块
2. 索引构建
    - 向量嵌入
    - 多模态
3. 检索优化
    - 混合检索
    - 查询构建
    - 查询重构与分发
    - 检索进阶技术
4. 格式化生成
    - 结构化输出和格式控制
5. 评估
    - RAG 评估和方法论
    - 评估工具


记忆
记忆系统 参考了人类认知科学分为：
1. Semantic Memory（语义记忆）- 存储"事实（Facts）"
就是 Agent 知道的一些长期事实。
不会因为一次对话结束就消失。
例如：Agent 的名字、可用能力、所属业务规则、偏好或长期稳定的事实。API 密钥不属于 Agent 记忆，应保存在环境变量或专门的密钥管理系统中，也不应放进模型上下文。

2. Episodic Memory（情景记忆）- 存储"发生过什么"
记录过去的对话、事件和经验。它记录的是：经历（Experience）而不是事实
随着时间推移，如果不对其进行管理（比如摘要、压缩或过期机制），
它会变得越来越大。
如果只是把对话历史直接塞进 Context Window，旧信息或重复信息会被挤出有限上下文，这会表现为“Agent 健忘”。但已经持久化的情景记忆不会自动消失；另一种问题是它没有被正确检索并重新放入当前上下文。

3. Procedural Memory（程序记忆）- 存储"怎么做"
关于如何执行任务的知识。
例如：使用某个 API 的步骤、调试某类错误的流程、
或者根据反馈调整策略的具体指令。


上下文
上下文是 Agent 在当前一次模型调用中实际提供给模型的信息。对话历史、检索结果、状态和工具输出都可能在应用程序里存在，但只有被选中并组装进 Prompt 的部分才真正进入 Context Window。
比如：
- 当前对话历史（Chat History）
- 用户当前输入（Current Input）
- 检索到的信息（Retrieved Context）
- 记忆中的相关片段（Relevant Memory）
- 外部环境信息（如时间、日期、用户偏好）
- 任务目标和约束条件（Task Goal & Constraints）
- Agent 自身的状态（Internal State）
- 工具的输入输出（Tool Inputs & Outputs）
- 预设的系统提示词（System Prompt）
- 安全和权限策略（Safety & Permission Policies）

而上下文工程指的是：将上面所有东西有条理的组织起来，塞进有限的 Context Window 供 Agent 使用。
这里就涉及到：
- 如何有效压缩和总结信息（Summarization & Compression）
- 如何优化提示词结构（Prompt Structuring）
- 如何进行多轮对话管理（Multi-turn Conversation Management）
- 如何处理不确定性（Uncertainty Handling）
- 如何防止信息过载（Context Overload Prevention）



后续参考：

- [LlamaIndex Agents](https://docs.llamaindex.ai/en/stable/use_cases/agents/)
- [LangChain Docs](https://docs.langchain.com/)
- [Gemini API Code Execution](https://ai.google.dev/gemini-api/docs/code-execution)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

### 阅读后的补充想法：
LlamaIndex：Agent 怎么结合私有数据和 RAG
我目前把 LlamaIndex Agent 理解为：能够根据请求进行决策，并可具备以下能力的系统：

- 将复杂问题拆成多个子问题；
- 判断要调用哪个工具；
- 生成工具参数；
- 规划任务步骤；
- 通过记忆组件保存和检索之前的任务信息。

LlamaIndex 既提供封装好的 Agent 和 Tool，也允许通过 Workflows 设计更底层的事件驱动 Agent 流程。
不过，LlamaIndex 最有特色的地方不是普通 Function Calling，而是：
> Agent 可以操作和检索私有数据。
它本来就是以 RAG、文档索引、检索器、向量数据库这些能力起家的。

LangChain：Agent 应用怎么搭建、编排、测试、部署、监控
Gemini Code Execution：模型怎么调用内置代码执行环境
MCP：不同 AI 应用怎么用统一协议连接外部工具和数据







- [x] 已完成一个最小 RAG 流程：chunk、embed、retrieve、answer（Prompt 要求 citations）。

  **chunk 分块**：把长文本切成小块。大模型一次读不完几百页 PDF，所以得拆。
  👉 [查看代码：chunk.js](./stage-2-rag/src/chunk.js)

  **embed 向量化**：将文本变成数值数组，从而进行数学意义上的相似度计算。当前 `embed.js` 使用的是字符哈希模拟向量数据结构，方便理解余弦相似度；它不等同于真实 Embedding 模型的语义能力。
  👉 [查看代码：embed.js](./stage-2-rag/src/embed.js)
  👉 [查看代码：retrieve.js (如何计算相似度)](./stage-2-rag/src/retrieve.js)

- [x] 已将维基百科搜索 API 包装为可供模型调用的工具。
  本阶段的 RAG 还读取了本地 Markdown 文件；数据库、浏览器和代码执行工具尚未接入。
  👉 [查看代码：research_agent.js (看里面的 search_wikipedia 工具定义)](./research_agent.js)

- [x] 已能从概念上区分短期上下文、会话记忆和长期记忆。
  上文的记忆分类来自认知科学，也可从工程实现角度理解；当前代码真正实现的是 `chatHistory` 形式的短期对话上下文，还没有持久化会话记忆或长期记忆。
  - **短期上下文**：简单一点就是：把过去几轮的对话直接塞给 LLM。（存在LLM Context Window）
    - 也有人叫 working memory( 工作记忆 )
    - 或者 Context Window (上下文窗口)
    - 模型当前这一刻看到的 Prompt
  - **会话记忆**：保存同一会话的对话、事件或摘要。实现可以是内存、Redis、文件或数据库；保存后仍需按需摘要和检索，不能无限量塞回 Prompt。
  - **长期记忆**：跨会话保存的事实、偏好或经验。数据库只是载体，还需要更新、过期、检索和注入上下文的策略。

- [x] 已处理工具失败和部分空结果。
  编写资料研究助手时遇到维基百科 403 报错；代码会捕捉错误，并将“调用失败”回传模型。当前版本由模型决定是否降级回答或重试，但还没有明确的重试策略。
  RAG 引擎通过 Prompt 限制“检索不到时不编造”。不过 `retrieve.js` 目前总会返回 Top-K，没有相关度阈值；真正的空结果判断、重复调用去重和引用校验仍待补上。
  👉 [查看代码：answer.js (看里面的系统防幻觉 Prompt)](./stage-2-rag/src/answer.js)

- [x] 已在 Prompt 中要求 Agent 在回答里给出来源或证据。
  当前实现只要求模型输出引用链接或资料块编号，没有自动验证“链接是否真的支撑结论”；这部分还需要证据元数据和引用校验。
  👉 [查看代码：research_agent.js (最终输出带引用链接)](./research_agent.js)

---

# 本阶段产物

**产出 1**：一个资料研究助手，输入主题后搜索维基百科摘要、总结并按 Prompt 要求输出引用链接。
👉 [代码实现已产出：research_agent.js](./research_agent.js)

**产出 2**：一个手写 RAG 实验，包含切块、向量化、检索和问答。
👉 [代码实现已产出：stage-2-rag](./stage-2-rag/src/index.js)



接下来阅读一个相近的开源项目，结合已有资料研究助手理解可扩展的研究工作流。
https://github.com/assafelovic/gpt-researcher



完成上述内容后，仍然缺少一些能力：
- 上下文压缩与相关度阈值；
- 引用校验与工具调用去重；
- 持久化的会话记忆和长期记忆；
- 更多外部工具与数据源。
这些内容留到下一阶段的 Agent Harness 学习中继续思考。
