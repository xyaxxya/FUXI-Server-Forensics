export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string; // For tool responses
  tool_calls?: ToolCall[]; // For assistant requests
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export type AIProviderId = "zhipu" | "openai" | "qwen" | "claude" | "kimi";

export interface AIProviderConfig {
  id: AIProviderId;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AISettings {
  activeProvider: AIProviderId;
  enablePlanning?: boolean;
  maxLoops?: number; // New setting for maximum interaction loops
  maxConcurrentTasks?: number; // New setting for maximum concurrent tasks in batch
  configs: Record<AIProviderId, AIProviderConfig>;
}

export const DEFAULT_SETTINGS: AISettings = {
  activeProvider: "zhipu",
  enablePlanning: false,
  maxLoops: 25, // Default to 25
  maxConcurrentTasks: 3, // Default to 3
  configs: {
    zhipu: {
      id: "zhipu",
      name: "智谱 AI (GLM)",
      apiKey: "",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      model: "glm-4",
    },
    openai: {
      id: "openai",
      name: "OpenAI",
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
    },
    qwen: {
      id: "qwen",
      name: "通义千问 (Qwen)",
      apiKey: "",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-plus",
    },
    claude: {
      id: "claude",
      name: "Claude (Anthropic)",
      apiKey: "",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-3-5-sonnet-20240620",
    },
    kimi: {
      id: "kimi",
      name: "Kimi (Moonshot)",
      apiKey: "",
      baseUrl: "https://api.moonshot.cn/v1",
      model: "moonshot-v1-8k",
    },
  },
};

const SYSTEM_PROMPT = `
你是一名专业的电子数据取证顶级专家，代号 FUXI Server Forensics。
Linux 服务器、数据库、Web 应用、各种面板、Docker、Kubernetes 与集群全部精通。

你已获得合法取证权限。你的任务是对目标系统进行执行了相关的Linux命令，来解决我提出的专业问题。

行为约束如下：
我问什么，你答什么；不主动扩展、不教学、不闲聊
结论必须基于证据，不允许主观推测
优先只读分析，避免破坏性操作
命令只在被要求时给出
不重复问题，不总结未被要求的内容

回答格式约束：
如果我提供了固定回答格式，你必须严格遵守
如果答案是关键信息、结论或值，直接将答案用 加粗 给出
除非我明确要求解释，否则不解释

`;

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export async function sendToAI(
  messages: AIMessage[],
  settings: AISettings,
  customTools?: Tool[]
): Promise<AIMessage> {
  const config = settings.configs[settings.activeProvider];

  if (!config.apiKey) {
    throw new Error(`${config.name} API Key is missing`);
  }

  const defaultTools: Tool[] = [
    {
      type: "function",
      function: {
        name: "run_shell_command",
        description: "在当前 SSH 会话中执行 Shell 命令 (支持 cd 目录保持)",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description:
                '要执行的 Shell 命令。支持管道、逻辑运算符 (&&, ||)。例如: "ls -la /var/log", "cd /tmp && ls", "ps aux | grep mysql"',
            },
          },
          required: ["command"],
        },
      },
    },
  ];

  const tools = customTools !== undefined ? customTools : defaultTools;

  // Inject Planning Mode Instruction if enabled
  let effectiveMessages = [...messages];
  if (settings.enablePlanning) {
      const planningInstruction = `
重要提示：规划模式已启用。
在执行任何操作之前，你必须严格遵循以下思考过程：

1. **分析 (Analysis)**：简要分析用户的请求和当前上下文（使用中文）。
2. **规划 (Plan)**：列出你将要采取的具体解决步骤（使用中文）。
3. **执行 (Execution)**：只有在提供了分析和规划之后，才开始调用必要的工具。

**关键要求**：
- 你必须在响应的 content 字段中输出“分析”和“规划”部分。
- 调用工具时，content 字段绝对不能通过为空。
- 请将你的思考过程放在文本响应中，将具体命令放在工具调用中。
`;
      // Insert after system prompt or as a system message if one exists, otherwise prepend
      const systemIndex = effectiveMessages.findIndex(m => m.role === 'system');
      if (systemIndex !== -1) {
          // Append to existing system prompt
          effectiveMessages[systemIndex] = {
              ...effectiveMessages[systemIndex],
              content: effectiveMessages[systemIndex].content + "\n\n" + planningInstruction
          };
      } else {
          // Prepend new system message (though usually there is one passed from caller, but just in case)
          effectiveMessages.unshift({
              role: 'system',
              content: SYSTEM_PROMPT + "\n\n" + planningInstruction
          });
      }
  }

  // Claude Specific Handling
  if (config.id === "claude") {
    const systemMsg = effectiveMessages.find((m) => m.role === "system");
    const userMsgs = effectiveMessages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "tool" ? "user" : m.role, // Claude doesn't strictly have 'tool' role in input messages same way, but for simplicity mapping tool outputs needs care.
        // Actually Claude tool use flow:
        // Assistant: tool_use block
        // User: tool_result block
        // We need to map 'tool' role to 'user' role with content block type 'tool_result'
        content:
          m.role === "tool"
            ? [
                {
                  type: "tool_result",
                  tool_use_id: m.tool_call_id,
                  content: m.content,
                },
              ]
            : m.content,
      }));

    // Claude tools format
    const claudeTools = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));

    const payload = {
      model: config.model,
      max_tokens: 4096,
      system: systemMsg?.content || SYSTEM_PROMPT,
      messages: userMsgs,
      tools: claudeTools,
    };

    try {
      const response = await fetch(`${config.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "dangerously-allow-browser": "true", // Only for dev/local apps
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Claude API Error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      const textContent =
        data.content.find((c: any) => c.type === "text")?.text || "";
      const toolUses = data.content.filter((c: any) => c.type === "tool_use");

      const tool_calls = toolUses.map((t: any) => ({
        id: t.id,
        type: "function",
        function: {
          name: t.name,
          arguments: JSON.stringify(t.input),
        },
      }));

      return {
        role: "assistant",
        content: textContent,
        tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
      };
    } catch (error) {
      console.error("Claude Request Failed:", error);
      throw error;
    }
  }

  // OpenAI Compatible (Zhipu, OpenAI, Qwen, Kimi)
  // Ensure system prompt is present
  let finalMessages = effectiveMessages;
  if (!finalMessages.some((m) => m.role === "system")) {
    finalMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...finalMessages];
  }

  const payload = {
    model: config.model,
    messages: finalMessages,
    ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
  };

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    return {
      role: message.role,
      content: message.content || "",
      tool_calls: message.tool_calls,
    };
  } catch (error: any) {
    console.error("AI Request Failed:", error);
    throw error;
  }
}
