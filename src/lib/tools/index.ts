import { toolManager } from './toolManager';
import { coreTools } from './coreTools';
import { ToolDefinition, RegisteredTool } from './types';

// 初始化工具系统
export function initToolSystem(): void {
  // 注册核心工具
  toolManager.registerTools(coreTools);
  console.log(`Tool system initialized with ${toolManager.getToolCount()} tools`);
}

// 导出工具管理器
export { toolManager };

// 导出类型
export type {
  ToolDefinition,
  RegisteredTool
} from './types';

// 导出核心工具
export { coreTools } from './coreTools';
