import { AIMessage, AISettings, Tool, ToolCall, sendToAI } from './ai';
import { toolManager } from './tools';

interface QueryEngineOptions {
  settings: AISettings;
  tools?: Tool[];
  generalInfo?: string;
  signal?: AbortSignal;
  maxLoops?: number;
  maxTokens?: number;
  onMessage?: (message: AIMessage) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolResult?: (toolCall: ToolCall, result: AIMessage) => void;
  onStatusChange?: (status: string) => void;
  onUsage?: (usage: NonNullable<AIMessage['usage']>) => void;
  onError?: (error: Error) => void;
}

interface QueryEngineState {
  history: AIMessage[];
  currentDepth: number;
  isRunning: boolean;
  lastUsage: NonNullable<AIMessage['usage']> | null;
}

export class QueryEngine {
  private options: QueryEngineOptions;
  private state: QueryEngineState;
  private abortController: AbortController;

  constructor(options: QueryEngineOptions) {
    this.options = options;
    this.state = {
      history: [],
      currentDepth: 0,
      isRunning: false,
      lastUsage: null
    };
    this.abortController = new AbortController();
  }

  /**
   * 执行查询
   */
  async execute(initialMessage: AIMessage): Promise<AIMessage[]> {
    if (this.state.isRunning) {
      throw new Error('Query engine is already running');
    }

    this.state.isRunning = true;
    this.state.history = [initialMessage];
    this.state.currentDepth = 0;

    try {
      const result = await this.runQueryLoop();
      return result;
    } catch (error) {
      this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
      return this.state.history;
    } finally {
      this.state.isRunning = false;
    }
  }

  /**
   * 运行查询循环
   */
  private async runQueryLoop(): Promise<AIMessage[]> {
    const maxLoops = this.options.maxLoops ?? this.options.settings.maxLoops ?? 30;
    
    while (this.state.currentDepth < maxLoops) {
      if (this.abortController.signal.aborted) {
        return this.state.history;
      }

      try {
        // 发送消息到 AI
        this.options.onStatusChange?.('Sending message to AI');
        const response = await sendToAI(
          this.state.history,
          this.options.settings,
          this.options.tools,
          this.options.generalInfo,
          this.abortController.signal
        );

        // 处理响应
        this.state.history.push(response);
        this.options.onMessage?.(response);
        
        // 处理 usage
        if (response.usage) {
          this.state.lastUsage = response.usage;
          this.options.onUsage?.(response.usage);
        }

        // 检查是否有工具调用
        if (response.tool_calls && response.tool_calls.length > 0) {
          for (const toolCall of response.tool_calls) {
            this.options.onToolCall?.(toolCall);
            const toolResult = await this.executeTool(toolCall);
            this.state.history.push(toolResult);
            this.options.onToolResult?.(toolCall, toolResult);
          }
        } else {
          // 没有工具调用，结束循环
          return this.state.history;
        }

        this.state.currentDepth++;
      } catch (error) {
        this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
        // 重试逻辑
        await this.handleRetry(error);
      }
    }

    // 达到最大循环次数
    const loopLimitMessage: AIMessage = {
      role: 'assistant',
      content: '已达到最大交互次数，对话结束。'
    };
    this.state.history.push(loopLimitMessage);
    this.options.onMessage?.(loopLimitMessage);
    
    return this.state.history;
  }

  /**
   * 执行工具调用
   */
  private async executeTool(toolCall: ToolCall): Promise<AIMessage> {
    try {
      this.options.onStatusChange?.(`Executing tool: ${toolCall.function.name}`);
      
      // 解析工具参数
      let toolArgs: any = {};
      try {
        toolArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        toolArgs = {};
      }

      // 执行工具
      const result = await toolManager.executeTool(toolCall.function.name, toolArgs);

      // 构建工具响应消息
      const toolMessage: AIMessage = {
        role: 'tool',
        content: result.success 
          ? JSON.stringify(result.data || {}) 
          : JSON.stringify({ error: result.error }),
        tool_call_id: toolCall.id
      };

      return toolMessage;
    } catch (error) {
      // 构建错误响应
      const errorMessage: AIMessage = {
        role: 'tool',
        content: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool execution failed' }),
        tool_call_id: toolCall.id
      };

      return errorMessage;
    }
  }

  /**
   * 处理重试逻辑
   */
  private async handleRetry(error: any): Promise<void> {
    // 简单的重试逻辑，实际应用中可以更复杂
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * 中止查询
   */
  abort(): void {
    this.abortController.abort();
  }

  /**
   * 获取当前状态
   */
  getState(): QueryEngineState {
    return { ...this.state };
  }

  /**
   * 获取历史记录
   */
  getHistory(): AIMessage[] {
    return [...this.state.history];
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      history: [],
      currentDepth: 0,
      isRunning: false,
      lastUsage: null
    };
    this.abortController = new AbortController();
  }
}
