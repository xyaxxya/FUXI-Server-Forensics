import { LucideIcon } from 'lucide-react';
import { ZodSchema } from 'zod';

// 工具类型定义
export interface ToolInput {
  [key: string]: any;
}

export interface ToolOutput {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
}

export interface ToolMetadata {
  name: string;
  description: string;
  category: ToolCategory;
  icon?: LucideIcon;
  requiresApproval?: boolean;
  dangerLevel?: 'low' | 'medium' | 'high';
  version: string;
  dependencies?: string[];
  timeout?: number;
}

export interface ToolDefinition {
  metadata: ToolMetadata;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  schema?: ZodSchema;
  execute: (input: ToolInput) => Promise<ToolOutput>;
  validate?: (input: ToolInput) => boolean;
}

export interface RegisteredTool {
  definition: ToolDefinition;
  id: string;
  version: string;
  registeredAt: Date;
}

export type ToolCategory = 'system' | 'file' | 'network' | 'security' | 'database' | 'web' | 'ai';

export type ToolPermission = 'read' | 'write' | 'execute' | 'admin';

export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  permissions: ToolPermission[];
  timeout?: number;
}
