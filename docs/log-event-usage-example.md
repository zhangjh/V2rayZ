# 日志事件使用示例

本文档展示如何在渲染进程中使用日志 IPC 事件。

## 功能概述

日志管理服务会自动将所有日志事件推送到渲染进程，包括：
- 应用日志
- 代理核心日志
- 系统操作日志
- 错误日志

## 在渲染进程中监听日志事件

### 1. 基本用法

```typescript
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { LogEntry } from '../shared/types';

// 监听日志事件
window.ipcRenderer.on(IPC_CHANNELS.EVENT_LOG_RECEIVED, (event, log: LogEntry) => {
  console.log(`[${log.level}] ${log.message}`);
  
  // 更新 UI
  addLogToUI(log);
});
```

### 2. 在 React 组件中使用

```typescript
import { useEffect, useState } from 'react';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { LogEntry } from '../shared/types';

function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // 获取历史日志
    window.ipcRenderer.invoke(IPC_CHANNELS.LOGS_GET, { limit: 100 })
      .then((historicalLogs: LogEntry[]) => {
        setLogs(historicalLogs);
      });

    // 监听新日志
    const handleLog = (event: any, log: LogEntry) => {
      setLogs(prev => [...prev, log].slice(-100)); // 保留最近 100 条
    };

    window.ipcRenderer.on(IPC_CHANNELS.EVENT_LOG_RECEIVED, handleLog);

    // 清理
    return () => {
      window.ipcRenderer.removeListener(IPC_CHANNELS.EVENT_LOG_RECEIVED, handleLog);
    };
  }, []);

  return (
    <div className="log-viewer">
      {logs.map((log, index) => (
        <div key={index} className={`log-entry log-${log.level}`}>
          <span className="timestamp">{new Date(log.timestamp).toLocaleTimeString()}</span>
          <span className="level">{log.level.toUpperCase()}</span>
          <span className="source">{log.source}</span>
          <span className="message">{log.message}</span>
          {log.stack && <pre className="stack">{log.stack}</pre>}
        </div>
      ))}
    </div>
  );
}
```

### 3. 使用 Zustand 状态管理

```typescript
import { create } from 'zustand';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { LogEntry } from '../shared/types';

interface LogStore {
  logs: LogEntry[];
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  loadLogs: () => Promise<void>;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  
  addLog: (log) => set((state) => ({
    logs: [...state.logs, log].slice(-1000) // 保留最近 1000 条
  })),
  
  clearLogs: async () => {
    await window.ipcRenderer.invoke(IPC_CHANNELS.LOGS_CLEAR);
    set({ logs: [] });
  },
  
  loadLogs: async () => {
    const logs = await window.ipcRenderer.invoke(IPC_CHANNELS.LOGS_GET);
    set({ logs });
  },
}));

// 在应用初始化时设置监听器
export function initializeLogListener() {
  const { addLog } = useLogStore.getState();
  
  window.ipcRenderer.on(IPC_CHANNELS.EVENT_LOG_RECEIVED, (event, log: LogEntry) => {
    addLog(log);
  });
}
```

### 4. 日志级别过滤

```typescript
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { LogLevel } from '../shared/types';

// 设置日志级别
async function setLogLevel(level: LogLevel) {
  await window.ipcRenderer.invoke(IPC_CHANNELS.LOGS_SET_LEVEL, { level });
}

// 示例：只显示警告和错误
setLogLevel('warn');
```

## LogEntry 数据结构

```typescript
interface LogEntry {
  timestamp: Date;      // 日志时间戳
  level: LogLevel;      // 日志级别: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  message: string;      // 日志消息
  source: string;       // 日志来源（如 'Main', 'ProxyManager', 'sing-box'）
  stack?: string;       // 错误堆栈（仅错误日志）
}
```

## 日志级别说明

- `debug`: 调试信息，默认不显示
- `info`: 一般信息，如操作成功
- `warn`: 警告信息，如配置问题
- `error`: 错误信息，如操作失败
- `fatal`: 致命错误，如应用崩溃

## 最佳实践

1. **限制日志数量**: 在 UI 中只保留最近的日志条目，避免内存占用过大
2. **日志级别过滤**: 根据用户需求提供日志级别过滤功能
3. **性能优化**: 使用虚拟滚动处理大量日志
4. **错误高亮**: 为不同级别的日志使用不同的颜色
5. **搜索功能**: 提供日志搜索和过滤功能

## 示例：完整的日志面板组件

```typescript
import { useEffect, useState } from 'react';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import type { LogEntry, LogLevel } from '../shared/types';

function LogPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // 加载历史日志
    window.ipcRenderer.invoke(IPC_CHANNELS.LOGS_GET, { limit: 500 })
      .then(setLogs);

    // 监听新日志
    const handleLog = (event: any, log: LogEntry) => {
      setLogs(prev => [...prev, log].slice(-500));
    };

    window.ipcRenderer.on(IPC_CHANNELS.EVENT_LOG_RECEIVED, handleLog);

    return () => {
      window.ipcRenderer.removeListener(IPC_CHANNELS.EVENT_LOG_RECEIVED, handleLog);
    };
  }, []);

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.level === filter);

  const handleClear = async () => {
    await window.ipcRenderer.invoke(IPC_CHANNELS.LOGS_CLEAR);
    setLogs([]);
  };

  return (
    <div className="log-panel">
      <div className="log-controls">
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
          <option value="fatal">Fatal</option>
        </select>
        
        <label>
          <input 
            type="checkbox" 
            checked={autoScroll} 
            onChange={(e) => setAutoScroll(e.target.checked)} 
          />
          Auto Scroll
        </label>
        
        <button onClick={handleClear}>Clear Logs</button>
      </div>

      <div className="log-list">
        {filteredLogs.map((log, index) => (
          <div key={index} className={`log-entry log-${log.level}`}>
            <span className="timestamp">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="level">{log.level.toUpperCase()}</span>
            <span className="source">{log.source}</span>
            <span className="message">{log.message}</span>
            {log.stack && (
              <details>
                <summary>Stack Trace</summary>
                <pre>{log.stack}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 相关文件

- `src/main/services/LogManager.ts` - 日志管理服务
- `src/main/ipc/handlers/log-handlers.ts` - 日志 IPC 处理器
- `src/main/ipc/ipc-events.ts` - IPC 事件发送器
- `src/shared/ipc-channels.ts` - IPC 通道定义
- `src/shared/types.ts` - 类型定义
