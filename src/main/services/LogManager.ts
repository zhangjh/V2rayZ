/**
 * 日志管理服务
 * 负责日志记录、存储、查询和级别过滤
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { LogEntry, LogLevel } from '../../shared/types';
import { getLogsPath } from '../utils/paths';

export interface ILogManager {
  addLog(level: LogLevel, message: string, source: string, stack?: string): void;
  getLogs(limit?: number): LogEntry[];
  clearLogs(): void;
  setLogLevel(level: LogLevel): void;
  getLogLevel(): LogLevel;
  on(event: 'log', listener: (log: LogEntry) => void): void;
  off(event: 'log', listener: (log: LogEntry) => void): void;
}

export class LogManager extends EventEmitter implements ILogManager {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private logFilePath: string;
  private currentLogLevel: LogLevel = 'info';
  private logLevelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };
  private maxLogFileSize = 10 * 1024 * 1024; // 10MB
  private maxLogFiles = 5;

  private initPromise: Promise<void>;
  private pendingWrites: Set<Promise<void>> = new Set();

  constructor(logDir?: string) {
    super();
    // 使用统一的路径工具，确保始终使用正确的用户数据路径
    const baseLogDir = logDir || getLogsPath();
    this.logFilePath = path.join(baseLogDir, 'app.log');
    this.initPromise = this.ensureLogDirectory();
  }

  /**
   * 确保日志目录存在
   */
  private async ensureLogDirectory(): Promise<void> {
    const logDir = path.dirname(this.logFilePath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  /**
   * 获取当前日志级别
   */
  getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  /**
   * 检查日志级别是否应该被记录
   */
  private shouldLog(level: LogLevel): boolean {
    return this.logLevelPriority[level] >= this.logLevelPriority[this.currentLogLevel];
  }

  /**
   * 添加日志条目
   */
  addLog(level: LogLevel, message: string, source: string, stack?: string): void {
    // 检查日志级别过滤
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source,
      stack,
    };

    // 添加到内存日志
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 异步写入文件
    const writePromise = this.writeToFile(entry)
      .catch((error) => {
        console.error('Failed to write log to file:', error);
      })
      .finally(() => {
        this.pendingWrites.delete(writePromise);
      });

    this.pendingWrites.add(writePromise);

    // 触发事件
    this.emit('log', entry);
  }

  /**
   * 等待所有待处理的写入操作完成
   * 主要用于测试和优雅关闭
   */
  async flush(): Promise<void> {
    await Promise.all(Array.from(this.pendingWrites));
  }

  /**
   * 获取日志条目
   */
  getLogs(limit?: number): LogEntry[] {
    if (limit === undefined || limit <= 0) {
      return [...this.logs];
    }
    return this.logs.slice(-limit);
  }

  /**
   * 清空日志（内存和文件）
   */
  clearLogs(): void {
    this.logs = [];
    // 异步清空日志文件
    this.clearLogFiles().catch((error) => {
      console.error('Failed to clear log files:', error);
    });
  }

  /**
   * 清空所有日志文件
   */
  private async clearLogFiles(): Promise<void> {
    try {
      await this.initPromise;
      const logDir = path.dirname(this.logFilePath);
      const logBaseName = path.basename(this.logFilePath, '.log');

      // 清空主日志文件（截断为空）
      try {
        await fs.writeFile(this.logFilePath, '', 'utf-8');
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.error('Failed to clear main log file:', error);
        }
      }

      // 删除所有轮转的日志文件
      for (let i = 1; i <= this.maxLogFiles; i++) {
        const rotatedLogFile = path.join(logDir, `${logBaseName}.${i}.log`);
        try {
          await fs.unlink(rotatedLogFile);
        } catch (error: any) {
          // 文件不存在，忽略
          if (error.code !== 'ENOENT') {
            console.error(`Failed to delete rotated log file ${rotatedLogFile}:`, error);
          }
        }
      }

      console.log('All log files cleared');
    } catch (error) {
      console.error('Failed to clear log files:', error);
    }
  }

  /**
   * 写入日志到文件
   */
  private async writeToFile(entry: LogEntry): Promise<void> {
    try {
      // 等待初始化完成
      await this.initPromise;

      // 检查文件大小，如果超过限制则轮转
      await this.rotateLogIfNeeded();

      const line = this.formatLogEntry(entry);
      await fs.appendFile(this.logFilePath, line + '\n', 'utf-8');
    } catch (error) {
      console.error('Failed to write log entry:', error);
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp; // 已经是 ISO 字符串
    const level = entry.level.toUpperCase().padEnd(5);
    const source = entry.source.padEnd(20);
    let line = `[${timestamp}] [${level}] [${source}] ${entry.message}`;

    if (entry.stack) {
      line += `\n${entry.stack}`;
    }

    return line;
  }

  /**
   * 检查并轮转日志文件
   */
  private async rotateLogIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.logFilePath);
      if (stats.size >= this.maxLogFileSize) {
        await this.rotateLogFiles();
      }
    } catch (error: any) {
      // 文件不存在，不需要轮转
      if (error.code !== 'ENOENT') {
        console.error('Failed to check log file size:', error);
      }
    }
  }

  /**
   * 轮转日志文件
   */
  private async rotateLogFiles(): Promise<void> {
    try {
      const logDir = path.dirname(this.logFilePath);
      const logBaseName = path.basename(this.logFilePath, '.log');

      // 删除最旧的日志文件
      const oldestLog = path.join(logDir, `${logBaseName}.${this.maxLogFiles}.log`);
      try {
        await fs.unlink(oldestLog);
      } catch (error: any) {
        // 文件不存在，忽略
        if (error.code !== 'ENOENT') {
          console.error('Failed to delete oldest log file:', error);
        }
      }

      // 重命名现有日志文件
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldPath = path.join(logDir, `${logBaseName}.${i}.log`);
        const newPath = path.join(logDir, `${logBaseName}.${i + 1}.log`);
        try {
          await fs.rename(oldPath, newPath);
        } catch (error: any) {
          // 文件不存在，忽略
          if (error.code !== 'ENOENT') {
            console.error(`Failed to rename log file ${oldPath}:`, error);
          }
        }
      }

      // 重命名当前日志文件
      const newPath = path.join(logDir, `${logBaseName}.1.log`);
      await fs.rename(this.logFilePath, newPath);
    } catch (error) {
      console.error('Failed to rotate log files:', error);
    }
  }
}
