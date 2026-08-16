import OpenAI from 'openai'

// 1. 定义工具函数
function calculator(operation, a, b) {
  switch (operation) {
    case 'add':
      return String(a + b)

    case 'subtract':
      return String(a - b)

    case 'multiply':
      return String(a * b)

    case 'divide':
      return b !== 0 ? String(a / b) : 'Error: Division by zero'

    default:
      return 'Error: Unknown operation'
  }
}

// 2. 定义 OpenAI 兼容的工具 JSON Schema
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: '执行基本的数学运算（加减乘除）。',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['add', 'subtract', 'multiply', 'divide'],
            description: '要执行的运算类型',
          },
          a: {
            type: 'number',
            description: '第一个数字',
          },
          b: {
            type: 'number',
            description: '第二个数字',
          },
        },
        required: ['operation', 'a', 'b'],
        additionalProperties: false,
      },
    },
  },
]

// 3. 工具调用分发器
function executeToolCall(toolCall) {
  const functionName = toolCall.function.name

  let argumentsObject

  try {
    argumentsObject = JSON.parse(toolCall.function.arguments)
  } catch (error) {
    return 'Error: Failed to parse arguments as JSON.'
  }

  console.log(
    `  [系统执行] 调用工具: ${functionName}(${JSON.stringify(
      argumentsObject,
    )})`,
  )

  if (functionName === 'calculator') {
    return calculator(
      argumentsObject.operation,
      argumentsObject.a,
      argumentsObject.b,
    )
  }

  return `Error: Unknown tool ${functionName}`
}

// 创建一个带超时的 Promise
function withTimeout(promise, timeoutMilliseconds) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`请求超时，超过 ${timeoutMilliseconds} 毫秒`))
      }, timeoutMilliseconds)
    }),
  ])
}

// 4. Agent 主循环
async function runAgent(userQuery, { maxSteps = 5, timeoutSeconds = 60 } = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error(
      '未找到 DEEPSEEK_API_KEY，请先在环境变量中配置 DeepSeek API Key。',
    )
  }

  // 使用 OpenAI SDK 调用 DeepSeek 的 OpenAI 兼容接口
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com/v1',
  })

  // 初始化消息上下文
  const messages = [
    {
      role: 'system',
      content:
        '角色：AI 助手。根据问题决定是否调用工具，并基于工具结果回答。',
    },
    {
      role: 'user',
      content: userQuery,
    },
  ]

  const startTime = Date.now()

  console.log(`User: ${userQuery}`)

  // 5. Agent 循环
  for (let step = 1; step <= maxSteps; step++) {
    const elapsedSeconds = (Date.now() - startTime) / 1000

    // 6. 整体超时判断
    if (elapsedSeconds > timeoutSeconds) {
      console.error(
        `\n[Agent Error] 执行超时（超过 ${timeoutSeconds} 秒），已终止。`,
      )
      return
    }

    console.log(`\n--- 第 ${step} 步 ---`)

    try {
      const remainingMilliseconds = Math.max(
        1,
        timeoutSeconds * 1000 - (Date.now() - startTime),
      )

      // 7. 调用模型
      const response = await withTimeout(
        client.chat.completions.create({
          model: 'deepseek-chat',
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
        }),
        remainingMilliseconds,
      )

      const message = response.choices[0]?.message

      if (!message) {
        throw new Error('模型没有返回有效消息。')
      }

      // 只保存模型需要的标准字段
      messages.push({
        role: 'assistant',
        content: message.content ?? null,
        ...(message.tool_calls
          ? {
              tool_calls: message.tool_calls,
            }
          : {}),
      })

      // 8. 判断模型是否调用工具
      if (message.tool_calls?.length > 0) {
        console.log(
          `  [模型决定] 需要调用 ${message.tool_calls.length} 个工具。`,
        )

        for (const toolCall of message.tool_calls) {
          // 执行工具
          const toolResult = executeToolCall(toolCall)

          console.log(`  [工具返回] 结果: ${toolResult}`)

          // 9. 把工具结果放回上下文
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          })
        }

        // 继续下一轮，让模型读取工具结果
        continue
      }

      // 10. 没有工具调用，视为最终答案
      console.log('\n[最终答案] Agent:')
      console.log(message.content ?? '模型没有返回文本内容。')

      return message.content
    } catch (error) {
      console.error(
        `\n[Agent Error] 调用 API 时发生错误: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )

      return
    }
  }

  // 11. 达到最大步数
  console.error(
    `\n[Agent Error] 达到最大执行步数限制（${maxSteps} 步），未能得出最终结果。`,
  )
}

// 测试运行
const query = '请帮我算一下 2345 乘以 6789，然后再加上 1234 等于多少？'

runAgent(query).catch((error) => {
  console.error(
    `[程序错误] ${error instanceof Error ? error.message : String(error)}`,
  )
})
