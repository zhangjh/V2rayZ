// 用户配置
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

// 服务器配置
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

// TLS 设置
export interface TlsSettings {
  serverName?: string;
  allowInsecure?: boolean;
  alpn?: string[];
}

// WebSocket 设置
export interface WebSocketSettings {
  path?: string;
  headers?: Record<string, string>;
}

// TUN 模式配置
export interface TunModeConfig {
  mtu: number;
  stack: 'system' | 'gvisor' | 'mixed';
  autoRoute: boolean;
  strictRoute: boolean;
}

// 域名规则
export interface DomainRule {
  domain: string;
  action: 'proxy' | 'direct' | 'block';
}

// 代理状态
export interface ProxyStatus {
  running: boolean;
  pid?: number;
  uptime?: number;
  error?: string;
}

// 日志条目
export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: string;
}

// API 响应
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 系统代理状态
export interface SystemProxyStatus {
  enabled: boolean;
  address?: string;
  port?: number;
}
