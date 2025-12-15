/**
 * 日志事件转发集成测试
 * 验证日志事件能够正确从 LogManager 转发到渲染进程
 */

import { LogManager } from '../../services/LogManager';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { LogEntry, LogLevel } from '../../../shared/types';

// Mock IPC 事件发送器
let mockBroadcastedEvents: Array<{ channel: string; data: any }> = [];

jest.mock('../ipc-events', () => ({
  broadcastEvent: jest.fn((channel: string, data: any) => {
    mockBroadcastedEvents.push({ channel, data });
  }),
  ipcEventEmitter: {
    registerWindow: jest.fn(),
    unregisterWindow: jest.fn(),
    sendToAll: jest.fn(),
    getWindowCount: jest.fn(() => 1),
    clear: jest.fn(),
  },
}));

// 导入被测试的模块（在 mock 之后）
import { registerLogHandlers } from '../handlers/log-handlers';
import { broadcastEvent } from '../ipc-events';

describe('Log Event Forwarding Integration', () => {
  let logManager: LogManager;

  beforeEach(() => {
    // 清空 mock 数据
    mockBroadcastedEvents = [];
    jest.clearAllMocks();

    // 创建 LogManager 实例
    logManager = new LogManager();

    // 注册日志处理器
    registerLogHandlers(logManager);
  });

  afterEach(() => {
    // 清理
    logManager.removeAllListeners();
  });

  describe('Event Forwarding', () => {
    it('should broadcast log event when log is added', () => {
      // 添加日志
      logManager.addLog('info', 'Test message', 'TestSource');

      // 验证事件被广播
      expect(broadcastEvent).toHaveBeenCalledTimes(1);
      expect(broadcastEvent).toHaveBeenCalledWith(
        IPC_CHANNELS.EVENT_LOG_RECEIVED,
        expect.objectContaining({
          level: 'info',
          message: 'Test message',
          source: 'TestSource',
        })
      );
    });

    it('should broadcast multiple log events', () => {
      // 添加多个日志
      logManager.addLog('info', 'Message 1', 'Source1');
      logManager.addLog('warn', 'Message 2', 'Source2');
      logManager.addLog('error', 'Message 3', 'Source3');

      // 验证所有事件都被广播
      expect(broadcastEvent).toHaveBeenCalledTimes(3);

      const calls = (broadcastEvent as jest.Mock).mock.calls;
      expect(calls[0][0]).toBe(IPC_CHANNELS.EVENT_LOG_RECEIVED);
      expect(calls[0][1]).toMatchObject({
        level: 'info',
        message: 'Message 1',
        source: 'Source1',
      });

      expect(calls[1][0]).toBe(IPC_CHANNELS.EVENT_LOG_RECEIVED);
      expect(calls[1][1]).toMatchObject({
        level: 'warn',
        message: 'Message 2',
        source: 'Source2',
      });

      expect(calls[2][0]).toBe(IPC_CHANNELS.EVENT_LOG_RECEIVED);
      expect(calls[2][1]).toMatchObject({
        level: 'error',
        message: 'Message 3',
        source: 'Source3',
      });
    });

    it('should include stack trace in error logs', () => {
      const stackTrace = 'Error: Test error\n    at test.js:10:5';

      // 添加带堆栈的错误日志
      logManager.addLog('error', 'Error occurred', 'ErrorSource', stackTrace);

      // 验证堆栈信息被包含
      expect(broadcastEvent).toHaveBeenCalledWith(
        IPC_CHANNELS.EVENT_LOG_RECEIVED,
        expect.objectContaining({
          level: 'error',
          message: 'Error occurred',
          source: 'ErrorSource',
          stack: stackTrace,
        })
      );
    });

    it('should respect log level filtering', () => {
      // 设置日志级别为 warn
      logManager.setLogLevel('warn');

      // 添加不同级别的日志
      logManager.addLog('debug', 'Debug message', 'Source');
      logManager.addLog('info', 'Info message', 'Source');
      logManager.addLog('warn', 'Warn message', 'Source');
      logManager.addLog('error', 'Error message', 'Source');

      // 只有 warn 和 error 级别的日志应该被广播
      expect(broadcastEvent).toHaveBeenCalledTimes(2);

      const calls = (broadcastEvent as jest.Mock).mock.calls;
      expect(calls[0][1].level).toBe('warn');
      expect(calls[1][1].level).toBe('error');
    });

    it('should include timestamp in log events', () => {
      const beforeTime = new Date();

      logManager.addLog('info', 'Test message', 'Source');

      const afterTime = new Date();

      expect(broadcastEvent).toHaveBeenCalledWith(
        IPC_CHANNELS.EVENT_LOG_RECEIVED,
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );

      const logEntry = (broadcastEvent as jest.Mock).mock.calls[0][1] as LogEntry;
      const logTime = new Date(logEntry.timestamp).getTime();
      expect(logTime).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(logTime).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle all log levels', () => {
      // 设置日志级别为 debug 以确保所有级别都被记录
      logManager.setLogLevel('debug');

      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];

      levels.forEach((level) => {
        logManager.addLog(level, `${level} message`, 'Source');
      });

      expect(broadcastEvent).toHaveBeenCalledTimes(levels.length);

      const calls = (broadcastEvent as jest.Mock).mock.calls;
      levels.forEach((level, index) => {
        expect(calls[index][1].level).toBe(level);
      });
    });
  });

  describe('Event Channel', () => {
    it('should use correct IPC channel for log events', () => {
      logManager.addLog('info', 'Test', 'Source');

      expect(broadcastEvent).toHaveBeenCalledWith(
        IPC_CHANNELS.EVENT_LOG_RECEIVED,
        expect.any(Object)
      );
    });

    it('should use EVENT_LOG_RECEIVED channel constant', () => {
      logManager.addLog('info', 'Test', 'Source');

      const channel = (broadcastEvent as jest.Mock).mock.calls[0][0];
      expect(channel).toBe('event:logReceived');
      expect(channel).toBe(IPC_CHANNELS.EVENT_LOG_RECEIVED);
    });
  });
});
