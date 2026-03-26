// 错误处理工具 - 将技术错误转换为用户友好的提示

export interface FriendlyError {
  title: string;
  message: string;
  suggestion?: string;
  canRetry?: boolean;
}

export function getFriendlyError(error: any, language: 'zh' | 'en' = 'zh'): FriendlyError {
  const errorStr = String(error?.message || error || '').toLowerCase();
  
  // 特殊错误代码
  if (errorStr === 'no_db_connection') {
    return {
      title: language === 'zh' ? '未连接数据库' : 'No Database Connection',
      message: language === 'zh' 
        ? '请先在左侧列表中选择并连接一个数据库。' 
        : 'Please select and connect to a database from the left panel.',
      suggestion: language === 'zh' 
        ? '如果列表为空，请先在"数据库管理器"中添加数据库连接配置。' 
        : 'If the list is empty, add database connections in Database Manager first.',
      canRetry: false
    };
  }
  
  // SSH 连接错误
  if (errorStr.includes('connection refused') || errorStr.includes('connect timeout')) {
    return {
      title: language === 'zh' ? '连接失败' : 'Connection Failed',
      message: language === 'zh' 
        ? '无法连接到目标服务器，请检查 IP 地址和端口是否正确。' 
        : 'Cannot connect to the target server. Please check IP address and port.',
      suggestion: language === 'zh' 
        ? '1. 确认服务器 IP 和端口正确\n2. 检查服务器是否在线\n3. 确认防火墙规则允许连接' 
        : '1. Verify server IP and port\n2. Check if server is online\n3. Confirm firewall rules',
      canRetry: true
    };
  }

  if (errorStr.includes('authentication failed') || errorStr.includes('permission denied')) {
    return {
      title: language === 'zh' ? '认证失败' : 'Authentication Failed',
      message: language === 'zh' 
        ? '用户名或密码错误，请重新输入。' 
        : 'Incorrect username or password.',
      suggestion: language === 'zh' 
        ? '1. 检查用户名和密码是否正确\n2. 确认账户未被锁定\n3. 尝试使用 SSH 密钥认证' 
        : '1. Verify username and password\n2. Check if account is locked\n3. Try SSH key authentication',
      canRetry: true
    };
  }

  // 数据库错误
  if (errorStr.includes('access denied') || errorStr.includes('1045')) {
    return {
      title: language === 'zh' ? '数据库访问被拒绝' : 'Database Access Denied',
      message: language === 'zh' 
        ? '数据库用户名或密码错误。' 
        : 'Incorrect database username or password.',
      suggestion: language === 'zh' 
        ? '1. 检查数据库凭据\n2. 确认用户有访问权限\n3. 检查数据库主机地址' 
        : '1. Check database credentials\n2. Verify user permissions\n3. Check database host',
      canRetry: true
    };
  }

  if (errorStr.includes('unknown database') || errorStr.includes('1049')) {
    return {
      title: language === 'zh' ? '数据库不存在' : 'Database Not Found',
      message: language === 'zh' 
        ? '指定的数据库不存在。' 
        : 'The specified database does not exist.',
      suggestion: language === 'zh' 
        ? '请检查数据库名称是否正确，或先创建该数据库。' 
        : 'Check database name or create it first.',
      canRetry: false
    };
  }

  // API 错误
  if (errorStr.includes('api key') || errorStr.includes('unauthorized') || errorStr.includes('401')) {
    return {
      title: language === 'zh' ? 'API 密钥无效' : 'Invalid API Key',
      message: language === 'zh' 
        ? 'AI 服务 API 密钥无效或已过期。' 
        : 'AI service API key is invalid or expired.',
      suggestion: language === 'zh' 
        ? '请在设置中更新 API 密钥。' 
        : 'Please update API key in settings.',
      canRetry: false
    };
  }

  if (errorStr.includes('rate limit') || errorStr.includes('429')) {
    return {
      title: language === 'zh' ? '请求过于频繁' : 'Rate Limit Exceeded',
      message: language === 'zh' 
        ? 'API 调用次数超过限制，请稍后再试。' 
        : 'API rate limit exceeded. Please try again later.',
      suggestion: language === 'zh' 
        ? '等待几分钟后重试，或升级 API 套餐。' 
        : 'Wait a few minutes or upgrade your API plan.',
      canRetry: true
    };
  }

  // 网络错误
  if (errorStr.includes('network') || errorStr.includes('fetch failed') || errorStr.includes('enotfound')) {
    return {
      title: language === 'zh' ? '网络错误' : 'Network Error',
      message: language === 'zh' 
        ? '网络连接失败，请检查网络设置。' 
        : 'Network connection failed. Please check your network.',
      suggestion: language === 'zh' 
        ? '1. 检查网络连接\n2. 确认代理设置\n3. 尝试切换网络' 
        : '1. Check network connection\n2. Verify proxy settings\n3. Try different network',
      canRetry: true
    };
  }

  // 超时错误
  if (errorStr.includes('timeout') || errorStr.includes('timed out')) {
    return {
      title: language === 'zh' ? '请求超时' : 'Request Timeout',
      message: language === 'zh' 
        ? '操作超时，服务器响应时间过长。' 
        : 'Operation timed out. Server took too long to respond.',
      suggestion: language === 'zh' 
        ? '1. 检查网络连接\n2. 服务器可能负载过高\n3. 尝试增加超时时间' 
        : '1. Check network\n2. Server may be overloaded\n3. Try increasing timeout',
      canRetry: true
    };
  }

  // SQL 语法错误
  if (errorStr.includes('syntax error') || errorStr.includes('1064')) {
    return {
      title: language === 'zh' ? 'SQL 语法错误' : 'SQL Syntax Error',
      message: language === 'zh' 
        ? 'SQL 查询语句存在语法错误。' 
        : 'SQL query contains syntax errors.',
      suggestion: language === 'zh' 
        ? '请检查 SQL 语句的语法是否正确。' 
        : 'Please check SQL syntax.',
      canRetry: false
    };
  }

  // 默认错误
  return {
    title: language === 'zh' ? '操作失败' : 'Operation Failed',
    message: language === 'zh' 
      ? `发生错误：${String(error?.message || error)}` 
      : `Error: ${String(error?.message || error)}`,
    suggestion: language === 'zh' 
      ? '请检查输入信息或稍后重试。' 
      : 'Please check your input or try again later.',
    canRetry: true
  };
}
