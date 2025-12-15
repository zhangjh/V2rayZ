import { toast } from 'sonner';

/**
 * 错误类别
 */
export enum ErrorCategory {
  Config = 'Config',
  Connection = 'Connection',
  System = 'System',
  Process = 'Process',
  Unknown = 'Unknown',
}

/**
 * 应用程序错误接口
 */
export interface AppError {
  category: ErrorCategory;
  userMessage: string;
  technicalMessage?: string;
  canRetry: boolean;
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  /**
   * 处理应用程序错误
   */
  static handle(error: AppError): void {
    console.error(`[${error.category}] ${error.userMessage}`, error.technicalMessage);

    // 根据错误类别显示不同的提示
    switch (error.category) {
      case ErrorCategory.Config:
        this.handleConfigError(error);
        break;
      case ErrorCategory.Connection:
        this.handleConnectionError(error);
        break;
      case ErrorCategory.System:
        this.handleSystemError(error);
        break;
      case ErrorCategory.Process:
        this.handleProcessError(error);
        break;
      default:
        this.handleUnknownError(error);
    }
  }

  /**
   * 处理 API 调用错误
   */
  static handleApiError(error: unknown, context: string): void {
    console.error(`API Error in ${context}:`, error);

    let userMessage = '操作失败，请稍后重试';
    let canRetry = true;
    let category = ErrorCategory.System;

    if (error instanceof Error) {
      userMessage = error.message || userMessage;
    } else if (typeof error === 'string') {
      userMessage = error;
    }

    // Detect protocol-specific errors
    if (this.isTrojanError(userMessage)) {
      category = ErrorCategory.Connection;
      canRetry = this.isTrojanErrorRetryable(userMessage);
    } else if (this.isProtocolError(userMessage)) {
      category = ErrorCategory.Config;
      canRetry = false;
    }

    this.handle({
      category,
      userMessage: `${context}: ${userMessage}`,
      technicalMessage: error instanceof Error ? error.stack : String(error),
      canRetry,
    });
  }

  /**
   * Check if error is Trojan-specific
   */
  private static isTrojanError(message: string): boolean {
    const trojanKeywords = ['trojan', 'Trojan', '认证失败', '密码错误', 'TLS 握手失败'];
    return trojanKeywords.some((keyword) => message.includes(keyword));
  }

  /**
   * Check if error is protocol-related
   */
  private static isProtocolError(message: string): boolean {
    return (
      message.includes('不支持的协议') ||
      message.includes('Protocol') ||
      message.includes('暂不支持')
    );
  }

  /**
   * Check if Trojan error is retryable
   */
  private static isTrojanErrorRetryable(message: string): boolean {
    // Authentication and config errors are not retryable
    if (
      message.includes('认证失败') ||
      message.includes('密码错误') ||
      message.includes('配置错误') ||
      message.includes('UUID 错误')
    ) {
      return false;
    }

    // Connection and timeout errors are retryable
    if (
      message.includes('连接超时') ||
      message.includes('连接被拒绝') ||
      message.includes('网络不可达')
    ) {
      return true;
    }

    // Default to retryable for other errors
    return true;
  }

  /**
   * 显示成功提示
   */
  static showSuccess(message: string): void {
    toast.success(message);
  }

  /**
   * 显示信息提示
   */
  static showInfo(message: string): void {
    toast.info(message);
  }

  /**
   * 显示警告提示
   */
  static showWarning(message: string): void {
    toast.warning(message);
  }

  /**
   * 显示错误提示
   */
  static showError(message: string, description?: string): void {
    toast.error(message, {
      description,
    });
  }

  private static handleConfigError(error: AppError): void {
    this.showError('配置错误', error.userMessage);
  }

  private static handleConnectionError(error: AppError): void {
    const action = error.canRetry
      ? {
          label: '重试',
          onClick: () => {
            // 触发重试逻辑
            console.log('Retry connection');
          },
        }
      : undefined;

    toast.error('连接错误', {
      description: error.userMessage,
      action,
    });
  }

  private static handleSystemError(error: AppError): void {
    this.showError('系统错误', error.userMessage);
  }

  private static handleProcessError(error: AppError): void {
    const action = error.canRetry
      ? {
          label: '重启',
          onClick: () => {
            // 触发重启逻辑
            console.log('Restart process');
          },
        }
      : undefined;

    toast.error('进程错误', {
      description: error.userMessage,
      action,
    });
  }

  private static handleUnknownError(error: AppError): void {
    this.showError('未知错误', error.userMessage);
  }
}

/**
 * 包装异步函数，自动处理错误
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      ErrorHandler.handleApiError(error, context);
      throw error;
    }
  }) as T;
}

/**
 * 安全执行异步函数，捕获并处理错误
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  context: string,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    ErrorHandler.handleApiError(error, context);
    return defaultValue;
  }
}
