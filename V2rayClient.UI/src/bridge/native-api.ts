/**
 * Bridge layer for communicating with C# backend via WebView2
 */

import type {
  ApiResponse,
  ConnectionStatus,
  TrafficStats,
  UserConfig,
  DomainRule,
  ProxyMode,
  NativeEventData,
  NativeEventListener,
  LogEntry,
  ServerConfig,
  ServerConfigWithId,
} from './types'

/**
 * Check if running in WebView2 environment
 */
export function isWebView2(): boolean {
  return typeof window !== 'undefined' && 'nativeApi' in window
}

/**
 * Parse JSON response from native API
 */
function parseResponse<T>(jsonString: string): ApiResponse<T> {
  try {
    return JSON.parse(jsonString) as ApiResponse<T>
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse response: ${error}`,
    }
  }
}

/**
 * Proxy Control APIs
 */
export async function startProxy(): Promise<ApiResponse<void>> {
  console.log('[NativeApi] startProxy called')
  
  if (!isWebView2()) {
    console.log('[NativeApi] Not in WebView2 environment')
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    console.log('[NativeApi] Calling native startProxy...')
    const result = await window.nativeApi.startProxy()
    console.log('[NativeApi] Native startProxy result:', result)
    const parsed = parseResponse<void>(result)
    console.log('[NativeApi] Parsed result:', parsed)
    return parsed
  } catch (error) {
    console.error('[NativeApi] startProxy error:', error)
    return { success: false, error: String(error) }
  }
}

export async function stopProxy(): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const result = await window.nativeApi.stopProxy()
    return parseResponse(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Configuration Management APIs
 */
export async function getConfig(): Promise<ApiResponse<UserConfig>> {
  const defaultConfig: UserConfig = {
    servers: [],
    selectedServerId: undefined,
    proxyMode: 'Smart',
    proxyModeType: 'SystemProxy',
    tunConfig: {
      interfaceName: 'V2rayZ-TUN',
      ipv4Address: '10.0.85.1/24',
      ipv6Address: 'fdfe:dcba:9876::1/126',
      enableIpv6: true,
      dnsServers: ['8.8.8.8', '8.8.4.4'],
      mtu: 9000,
      enableDnsHijack: true,
    },
    customRules: [],
    autoStart: false,
    autoConnect: false,
    minimizeToTray: true,
    socksPort: 65534,
    httpPort: 65533,
  }

  if (!isWebView2()) {
    console.log('[native-api] Not in WebView2, returning default config')
    return { success: true, data: defaultConfig }
  }
  
  try {
    console.log('[native-api] Getting config from native API...')
    const result = await window.nativeApi.getConfig()
    console.log('[native-api] Get config result:', result)
    const parsed = parseResponse<UserConfig>(result)
    console.log('[native-api] Parsed config:', parsed)
    
    return parsed
  } catch (error) {
    console.error('[native-api] Get config error:', error)
    return { success: false, error: String(error) }
  }
}

export async function saveConfig(config: UserConfig): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    console.log('[native-api] Not in WebView2, cannot save config')
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    console.log('[native-api] Saving config to native API:', config)
    const configJson = JSON.stringify(config)
    console.log('[native-api] Config JSON:', configJson)
    const result = await window.nativeApi.saveConfig(configJson)
    console.log('[native-api] Native save result:', result)
    const response = parseResponse<void>(result)
    
    return response
  } catch (error) {
    console.error('[native-api] Native save error:', error)
    return { success: false, error: String(error) }
  }
}

export async function updateProxyMode(mode: ProxyMode): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    return { success: true }
  }
  
  try {
    const result = await window.nativeApi.updateProxyMode(mode)
    return parseResponse(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function switchServer(serverId: string): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const result = await window.nativeApi.switchServer(serverId)
    return parseResponse(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Status and Statistics APIs
 */
export async function getConnectionStatus(): Promise<ApiResponse<ConnectionStatus>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const result = await window.nativeApi.getConnectionStatus()
    const parsed = parseResponse<ConnectionStatus>(result)
    console.log('[NativeApi] Connection status:', parsed)
    return parsed
  } catch (error) {
    console.error('[NativeApi] getConnectionStatus error:', error)
    return { success: false, error: String(error) }
  }
}

export async function getStatistics(): Promise<ApiResponse<TrafficStats>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const result = await window.nativeApi.getStatistics()
    return parseResponse<TrafficStats>(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function resetStatistics(): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    return { success: true }
  }
  
  try {
    const result = await window.nativeApi.resetStatistics()
    return parseResponse(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Custom Rules APIs
 */
export async function addCustomRule(rule: DomainRule): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const ruleJson = JSON.stringify(rule)
    const result = await window.nativeApi.addCustomRule(ruleJson)
    return parseResponse(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function addCustomRulesBatch(rules: DomainRule[]): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const rulesJson = JSON.stringify(rules)
    const result = await window.nativeApi.addCustomRulesBatch(rulesJson)
    return parseResponse(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function updateCustomRule(rule: DomainRule): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const ruleJson = JSON.stringify(rule)
    const result = await window.nativeApi.updateCustomRule(ruleJson)
    return parseResponse(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function deleteCustomRule(ruleId: string): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    return { success: true }
  }
  
  try {
    const result = await window.nativeApi.deleteCustomRule(ruleId)
    return parseResponse(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Logging APIs
 */
export async function getLogs(count?: number): Promise<ApiResponse<LogEntry[]>> {
  if (!isWebView2()) {
    // Return mock data for development
    const mockLogs: LogEntry[] = [
      {
        timestamp: new Date().toLocaleTimeString(),
        level: 'info',
        message: 'sing-box service started successfully',
        source: 'sing-box'
      },
      {
        timestamp: new Date().toLocaleTimeString(),
        level: 'debug',
        message: 'Configuration loaded',
        source: 'config'
      }
    ]
    return { success: true, data: mockLogs }
  }
  
  try {
    const nativeApi = (window as any).nativeApi
    if (nativeApi && nativeApi.getLogs) {
      const result = await nativeApi.getLogs(count || 100)
      return parseResponse<LogEntry[]>(result)
    } else {
      return { success: false, error: 'getLogs method not available' }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function clearLogs(): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    return { success: true }
  }
  
  try {
    const nativeApi = (window as any).nativeApi
    if (nativeApi && nativeApi.clearLogs) {
      const result = await nativeApi.clearLogs()
      return parseResponse(result)
    } else {
      return { success: false, error: 'clearLogs method not available' }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Version Information APIs
 */
export async function getVersionInfo(): Promise<ApiResponse<{
  appVersion: string
  appName: string
  buildDate: string
  singBoxVersion: string
  copyright: string
  repositoryUrl: string
}>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const result = await window.nativeApi.getVersionInfo()
    return parseResponse(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Protocol URL Parsing APIs
 */
export async function parseProtocolUrl(url: string): Promise<ApiResponse<ServerConfig>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const result = await window.nativeApi.parseProtocolUrl(url)
    return parseResponse<ServerConfig>(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function addServerFromUrl(url: string, name: string): Promise<ApiResponse<ServerConfigWithId>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const result = await window.nativeApi.addServerFromUrl(url, name)
    return parseResponse<ServerConfigWithId>(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Update Management APIs
 */
export async function checkForUpdates(): Promise<ApiResponse<void>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const nativeApi = (window as any).nativeApi
    if (nativeApi && nativeApi.checkForUpdates) {
      const result = await nativeApi.checkForUpdates()
      return parseResponse(result)
    } else {
      return { success: false, error: 'checkForUpdates method not available' }
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Debug function to get config file information
 */


/**
 * Event Listener Management
 */
export function addEventListener<K extends keyof NativeEventData>(
  eventName: K,
  callback: NativeEventListener<K>
): void {
  if (!isWebView2()) {
    console.warn(`Cannot add event listener '${eventName}': Not in WebView2 environment`)
    return
  }
  
  window.addNativeEventListener(eventName, callback)
}

export function removeEventListener<K extends keyof NativeEventData>(
  eventName: K,
  callback: NativeEventListener<K>
): void {
  if (!isWebView2()) {
    return
  }
  
  window.removeNativeEventListener(eventName, callback)
}

/**
 * Permission Check APIs
 */
export async function isAdministrator(): Promise<ApiResponse<{ isAdministrator: boolean }>> {
  if (!isWebView2()) {
    return { success: false, error: 'Not running in WebView2 environment' }
  }
  
  try {
    const result = await window.nativeApi.isAdministrator()
    return parseResponse<{ isAdministrator: boolean }>(result)
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
