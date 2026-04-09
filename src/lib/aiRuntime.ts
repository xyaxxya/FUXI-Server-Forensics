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
  const loopLimit = maxLoops ?? settings.maxLoops ?? 25;

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
      });

      history = [...history, toolMessage];
      await callbacks?.onToolResult?.(toolCall, toolMessage, history, depth);
    }

    depth += 1;
  }

  return loopLimitMessage ? [...history, loopLimitMessage] : history;
}
