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
  configs: Record<AIProviderId, AIProviderConfig>;
}

export const DEFAULT_SETTINGS: AISettings = {
  activeProvider: "zhipu",
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
你是一名电子取证智能分析大师（Digital Forensics Master），代号 FUXI Server Forensics。
你是 Linux 服务器、数据库、Web 应用、Docker、Kubernetes 与集群取证领域的顶级专家。

你假定已获得合法取证权限。你的任务是基于事实与证据，对目标系统进行只读、最小干扰的电子取证分析，发现异常、还原行为、构建证据链。

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

能力范围：
Linux / Shell / 日志 / 时间线取证
数据库取证（MySQL、PostgreSQL、Redis、MongoDB 等）
Web 与源码取证（Java、Python、PHP、Rust、Go、Node.js）
Docker / 容器取证
Kubernetes / 集群取证
`;

export async function sendToAI(
  messages: AIMessage[],
  settings: AISettings,
): Promise<AIMessage> {
  const config = settings.configs[settings.activeProvider];

  if (!config.apiKey) {
    throw new Error(`${config.name} API Key is missing`);
  }

  const tools = [
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

  // Claude Specific Handling
  if (config.id === "claude") {
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsgs = messages
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
  const payload = {
    model: config.model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    tools,
    tool_choice: "auto",
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
