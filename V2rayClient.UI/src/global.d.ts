/// <reference types="vite/client" />

import type { UserConfig, DomainRule } from './bridge/types'

declare global {
    interface Window {
        nativeApi: {
            startProxy: () => Promise<string>
            stopProxy: () => Promise<string>
            getConfig: () => Promise<string>
            saveConfig: (configJson: string) => Promise<string>
            updateProxyMode: (mode: string) => Promise<string>
            switchServer: (serverId: string) => Promise<string>
            getConnectionStatus: () => Promise<string>
            getStatistics: () => Promise<string>
            resetStatistics: () => Promise<string>
            addCustomRule: (ruleJson: string) => Promise<string>
            addCustomRulesBatch: (rulesJson: string) => Promise<string>
            updateCustomRule: (ruleJson: string) => Promise<string>
            deleteCustomRule: (ruleId: string) => Promise<string>
            getLogs: (count: number) => Promise<string>
            clearLogs: () => Promise<string>
            getVersionInfo: () => Promise<string>
            checkForUpdates: () => Promise<string>
            parseProtocolUrl: (url: string) => Promise<string>
            addServerFromUrl: (url: string, name: string) => Promise<string>
        }
        addNativeEventListener: (eventName: string, callback: (data: any) => void) => void
        removeNativeEventListener: (eventName: string, callback: (data: any) => void) => void
        nativeEventListeners: Record<string, Array<(data: any) => void>>
    }
}

export { }
