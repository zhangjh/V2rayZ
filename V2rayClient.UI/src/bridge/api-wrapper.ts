/**
 * API wrapper with error handling
 */

import { ErrorHandler, ErrorCategory } from '../lib/error-handler';
import * as nativeApi from './native-api';
import type { ApiResponse } from './types';

/**
 * 包装 API 调用，自动处理错误
 */
async function wrapApiCall<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  context: string,
  errorCategory: ErrorCategory = ErrorCategory.System
): Promise<T | null> {
  try {
    const response = await apiCall();
    
    if (!response.success) {
      ErrorHandler.handle({
        category: errorCategory,
        userMessage: response.error || '操作失败',
        technicalMessage: response.error,
        canRetry: true,
      });
      return null;
    }
    
    return response.data ?? null;
  } catch (error) {
    ErrorHandler.handleApiError(error, context);
    return null;
  }
}

/**
 * Proxy Control APIs with error handling
 */
export async function startProxy(): Promise<boolean> {
  try {
    const response = await nativeApi.startProxy();
    
    if (!response.success) {
      const errorMessage = response.error || '启动代理失败';
      
      // Determine error category based on error message
      let category = ErrorCategory.Connection;
      let canRetry = true;
      
      if (errorMessage.includes('不支持的协议') || errorMessage.includes('Protocol')) {
        category = ErrorCategory.Config;
        canRetry = false;
      } else if (errorMessage.includes('认证失败') || errorMessage.includes('密码错误') || errorMessage.includes('UUID 错误')) {
        category = ErrorCategory.Config;
        canRetry = false;
      } else if (errorMessage.includes('配置错误') || errorMessage.includes('配置格式')) {
        category = ErrorCategory.Config;
        canRetry = false;
      }
      
      ErrorHandler.handle({
        category,
        userMessage: errorMessage,
        technicalMessage: errorMessage,
        canRetry,
      });
      
      return false;
    }
    
    ErrorHandler.showSuccess('代理已启动');
    return true;
  } catch (error) {
    ErrorHandler.handleApiError(error, '启动代理');
    return false;
  }
}

export async function stopProxy(): Promise<boolean> {
  const result = await wrapApiCall(
    () => nativeApi.stopProxy(),
    '停止代理',
    ErrorCategory.Connection
  );
  
  if (result !== null) {
    ErrorHandler.showSuccess('代理已停止');
    return true;
  }
  
  return false;
}

/**
 * Configuration Management APIs with error handling
 */
export async function getConfig() {
  return wrapApiCall(
    () => nativeApi.getConfig(),
    '获取配置',
    ErrorCategory.Config
  );
}

export async function saveConfig(config: Parameters<typeof nativeApi.saveConfig>[0]): Promise<boolean> {
  const result = await wrapApiCall(
    () => nativeApi.saveConfig(config),
    '保存配置',
    ErrorCategory.Config
  );
  
  if (result !== null) {
    ErrorHandler.showSuccess('配置已保存');
    return true;
  }
  
  return false;
}

export async function updateProxyMode(mode: Parameters<typeof nativeApi.updateProxyMode>[0]): Promise<boolean> {
  const result = await wrapApiCall(
    () => nativeApi.updateProxyMode(mode),
    '更新代理模式',
    ErrorCategory.Config
  );
  
  if (result !== null) {
    ErrorHandler.showSuccess('代理模式已更新');
    return true;
  }
  
  return false;
}

/**
 * Status and Statistics APIs with error handling
 */
export async function getConnectionStatus() {
  return wrapApiCall(
    () => nativeApi.getConnectionStatus(),
    '获取连接状态',
    ErrorCategory.Connection
  );
}

export async function getStatistics() {
  return wrapApiCall(
    () => nativeApi.getStatistics(),
    '获取流量统计',
    ErrorCategory.System
  );
}

export async function resetStatistics(): Promise<boolean> {
  const result = await wrapApiCall(
    () => nativeApi.resetStatistics(),
    '重置流量统计',
    ErrorCategory.System
  );
  
  if (result !== null) {
    ErrorHandler.showSuccess('流量统计已重置');
    return true;
  }
  
  return false;
}

/**
 * Custom Rules APIs with error handling
 */
export async function addCustomRule(rule: Parameters<typeof nativeApi.addCustomRule>[0]): Promise<boolean> {
  const result = await wrapApiCall(
    () => nativeApi.addCustomRule(rule),
    '添加自定义规则',
    ErrorCategory.Config
  );
  
  if (result !== null) {
    ErrorHandler.showSuccess('规则已添加');
    return true;
  }
  
  return false;
}

export async function updateCustomRule(rule: Parameters<typeof nativeApi.updateCustomRule>[0]): Promise<boolean> {
  const result = await wrapApiCall(
    () => nativeApi.updateCustomRule(rule),
    '更新自定义规则',
    ErrorCategory.Config
  );
  
  if (result !== null) {
    ErrorHandler.showSuccess('规则已更新');
    return true;
  }
  
  return false;
}

export async function deleteCustomRule(ruleId: string): Promise<boolean> {
  const result = await wrapApiCall(
    () => nativeApi.deleteCustomRule(ruleId),
    '删除自定义规则',
    ErrorCategory.Config
  );
  
  if (result !== null) {
    ErrorHandler.showSuccess('规则已删除');
    return true;
  }
  
  return false;
}

/**
 * Logging APIs with error handling
 */
export async function getLogs(count?: number) {
  return wrapApiCall(
    () => nativeApi.getLogs(count),
    '获取日志',
    ErrorCategory.System
  );
}

export async function clearLogs(): Promise<boolean> {
  const result = await wrapApiCall(
    () => nativeApi.clearLogs(),
    '清空日志',
    ErrorCategory.System
  );
  
  if (result !== null) {
    ErrorHandler.showSuccess('日志已清空');
    return true;
  }
  
  return false;
}

/**
 * Version Information APIs with error handling
 */
export async function getVersionInfo() {
  return wrapApiCall(
    () => nativeApi.getVersionInfo(),
    '获取版本信息',
    ErrorCategory.System
  );
}

/**
 * Re-export event listener functions
 */
export { addEventListener, removeEventListener } from './native-api';
