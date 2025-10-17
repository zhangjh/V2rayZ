/**
 * Global type declarations for window object
 */

import type { NativeEventData, NativeEventListener, UserConfig, DomainRule } from './types'

interface NativeApi {
  // Proxy Control
  startProxy(): Promise<string>
  stopProxy(): Promise<string>

  // Configuration Management
  getConfig(): Promise<string>
  saveConfig(configJson: string): Promise<string>
  updateProxyMode(mode: 'Global' | 'Smart' | 'Direct'): Promise<string>
  switchServer(serverId: string): Promise<string>

  // Status and Statistics
  getConnectionStatus(): Promise<string>
  getStatistics(): Promise<string>
  resetStatistics(): Promise<string>

  // Custom Rules
  addCustomRule(ruleJson: string): Promise<string>
  addCustomRulesBatch(rulesJson: string): Promise<string>
  updateCustomRule(ruleJson: string): Promise<string>
  deleteCustomRule(ruleId: string): Promise<string>

  // Logging
  getLogs(count: number): Promise<string>
  clearLogs(): Promise<string>

  // Version Information
  getVersionInfo(): Promise<string>

  // Debug Functions
  getConfigFileInfo(): Promise<string>
}

declare global {
  interface Window {
    nativeApi: NativeApi
    addNativeEventListener<K extends keyof NativeEventData>(
      eventName: K,
      callback: NativeEventListener<K>
    ): void
    removeNativeEventListener<K extends keyof NativeEventData>(
      eventName: K,
      callback: NativeEventListener<K>
    ): void
  }
}

export {}
