import { AIMessage, AISettings } from './ai';
import { toolManager } from './tools';

interface ServerMetrics {
  cpu: {
    usage: number; // 百分比
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number; // MB
    used: number; // MB
    free: number; // MB
  };
  disk: {
    total: number; // GB
    used: number; // GB
    free: number; // GB
  };
  network: {
    incoming: number; // MB/s
    outgoing: number; // MB/s
    connections: number;
  };
}

interface SecurityEvent {
  id: string;
  timestamp: number;
  type: 'login' | 'logout' | 'command' | 'file_change' | 'network' | 'error';
  severity: 'low' | 'medium' | 'high';
  description: string;
  details: any;
}

interface PerformanceIssue {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'network' | 'process';
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
  possibleCauses: string[];
}

interface OptimizationSuggestion {
  id: string;
  type: 'performance' | 'security' | 'reliability' | 'cost';
  priority: 'low' | 'medium' | 'high';
  description: string;
  implementationSteps: string[];
  expectedImpact: string;
}

interface AnalysisResult {
  serverMetrics: ServerMetrics;
  securityEvents: SecurityEvent[];
  performanceIssues: PerformanceIssue[];
  optimizationSuggestions: OptimizationSuggestion[];
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
  summary: string;
}

export class IntelligentAnalyzer {
  private settings: AISettings;

  constructor(settings: AISettings) {
    this.settings = settings;
  }

  /**
   * 分析服务器状态
   */
  async analyzeServerStatus(targetIds?: string[]): Promise<AnalysisResult> {
    try {
      // 收集服务器指标
      const serverMetrics = await this.collectServerMetrics(targetIds);
      
      // 检测安全事件
      const securityEvents = await this.detectSecurityEvents(targetIds);
      
      // 分析性能问题
      const performanceIssues = this.analyzePerformanceIssues(serverMetrics);
      
      // 生成优化建议
      const optimizationSuggestions = this.generateOptimizationSuggestions(
        serverMetrics, 
        securityEvents, 
        performanceIssues
      );
      
      // 评估整体健康状况
      const overallHealth = this.evaluateOverallHealth(
        serverMetrics, 
        securityEvents, 
        performanceIssues
      );
      
      // 生成分析摘要
      const summary = this.generateAnalysisSummary(
        serverMetrics, 
        securityEvents, 
        performanceIssues, 
        optimizationSuggestions, 
        overallHealth
      );
      
      return {
        serverMetrics,
        securityEvents,
        performanceIssues,
        optimizationSuggestions,
        overallHealth,
        summary
      };
    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 收集服务器指标
   */
  private async collectServerMetrics(targetIds?: string[]): Promise<ServerMetrics> {
    // 执行系统信息命令
    const systemInfoResult = await toolManager.executeTool('run_command', {
      command_type: 'system_info',
      target_ids: targetIds
    });

    // 执行磁盘使用命令
    const diskUsageResult = await toolManager.executeTool('run_command', {
      command_type: 'disk_usage',
      target_ids: targetIds
    });

    // 执行进程列表命令
    const processListResult = await toolManager.executeTool('run_command', {
      command_type: 'process_list',
      target_ids: targetIds
    });

    // 执行网络状态命令
    const networkStatusResult = await toolManager.executeTool('run_command', {
      command_type: 'network_status',
      target_ids: targetIds
    });

    // 解析结果
    return {
      cpu: this.parseCpuMetrics(systemInfoResult.data, processListResult.data),
      memory: this.parseMemoryMetrics(processListResult.data),
      disk: this.parseDiskMetrics(diskUsageResult.data),
      network: this.parseNetworkMetrics(networkStatusResult.data)
    };
  }

  /**
   * 检测安全事件
   */
  private async detectSecurityEvents(targetIds?: string[]): Promise<SecurityEvent[]> {
    // 分析认证日志
    const authLogResult = await toolManager.executeTool('analyze_log', {
      log_path: '/var/log/auth.log',
      log_type: 'auth',
      time_range: '24h',
      target_ids: targetIds
    });

    // 分析系统日志
    const systemLogResult = await toolManager.executeTool('analyze_log', {
      log_path: '/var/log/syslog',
      log_type: 'system',
      time_range: '24h',
      target_ids: targetIds
    });

    // 解析安全事件
    const events: SecurityEvent[] = [];

    // 解析认证日志事件
    if (authLogResult.success && authLogResult.data) {
      events.push(...this.parseAuthLogEvents(authLogResult.data));
    }

    // 解析系统日志事件
    if (systemLogResult.success && systemLogResult.data) {
      events.push(...this.parseSystemLogEvents(systemLogResult.data));
    }

    return events.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 分析性能问题
   */
  private analyzePerformanceIssues(metrics: ServerMetrics): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];

    // 检查 CPU 使用率
    if (metrics.cpu.usage > 80) {
      issues.push({
        id: `perf_cpu_${Date.now()}`,
        type: 'cpu',
        severity: metrics.cpu.usage > 90 ? 'high' : 'medium',
        description: `CPU 使用率过高: ${metrics.cpu.usage}%`,
        impact: '系统响应缓慢，服务可能不可用',
        possibleCauses: ['进程占用过高', '资源分配不足', '系统负载过大']
      });
    }

    // 检查内存使用率
    const memoryUsage = (metrics.memory.used / metrics.memory.total) * 100;
    if (memoryUsage > 80) {
      issues.push({
        id: `perf_memory_${Date.now()}`,
        type: 'memory',
        severity: memoryUsage > 90 ? 'high' : 'medium',
        description: `内存使用率过高: ${memoryUsage.toFixed(1)}%`,
        impact: '系统可能出现 OOM 错误，服务崩溃',
        possibleCauses: ['内存泄漏', '应用程序内存占用过大', '系统内存不足']
      });
    }

    // 检查磁盘使用率
    const diskUsage = (metrics.disk.used / metrics.disk.total) * 100;
    if (diskUsage > 80) {
      issues.push({
        id: `perf_disk_${Date.now()}`,
        type: 'disk',
        severity: diskUsage > 90 ? 'high' : 'medium',
        description: `磁盘使用率过高: ${diskUsage.toFixed(1)}%`,
        impact: '磁盘空间不足，可能导致服务无法写入数据',
        possibleCauses: ['日志文件过大', '数据积累过多', '磁盘空间分配不足']
      });
    }

    // 检查网络连接数
    if (metrics.network.connections > 1000) {
      issues.push({
        id: `perf_network_${Date.now()}`,
        type: 'network',
        severity: metrics.network.connections > 5000 ? 'high' : 'medium',
        description: `网络连接数过多: ${metrics.network.connections}`,
        impact: '网络性能下降，可能导致连接拒绝',
        possibleCauses: ['DDoS 攻击', '应用程序连接泄漏', '网络配置不当']
      });
    }

    return issues;
  }

  /**
   * 生成优化建议
   */
  private generateOptimizationSuggestions(
    metrics: ServerMetrics,
    events: SecurityEvent[],
    issues: PerformanceIssue[]
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // 性能优化建议
    if (metrics.cpu.usage > 70) {
      suggestions.push({
        id: `opt_perf_cpu_${Date.now()}`,
        type: 'performance',
        priority: 'high',
        description: '优化 CPU 使用',
        implementationSteps: [
          '识别并优化占用 CPU 高的进程',
          '考虑增加 CPU 资源',
          '优化应用程序代码'
        ],
        expectedImpact: '降低 CPU 使用率，提高系统响应速度'
      });
    }

    if (metrics.memory.used / metrics.memory.total > 0.7) {
      suggestions.push({
        id: `opt_perf_memory_${Date.now()}`,
        type: 'performance',
        priority: 'high',
        description: '优化内存使用',
        implementationSteps: [
          '检查内存泄漏',
          '优化应用程序内存使用',
          '考虑增加内存资源'
        ],
        expectedImpact: '降低内存使用率，减少 OOM 风险'
      });
    }

    // 安全优化建议
    const highSeverityEvents = events.filter(e => e.severity === 'high');
    if (highSeverityEvents.length > 0) {
      suggestions.push({
        id: `opt_security_${Date.now()}`,
        type: 'security',
        priority: 'high',
        description: '处理高风险安全事件',
        implementationSteps: [
          '调查高风险安全事件',
          '采取相应的安全措施',
          '加强监控和告警'
        ],
        expectedImpact: '减少安全风险，防止安全事件再次发生'
      });
    }

    // 可靠性优化建议
    suggestions.push({
      id: `opt_reliability_${Date.now()}`,
      type: 'reliability',
      priority: 'medium',
      description: '提高系统可靠性',
      implementationSteps: [
        '设置系统监控和告警',
        '定期备份重要数据',
        '制定灾难恢复计划'
      ],
      expectedImpact: '提高系统可靠性，减少 downtime'
    });

    return suggestions;
  }

  /**
   * 评估整体健康状况
   */
  private evaluateOverallHealth(
    metrics: ServerMetrics,
    events: SecurityEvent[],
    issues: PerformanceIssue[]
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    let score = 100;

    // 基于 CPU 使用率扣分
    if (metrics.cpu.usage > 80) {
      score -= (metrics.cpu.usage - 80) * 2;
    }

    // 基于内存使用率扣分
    const memoryUsage = (metrics.memory.used / metrics.memory.total) * 100;
    if (memoryUsage > 80) {
      score -= (memoryUsage - 80) * 2;
    }

    // 基于磁盘使用率扣分
    const diskUsage = (metrics.disk.used / metrics.disk.total) * 100;
    if (diskUsage > 80) {
      score -= (diskUsage - 80) * 2;
    }

    // 基于安全事件扣分
    const highSeverityEvents = events.filter(e => e.severity === 'high');
    score -= highSeverityEvents.length * 10;

    // 基于性能问题扣分
    const highSeverityIssues = issues.filter(i => i.severity === 'high');
    score -= highSeverityIssues.length * 15;

    // 确保分数在 0-100 之间
    score = Math.max(0, Math.min(100, score));

    // 确定健康状况
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  /**
   * 生成分析摘要
   */
  private generateAnalysisSummary(
    metrics: ServerMetrics,
    events: SecurityEvent[],
    issues: PerformanceIssue[],
    suggestions: OptimizationSuggestion[],
    health: 'excellent' | 'good' | 'fair' | 'poor'
  ): string {
    const highSeverityEvents = events.filter(e => e.severity === 'high');
    const highSeverityIssues = issues.filter(i => i.severity === 'high');
    const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');

    let summary = `服务器健康状况: ${this.getHealthDescription(health)}\n\n`;

    summary += `## 服务器指标\n`;
    summary += `- CPU 使用率: ${metrics.cpu.usage}%\n`;
    summary += `- 内存使用率: ${((metrics.memory.used / metrics.memory.total) * 100).toFixed(1)}%\n`;
    summary += `- 磁盘使用率: ${((metrics.disk.used / metrics.disk.total) * 100).toFixed(1)}%\n`;
    summary += `- 网络连接数: ${metrics.network.connections}\n\n`;

    if (highSeverityEvents.length > 0) {
      summary += `## 安全事件\n`;
      summary += `发现 ${highSeverityEvents.length} 个高风险安全事件\n\n`;
    }

    if (highSeverityIssues.length > 0) {
      summary += `## 性能问题\n`;
      summary += `发现 ${highSeverityIssues.length} 个高严重度性能问题\n\n`;
    }

    if (highPrioritySuggestions.length > 0) {
      summary += `## 优化建议\n`;
      summary += `有 ${highPrioritySuggestions.length} 个高优先级优化建议\n\n`;
    }

    return summary;
  }

  /**
   * 解析 CPU 指标
   */
  private parseCpuMetrics(systemInfo: any, processList: any): any {
    // 简单解析，实际应用中需要更复杂的解析逻辑
    return {
      usage: Math.random() * 30 + 20, // 模拟数据
      cores: 4,
      loadAverage: [0.5, 0.8, 1.0]
    };
  }

  /**
   * 解析内存指标
   */
  private parseMemoryMetrics(processList: any): any {
    // 简单解析，实际应用中需要更复杂的解析逻辑
    return {
      total: 8192,
      used: 4096,
      free: 4096
    };
  }

  /**
   * 解析磁盘指标
   */
  private parseDiskMetrics(diskUsage: any): any {
    // 简单解析，实际应用中需要更复杂的解析逻辑
    return {
      total: 100,
      used: 50,
      free: 50
    };
  }

  /**
   * 解析网络指标
   */
  private parseNetworkMetrics(networkStatus: any): any {
    // 简单解析，实际应用中需要更复杂的解析逻辑
    return {
      incoming: 10,
      outgoing: 5,
      connections: 200
    };
  }

  /**
   * 解析认证日志事件
   */
  private parseAuthLogEvents(logData: any): SecurityEvent[] {
    // 简单解析，实际应用中需要更复杂的解析逻辑
    return [
      {
        id: `event_${Date.now()}_1`,
        timestamp: Date.now() - 3600000,
        type: 'login',
        severity: 'medium',
        description: '用户登录成功',
        details: {
          user: 'root',
          ip: '192.168.1.100',
          method: 'password'
        }
      }
    ];
  }

  /**
   * 解析系统日志事件
   */
  private parseSystemLogEvents(logData: any): SecurityEvent[] {
    // 简单解析，实际应用中需要更复杂的解析逻辑
    return [];
  }

  /**
   * 获取健康状况描述
   */
  private getHealthDescription(health: 'excellent' | 'good' | 'fair' | 'poor'): string {
    switch (health) {
      case 'excellent': return '优秀';
      case 'good': return '良好';
      case 'fair': return '一般';
      case 'poor': return '较差';
    }
  }
}
