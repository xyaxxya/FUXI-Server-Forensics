import { AIMessage, AISettings } from './ai';
import { QueryEngine } from './queryEngine';
import { toolManager } from './tools';

interface Task {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  dependencies?: string[];
  estimatedTime?: number; // 估计完成时间（秒）
  actualTime?: number; // 实际完成时间（秒）
  result?: any;
  error?: string;
}

interface ExecutionPlan {
  id: string;
  name: string;
  tasks: Task[];
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'in_progress' | 'completed' | 'failed';
  metadata: {
    [key: string]: any;
  };
}

interface TaskPlannerOptions {
  settings: AISettings;
  queryEngine: QueryEngine;
  onTaskStatusChange?: (task: Task) => void;
  onPlanStatusChange?: (plan: ExecutionPlan) => void;
  onTaskStart?: (task: Task) => void;
  onTaskComplete?: (task: Task) => void;
  onTaskFail?: (task: Task) => void;
}

export class TaskPlanner {
  private options: TaskPlannerOptions;
  private currentPlan: ExecutionPlan | null = null;

  constructor(options: TaskPlannerOptions) {
    this.options = options;
  }

  /**
   * 生成执行计划
   */
  async generatePlan(taskDescription: string, context?: string): Promise<ExecutionPlan> {
    // 构建提示词
    const prompt = this.buildPlanningPrompt(taskDescription, context);

    // 创建初始消息
    const initialMessage: AIMessage = {
      role: 'user',
      content: prompt
    };

    // 执行查询
    const history = await this.options.queryEngine.execute(initialMessage);

    // 解析AI的响应，生成计划
    const plan = this.parsePlanFromResponse(history, taskDescription);
    this.currentPlan = plan;

    // 通知计划状态变化
    this.options.onPlanStatusChange?.(plan);

    return plan;
  }

  /**
   * 执行计划
   */
  async executePlan(plan: ExecutionPlan = this.currentPlan!): Promise<ExecutionPlan> {
    if (!plan) {
      throw new Error('No plan to execute');
    }

    // 更新计划状态
    plan.status = 'in_progress';
    plan.updatedAt = Date.now();
    this.options.onPlanStatusChange?.(plan);

    // 执行任务
    for (const task of plan.tasks) {
      // 检查任务依赖
      if (!this.checkTaskDependencies(task, plan.tasks)) {
        task.status = 'failed';
        task.error = 'Dependencies not met';
        this.options.onTaskFail?.(task);
        continue;
      }

      // 执行任务
      task.status = 'in_progress';
      this.options.onTaskStatusChange?.(task);
      this.options.onTaskStart?.(task);

      const startTime = Date.now();

      try {
        // 构建任务执行提示词
        const prompt = this.buildTaskExecutionPrompt(task.content);

        // 创建任务执行消息
        const taskMessage: AIMessage = {
          role: 'user',
          content: prompt
        };

        // 执行任务
        const history = await this.options.queryEngine.execute(taskMessage);

        // 评估任务结果
        const result = this.evaluateTaskResult(history);
        task.result = result;
        task.status = 'completed';
        task.actualTime = (Date.now() - startTime) / 1000;
        this.options.onTaskComplete?.(task);
      } catch (error) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : 'Task execution failed';
        this.options.onTaskFail?.(task);
      }

      task.status = task.status;
      this.options.onTaskStatusChange?.(task);
    }

    // 更新计划状态
    const allCompleted = plan.tasks.every(t => t.status === 'completed');
    const anyFailed = plan.tasks.some(t => t.status === 'failed');

    if (allCompleted) {
      plan.status = 'completed';
    } else if (anyFailed) {
      plan.status = 'failed';
    }

    plan.updatedAt = Date.now();
    this.options.onPlanStatusChange?.(plan);

    return plan;
  }

  /**
   * 构建规划提示词
   */
  private buildPlanningPrompt(taskDescription: string, context?: string): string {
    return `
你是一名专业的任务规划师，擅长将复杂任务分解为可执行的子任务。

请根据以下任务描述，生成一个详细的执行计划：

任务描述：${taskDescription}

${context ? `上下文信息：${context}` : ''}

请按照以下格式输出执行计划：

# 执行计划

## 任务分解

1. 任务1：[任务描述]
   - 优先级：[low/medium/high]
   - 依赖：[依赖任务ID，如无依赖则写"无"]
   - 估计时间：[估计完成时间，单位秒]

2. 任务2：[任务描述]
   - 优先级：[low/medium/high]
   - 依赖：[依赖任务ID，如无依赖则写"无"]
   - 估计时间：[估计完成时间，单位秒]

...

## 执行顺序

[说明任务的执行顺序和逻辑]

## 预期结果

[描述预期的执行结果]
`;
  }

  /**
   * 构建任务执行提示词
   */
  private buildTaskExecutionPrompt(taskContent: string): string {
    return `
请执行以下任务：

任务：${taskContent}

请按照以下步骤执行：
1. 分析任务需求
2. 确定需要使用的工具
3. 执行必要的工具调用
4. 评估执行结果
5. 提供详细的执行报告

可用工具：
${this.getAvailableToolsDescription()}
`;
  }

  /**
   * 获取可用工具描述
   */
  private getAvailableToolsDescription(): string {
    const tools = toolManager.getAllTools();
    return tools.map(tool => {
      const def = tool.definition;
      return `- ${def.metadata.name}: ${def.metadata.description}`;
    }).join('\n');
  }

  /**
   * 从AI响应中解析计划
   */
  private parsePlanFromResponse(history: AIMessage[], taskDescription: string): ExecutionPlan {
    // 从历史记录中获取AI的最后一个响应
    const lastMessage = history.find(m => m.role === 'assistant');
    const content = lastMessage?.content || '';

    // 解析任务
    const tasks: Task[] = [];
    const taskMatches = content.match(/\d+\. 任务\d+：(.+?)\n\s+- 优先级：(.+?)\n\s+- 依赖：(.+?)\n\s+- 估计时间：(.+?)秒/g);

    if (taskMatches) {
      taskMatches.forEach((match, index) => {
        const taskMatch = match.match(/\d+\. 任务\d+：(.+?)\n\s+- 优先级：(.+?)\n\s+- 依赖：(.+?)\n\s+- 估计时间：(.+?)秒/);
        if (taskMatch) {
          const dependencies = taskMatch[3].trim() === '无' ? [] : taskMatch[3].trim().split(',').map(d => d.trim());
          tasks.push({
            id: `task_${index + 1}`,
            content: taskMatch[1].trim(),
            status: 'pending',
            priority: taskMatch[2].trim() as 'low' | 'medium' | 'high',
            dependencies,
            estimatedTime: parseInt(taskMatch[4].trim())
          });
        }
      });
    }

    // 如果没有解析到任务，创建默认任务
    if (tasks.length === 0) {
      tasks.push({
        id: 'task_1',
        content: taskDescription,
        status: 'pending',
        priority: 'medium'
      });
    }

    return {
      id: `plan_${Date.now()}`,
      name: `执行计划: ${taskDescription.substring(0, 50)}...`,
      tasks,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'draft',
      metadata: {}
    };
  }

  /**
   * 检查任务依赖
   */
  private checkTaskDependencies(task: Task, allTasks: Task[]): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      return depTask && depTask.status === 'completed';
    });
  }

  /**
   * 评估任务结果
   */
  private evaluateTaskResult(history: AIMessage[]): any {
    // 从历史记录中提取结果
    const toolResults = history.filter(m => m.role === 'tool');
    const assistantMessages = history.filter(m => m.role === 'assistant');

    return {
      toolResults: toolResults.map(m => m.content),
      assistantResponses: assistantMessages.map(m => m.content),
      finalResponse: assistantMessages[assistantMessages.length - 1]?.content
    };
  }

  /**
   * 获取当前计划
   */
  getCurrentPlan(): ExecutionPlan | null {
    return this.currentPlan;
  }

  /**
   * 设置当前计划
   */
  setCurrentPlan(plan: ExecutionPlan): void {
    this.currentPlan = plan;
  }

  /**
   * 取消执行
   */
  cancelExecution(): void {
    this.options.queryEngine.abort();
  }
}
