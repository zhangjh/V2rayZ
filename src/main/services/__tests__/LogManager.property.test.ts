/**
 * LogManager 属性测试
 * 使用 fast-check 进行基于属性的测试
 */

import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LogManager } from '../LogManager';
import type { LogEntry, LogLevel } from '../../../shared/types';

// ============================================================================
// 生成器 (Generators)
// ============================================================================

/**
 * 生成有效的日志级别
 */
const logLevelArbitrary = (): fc.Arbitrary<LogLevel> => {
  return fc.constantFrom('debug', 'info', 'warn', 'error', 'fatal');
};

/**
 * 生成有效的日志消息
 */
const logMessageArbitrary = (): fc.Arbitrary<string> => {
  return fc.string({ minLength: 1, maxLength: 500 });
};

/**
 * 生成有效的日志来源
 */
const logSourceArbitrary = (): fc.Arbitrary<string> => {
  return fc.constantFrom(
    'main',
    'proxy',
    'config',
    'system',
    'network',
    'ui',
    'ipc',
    'service'
  );
};

/**
 * 生成有效的堆栈信息
 */
const stackTraceArbitrary = (): fc.Arbitrary<string | undefined> => {
  return fc.option(
    fc.string({ minLength: 10, maxLength: 1000 }).map(s => `Error: ${s}\n    at function1\n    at function2`),
    { nil: undefined }
  );
};

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 创建临时日志目录
 */
async function createTempLogDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'v2rayz-log-test-'));
  return tempDir;
}

/**
 * 清理临时目录
 */
async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // 忽略清理错误
  }
}

/**
 * 等待一段时间（用于异步操作）
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// 属性测试
// ============================================================================

describe('LogManager Property Tests', () => {
  /**
   * Feature: electron-cross-platform, Property 21: 日志写入和转发
   * 对于任何日志记录请求，日志应该同时写入日志文件和通过 IPC 发送到前端，
   * 并且两者的内容应该一致。
   * 
   * Validates: Requirements 7.1
   */
  describe('Property 21: Log write and forward', () => {
    it('should write log to file and emit event with consistent content', async () => {
      await fc.assert(
        fc.asyncProperty(
          logLevelArbitrary(),
          logMessageArbitrary(),
          logSourceArbitrary(),
          stackTraceArbitrary(),
          async (level, message, source, stack) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 设置日志级别为 debug 以记录所有日志
              logManager.setLogLevel('debug');

              // 监听日志事件
              const receivedLogs: LogEntry[] = [];
              logManager.on('log', (log) => {
                receivedLogs.push(log);
              });

              // 添加日志
              logManager.addLog(level, message, source, stack);

              // 等待文件写入完成
              await logManager.flush();

              // 验证事件已触发
              expect(receivedLogs.length).toBe(1);
              const emittedLog = receivedLogs[0];

              // 验证事件内容
              expect(emittedLog.level).toBe(level);
              expect(emittedLog.message).toBe(message);
              expect(emittedLog.source).toBe(source);
              expect(emittedLog.stack).toBe(stack);

              // 验证文件已写入
              const logFilePath = path.join(tempDir, 'app.log');
              const fileContent = await fs.readFile(logFilePath, 'utf-8');

              // 验证文件包含日志内容
              expect(fileContent).toContain(message);
              expect(fileContent).toContain(level.toUpperCase());
              expect(fileContent).toContain(source);
              if (stack) {
                expect(fileContent).toContain(stack);
              }

              // 验证内存中的日志
              const logs = logManager.getLogs();
              expect(logs.length).toBe(1);
              expect(logs[0]).toEqual(emittedLog);
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency across multiple log entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              level: logLevelArbitrary(),
              message: logMessageArbitrary(),
              source: logSourceArbitrary(),
              stack: stackTraceArbitrary(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (logEntries) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 设置日志级别为 debug 以记录所有日志
              logManager.setLogLevel('debug');

              // 监听日志事件
              const receivedLogs: LogEntry[] = [];
              logManager.on('log', (log) => {
                receivedLogs.push(log);
              });

              // 添加所有日志
              for (const entry of logEntries) {
                logManager.addLog(entry.level, entry.message, entry.source, entry.stack);
              }

              // 等待文件写入完成
              await logManager.flush();

              // 验证事件数量
              expect(receivedLogs.length).toBe(logEntries.length);

              // 验证每个日志的内容
              for (let i = 0; i < logEntries.length; i++) {
                expect(receivedLogs[i].level).toBe(logEntries[i].level);
                expect(receivedLogs[i].message).toBe(logEntries[i].message);
                expect(receivedLogs[i].source).toBe(logEntries[i].source);
                expect(receivedLogs[i].stack).toBe(logEntries[i].stack);
              }

              // 验证文件内容
              const logFilePath = path.join(tempDir, 'app.log');
              const fileContent = await fs.readFile(logFilePath, 'utf-8');

              // 验证所有日志都在文件中
              for (const entry of logEntries) {
                expect(fileContent).toContain(entry.message);
              }

              // 验证内存中的日志
              const logs = logManager.getLogs();
              expect(logs.length).toBe(logEntries.length);
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should forward logs to multiple listeners', async () => {
      await fc.assert(
        fc.asyncProperty(
          logLevelArbitrary(),
          logMessageArbitrary(),
          logSourceArbitrary(),
          async (level, message, source) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 设置日志级别为 debug 以记录所有日志
              logManager.setLogLevel('debug');

              // 添加多个监听器
              const listener1Logs: LogEntry[] = [];
              const listener2Logs: LogEntry[] = [];
              const listener3Logs: LogEntry[] = [];

              logManager.on('log', (log) => listener1Logs.push(log));
              logManager.on('log', (log) => listener2Logs.push(log));
              logManager.on('log', (log) => listener3Logs.push(log));

              // 添加日志
              logManager.addLog(level, message, source);

              // 等待文件写入完成
              await logManager.flush();

              // 验证所有监听器都收到了日志
              expect(listener1Logs.length).toBe(1);
              expect(listener2Logs.length).toBe(1);
              expect(listener3Logs.length).toBe(1);

              // 验证内容一致
              expect(listener1Logs[0]).toEqual(listener2Logs[0]);
              expect(listener2Logs[0]).toEqual(listener3Logs[0]);
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Feature: electron-cross-platform, Property 22: 日志查询返回最近条目
   * 对于任何日志查询请求，返回的日志条目应该按时间倒序排列，
   * 并且数量不超过请求的限制。
   * 
   * Validates: Requirements 7.3
   */
  describe('Property 22: Log query returns recent entries', () => {
    it('should return logs in chronological order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              level: logLevelArbitrary(),
              message: logMessageArbitrary(),
              source: logSourceArbitrary(),
            }),
            { minLength: 2, maxLength: 50 }
          ),
          async (logEntries) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 设置日志级别为 debug 以记录所有日志
              logManager.setLogLevel('debug');

              // 添加所有日志（带延迟确保时间戳不同）
              for (const entry of logEntries) {
                logManager.addLog(entry.level, entry.message, entry.source);
                await wait(1); // 确保时间戳不同
              }

              // 等待文件写入完成
              await logManager.flush();

              // 获取所有日志
              const logs = logManager.getLogs();

              // 验证日志数量
              expect(logs.length).toBe(logEntries.length);

              // 验证日志按时间顺序排列（最早的在前）
              for (let i = 1; i < logs.length; i++) {
                expect(new Date(logs[i].timestamp).getTime()).toBeGreaterThanOrEqual(
                  new Date(logs[i - 1].timestamp).getTime()
                );
              }
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should respect limit parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          async (totalLogs, limit) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 添加指定数量的日志
              for (let i = 0; i < totalLogs; i++) {
                logManager.addLog('info', `Log message ${i}`, 'test');
              }

              // 获取限制数量的日志
              const logs = logManager.getLogs(limit);

              // 验证返回的日志数量不超过限制
              expect(logs.length).toBeLessThanOrEqual(limit);

              // 如果总日志数大于限制，应该返回最后的 N 条
              if (totalLogs > limit) {
                expect(logs.length).toBe(limit);
                // 验证返回的是最近的日志
                expect(logs[logs.length - 1].message).toBe(`Log message ${totalLogs - 1}`);
              } else {
                expect(logs.length).toBe(totalLogs);
              }
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return most recent logs when limit is specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 20, max: 100 }),
          fc.integer({ min: 5, max: 15 }),
          async (totalLogs, limit) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 添加日志
              for (let i = 0; i < totalLogs; i++) {
                logManager.addLog('info', `Message ${i}`, 'test');
              }

              // 获取限制数量的日志
              const logs = logManager.getLogs(limit);

              // 验证返回的是最近的日志
              expect(logs.length).toBe(Math.min(limit, totalLogs));

              // 验证最后一条日志是最新的
              const lastLog = logs[logs.length - 1];
              expect(lastLog.message).toBe(`Message ${totalLogs - 1}`);

              // 验证第一条日志是从正确位置开始的
              const firstLog = logs[0];
              const expectedStartIndex = Math.max(0, totalLogs - limit);
              expect(firstLog.message).toBe(`Message ${expectedStartIndex}`);
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle zero and negative limits gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }),
          async (totalLogs) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 添加日志
              for (let i = 0; i < totalLogs; i++) {
                logManager.addLog('info', `Message ${i}`, 'test');
              }

              // 测试 limit = 0
              const logsWithZero = logManager.getLogs(0);
              expect(logsWithZero.length).toBe(totalLogs);

              // 测试 limit = -1
              const logsWithNegative = logManager.getLogs(-1);
              expect(logsWithNegative.length).toBe(totalLogs);

              // 测试 undefined
              const logsWithUndefined = logManager.getLogs();
              expect(logsWithUndefined.length).toBe(totalLogs);
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Feature: electron-cross-platform, Property 23: 错误日志包含堆栈信息
   * 对于任何错误级别的日志，日志内容应该包含错误消息和完整的堆栈跟踪信息。
   * 
   * Validates: Requirements 7.4
   */
  describe('Property 23: Error logs contain stack information', () => {
    it('should include stack trace for error logs', async () => {
      await fc.assert(
        fc.asyncProperty(
          logMessageArbitrary(),
          logSourceArbitrary(),
          stackTraceArbitrary(),
          async (message, source, stack) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 设置日志级别为 debug 以记录所有日志
              logManager.setLogLevel('debug');

              // 添加错误日志
              logManager.addLog('error', message, source, stack);

              // 等待文件写入
              await logManager.flush();

              // 获取日志
              const logs = logManager.getLogs();
              expect(logs.length).toBe(1);

              const log = logs[0];
              expect(log.level).toBe('error');
              expect(log.message).toBe(message);
              expect(log.source).toBe(source);
              expect(log.stack).toBe(stack);

              // 验证文件内容
              const logFilePath = path.join(tempDir, 'app.log');
              const fileContent = await fs.readFile(logFilePath, 'utf-8');

              expect(fileContent).toContain(message);
              if (stack) {
                expect(fileContent).toContain(stack);
              }
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve stack trace through multiple operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              message: logMessageArbitrary(),
              source: logSourceArbitrary(),
              stack: fc.string({ minLength: 10, maxLength: 500 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (errorLogs) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 设置日志级别为 debug 以记录所有日志
              logManager.setLogLevel('debug');

              // 添加所有错误日志
              for (const entry of errorLogs) {
                logManager.addLog('error', entry.message, entry.source, entry.stack);
              }

              // 等待文件写入
              await logManager.flush();

              // 获取日志
              const logs = logManager.getLogs();
              expect(logs.length).toBe(errorLogs.length);

              // 验证每个日志都包含堆栈信息
              for (let i = 0; i < errorLogs.length; i++) {
                expect(logs[i].stack).toBe(errorLogs[i].stack);
                expect(logs[i].stack).toBeTruthy();
              }

              // 验证文件内容
              const logFilePath = path.join(tempDir, 'app.log');
              const fileContent = await fs.readFile(logFilePath, 'utf-8');

              // 验证所有堆栈信息都在文件中
              for (const entry of errorLogs) {
                expect(fileContent).toContain(entry.stack);
              }
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle fatal logs with stack traces', async () => {
      await fc.assert(
        fc.asyncProperty(
          logMessageArbitrary(),
          logSourceArbitrary(),
          fc.string({ minLength: 20, maxLength: 1000 }),
          async (message, source, stack) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 设置日志级别为 debug 以记录所有日志
              logManager.setLogLevel('debug');

              // 添加致命错误日志
              logManager.addLog('fatal', message, source, stack);

              // 等待文件写入
              await logManager.flush();

              // 获取日志
              const logs = logManager.getLogs();
              expect(logs.length).toBe(1);

              const log = logs[0];
              expect(log.level).toBe('fatal');
              expect(log.stack).toBe(stack);
              expect(log.stack).toBeTruthy();

              // 验证文件内容
              const logFilePath = path.join(tempDir, 'app.log');
              const fileContent = await fs.readFile(logFilePath, 'utf-8');

              expect(fileContent).toContain('FATAL');
              expect(fileContent).toContain(stack);
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Feature: electron-cross-platform, Property 24: 日志级别动态调整
   * 对于任何日志级别更改，后续的日志输出应该只包含大于等于新级别的日志
   * （例如设置为 WARN 后不应输出 INFO 日志）。
   * 
   * Validates: Requirements 7.5
   */
  describe('Property 24: Log level dynamic adjustment', () => {
    it('should filter logs based on current log level', async () => {
      await fc.assert(
        fc.asyncProperty(
          logLevelArbitrary(),
          fc.array(
            fc.record({
              level: logLevelArbitrary(),
              message: logMessageArbitrary(),
              source: logSourceArbitrary(),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          async (filterLevel, logEntries) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 设置日志级别
              logManager.setLogLevel(filterLevel);

              // 添加所有日志
              for (const entry of logEntries) {
                logManager.addLog(entry.level, entry.message, entry.source);
              }

              // 等待文件写入
              await logManager.flush();

              // 获取日志
              const logs = logManager.getLogs();

              // 定义级别优先级
              const levelPriority: Record<LogLevel, number> = {
                debug: 0,
                info: 1,
                warn: 2,
                error: 3,
                fatal: 4,
              };

              const filterPriority = levelPriority[filterLevel];

              // 验证所有记录的日志级别都大于等于过滤级别
              for (const log of logs) {
                expect(levelPriority[log.level]).toBeGreaterThanOrEqual(filterPriority);
              }

              // 计算应该被记录的日志数量
              const expectedCount = logEntries.filter(
                entry => levelPriority[entry.level] >= filterPriority
              ).length;

              expect(logs.length).toBe(expectedCount);
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update filtering when log level changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          logLevelArbitrary(),
          logLevelArbitrary(),
          async (initialLevel, newLevel) => {
            const tempDir = await createTempLogDir();
            const logManager = new LogManager(tempDir);

            try {
              // 设置初始日志级别
              logManager.setLogLevel(initialLevel);

              // 添加一些日志
              logManager.addLog('debug', 'Debug message', 'test');
              logManager.addLog('info', 'Info message', 'test');
              logManager.addLog('warn', 'Warn message', 'test');

              const logsAfterFirst = logManager.getLogs();

              // 更改日志级别
              logManager.setLogLevel(newLevel);

              // 清空日志以便测试新级别
              logManager.clearLogs();

              // 添加新的日志
              logManager.addLog('debug', 'Debug message 2', 'test');
              logManager.addLog('info', 'Info message 2', 'test');
              logManager.addLog('warn', 'Warn message 2', 'test');
              logManager.addLog('error', 'Error message 2', 'test');

              const logsAfterSecond = logManager.getLogs();

              // 定义级别优先级
              const levelPriority: Record<LogLevel, number> = {
                debug: 0,
                info: 1,
                warn: 2,
                error: 3,
                fatal: 4,
              };

              // 验证第一批日志符合初始级别
              for (const log of logsAfterFirst) {
                expect(levelPriority[log.level]).toBeGreaterThanOrEqual(
                  levelPriority[initialLevel]
                );
              }

              // 验证第二批日志符合新级别
              for (const log of logsAfterSecond) {
                expect(levelPriority[log.level]).toBeGreaterThanOrEqual(
                  levelPriority[newLevel]
                );
              }
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not log below current level', async () => {
      const tempDir = await createTempLogDir();
      const logManager = new LogManager(tempDir);

      try {
        // 设置为 ERROR 级别
        logManager.setLogLevel('error');

        // 尝试添加各种级别的日志
        logManager.addLog('debug', 'Debug message', 'test');
        logManager.addLog('info', 'Info message', 'test');
        logManager.addLog('warn', 'Warn message', 'test');
        logManager.addLog('error', 'Error message', 'test');
        logManager.addLog('fatal', 'Fatal message', 'test');

        // 获取日志
        const logs = logManager.getLogs();

        // 应该只有 error 和 fatal 级别的日志
        expect(logs.length).toBe(2);
        expect(logs[0].level).toBe('error');
        expect(logs[1].level).toBe('fatal');
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it('should log all levels when set to debug', async () => {
      const tempDir = await createTempLogDir();
      const logManager = new LogManager(tempDir);

      try {
        // 设置为 DEBUG 级别
        logManager.setLogLevel('debug');

        // 添加各种级别的日志
        logManager.addLog('debug', 'Debug message', 'test');
        logManager.addLog('info', 'Info message', 'test');
        logManager.addLog('warn', 'Warn message', 'test');
        logManager.addLog('error', 'Error message', 'test');
        logManager.addLog('fatal', 'Fatal message', 'test');

        // 获取日志
        const logs = logManager.getLogs();

        // 应该有所有 5 条日志
        expect(logs.length).toBe(5);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });
  });
});
