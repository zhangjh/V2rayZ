/**
 * TypeScript type definitions for the Native API Bridge
 * This file should be copied to the React project for type safety
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ConnectionStatus {
  v2ray: {
    running: boolean;
    pid?: number;
    uptime?: number;
    error?: string;
  };
  proxy: {
    enabled: boolean;
    server?: string;
  };
}

export interface TrafficStats {
  uploadTotal: number;
  downloadTotal: number;
  uploadSpeed: number;
  downloadSpeed: number;
}

export interface ServerConfig {
  address: string;
  port: number;
  uuid: string;
  encryption: string;
  network: 'Tcp' | 'Ws' | 'H2';
  security: 'None' | 'Tls';
  tlsSettings?: TlsSettings;
}

export interface TlsSettings {
  serverName?: string;
  allowInsecure?: boolean;
}

export interface DomainRule {
  id?: string;
  domain: string;
  strategy: 'Proxy' | 'Direct';
  enabled: boolean;
}

export interface UserConfig {
  server: ServerConfig;
  proxyMode: 'Global' | 'Smart' | 'Direct';
  customRules: DomainRule[];
  autoStart: boolean;
  autoConnect: boolean;
  minimizeToTray: boolean;
  socksPort: number;
  httpPort: number;
}

export interface NativeEventData {
  processStarted: { processId: number; timestamp: string };
  processStopped: { processId: number; timestamp: string };
  processError: { processId: number; timestamp: string; error: string };
  configChanged: { key?: string; oldValue?: any; newValue?: any };
  statsUpdated: TrafficStats;
}

export interface NativeApi {
  // Proxy Control
  startProxy(): Promise<string>;
  stopProxy(): Promise<string>;

  // Configuration Management
  getConfig(): Promise<string>;
  saveConfig(config: UserConfig): Promise<string>;
  updateProxyMode(mode: 'Global' | 'Smart' | 'Direct'): Promise<string>;

  // Status and Statistics
  getConnectionStatus(): Promise<string>;
  getStatistics(): Promise<string>;
  resetStatistics(): Promise<string>;

  // Custom Rules
  addCustomRule(rule: DomainRule): Promise<string>;
  updateCustomRule(rule: DomainRule): Promise<string>;
  deleteCustomRule(ruleId: string): Promise<string>;
}

export interface NativeEventListener<K extends keyof NativeEventData> {
  (data: NativeEventData[K]): void;
}

declare global {
  interface Window {
    nativeApi: NativeApi;
    addNativeEventListener<K extends keyof NativeEventData>(
      eventName: K,
      callback: NativeEventListener<K>
    ): void;
    removeNativeEventListener<K extends keyof NativeEventData>(
      eventName: K,
      callback: NativeEventListener<K>
    ): void;
  }
}

export {};
