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
  proxyModeType: 'SystemProxy' | 'Tun';
}

export interface TrafficStats {
  uploadTotal: number;
  downloadTotal: number;
  uploadSpeed: number;
  downloadSpeed: number;
}

export interface ServerConfig {
  protocol: 'Vless' | 'Trojan';
  address: string;
  port: number;
  uuid?: string; // For VLESS
  encryption?: string; // For VLESS
  password?: string; // For Trojan
  network: 'Tcp' | 'Ws' | 'H2';
  security: 'None' | 'Tls';
  tlsSettings?: TlsSettings;
  wsSettings?: WsSettings;
}

export interface ServerConfigWithId extends ServerConfig {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface WsSettings {
  path?: string;
  host?: string;
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

export interface TunModeConfig {
  interfaceName: string;
  ipv4Address: string;
  ipv6Address?: string;
  enableIpv6: boolean;
  dnsServers: string[];
  mtu: number;
  enableDnsHijack: boolean;
}

export interface UserConfig {
  servers: ServerConfigWithId[];
  selectedServerId?: string;
  proxyMode: 'Global' | 'Smart' | 'Direct';
  proxyModeType: 'SystemProxy' | 'Tun';
  tunConfig: TunModeConfig;
  customRules: DomainRule[];
  autoStart: boolean;
  autoConnect: boolean;
  minimizeToTray: boolean;
  socksPort: number;
  httpPort: number;
}

export interface TunModeValidationResult {
  isAvailable: boolean;
  errorMessage?: string;
}

export interface NativeEventData {
  processStarted: { processId: number; timestamp: string };
  processStopped: { processId: number; timestamp: string };
  processError: { processId: number; timestamp: string; error: string };
  configChanged: { key?: string; oldValue?: any; newValue?: any };
  statsUpdated: TrafficStats;
  proxyModeSwitched: { success: boolean; newMode: string };
  proxyModeSwitchFailed: { success: boolean; error: string };
  geoDataUpdateChecked: any;
  geoDataUpdateCheckFailed: { error: string };
  geoDataUpdated: any;
  geoDataUpdateFailed: any;
}

export interface NativeApi {
  // Proxy Control
  startProxy(): Promise<string>;
  stopProxy(): Promise<string>;

  // Configuration Management
  getConfig(): Promise<string>;
  saveConfig(config: UserConfig): Promise<string>;
  updateProxyMode(mode: 'Global' | 'Smart' | 'Direct'): Promise<string>;
  switchServer(serverId: string): Promise<string>;

  // Protocol URL Parsing
  parseProtocolUrl(url: string): Promise<string>;
  addServerFromUrl(url: string, name: string): Promise<string>;

  // Status and Statistics
  getConnectionStatus(): Promise<string>;
  getStatistics(): Promise<string>;
  resetStatistics(): Promise<string>;

  // Custom Rules
  addCustomRule(rule: DomainRule): Promise<string>;
  updateCustomRule(rule: DomainRule): Promise<string>;
  deleteCustomRule(ruleId: string): Promise<string>;
  addCustomRulesBatch(rules: DomainRule[]): Promise<string>;

  // Logging
  getLogs(count: number): Promise<string>;
  clearLogs(): Promise<string>;

  // Version and Updates
  getVersionInfo(): Promise<string>;
  checkForUpdates(): Promise<string>;

  // TUN Mode Configuration
  getProxyModeType(): Promise<string>;
  setProxyModeType(modeType: 'SystemProxy' | 'Tun'): Promise<string>;
  getTunConfig(): Promise<string>;
  setTunConfig(tunConfig: TunModeConfig): Promise<string>;
  validateTunMode(): Promise<string>;
  switchProxyMode(targetModeType: 'SystemProxy' | 'Tun'): Promise<string>;
  isAdministrator(): Promise<string>;
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
