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
    
    // Agent
    agent: 'Agent',
    agent_general: 'General Agent',
    agent_panel: 'Main Panel',

    // AI Agent Interface
    ai_assistant: 'AI Assistant',
    selected_servers: 'Selected {0} servers',
    connected_to: 'Connected: {0}',
    not_connected: 'Not Connected',
    api_endpoint: 'API Endpoint',
    api_key: 'API Key',
    model_name: 'Model Name',
    how_can_i_help: 'How can I help you today?',
    example_disk_usage: 'Check disk usage on all servers',
    example_nginx_logs: 'Analyze recent Nginx error logs',
    example_active_connections: 'Explain the active connections',
    example_kernel_versions: 'Show system kernel versions',
    ai_thinking: 'AI is thinking...',
    input_placeholder_selected: 'Ask about {0} selected servers...',
    input_placeholder_default: 'Enter question or command (Enter to send)...',
    ai_disclaimer: 'FUXI Server Forensics generated content may be inaccurate.',
    configure_api_key: 'Please configure API Key for {0} in settings.',
    error_prefix: 'Error: {0}',
    executing_command: 'Executing command...',
    running_command: 'Running ({0}): {1}',
    no_active_session: 'Error: No active SSH session and no servers selected. Please connect and select servers first.',
    running_on_servers: 'Running on {0} servers: {1}',
    execution_failed: 'Execution failed: {0}',
    analyzing_results: 'Analyzing results...',
    
    // Settings
    settings: 'Settings',
    general_settings: 'General',
    ai_settings: 'AI Configuration',
    language: 'Language',
    clear_chat: 'Clear Chat',
    clear_chat_confirm: 'Are you sure you want to clear the conversation history?',
    save: 'Save',
    cancel: 'Cancel',
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
    
    // Agent
    agent: 'Agent智能体',
    agent_general: '通用智能体',
    agent_panel: '主答题面板',

    // AI Agent Interface
    ai_assistant: 'AI 智能体',
    selected_servers: '已选中 {0} 个服务器',
    connected_to: '已连接: {0}',
    not_connected: '未连接',
    api_endpoint: 'API 端点',
    api_key: 'API 密钥',
    model_name: '模型名称',
    how_can_i_help: '今天我能为您做什么？',
    example_disk_usage: '分析服务器各个端口作用',
    example_nginx_logs: '分析服务器是用来做什么的',
    example_active_connections: '分析服务器搭建了哪些网站',
    example_kernel_versions: '分析服务器的历史记录',
    ai_thinking: 'AI 正在思考...',
    input_placeholder_selected: '针对已选中的 {0} 个服务器提问...',
    input_placeholder_default: '输入问题或指令 (Enter 发送)...',
    ai_disclaimer: 'FUXI Server Forensics 生成的内容可能不准确。',
    configure_api_key: '请先在设置中配置 {0} 的 API Key。',
    error_prefix: '错误: {0}',
    executing_command: '正在执行命令...',
    running_command: '正在运行 ({0}): {1}',
    no_active_session: '错误：没有活动的 SSH 会话，且未选择任何服务器。请先连接并选择服务器。',
    running_on_servers: '正在 {0} 个服务器上运行: {1}',
    execution_failed: '执行失败: {0}',
    analyzing_results: '正在分析结果...',

    // Settings
    settings: '设置',
    general_settings: '通用设置',
    ai_settings: 'AI 配置',
    language: '语言',
    clear_chat: '清空对话',
    clear_chat_confirm: '确定要清空对话历史吗？',
    save: '保存',
    cancel: '取消',
  }
};
