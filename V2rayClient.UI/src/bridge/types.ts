/**
 * TypeScript type definitions for the Native API Bridge
 */

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export interface ConnectionStatus {
  v2ray: {
    running: boolean
    pid?: number
    uptime?: number
    error?: string
  }
  proxy: {
    enabled: boolean
    server?: string
  }
}

export interface TrafficStats {
  uploadTotal: number
  downloadTotal: number
  uploadSpeed: number
  downloadSpeed: number
}

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
  source?: string
}

export type ProtocolType = 'Vless' | 'Trojan'

export interface ServerConfig {
  protocol: ProtocolType
  address: string
  port: number
  network: 'Tcp' | 'Ws' | 'H2'
  security: 'None' | 'Tls'
  tlsSettings?: TlsSettings
  wsSettings?: WsSettings
  
  // VLESS specific fields (optional)
  uuid?: string
  encryption?: string
  
  // Trojan specific fields (optional)
  password?: string
}

export interface TlsSettings {
  serverName?: string
  allowInsecure?: boolean
}

export interface WsSettings {
  path?: string
  host?: string
}

export interface DomainRule {
  id?: string
  domain: string
  strategy: 'Proxy' | 'Direct'
  enabled: boolean
}

export interface ServerConfigWithId extends ServerConfig {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface UserConfig {
  servers: ServerConfigWithId[]
  selectedServerId?: string
  server?: ServerConfig // Legacy field for backward compatibility
  proxyMode: 'Global' | 'Smart' | 'Direct'
  customRules: DomainRule[]
  autoStart: boolean
  autoConnect: boolean
  minimizeToTray: boolean
  socksPort: number
  httpPort: number
}

export type ProxyMode = 'Global' | 'Smart' | 'Direct'

export interface NativeEventData {
  processStarted: { processId: number; timestamp: string }
  processStopped: { processId: number; timestamp: string }
  processError: { processId: number; timestamp: string; error: string }
  configChanged: { key?: string; oldValue?: any; newValue?: any }
  statsUpdated: TrafficStats
  logReceived: LogEntry
}

export type NativeEventListener<K extends keyof NativeEventData> = (
  data: NativeEventData[K]
) => void
