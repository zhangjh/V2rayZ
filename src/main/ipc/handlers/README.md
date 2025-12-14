# IPC 处理器

本目录包含所有 IPC 处理器的实现，用于处理渲染进程发送的请求。

## 已实现的处理器

### 配置管理 (config-handlers.ts)
- `config:get` - 获取用户配置
- `config:save` - 保存用户配置
- `config:updateMode` - 更新代理模式
- `config:getValue` - 获取配置值
- `config:setValue` - 设置配置值

### 服务器管理 (server-handlers.ts)
- `server:parseUrl` - 解析服务器 URL
- `server:addFromUrl` - 从 URL 添加服务器
- `server:add` - 添加服务器
- `server:update` - 更新服务器
- `server:delete` - 删除服务器
- `server:getAll` - 获取所有服务器

### 日志管理 (log-handlers.ts)
- `logs:get` - 获取日志条目
- `logs:clear` - 清空日志
- `logs:setLevel` - 设置日志级别

#### 日志事件推送
日志处理器会自动监听 LogManager 的日志事件，并通过 IPC 事件发送器广播到所有渲染进程：
- 事件通道: `event:logReceived`
- 事件数据: `LogEntry` 对象，包含时间戳、级别、消息、来源和可选的堆栈信息
- 日志级别过滤: 只有满足当前日志级别的日志才会被广播

## 使用方式

### 在主进程中注册处理器

```typescript
import { registerConfigHandlers, registerServerHandlers, registerLogHandlers } from './ipc/handlers';
import { ConfigManager } from '../services/ConfigManager';
import { ProtocolParser } from '../services/ProtocolParser';
import { LogManager } from '../services/LogManager';

const configManager = new ConfigManager();
const protocolParser = new ProtocolParser();
const logManager = new LogManager();

// 注册处理器
registerConfigHandlers(configManager);
registerServerHandlers(protocolParser, configManager);
registerLogHandlers(logManager);
```

### 在渲染进程中调用

```typescript
// 调用 IPC 方法
const logs = await window.ipcRenderer.invoke('logs:get', { limit: 100 });

// 监听日志事件
window.ipcRenderer.on('event:logReceived', (event, log) => {
  console.log('New log:', log);
});
```

## 事件广播机制

日志事件使用 `IpcEventEmitter` 进行广播，确保所有打开的窗口都能接收到日志更新：

1. 主窗口创建时，通过 `ipcEventEmitter.registerWindow(mainWindow)` 注册
2. LogManager 触发 'log' 事件时，日志处理器调用 `broadcastEvent()` 广播到所有窗口
3. 渲染进程通过 `ipcRenderer.on()` 监听 `event:logReceived` 事件接收日志

这种机制支持多窗口场景，所有窗口都能实时接收日志更新。
