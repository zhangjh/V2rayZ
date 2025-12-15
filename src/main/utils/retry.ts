/**
 * 重试工具函数
 * 用于处理临时性错误的自动重试
 */

/**
 * 重试选项
 */
export interface RetryOptions {
  /**
   * 最大重试次数
   */
  maxRetries: number;

  /**
   * 重试延迟（毫秒）
   */
  delay: number;

  /**
   * 是否使用指数退避
   */
  exponentialBackoff?: boolean;

  /**
   * 判断错误是否可重试的函数
   */
  shouldRetry?: (error: Error) => boolean;

  /**
   * 重试前的回调
   */
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * 默认的可重试错误判断
 */
function defaultShouldRetry(error: Error): boolean {
  const message = error.message.toLowerCase();
  const errorCode = (error as NodeJS.ErrnoException).code;

  // 网络相关的临时性错误
  const temporaryErrors = [
    'timeout',
    'timed out',
    'econnrefused',
    'econnreset',
    'etimedout',
    'enetunreach',
    'ehostunreach',
    'enotfound',
    'temporary failure',
  ];

  // 检查错误码
  if (errorCode && temporaryErrors.includes(errorCode.toLowerCase())) {
    return true;
  }

  // 检查错误消息
  return temporaryErrors.some((pattern) => message.includes(pattern));
}

/**
 * 执行带重试的异步操作
 *
 * @param fn 要执行的异步函数
 * @param options 重试选项
 * @returns 函数执行结果
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    exponentialBackoff = true,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  // 尝试执行函数，包括初始尝试和重试
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 如果已经达到最大重试次数，抛出错误
      if (attempt >= maxRetries) {
        throw lastError;
      }

      // 检查是否应该重试
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // 计算延迟时间
      const currentDelay = exponentialBackoff ? delay * Math.pow(2, attempt) : delay;

      // 调用重试回调
      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      console.log(
        `操作失败，将在 ${currentDelay}ms 后进行第 ${attempt + 1} 次重试...`,
        lastError.message
      );

      // 等待后重试
      await sleep(currentDelay);
    }
  }

  // 理论上不会到达这里，但为了类型安全
  throw lastError || new Error('重试失败');
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建带重试的函数包装器
 *
 * @param fn 要包装的函数
 * @param options 重试选项
 * @returns 包装后的函数
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: Partial<RetryOptions> = {}
): T {
  return (async (...args: any[]) => {
    return retry(() => fn(...args), options);
  }) as T;
}
