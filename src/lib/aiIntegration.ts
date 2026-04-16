import { AIMessage, AISettings, serverForensicsTools, buildServerForensicsToolExecution } from './ai';
import { toolManager, initToolSystem } from './tools';
import { QueryEngine } from './queryEngine';
import { sessionManager } from './sessionManager';
import { TaskPlanner } from './taskPlanner';
import { IntelligentAnalyzer } from './intelligentAnalyzer';
import { forensicsCommands } from '../plugins/forensics';

interface AIIntegrationOptions {
  settings: AISettings;
}

export class AIIntegration {
  private settings: AISettings;
  private queryEngine: QueryEngine;
  private taskPlanner: TaskPlanner;
  private intelligentAnalyzer: IntelligentAnalyzer;

  constructor(options: AIIntegrationOptions) {
    this.settings = options.settings;
    
    // 初始化工具系统
    initToolSystem();
    
    // 初始化查询引擎
    this.queryEngine = new QueryEngine({
      settings: this.settings,
      tools: serverForensicsTools
    });
    
    // 初始化任务规划器
    this.taskPlanner = new TaskPlanner({
      settings: this.settings,
      queryEngine: this.queryEngine
    });
    
    // 初始化智能分析器
    this.intelligentAnalyzer = new IntelligentAnalyzer(this.settings);
  }

  /**
   * 执行 AI 分析
   */
  async executeAnalysis(prompt: string, targetIds?: string[]): Promise<AIMessage[]> {
    // 创建初始消息
    const initialMessage: AIMessage = {
      role: 'user',
      content: prompt
    };

    // 执行查询
    const history = await this.queryEngine.execute(initialMessage);
    
    // 保存到会话
    await sessionManager.addMessageToCurrentSession(initialMessage);
    for (const message of history.slice(1)) {
      await sessionManager.addMessageToCurrentSession(message);
    }

    return history;
  }

  /**
   * 生成并执行任务计划
   */
  async generateAndExecutePlan(taskDescription: string, context?: string): Promise<any> {
    // 生成计划
    const plan = await this.taskPlanner.generatePlan(taskDescription, context);
    
    // 执行计划
    const executedPlan = await this.taskPlanner.executePlan(plan);
    
    return executedPlan;
  }

  /**
   * 分析服务器状态
   */
  async analyzeServerStatus(targetIds?: string[]): Promise<any> {
    return this.intelligentAnalyzer.analyzeServerStatus(targetIds);
  }

  /**
   * 执行取证命令
   */
  async executeForensicsCommand(commandId: string, targetIds?: string[]): Promise<any> {
    // 查找命令
    const command = forensicsCommands.find(cmd => cmd.id === commandId);
    if (!command) {
      throw new Error(`Command ${commandId} not found`);
    }

    // 执行命令
    const result = await toolManager.executeTool('run_command', {
      command_type: command.id,
      target_ids: targetIds
    });

    return result;
  }

  /**
   * 获取所有可用工具
   */
  getAvailableTools() {
    return toolManager.getAllTools();
  }

  /**
   * 获取所有取证命令
   */
  getForensicsCommands() {
    return forensicsCommands;
  }

  /**
   * 创建新会话
   */
  async createSession(name: string, initialMessage?: AIMessage) {
    return sessionManager.createSession(name, initialMessage);
  }

  /**
   * 加载会话
   */
  async loadSession(id: string) {
    return sessionManager.loadSession(id);
  }

  /**
   * 列出所有会话
   */
  async listSessions() {
    return sessionManager.listSessions();
  }

  /**
   * 获取当前会话
   */
  getCurrentSession() {
    return sessionManager.getCurrentSession();
  }

  /**
   * 更新设置
   */
  updateSettings(settings: AISettings) {
    this.settings = settings;
    // 重新初始化相关组件
    this.queryEngine = new QueryEngine({
      settings: this.settings,
      tools: serverForensicsTools
    });
    this.taskPlanner = new TaskPlanner({
      settings: this.settings,
      queryEngine: this.queryEngine
    });
    this.intelligentAnalyzer = new IntelligentAnalyzer(this.settings);
  }

  /**
   * 获取设置
   */
  getSettings() {
    return this.settings;
  }
}

// 导出单例实例
let aiIntegrationInstance: AIIntegration | null = null;

export function getAIIntegration(settings: AISettings): AIIntegration {
  if (!aiIntegrationInstance) {
    aiIntegrationInstance = new AIIntegration({ settings });
  } else {
    aiIntegrationInstance.updateSettings(settings);
  }
  return aiIntegrationInstance;
}
