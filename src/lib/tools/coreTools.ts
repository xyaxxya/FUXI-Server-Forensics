import { Terminal, FileText, Search, FolderOpen, Play, Server, AlertTriangle } from 'lucide-react';
import { ToolDefinition } from './types';
import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';

// Shell 工具
export const shellTool: ToolDefinition = {
  metadata: {
    name: 'shell',
    description: '执行 shell 命令',
    category: 'system',
    icon: Terminal,
    requiresApproval: true,
    dangerLevel: 'medium',
    version: '1.0.0',
    timeout: 60000 // 60秒超时
  },
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的 shell 命令'
      },
      target_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '可选。要执行命令的服务器会话 ID'
      }
    },
    required: ['command']
  },
  schema: z.object({
    command: z.string().min(1, '命令不能为空'),
    target_ids: z.array(z.string()).optional()
  }),
  execute: async (input) => {
    try {
      const result = await invoke('run_ssh_command', {
        command: input.command,
        sessionIds: input.target_ids || []
      });
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '执行命令失败'
      };
    }
  }
};

// 读取文件工具
export const readFileTool: ToolDefinition = {
  metadata: {
    name: 'read_file',
    description: '读取服务器文件内容',
    category: 'file',
    icon: FileText,
    dangerLevel: 'low',
    version: '1.0.0',
    timeout: 30000 // 30秒超时
  },
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径'
      },
      mode: {
        type: 'string',
        enum: ['head', 'tail', 'range'],
        description: '读取模式：开头、结尾或指定范围'
      },
      line_count: {
        type: 'integer',
        description: '要读取的行数'
      },
      start_line: {
        type: 'integer',
        description: '当 mode=range 时的起始行号'
      },
      target_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '可选。要执行命令的服务器会话 ID'
      }
    },
    required: ['path']
  },
  schema: z.object({
    path: z.string().min(1, '文件路径不能为空'),
    mode: z.enum(['head', 'tail', 'range']).optional(),
    line_count: z.number().int().min(1).optional(),
    start_line: z.number().int().min(1).optional(),
    target_ids: z.array(z.string()).optional()
  }),
  execute: async (input) => {
    try {
      const command = buildReadFileCommand(input);
      const result = await invoke('run_ssh_command', {
        command,
        sessionIds: input.target_ids || []
      });
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '读取文件失败'
      };
    }
  }
};

// 写入文件工具
export const writeFileTool: ToolDefinition = {
  metadata: {
    name: 'write_file',
    description: '写入内容到服务器文件',
    category: 'file',
    icon: FileText,
    requiresApproval: true,
    dangerLevel: 'high',
    version: '1.0.0',
    timeout: 30000 // 30秒超时
  },
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '文件路径'
      },
      content: {
        type: 'string',
        description: '要写入的内容'
      },
      append: {
        type: 'boolean',
        description: '是否追加到文件末尾'
      },
      target_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '可选。要执行命令的服务器会话 ID'
      }
    },
    required: ['path', 'content']
  },
  schema: z.object({
    path: z.string().min(1, '文件路径不能为空'),
    content: z.string(),
    append: z.boolean().optional(),
    target_ids: z.array(z.string()).optional()
  }),
  execute: async (input) => {
    try {
      const command = buildWriteFileCommand(input);
      const result = await invoke('run_ssh_command', {
        command,
        sessionIds: input.target_ids || []
      });
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '写入文件失败'
      };
    }
  }
};

// 搜索文件内容工具
export const grepFilesTool: ToolDefinition = {
  metadata: {
    name: 'grep_files',
    description: '在服务器文件中搜索文本',
    category: 'file',
    icon: Search,
    dangerLevel: 'low',
    version: '1.0.0',
    timeout: 60000 // 60秒超时
  },
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: '搜索模式或正则表达式'
      },
      search_paths: {
        type: 'array',
        items: { type: 'string' },
        description: '搜索路径列表'
      },
      file_glob: {
        type: 'string',
        description: '文件匹配模式'
      },
      ignore_case: {
        type: 'boolean',
        description: '是否忽略大小写'
      },
      max_results: {
        type: 'integer',
        description: '最大结果数'
      },
      target_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '可选。要执行命令的服务器会话 ID'
      }
    },
    required: ['pattern']
  },
  schema: z.object({
    pattern: z.string().min(1, '搜索模式不能为空'),
    search_paths: z.array(z.string()).optional(),
    file_glob: z.string().optional(),
    ignore_case: z.boolean().optional(),
    max_results: z.number().int().min(1).optional(),
    target_ids: z.array(z.string()).optional()
  }),
  execute: async (input) => {
    try {
      const command = buildGrepCommand(input);
      const result = await invoke('run_ssh_command', {
        command,
        sessionIds: input.target_ids || []
      });
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索文件失败'
      };
    }
  }
};

// 列出目录工具
export const listDirTool: ToolDefinition = {
  metadata: {
    name: 'list_dir',
    description: '列出服务器目录内容',
    category: 'file',
    icon: FolderOpen,
    dangerLevel: 'low',
    version: '1.0.0',
    timeout: 30000 // 30秒超时
  },
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '目录路径'
      },
      depth: {
        type: 'integer',
        description: '目录深度'
      },
      max_results: {
        type: 'integer',
        description: '最大结果数'
      },
      include_hidden: {
        type: 'boolean',
        description: '是否包含隐藏文件'
      },
      target_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '可选。要执行命令的服务器会话 ID'
      }
    },
    required: ['path']
  },
  schema: z.object({
    path: z.string().min(1, '目录路径不能为空'),
    depth: z.number().int().min(1).optional(),
    max_results: z.number().int().min(1).optional(),
    include_hidden: z.boolean().optional(),
    target_ids: z.array(z.string()).optional()
  }),
  execute: async (input) => {
    try {
      const command = buildListDirCommand(input);
      const result = await invoke('run_ssh_command', {
        command,
        sessionIds: input.target_ids || []
      });
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '列出目录失败'
      };
    }
  }
};

// 运行特定命令工具
export const runCommandTool: ToolDefinition = {
  metadata: {
    name: 'run_command',
    description: '运行特定的服务器诊断命令',
    category: 'system',
    icon: Play,
    dangerLevel: 'low',
    version: '1.0.0',
    timeout: 30000 // 30秒超时
  },
  parameters: {
    type: 'object',
    properties: {
      command_type: {
        type: 'string',
        enum: ['system_info', 'disk_usage', 'process_list', 'network_status', 'service_status'],
        description: '命令类型'
      },
      target_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '可选。要执行命令的服务器会话 ID'
      }
    },
    required: ['command_type']
  },
  schema: z.object({
    command_type: z.enum(['system_info', 'disk_usage', 'process_list', 'network_status', 'service_status']),
    target_ids: z.array(z.string()).optional()
  }),
  execute: async (input) => {
    try {
      const command = buildDiagnosticCommand(input.command_type);
      const result = await invoke('run_ssh_command', {
        command,
        sessionIds: input.target_ids || []
      });
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '运行命令失败'
      };
    }
  }
};

// 分析日志工具
export const analyzeLogTool: ToolDefinition = {
  metadata: {
    name: 'analyze_log',
    description: '分析服务器日志文件',
    category: 'security',
    icon: AlertTriangle,
    dangerLevel: 'low',
    version: '1.0.0',
    timeout: 60000 // 60秒超时
  },
  parameters: {
    type: 'object',
    properties: {
      log_path: {
        type: 'string',
        description: '日志文件路径'
      },
      log_type: {
        type: 'string',
        enum: ['auth', 'system', 'web', 'database'],
        description: '日志类型'
      },
      search_pattern: {
        type: 'string',
        description: '搜索模式'
      },
      time_range: {
        type: 'string',
        description: '时间范围，如 "1h"、"24h"'
      },
      max_results: {
        type: 'integer',
        description: '最大结果数'
      },
      target_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '可选。要执行命令的服务器会话 ID'
      }
    },
    required: ['log_path', 'log_type']
  },
  schema: z.object({
    log_path: z.string().min(1, '日志文件路径不能为空'),
    log_type: z.enum(['auth', 'system', 'web', 'database']),
    search_pattern: z.string().optional(),
    time_range: z.string().optional(),
    max_results: z.number().int().min(1).optional(),
    target_ids: z.array(z.string()).optional()
  }),
  execute: async (input) => {
    try {
      const command = buildLogAnalysisCommand(input);
      const result = await invoke('run_ssh_command', {
        command,
        sessionIds: input.target_ids || []
      });
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '分析日志失败'
      };
    }
  }
};

// 辅助函数：构建读取文件命令
function buildReadFileCommand(input: any): string {
  const path = input.path;
  const mode = input.mode || 'head';
  const lineCount = input.line_count || 80;
  const startLine = input.start_line || 1;
  const endLine = startLine + lineCount - 1;
  
  let body = '';
  if (mode === 'tail') {
    body = `tail -n ${lineCount} "${path}" 2>/dev/null`;
  } else if (mode === 'range') {
    body = `sed -n '${startLine},${endLine}p' "${path}" 2>/dev/null`;
  } else {
    body = `head -n ${lineCount} "${path}" 2>/dev/null`;
  }
  
  return `file "${path}" 2>/dev/null; echo "---"; ls -l "${path}" 2>/dev/null; echo "---"; ${body}`;
}

// 辅助函数：构建写入文件命令
function buildWriteFileCommand(input: any): string {
  const path = input.path;
  const content = input.content;
  const append = input.append || false;
  
  if (append) {
    return `echo "${content}" >> "${path}"`;
  } else {
    return `echo "${content}" > "${path}"`;
  }
}

// 辅助函数：构建 grep 命令
function buildGrepCommand(input: any): string {
  const pattern = input.pattern;
  const searchPaths = input.search_paths || ['/var/www', '/www', '/etc', '/opt', '/home'];
  const paths = searchPaths.map((p: string) => `"${p}"`).join(' ');
  const include = input.file_glob ? ` --include="${input.file_glob}"` : '';
  const maxResults = input.max_results || 120;
  const ignoreCase = input.ignore_case ? 'i' : '';
  
  return `grep -R${ignoreCase}nE${include} "${pattern}" ${paths} 2>/dev/null | head -n ${maxResults}`;
}

// 辅助函数：构建列出目录命令
function buildListDirCommand(input: any): string {
  const path = input.path;
  const depth = input.depth || 2;
  const maxResults = input.max_results || 80;
  const includeHidden = input.include_hidden ? '' : ' ! -path \*/\.* ! -name \.*';
  
  return `find "${path}" -maxdepth ${depth}${includeHidden} -printf '%y %M %u %g %s %TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null | head -n ${maxResults}`;
}

// 辅助函数：构建诊断命令
function buildDiagnosticCommand(commandType: string): string {
  switch (commandType) {
    case 'system_info':
      return 'uname -a; cat /etc/os-release | grep -E "^(NAME|VERSION)="; uptime -p';
    case 'disk_usage':
      return 'df -h';
    case 'process_list':
      return 'ps auxf';
    case 'network_status':
      return 'netstat -tunlp || ss -tunlp';
    case 'service_status':
      return 'systemctl --type=service --state=running | head -n 80; true';
    default:
      return 'uname -a';
  }
}

// 辅助函数：构建日志分析命令
function buildLogAnalysisCommand(input: any): string {
  const logPath = input.log_path;
  const searchPattern = input.search_pattern || '';
  const timeRange = input.time_range || '24h';
  const maxResults = input.max_results || 200;
  
  let command = `tail -n ${maxResults} "${logPath}" 2>/dev/null`;
  
  if (searchPattern) {
    command = `grep "${searchPattern}" "${logPath}" 2>/dev/null | tail -n ${maxResults}`;
  }
  
  return command;
}

// 导出所有核心工具
export const coreTools: ToolDefinition[] = [
  shellTool,
  readFileTool,
  writeFileTool,
  grepFilesTool,
  listDirTool,
  runCommandTool,
  analyzeLogTool
];
