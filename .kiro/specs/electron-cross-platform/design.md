# 设计文档

## 概述

本设计文档描述了将 V2rayZ 从 WPF + WebView2 架构迁移到 Electron + Node.js 跨平台架构的技术方案。该迁移将保留现有的 React 前端代码，重写后端服务层为 Node.js，并通过平台抽象层支持 Windows 和 macOS 双系统。

### 核心目标

1. **前端复用**: 最大化复用现有的 React + TypeScript 前端代码
2. **跨平台支持**: 在 Windows 和 macOS 上提供一致的用户体验
3. **架构清晰**: 采用分层架构，清晰分离关注点
4. **可维护性**: 使用 TypeScript 提供类型安全，便于长期维护

### 技术栈选择

- **前端框架**: React 18 + TypeScript + Vite（保持不变）
- **桌面框架**: Electron 28+
- **后端运行时**: Node.js 20+
- **进程通信**: Electron IPC (ipcMain/ipcRenderer)
- **构建工具**: electron-builder
- **代理核心**: sing-box（保持不变）

## 架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Application                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Renderer Process (React UI)                 │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  React Components (复用现有代码)                │  │  │
│  │  │  - Settings, Servers, Rules, Logs, etc.        │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  IPC Client (替代 NativeApi bridge)            │  │  │
│  │  │  - invoke/on methods for backend communication │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                  │
│                            │ IPC                              │
│                            ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           Main Process (Node.js Backend)              │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  IPC Handlers (API Layer)                      │  │  │
│  │  │  - Expose service methods to renderer          │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Service Layer                                  │  │  │
│  │  │  - ConfigManager                                │  │  │
│  │  │  - ProxyManager (sing-box lifecycle)           │  │  │
│  │  │  - SystemProxyManager                           │  │  │
│  │  │  - LogManager                                   │  │  │
│  │  │  - ProtocolParser                               │  │  │
│  │  │  - RoutingRuleManager                           │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Platform Abstraction Layer                     │  │  │
│  │  │  - SystemProxy (Windows/macOS)                  │  │  │
│  │  │  - AutoStart (Windows/macOS)                    │  │  │
│  │  │  - ProcessManager                               │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                  │
│                            │ Child Process                    │
│                            ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              sing-box Process                         │  │
│  │  - Proxy core (VLESS/Trojan)                         │  │
│  │  - System Proxy / TUN mode                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 分层架构

#### 1. 渲染进程层 (Renderer Process)

- **职责**: UI 渲染、用户交互、状态管理
- **技术**: React 18, TypeScript, Zustand, Tailwind CSS
- **通信**: 通过 Electron IPC 与主进程通信

#### 2. IPC 通信层

- **职责**: 定义前后端通信协议，类型安全的 API 调用
- **实现**: 
  - 主进程: `ipcMain.handle()` 注册处理器
  - 渲染进程: `ipcRenderer.invoke()` 调用方法
  - 事件推送: `webContents.send()` / `ipcRenderer.on()`

#### 3. 服务层 (Service Layer)

- **职责**: 业务逻辑实现，与 C# 服务层功能对等
- **服务模块**:
  - ConfigManager: 配置文件读写和验证
  - ProxyManager: sing-box 进程生命周期管理
  - SystemProxyManager: 系统代理设置
  - LogManager: 日志收集和管理
  - ProtocolParser: 协议 URL 解析
  - RoutingRuleManager: 路由规则生成

#### 4. 平台抽象层 (Platform Abstraction)

- **职责**: 封装平台特定的系统调用
- **实现**: 工厂模式根据 `process.platform` 返回对应实现
- **模块**:
  - SystemProxy: Windows (注册表) / macOS (networksetup)
  - AutoStart: Windows (注册表) / macOS (Login Items)
  - ProcessManager: 跨平台进程管理

## 组件和接口

### IPC 通信协议

#### 通道定义

```typescript
// src/shared/ipc-channels.ts
export const IPC_CHANNELS = {
  // Proxy Control
  PROXY_START: 'proxy:start',
  PROXY_STOP: 'proxy:stop',
  PROXY_GET_STATUS: 'proxy:getStatus',
  
  // Configuration
  CONFIG_GET: 'config:get',
  CONFIG_SAVE: 'config:save',
  CONFIG_UPDATE_MODE: 'config:updateMode',
  
  // Server Management
  SERVER_SWITCH: 'server:switch',
  SERVER_PARSE_URL: 'server:parseUrl',
  SERVER_ADD_FROM_URL: 'server:addFromUrl',
  
  // Events (Main -> Renderer)
  EVENT_PROXY_STARTED: 'event:proxyStarted',
  EVENT_PROXY_STOPPED: 'event:proxyStopped',
  EVENT_PROXY_ERROR: 'event:proxyError',
  EVENT_CONFIG_CHANGED: 'event:configChanged',
  EVENT_LOG_RECEIVED: 'event:logReceived',
} as const;
```

#### 类型定义

```typescript
// src/shared/types.ts
export interface UserConfig {
  servers: ServerConfig[];
  selectedServerId: string | null;
  proxyMode: 'global' | 'smart' | 'direct';
  proxyModeType: 'systemProxy' | 'tun';
  tunConfig: TunModeConfig;
  customRules: DomainRule[];
  autoStart: boolean;
  autoConnect: boolean;
  minimizeToTray: boolean;
  socksPort: number;
  httpPort: number;
}

export interface ServerConfig {
  id: string;
  name: string;
  protocol: 'vless' | 'trojan';
  address: string;
  port: number;
  uuid?: string;
  password?: string;
  encryption?: string;
  network?: 'tcp' | 'ws' | 'grpc';
  security?: 'none' | 'tls';
  tlsSettings?: TlsSettings;
  wsSettings?: WebSocketSettings;
}

export interface ProxyStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### 服务接口

#### ConfigManager

```typescript
// src/main/services/ConfigManager.ts
export interface IConfigManager {
  loadConfig(): Promise<UserConfig>;
  saveConfig(config: UserConfig): Promise<void>;
  get<T>(key: string): T | undefined;
  set(key: string, value: any): Promise<void>;
  validateConfig(config: UserConfig): void;
}

export class ConfigManager implements IConfigManager {
  private configPath: string;
  private currentConfig: UserConfig | null = null;
  
  constructor() {
    // 使用 Electron app.getPath('userData')
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
  }
  
  async loadConfig(): Promise<UserConfig> {
    // 实现配置加载逻辑
  }
  
  async saveConfig(config: UserConfig): Promise<void> {
    // 实现配置保存逻辑
  }
}
```

#### ProxyManager

```typescript
// src/main/services/ProxyManager.ts
export interface IProxyManager {
  start(config: UserConfig): Promise<void>;
  stop(): Promise<void>;
  restart(config: UserConfig): Promise<void>;
  getStatus(): ProxyStatus;
  generateSingBoxConfig(config: UserConfig): SingBoxConfig;
}

export class ProxyManager implements IProxyManager {
  private singboxProcess: ChildProcess | null = null;
  private startTime: Date | null = null;
  
  async start(config: UserConfig): Promise<void> {
    // 生成 sing-box 配置
    const singboxConfig = this.generateSingBoxConfig(config);
    
    // 写入配置文件
    const configPath = path.join(app.getPath('userData'), 'singbox_config.json');
    await fs.writeFile(configPath, JSON.stringify(singboxConfig, null, 2));
    
    // 启动 sing-box 进程
    const singboxPath = this.getSingBoxPath();
    this.singboxProcess = spawn(singboxPath, ['run', '-c', configPath]);
    
    // 监听进程输出和事件
    this.singboxProcess.stdout?.on('data', this.handleOutput);
    this.singboxProcess.stderr?.on('data', this.handleError);
    this.singboxProcess.on('exit', this.handleExit);
  }
  
  private getSingBoxPath(): string {
    // 根据平台返回对应的 sing-box 可执行文件路径
    const platform = process.platform;
    const resourcesPath = process.resourcesPath;
    
    if (platform === 'win32') {
      return path.join(resourcesPath, 'sing-box.exe');
    } else if (platform === 'darwin') {
      return path.join(resourcesPath, 'sing-box');
    }
    throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

#### SystemProxyManager

```typescript
// src/main/services/SystemProxyManager.ts
export interface ISystemProxyManager {
  enableProxy(address: string, port: number): Promise<void>;
  disableProxy(): Promise<void>;
  getProxyStatus(): Promise<SystemProxyStatus>;
}

// 平台抽象
export abstract class SystemProxyBase implements ISystemProxyManager {
  abstract enableProxy(address: string, port: number): Promise<void>;
  abstract disableProxy(): Promise<void>;
  abstract getProxyStatus(): Promise<SystemProxyStatus>;
}

// Windows 实现
export class WindowsSystemProxy extends SystemProxyBase {
  async enableProxy(address: string, port: number): Promise<void> {
    // 使用 regedit 或 node-windows-proxy 修改注册表
    const proxyServer = `http=${address}:${port};https=${address}:${port}`;
    // 实现注册表修改逻辑
  }
}

// macOS 实现
export class MacOSSystemProxy extends SystemProxyBase {
  async enableProxy(address: string, port: number): Promise<void> {
    // 使用 networksetup 命令
    const services = await this.getNetworkServices();
    for (const service of services) {
      await execAsync(`networksetup -setwebproxy "${service}" ${address} ${port}`);
      await execAsync(`networksetup -setsecurewebproxy "${service}" ${address} ${port}`);
    }
  }
  
  private async getNetworkServices(): Promise<string[]> {
    const { stdout } = await execAsync('networksetup -listallnetworkservices');
    return stdout.split('\n').slice(1).filter(s => s.trim());
  }
}

// 工厂函数
export function createSystemProxyManager(): ISystemProxyManager {
  if (process.platform === 'win32') {
    return new WindowsSystemProxy();
  } else if (process.platform === 'darwin') {
    return new MacOSSystemProxy();
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}
```

#### LogManager

```typescript
// src/main/services/LogManager.ts
export interface ILogManager {
  addLog(level: LogLevel, message: string, source: string): void;
  getLogs(limit?: number): LogEntry[];
  clearLogs(): void;
  on(event: 'log', listener: (log: LogEntry) => void): void;
}

export class LogManager extends EventEmitter implements ILogManager {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private logFilePath: string;
  
  constructor() {
    super();
    this.logFilePath = path.join(app.getPath('userData'), 'logs', 'app.log');
    this.ensureLogDirectory();
  }
  
  addLog(level: LogLevel, message: string, source: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      source,
    };
    
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // 写入文件
    this.writeToFile(entry);
    
    // 触发事件
    this.emit('log', entry);
  }
  
  private async writeToFile(entry: LogEntry): Promise<void> {
    const line = `[${entry.timestamp.toISOString()}] [${entry.level}] [${entry.source}] ${entry.message}\n`;
    await fs.appendFile(this.logFilePath, line);
  }
}
```

#### ProtocolParser

```typescript
// src/main/services/ProtocolParser.ts
export interface IProtocolParser {
  isSupported(url: string): boolean;
  parseUrl(url: string): ServerConfig;
}

export class ProtocolParser implements IProtocolParser {
  isSupported(url: string): boolean {
    return url.startsWith('vless://') || url.startsWith('trojan://');
  }
  
  parseUrl(url: string): ServerConfig {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol.replace(':', '') as 'vless' | 'trojan';
    
    if (protocol === 'vless') {
      return this.parseVless(urlObj);
    } else if (protocol === 'trojan') {
      return this.parseTrojan(urlObj);
    }
    
    throw new Error(`Unsupported protocol: ${protocol}`);
  }
  
  private parseVless(url: URL): ServerConfig {
    const uuid = url.username;
    const address = url.hostname;
    const port = parseInt(url.port) || 443;
    const params = new URLSearchParams(url.search);
    
    return {
      id: crypto.randomUUID(),
      name: decodeURIComponent(url.hash.slice(1)) || `${address}:${port}`,
      protocol: 'vless',
      address,
      port,
      uuid,
      encryption: params.get('encryption') || 'none',
      network: (params.get('type') as any) || 'tcp',
      security: (params.get('security') as any) || 'none',
      // 解析其他参数...
    };
  }
  
  private parseTrojan(url: URL): ServerConfig {
    // 类似的 Trojan 解析逻辑
  }
}
```

#### AutoStartManager

```typescript
// src/main/services/AutoStartManager.ts
export interface IAutoStartManager {
  setAutoStart(enabled: boolean): Promise<boolean>;
  isAutoStartEnabled(): Promise<boolean>;
}

export abstract class AutoStartBase implements IAutoStartManager {
  abstract setAutoStart(enabled: boolean): Promise<boolean>;
  abstract isAutoStartEnabled(): Promise<boolean>;
}

// Windows 实现
export class WindowsAutoStart extends AutoStartBase {
  private readonly appName = 'V2rayZ';
  private readonly regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  
  async setAutoStart(enabled: boolean): Promise<boolean> {
    const exePath = app.getPath('exe');
    
    if (enabled) {
      // 添加注册表项
      await execAsync(`reg add "${this.regKey}" /v "${this.appName}" /t REG_SZ /d "${exePath}" /f`);
    } else {
      // 删除注册表项
      await execAsync(`reg delete "${this.regKey}" /v "${this.appName}" /f`);
    }
    
    return true;
  }
  
  async isAutoStartEnabled(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`reg query "${this.regKey}" /v "${this.appName}"`);
      return stdout.includes(this.appName);
    } catch {
      return false;
    }
  }
}

// macOS 实现
export class MacOSAutoStart extends AutoStartBase {
  async setAutoStart(enabled: boolean): Promise<boolean> {
    // 使用 Electron 的 app.setLoginItemSettings
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
    });
    return true;
  }
  
  async isAutoStartEnabled(): Promise<boolean> {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  }
}

// 工厂函数
export function createAutoStartManager(): IAutoStartManager {
  if (process.platform === 'win32') {
    return new WindowsAutoStart();
  } else if (process.platform === 'darwin') {
    return new MacOSAutoStart();
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}
```

## 数据模型

### 配置文件结构

```json
{
  "servers": [
    {
      "id": "uuid-v4",
      "name": "Server Name",
      "protocol": "vless",
      "address": "example.com",
      "port": 443,
      "uuid": "uuid-v4",
      "encryption": "none",
      "network": "ws",
      "security": "tls",
      "tlsSettings": {
        "serverName": "example.com",
        "allowInsecure": false
      },
      "wsSettings": {
        "path": "/path",
        "headers": {
          "Host": "example.com"
        }
      }
    }
  ],
  "selectedServerId": "uuid-v4",
  "proxyMode": "smart",
  "proxyModeType": "systemProxy",
  "tunConfig": {
    "mtu": 9000,
    "stack": "system",
    "autoRoute": true,
    "strictRoute": true
  },
  "customRules": [
    {
      "domain": "example.com",
      "action": "proxy"
    }
  ],
  "autoStart": false,
  "autoConnect": false,
  "minimizeToTray": true,
  "socksPort": 65534,
  "httpPort": 65533
}
```

### sing-box 配置生成

```typescript
interface SingBoxConfig {
  log: {
    level: string;
    timestamp: boolean;
  };
  dns?: {
    servers: Array<{ address: string }>;
    strategy: string;
  };
  inbounds: Array<{
    type: string;
    tag: string;
    listen?: string;
    listen_port?: number;
    // TUN 模式特定配置
    interface_name?: string;
    mtu?: number;
    auto_route?: boolean;
    strict_route?: boolean;
    stack?: string;
  }>;
  outbounds: Array<{
    type: string;
    tag: string;
    server?: string;
    server_port?: number;
    uuid?: string;
    password?: string;
    // 传输层配置
    transport?: {
      type: string;
      path?: string;
      headers?: Record<string, string>;
    };
    // TLS 配置
    tls?: {
      enabled: boolean;
      server_name?: string;
      insecure?: boolean;
    };
  }>;
  route?: {
    rules: Array<{
      domain?: string[];
      domain_suffix?: string[];
      geosite?: string[];
      geoip?: string[];
      outbound: string;
    }>;
    rule_set?: Array<{
      tag: string;
      type: string;
      format: string;
      url: string;
    }>;
  };
}
```

## 正确性属性

*属性是指在系统所有有效执行中都应该成立的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性是人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: IPC 通信往返一致性

*对于任何* IPC 调用和参数，当渲染进程通过 `ipcRenderer.invoke()` 调用主进程方法时，主进程应该接收到相同的参数，并且返回值应该能够被渲染进程正确接收。

**验证: 需求 1.2**

### 属性 2: UI 交互触发正确的后端操作

*对于任何* UI 交互事件（如按钮点击、表单提交），系统应该触发对应的 IPC 调用，并且调用的通道名称和参数应该与交互类型匹配。

**验证: 需求 1.4**

### 属性 3: 窗口关闭行为遵循配置

*对于任何* 窗口关闭事件，如果 `minimizeToTray` 配置为 true，则窗口应该隐藏而不是退出；如果为 false，则应用应该完全退出。

**验证: 需求 1.5**

### 属性 4: 代理启动生成正确的进程

*对于任何* 有效的用户配置，当请求启动代理时，系统应该生成 sing-box 配置文件，启动 sing-box 进程，并且进程 ID 应该大于 0。

**验证: 需求 2.2**

### 属性 5: 代理停止清理所有资源

*对于任何* 正在运行的代理连接，当请求停止代理时，sing-box 进程应该被终止，系统代理设置应该被清理，并且进程状态应该变为未运行。

**验证: 需求 2.3**

### 属性 6: 日志捕获和转发

*对于任何* sing-box 进程输出的日志行，系统应该捕获该日志，解析日志级别和内容，并通过 IPC 事件发送到渲染进程。

**验证: 需求 2.4**

### 属性 7: 平台特定的系统代理方法

*对于任何* 系统代理启用请求，系统应该根据 `process.platform` 调用对应平台的实现（Windows 使用注册表，macOS 使用 networksetup）。

**验证: 需求 3.1**

### 属性 8: 跨平台托盘菜单一致性

*对于任何* 平台，系统托盘应该包含相同的菜单项集合（启动/停止代理、显示窗口、退出等），并且菜单项的功能应该一致。

**验证: 需求 3.2**

### 属性 9: 平台特定的自启动机制

*对于任何* 自启动设置请求，系统应该根据 `process.platform` 使用对应的机制（Windows 使用注册表，macOS 使用 Login Items）。

**验证: 需求 3.3**

### 属性 10: 系统信息跨平台兼容

*对于任何* 系统信息查询，返回的数据结构应该在所有平台上保持一致的字段和类型。

**验证: 需求 3.4**

### 属性 11: 平台特定的二进制文件加载

*对于任何* sing-box 二进制文件加载请求，系统应该根据 `process.platform` 返回对应平台的可执行文件路径（Windows 返回 .exe，macOS 返回无扩展名）。

**验证: 需求 3.5**

### 属性 12: 配置验证和保存

*对于任何* 配置修改请求，系统应该先验证配置的有效性（必填字段、类型检查、范围检查），只有验证通过才保存到文件。

**验证: 需求 4.2**

### 属性 13: 配置往返一致性

*对于任何* 有效的用户配置，保存到文件后重新加载，应该得到等价的配置对象（所有字段值相同）。

**验证: 需求 4.3**

### 属性 14: 配置文件权限保护

*对于任何* 保存的配置文件，文件权限应该设置为仅当前用户可读写（Unix: 0600，Windows: 仅所有者访问）。

**验证: 需求 4.5**

### 属性 15: 代理配置生成和进程启动

*对于任何* 有效的用户配置，启动代理时应该生成有效的 sing-box JSON 配置，并且 sing-box 进程应该成功启动（不立即退出）。

**验证: 需求 5.1**

### 属性 16: 进程状态监控

*对于任何* 正在运行的 sing-box 进程，系统应该能够查询进程状态（PID、运行时间），并且状态应该反映实际的进程状态。

**验证: 需求 5.2**

### 属性 17: 代理模式切换重启

*对于任何* 代理模式更改（全局/智能/直连），如果代理正在运行，系统应该重新生成配置并重启 sing-box 进程。

**验证: 需求 5.3**

### 属性 18: 进程优雅终止

*对于任何* 正在运行的 sing-box 进程，停止请求应该先尝试优雅终止（SIGTERM），如果超时则强制终止（SIGKILL）。

**验证: 需求 5.4**

### 属性 19: 系统代理往返恢复

*对于任何* 系统代理启用操作，记录原始代理设置，禁用后应该恢复到原始设置（而不是简单地禁用代理）。

**验证: 需求 6.3**

### 属性 20: 代理状态查询准确性

*对于任何* 代理状态查询，返回的启用状态和配置信息应该与系统实际的代理设置一致。

**验证: 需求 6.5**

### 属性 21: 日志写入和转发

*对于任何* 日志记录请求，日志应该同时写入日志文件和通过 IPC 发送到前端，并且两者的内容应该一致。

**验证: 需求 7.1**

### 属性 22: 日志查询返回最近条目

*对于任何* 日志查询请求，返回的日志条目应该按时间倒序排列，并且数量不超过请求的限制。

**验证: 需求 7.3**

### 属性 23: 错误日志包含堆栈信息

*对于任何* 错误级别的日志，日志内容应该包含错误消息和完整的堆栈跟踪信息。

**验证: 需求 7.4**

### 属性 24: 日志级别动态调整

*对于任何* 日志级别更改，后续的日志输出应该只包含大于等于新级别的日志（例如设置为 WARN 后不应输出 INFO 日志）。

**验证: 需求 7.5**

### 属性 25: VLESS URL 解析正确性

*对于任何* 有效的 VLESS 协议 URL，解析后的服务器配置应该包含所有必需字段（address、port、uuid），并且字段值应该与 URL 中的参数匹配。

**验证: 需求 8.1**

### 属性 26: Trojan URL 解析正确性

*对于任何* 有效的 Trojan 协议 URL，解析后的服务器配置应该包含所有必需字段（address、port、password），并且字段值应该与 URL 中的参数匹配。

**验证: 需求 8.2**

### 属性 27: 传输层配置解析

*对于任何* 包含传输层配置的协议 URL（WebSocket、gRPC），解析后的配置应该包含对应的传输设置（path、headers 等）。

**验证: 需求 8.4**

### 属性 28: TLS 配置解析

*对于任何* 包含 TLS 配置的协议 URL，解析后的配置应该包含 TLS 设置（serverName、allowInsecure 等）。

**验证: 需求 8.5**

### 属性 29: 自定义域名规则集成

*对于任何* 自定义域名规则，添加到配置后生成的 sing-box 配置应该在 route.rules 中包含对应的规则条目。

**验证: 需求 9.3**

### 属性 30: 路由规则修改触发重启

*对于任何* 路由规则修改（添加、删除、更新），如果代理正在运行，系统应该重新生成配置并重启代理。

**验证: 需求 9.4**

### 属性 31: 托盘操作触发正确行为

*对于任何* 托盘菜单操作（启动代理、停止代理、显示窗口），系统应该执行对应的功能，并且操作结果应该反映在应用状态中。

**验证: 需求 10.3**

### 属性 32: 自启动往返一致性

*对于任何* 自启动启用操作，启用后查询状态应该返回 true，禁用后查询状态应该返回 false。

**验证: 需求 11.3**

### 属性 33: 自启动状态查询准确性

*对于任何* 自启动状态查询，返回的状态应该与系统实际的自启动配置一致（Windows 检查注册表，macOS 检查 Login Items）。

**验证: 需求 11.4**

### 属性 34: 打包产物包含必要文件

*对于任何* 平台的打包产物，应该包含对应平台的 sing-box 可执行文件、前端资源文件、和必要的配置文件。

**验证: 需求 12.4**

### 属性 35: 打包输出包含版本信息

*对于任何* 打包完成的安装包，文件名或元数据应该包含应用版本号。

**验证: 需求 12.5**

## 错误处理

### 错误分类

1. **配置错误**: 配置文件格式错误、必填字段缺失、类型不匹配
2. **进程错误**: sing-box 启动失败、进程崩溃、进程无响应
3. **系统错误**: 系统代理设置失败、权限不足、文件 I/O 错误
4. **网络错误**: 连接超时、DNS 解析失败、证书验证失败
5. **平台错误**: 不支持的平台、平台特定 API 调用失败

### 错误处理策略

#### 1. 配置错误处理

```typescript
try {
  const config = await configManager.loadConfig();
} catch (error) {
  logger.error('Failed to load config', error);
  // 使用默认配置
  const config = createDefaultConfig();
  // 通知用户
  dialog.showErrorBox('配置加载失败', '将使用默认配置');
}
```

#### 2. 进程错误处理

```typescript
singboxProcess.on('exit', (code, signal) => {
  if (code !== 0) {
    logger.error(`sing-box exited with code ${code}`);
    // 解析错误原因
    const errorMessage = parseSingBoxError(lastErrorOutput);
    // 通知前端
    mainWindow.webContents.send('event:proxyError', {
      message: errorMessage,
      code,
    });
  }
});
```

#### 3. 系统代理错误处理

```typescript
async enableProxy(address: string, port: number): Promise<void> {
  // 保存原始设置
  const originalSettings = await this.getProxyStatus();
  
  try {
    await this.setSystemProxy(address, port);
  } catch (error) {
    logger.error('Failed to set system proxy', error);
    // 回滚到原始设置
    await this.restoreProxySettings(originalSettings);
    throw new Error('系统代理设置失败，已回滚更改');
  }
}
```

#### 4. 全局异常捕获

```typescript
// 主进程
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  // 记录到文件
  // 不退出应用，尝试恢复
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', reason);
});

// 渲染进程
window.addEventListener('error', (event) => {
  console.error('Renderer error', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Renderer unhandled rejection', event.reason);
});
```

### 错误恢复机制

1. **自动重试**: 对于临时性错误（网络超时、进程启动失败），自动重试最多 3 次
2. **明确错误报告**: 如果启动失败（如 TUN 模式失败），向用户显示明确的错误信息，不进行自动降级
3. **状态恢复**: 应用崩溃后重启，尝试恢复上次的连接状态
4. **资源清理**: 确保异常退出时清理系统代理设置和进程

## 测试策略

### 单元测试

使用 Jest 进行单元测试，覆盖以下模块：

1. **ConfigManager**: 配置加载、保存、验证
2. **ProtocolParser**: VLESS/Trojan URL 解析
3. **RoutingRuleManager**: 路由规则生成
4. **LogManager**: 日志记录和查询
5. **平台抽象层**: 各平台实现的单元测试

测试框架: Jest + TypeScript

```typescript
// 示例: ConfigManager 单元测试
describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempDir: string;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v2rayz-test-'));
    configManager = new ConfigManager(tempDir);
  });
  
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });
  
  test('should create default config on first load', async () => {
    const config = await configManager.loadConfig();
    expect(config.servers).toEqual([]);
    expect(config.proxyMode).toBe('smart');
  });
  
  test('should save and load config', async () => {
    const config = createTestConfig();
    await configManager.saveConfig(config);
    
    const loaded = await configManager.loadConfig();
    expect(loaded).toEqual(config);
  });
  
  test('should validate config before saving', async () => {
    const invalidConfig = { ...createTestConfig(), httpPort: -1 };
    await expect(configManager.saveConfig(invalidConfig)).rejects.toThrow();
  });
});
```

### 集成测试

使用 Spectron 或 Playwright 进行 Electron 应用的集成测试：

1. **应用启动**: 测试应用能否正常启动和初始化
2. **IPC 通信**: 测试前后端通信是否正常
3. **代理启动停止**: 测试完整的代理启动停止流程
4. **配置持久化**: 测试配置修改后重启应用是否保留

### 端到端测试

测试完整的用户工作流：

1. **添加服务器**: 从 URL 导入服务器配置
2. **启动代理**: 选择服务器并启动代理连接
3. **切换模式**: 在全局/智能/直连模式之间切换
4. **查看日志**: 查看代理运行日志
5. **停止代理**: 停止代理并清理资源

### 跨平台测试

在 CI/CD 中配置多平台测试：

- **Windows**: GitHub Actions (windows-latest)
- **macOS**: GitHub Actions (macos-latest)

确保所有平台特定功能在对应平台上正常工作。
