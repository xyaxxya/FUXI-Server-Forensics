import { AIMessage, AISettings, Tool, ToolCall, sendToAI } from "./ai";

export interface ConversationLoopCallbacks {
  onAssistantMessage?: (response: AIMessage, history: AIMessage[], depth: number) => Promise<void> | void;
  onToolResult?: (
    toolCall: ToolCall,
    toolMessage: AIMessage,
    history: AIMessage[],
    depth: number,
  ) => Promise<void> | void;
  onStatusChange?: (status: string) => Promise<void> | void;
  onUsage?: (usage: NonNullable<AIMessage["usage"]>) => Promise<void> | void;
  onRoutingChange?: (response: AIMessage) => Promise<void> | void;
}

export interface ToolExecutionParams {
  toolCall: ToolCall;
  history: AIMessage[];
  depth: number;
  signal?: AbortSignal;
}

export interface ConversationLoopOptions {
  initialHistory: AIMessage[];
  settings: AISettings;
  tools?: Tool[];
  generalInfo?: string;
  signal?: AbortSignal;
  maxLoops?: number;
  loopLimitMessage?: AIMessage;
  prepareMessages?: (history: AIMessage[]) => AIMessage[];
  executeToolCall?: (params: ToolExecutionParams) => Promise<AIMessage>;
  callbacks?: ConversationLoopCallbacks;
}

export function applyUsageToSettings(
  settings: AISettings,
  usage: AIMessage["usage"],
): AISettings {
  if (!usage) {
    return settings;
  }

  const currentUsage = settings.tokenUsage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  return {
    ...settings,
    tokenUsage: {
      prompt_tokens: currentUsage.prompt_tokens + usage.prompt_tokens,
      completion_tokens: currentUsage.completion_tokens + usage.completion_tokens,
      total_tokens: currentUsage.total_tokens + usage.total_tokens,
    },
  };
}

function stripInternalThinking(content: string) {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function looksLikeActionPromiseWithoutTool(message: AIMessage) {
  if (message.role !== "assistant" || (message.tool_calls?.length ?? 0) > 0) {
    return false;
  }

  const content = stripInternalThinking(message.content).replace(/\s+/g, " ").trim();
  if (!content) {
    return true;
  }
  if (content.length > 700) {
    return false;
  }
  if (/(无法|不能|缺少|没有可用|未连接|请先|需要你|no .*available|missing|configure|connect .*first|permission denied)/i.test(content)) {
    return false;
  }

  return /(^|\s|[。！？.!?])(好的|收到|明白|可以|没问题|马上|立即|我会|我将|我来|我先|接下来|下一步|先帮你|让我|开始|Sure|Okay|Ok|Got it|I'll|I’ll|I will|I’m going to|I'm going to|Let me|Next,? I|I can help)/i.test(content);
}

function buildMissingToolRepairMessage(): AIMessage {
  return {
    role: "system",
    content:
      "上一条 assistant 回复只说明了准备行动，但没有调用任何工具。不要再次只承诺行动。" +
      "如果任务需要采集信息、执行命令、查询网页或读取数据库，请在下一条回复直接调用合适的工具；" +
      "只有在确实缺少连接、权限或必要输入时，才给出具体阻塞原因。",
  };
}

function formatToolExecutionError(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export async function runConversationLoop({
  initialHistory,
  settings,
  tools,
  generalInfo,
  signal,
  maxLoops,
  loopLimitMessage,
  prepareMessages,
  executeToolCall,
  callbacks,
}: ConversationLoopOptions): Promise<AIMessage[]> {
  let history = [...initialHistory];
  let depth = 0;
  let missingToolRepairCount = 0;
  const loopLimit = maxLoops ?? settings.maxLoops ?? 25;
  const missingToolRepairLimit = 2;

  while (depth <= loopLimit) {
    if (signal?.aborted) {
      return history;
    }

    const outboundHistory = prepareMessages ? prepareMessages(history) : history;
    const response = await sendToAI(outboundHistory, settings, tools, generalInfo, signal);

    history = [...history, response];
    await callbacks?.onRoutingChange?.(response);
    if (response.usage) {
      await callbacks?.onUsage?.(response.usage);
    }
    await callbacks?.onAssistantMessage?.(response, history, depth);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      if (executeToolCall && looksLikeActionPromiseWithoutTool(response) && missingToolRepairCount < missingToolRepairLimit) {
        missingToolRepairCount += 1;
        history = [...history, buildMissingToolRepairMessage()];
        await callbacks?.onStatusChange?.("Model promised action without calling a tool; requesting a concrete tool call...");
        depth += 1;
        continue;
      }
      return history;
    }

    if (!executeToolCall) {
      return history;
    }

    for (const toolCall of response.tool_calls) {
      if (signal?.aborted) {
        return history;
      }

      const toolMessage = await executeToolCall({
        toolCall,
        history,
        depth,
        signal,
      }).catch((error): AIMessage => ({
        role: "tool",
        content: `Tool execution failed for ${toolCall.function.name || "unknown_tool"}: ${formatToolExecutionError(error)}`,
        tool_call_id: toolCall.id,
      }));

      history = [...history, toolMessage];
      await callbacks?.onToolResult?.(toolCall, toolMessage, history, depth);
    }

    depth += 1;
  }

  return loopLimitMessage ? [...history, loopLimitMessage] : history;
}
