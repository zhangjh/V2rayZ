/**
 * 重试工具函数测试
 */

import { retry, withRetry } from '../retry';

describe('retry', () => {
  it('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await retry(fn, { maxRetries: 3 });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');
    
    const result = await retry(fn, { maxRetries: 3, delay: 10 });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('permanent error'));
    
    // 需要提供 shouldRetry 函数，因为默认的不会重试 'permanent error'
    await expect(retry(fn, { 
      maxRetries: 2, 
      delay: 10,
      shouldRetry: () => true // 总是重试
    })).rejects.toThrow('permanent error');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should not retry non-retryable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('permission denied'));
    
    const shouldRetry = (error: Error) => {
      return !error.message.includes('permission');
    };
    
    await expect(retry(fn, { maxRetries: 3, delay: 10, shouldRetry })).rejects.toThrow('permission denied');
    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it('should call onRetry callback', async () => {
    const error = new Error('error 1');
    const fn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');
    
    const onRetry = jest.fn();
    
    // 需要提供一个 shouldRetry 函数，因为默认的不会重试 'error 1'
    await retry(fn, { 
      maxRetries: 2, 
      delay: 10, 
      onRetry,
      shouldRetry: () => true // 总是重试
    });
    
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(error, 1);
  });
});

describe('withRetry', () => {
  it('should wrap function with retry logic', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');
    
    const wrappedFn = withRetry(fn, { maxRetries: 2, delay: 10 });
    const result = await wrappedFn('arg1', 'arg2');
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});
