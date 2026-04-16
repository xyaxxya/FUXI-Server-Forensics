import { ToolDefinition, RegisteredTool, ToolInput, ToolOutput, ToolExecutionContext } from './types';

class ToolManager {
  private tools: Map<string, RegisteredTool> = new Map();
  private toolCache: Map<string, { result: ToolOutput; timestamp: number }> = new Map();

  /**
   * 注册工具
   */
  registerTool(tool: ToolDefinition): void {
    const toolId = tool.metadata.name.toLowerCase().replace(/\s+/g, '_');
    this.tools.set(toolId, {
      definition: tool,
      id: toolId,
      version: tool.metadata.version,
      registeredAt: new Date()
    });
  }

  /**
   * 注册多个工具
   */
  registerTools(tools: ToolDefinition[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }

  /**
   * 获取工具
   */
  getTool(toolId: string): RegisteredTool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * 获取所有工具
   */
  getAllTools(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按类别获取工具
   */
  getToolsByCategory(category: string): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(tool => 
      tool.definition.metadata.category === category
    );
  }

  /**
   * 按权限级别获取工具
   */
  getToolsByPermission(permissions: string[]): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(tool => {
      const dangerLevel = tool.definition.metadata.dangerLevel || 'low';
      if (dangerLevel === 'high' && !permissions.includes('admin')) {
        return false;
      }
      if (dangerLevel === 'medium' && !['admin', 'execute'].some(p => permissions.includes(p))) {
        return false;
      }
      return true;
    });
  }

  /**
   * 执行工具
   */
  async executeTool(toolId: string, input: ToolInput, context?: ToolExecutionContext): Promise<ToolOutput> {
    const tool = this.getTool(toolId);
    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolId} not found`
      };
    }

    // 检查权限
    if (tool.definition.metadata.requiresApproval && context) {
      const hasPermission = context.permissions.some(p => ['admin', 'execute'].includes(p));
      if (!hasPermission) {
        return {
          success: false,
          error: 'Permission denied'
        };
      }
    }

    // 检查依赖
    if (tool.definition.metadata.dependencies) {
      for (const depId of tool.definition.metadata.dependencies) {
        if (!this.hasTool(depId)) {
          return {
            success: false,
            error: `Dependency ${depId} not found`
          };
        }
      }
    }

    // 验证输入
    if (tool.definition.schema) {
      try {
        tool.definition.schema.parse(input);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Invalid tool input'
        };
      }
    } else if (tool.definition.validate && !tool.definition.validate(input)) {
      return {
        success: false,
        error: 'Invalid tool input'
      };
    }

    // 生成缓存键
    const cacheKey = `${toolId}:${JSON.stringify(input)}`;
    const cached = this.toolCache.get(cacheKey);
    const cacheExpiry = 5 * 60 * 1000; // 5分钟缓存

    // 检查缓存
    if (cached && (Date.now() - cached.timestamp) < cacheExpiry) {
      return {
        ...cached.result,
        executionTime: 0
      };
    }

    // 设置超时
    const timeout = context?.timeout || tool.definition.metadata.timeout || 30000; // 默认30秒
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        tool.definition.execute(input),
        new Promise<ToolOutput>((_, reject) => {
          setTimeout(() => reject(new Error('Tool execution timed out')), timeout);
        })
      ]);

      const executionTime = Date.now() - startTime;
      const output = {
        ...result,
        executionTime
      };

      // 缓存结果
      this.toolCache.set(cacheKey, {
        result: output,
        timestamp: Date.now()
      });

      return output;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 检查工具是否存在
   */
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * 移除工具
   */
  removeTool(toolId: string): boolean {
    return this.tools.delete(toolId);
  }

  /**
   * 清空所有工具
   */
  clearTools(): void {
    this.tools.clear();
    this.toolCache.clear();
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.toolCache.clear();
  }

  /**
   * 获取工具数量
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.toolCache.size;
  }
}

// 导出单例实例
export const toolManager = new ToolManager();
