export type Language = 'en' | 'zh';

export const translations = {
  en: {
    system: 'System',
    network: 'Network',
    database: 'Database',
    docker: 'Docker',
    k8s: 'K8s Cluster',
    terminal: 'Terminal',
    web: 'Web Panel',
    security: 'Security',
    disconnect: 'Disconnect',
    
    // Dashboard Headers
    systemInfo: 'System Information',
    networkInfo: 'Network Status',
    dbInfo: 'Database Management',
    dockerInfo: 'Docker Containers',
    k8sInfo: 'Kubernetes Cluster',
    webInfo: 'Web Panel & Services',
    securityInfo: 'Security & Forensics',
    
    // Misc
    serviceNotDetected: 'Service not detected',
    noData: 'No data available',
    updating: 'Updating...',
    
    // Actions
    stop: 'Stop',
    reload: 'Reload',
    restart: 'Restart',

    // Menu Groups
    monitor: 'Monitoring',
    infrastructure: 'Infrastructure',
    services: 'Services',
    tools: 'Tools',
  },
  zh: {
    system: '系统信息',
    network: '网络状态',
    database: '数据库',
    docker: '容器服务',
    k8s: 'K8s 集群',
    terminal: '终端命令行',
    web: '面板应用',
    security: '安全审计',
    disconnect: '断开连接',
    
    // Dashboard Headers
    systemInfo: '系统详细信息',
    networkInfo: '网络连接状态',
    dbInfo: '数据库管理',
    dockerInfo: 'Docker 容器概览',
    k8sInfo: 'Kubernetes 集群状态',
    webInfo: 'Web 面板与服务',
    securityInfo: '安全与入侵排查',
    
    // Misc
    serviceNotDetected: '未检测到服务',
    noData: '暂无数据',
    updating: '更新中...',
    
    // Actions
    stop: '停止',
    reload: '重载',
    restart: '重启',

    // Menu Groups
    monitor: '监控中心',
    infrastructure: '基础设施',
    services: '应用服务',
    tools: '实用工具',
  }
};
