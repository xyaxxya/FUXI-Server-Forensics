import { buildSkillPackPrompt, detectAutoSkillRouting } from "../skills/forensicsSkillPacks";

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string; // For tool responses
  tool_calls?: ToolCall[]; // For assistant requests
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  routing_info?: {
    frameworks: string[];
    skill_ids: string[];
    status_text: string;
    phase: "probe" | "execute";
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export type AIProviderId = "fuxi" | "zhipu" | "openai" | "qwen" | "claude" | "kimi" | "gemini" | "ollama";

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
  maxTokens?: number; // New setting for maximum tokens per request
  configs: Record<AIProviderId, AIProviderConfig>;
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const DEFAULT_SETTINGS: AISettings = {
  activeProvider: "fuxi",
  enablePlanning: false,
  maxLoops: 25, // Default to 25
  maxConcurrentTasks: 3, // Default to 3
  maxTokens: 32768, // Default max tokens
  tokenUsage: {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0
  },
  configs: {
    fuxi: {
      id: "fuxi",
      name: "伏羲畅饮",
      apiKey: "sk-PHRYmaW8O2NJf5erJVc1DjKoM68M5fuviqw1iaQXtFUYIF8L",
      baseUrl: "https://linkapi.ai/v1",
      model: "gpt-5.3-codex",
    },
    zhipu: {
      id: "zhipu",
      name: "智谱 AI (GLM)",
      apiKey: "",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      model: "GLM-4.7-Flash",
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
    gemini: {
      id: "gemini",
      name: "Google Gemini",
      apiKey: "",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-1.5-pro",
    },
    ollama: {
      id: "ollama",
      name: "Ollama (Local)",
      apiKey: "ollama", // Ollama usually doesn't need a key, but we need non-empty string to pass check
      baseUrl: "http://localhost:11434/v1",
      model: "llama3",
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
- 我问什么，你答什么。
- 除非明确要求，否则不解释基础概念，专注于取证分析，严禁闲聊。
- **主动保留关键信息**：在分析过程中，一旦发现对后续分析有价值的关键信息（如：数据库账号密码、Webshell 路径、关键配置文件位置、特定软件版本、异常 IP 等），**必须立即主动调用** \`update_context_info\` 工具将其保存到上下文面板，不要等待用户指示。
- **集群感知**：对于集群环境（如 K8s, Hadoop, ElasticSearch），注意区分 Master/Node 节点。请先检查服务器列表中的备注（Note）信息，优先针对 Master 节点执行管理命令，针对 Node 节点执行数据/日志分析命令。利用 \`run_shell_command\` 的 \`target_ids\` 参数来指定特定服务器执行命令，避免无差别的全量扫描。

**回答格式约束**：
- 如果我提供了固定回答格式，你必须严格遵守
- 如果最终答案是关键信息、结论或值，直接将答案用 **加粗** 给出，不要有多余的解释
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
  generalInfo?: string,
  signal?: AbortSignal
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
        description: "在当前 SSH 会话中执行 Shell 命令。支持指定目标服务器执行。",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description:
                '要执行的 Shell 命令。支持管道、逻辑运算符 (&&, ||)。例如: "ls -la /var/log", "cd /tmp && ls", "ps aux | grep mysql"',
            },
            target_ids: {
              type: "array",
              items: { type: "string" },
              description: "Optional. List of session IDs to execute this command on. If not provided, executes on all selected servers. Use this to target specific nodes (e.g. only master node).",
            },
          },
          required: ["command"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_context_info",
        description: "Save CRITICAL findings (credentials, webshell paths, software versions, configs) to the global context panel immediately. Use this PROACTIVELY when you find something important.",
        parameters: {
          type: "object",
          properties: {
            info: {
              type: "string",
              description: "The information to save/append to context.",
            },
          },
          required: ["info"],
        },
      },
    },
  ];

  const tools = customTools !== undefined ? customTools : defaultTools;

  let effectiveMessages = [...messages];
  const autoRouting = detectAutoSkillRouting(messages, generalInfo);
  const autoSkillPrompt = buildSkillPackPrompt(autoRouting.selectedSkillIds, "zh");
  const lastUserContent = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const isSkillQuestion = /skills?|skill|调用.*skills|会调用什么|哪些skills|有什么skills|调用了哪些|可调用能力/.test(lastUserContent.toLowerCase());

  if (isSkillQuestion) {
      const frameworkText = autoRouting.frameworks.length ? autoRouting.frameworks.join(" / ") : "未识别特定框架";
      const skillText = autoRouting.selectedSkillNames.length ? autoRouting.selectedSkillNames.join("、") : "默认取证策略";
      return {
        role: "assistant",
        content: `当前自动路由结果：${autoRouting.statusText}\n识别框架：${frameworkText}\n将调用 skills：${skillText}\n当前阶段：${autoRouting.phase === "probe" ? "阶段1 只读探测" : "阶段2 技能执行"}`,
        routing_info: {
          frameworks: autoRouting.frameworks,
          skill_ids: autoRouting.selectedSkillIds,
          status_text: autoRouting.statusText,
          phase: autoRouting.phase,
        },
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        }
      };
  }

  if (autoSkillPrompt) {
      const phaseInstruction = autoRouting.phase === "probe"
        ? `\n\n**两阶段策略-当前阶段**：阶段1（只读探测）。你必须仅执行只读命令收集框架证据，并在证据不足时优先探测，不执行破坏性写操作。`
        : `\n\n**两阶段策略-当前阶段**：阶段2（技能执行）。已识别框架，按已路由skills执行分析/重构步骤。`;
      const skillQaInstruction = `\n\n**技能问答约束**：当用户询问“你会调用什么skills/调用了哪些skills”时，你必须基于当前自动路由结果作答，明确列出：${autoRouting.selectedSkillNames.join("、")}；不要回答泛化能力清单。`;
      const routeInfoMsg = `\n\n**自动技能路由**：${autoRouting.statusText}${autoSkillPrompt}${phaseInstruction}${skillQaInstruction}`;
      const systemIndex = effectiveMessages.findIndex(m => m.role === 'system');
      if (systemIndex !== -1) {
          effectiveMessages[systemIndex] = {
              ...effectiveMessages[systemIndex],
              content: effectiveMessages[systemIndex].content + routeInfoMsg
          };
      } else {
          effectiveMessages.unshift({
              role: 'system',
              content: SYSTEM_PROMPT + routeInfoMsg
          });
      }
  }

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
      max_tokens: settings.maxTokens || 32768,
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
        signal,
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Claude API Error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      const textContent =
        (Array.isArray(data.content) ? (data.content.find((c: any) => c.type === "text")?.text || "") : "") || "";
      const toolUses = Array.isArray(data.content) ? data.content.filter((c: any) => c.type === "tool_use") : [];

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
        usage: {
          prompt_tokens: data.usage?.input_tokens || 0,
          completion_tokens: data.usage?.output_tokens || 0,
          total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        },
        routing_info: {
          frameworks: autoRouting.frameworks,
          skill_ids: autoRouting.selectedSkillIds,
          status_text: autoRouting.statusText,
          phase: autoRouting.phase,
        }
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
    max_tokens: settings.maxTokens || 32768,
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
      signal,
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
      usage: data.usage ? {
        prompt_tokens: data.usage.prompt_tokens || 0,
        completion_tokens: data.usage.completion_tokens || 0,
        total_tokens: data.usage.total_tokens || 0,
      } : undefined,
      routing_info: {
        frameworks: autoRouting.frameworks,
        skill_ids: autoRouting.selectedSkillIds,
        status_text: autoRouting.statusText,
        phase: autoRouting.phase,
      }
    };
  } catch (error: any) {
    console.error("AI Request Failed:", error);
    throw error;
  }
}
