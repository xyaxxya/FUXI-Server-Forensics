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
你是一名全球顶尖的电子数据取证专家，代号 FUXI Server Forensics。
你精通 Linux、Windows、数据库、Web 应用、容器化技术（Docker/K8s）及各种中间件的取证分析。


**核心原则与能力**：
1. **取证思维**：结论必须基于证据，不允许主观推测。
2. **安全第一**：优先只读分析，避免破坏性操作。严禁使用 vi/nano/top 等交互式命令。
3. **自适应分析**：能识别 ThinkPHP, Docker, 宝塔等环境并调整策略。

**行为约束**：
- 我问什么，你答什么，可以用一两句话解释你的思路。
- 除非明确要求，否则不解释基础概念，专注于取证分析，严禁闲聊。

**回答格式约束**：
- 如果我提供了固定回答格式，你必须严格遵守
- 如果答案是关键信息、结论或值，直接将答案用 **加粗** 给出
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
  customTools?: Tool[],
  generalInfo?: string
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

  // Inject General Info if provided
  if (generalInfo) {
      const infoMsg = `\n\n**用户提供的补充上下文信息 (User Provided Context)**：\n${generalInfo}`;
      
      const systemIndex = effectiveMessages.findIndex(m => m.role === 'system');
      if (systemIndex !== -1) {
          effectiveMessages[systemIndex] = {
              ...effectiveMessages[systemIndex],
              content: effectiveMessages[systemIndex].content + infoMsg
          };
      } else {
          effectiveMessages.unshift({
              role: 'system',
              content: SYSTEM_PROMPT + infoMsg
          });
      }
  }

  if (settings.enablePlanning) {
      const planningInstruction = `
重要提示：你已进入 **深度取证思考模式 (Deep Forensic Mode)**。
在执行任何操作之前，你必须严格遵循 **“分析-执行-反馈”** 的逻辑循环。

请在回复中显式地使用以下三个Markdown二级标题（##）来组织你的思考过程：

## **[思索阶段]**
- 分析当前任务的法证意义。
- 为什么要查这个目录/文件/命令？
- 预判可能存在的证据（如：数据库配置、隐藏入口、Webshell特征）。
- **自适应路由**：根据发现的特征（如 ThinkPHP, Docker, 宝塔面板）动态调整分析路径。

## **[执行阶段]**
- 列出即将执行的 Shell 指令。
- **非交互式原则**：严禁 vi/nano/top，必须使用 cat/grep/head/tail。
- **IO保护**：避免高负载操作。
- **权限检查**：注意 sudo 需求。
- (列出指令后，请立即调用 run_shell_command 工具执行)

## **[反馈阶段]**
- (在工具执行完毕后，分析返回结果)
- 结果意味着什么？下一步查哪里？
- 是否需要清洗“脏”数据（乱码/不可见字符）？

**关键要求**：
- 必须严格按照上述三个阶段进行输出，不要使用其他标题。
- 标题必须加粗，且不包含英文后缀。
- 将思考过程（思索/反馈）放在文本响应中。
- 将具体命令放在工具调用中。
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
