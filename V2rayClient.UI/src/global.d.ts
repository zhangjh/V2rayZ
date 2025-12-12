/// <reference types="vite/client" />

import type { NativeEventData, NativeEventListener } from './bridge/types'

declare global {
  interface Window {
    nativeApi: {
      // Proxy Control
      startProxy: () => Promise<string>
      stopProxy: () => Promise<string>

      // Configuration Management
      getConfig: () => Promise<string>
      saveConfig: (configJson: string) => Promise<string>
      updateProxyMode: (mode: string) => Promise<string>
      switchServer: (serverId: string) => Promise<string>

      // Status and Statistics
      getConnectionStatus: () => Promise<string>
      getStatistics: () => Promise<string>
      resetStatistics: () => Promise<string>

      // Custom Rules
      addCustomRule: (ruleJson: string) => Promise<string>
      addCustomRulesBatch: (rulesJson: string) => Promise<string>
      updateCustomRule: (ruleJson: string) => Promise<string>
      deleteCustomRule: (ruleId: string) => Promise<string>

      // Logging
      getLogs: (count: number) => Promise<string>
      clearLogs: () => Promise<string>

      // Version Information
      getVersionInfo: () => Promise<string>

      // Protocol URL Parsing
      parseProtocolUrl: (url: string) => Promise<string>
      addServerFromUrl: (url: string, name: string) => Promise<string>

      // Update Management
      checkForUpdates: () => Promise<string>

      // Permission Check
      isAdministrator: () => Promise<string>
    }

    // Event Listeners
    addNativeEventListener<K extends keyof NativeEventData>(
      eventName: K,
      callback: NativeEventListener<K>
    ): void
    removeNativeEventListener<K extends keyof NativeEventData>(
      eventName: K,
      callback: NativeEventListener<K>
    ): void
    nativeEventListeners: Record<string, Array<(data: any) => void>>
  }
}

export {}
