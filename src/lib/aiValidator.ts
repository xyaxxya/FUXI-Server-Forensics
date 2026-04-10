// AI 配置验证工具

import { AISettings, AIProviderId } from "./ai";

export interface ValidationResult {
  success: boolean;
  message: string;
  latency?: number;
}

export async function testAIConnection(
  providerId: AIProviderId,
  settings: AISettings,
  signal?: AbortSignal
): Promise<ValidationResult> {
  const config = settings.configs[providerId];
  
  if (!config.apiKey || config.apiKey.trim() === '') {
    return {
      success: false,
      message: 'API Key 不能为空'
    };
  }

  const startTime = Date.now();

  try {
    // Claude 特殊处理
    if (providerId === 'claude') {
      const response = await fetch(`${config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 50,
          messages: [{ role: 'user', content: 'Hi' }]
        }),
        signal
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `连接失败 (${response.status})`;
        
        if (response.status === 401) {
          errorMsg = 'API Key 无效或已过期';
        } else if (response.status === 429) {
          errorMsg = 'API 调用频率超限，请稍后再试';
        } else if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            errorMsg = errorJson.error?.message || errorMsg;
          } catch (e) {
            // Keep default message
          }
        }
        
        return { success: false, message: errorMsg };
      }

      try {
        await response.json();
      } catch (e) {
        return {
          success: false,
          message: 'Claude API 响应不是有效的 JSON 格式。请检查 Base URL 代理节点是否正常。'
        };
      }

      return {
        success: true,
        message: `连接成功！延迟: ${latency}ms`,
        latency
      };
    }

    // OpenAI 兼容接口 (包括 Zhipu, OpenAI, Qwen, Kimi, Gemini, Ollama)
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 50
      }),
      signal
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `连接失败 (${response.status})`;
      
      if (response.status === 401 || response.status === 403) {
        errorMsg = 'API Key 无效或已过期';
      } else if (response.status === 429) {
        errorMsg = 'API 调用频率超限，请稍后再试';
      } else if (response.status === 404) {
        errorMsg = 'API 端点不存在，请检查 Base URL';
      } else if (errorText) {
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error?.message || errorMsg;
        } catch (e) {
          // Keep default message
        }
      }
      
      return { success: false, message: errorMsg };
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      return {
        success: false,
        message: 'API 响应不是有效的 JSON 格式。请检查 Base URL 是否需要添加 /v1 后缀，或检查中转站地址是否正确。'
      };
    }
    
    // 验证响应格式
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      return {
        success: false,
        message: 'API 响应格式异常，请检查配置'
      };
    }

    return {
      success: true,
      message: `连接成功！延迟: ${latency}ms`,
      latency
    };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, message: '测试已取消' };
    }
    
    let errorMsg = '连接失败';
    
    if (error.message?.includes('fetch failed') || error.message?.includes('NetworkError')) {
      errorMsg = '网络连接失败，请检查网络或代理设置';
    } else if (error.message?.includes('timeout')) {
      errorMsg = '连接超时，请检查 Base URL 是否正确';
    } else {
      errorMsg = `连接失败: ${error.message}`;
    }
    
    return { success: false, message: errorMsg };
  }
}
