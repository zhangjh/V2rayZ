/**
 * Configuration storage utilities
 * Provides localStorage-based configuration persistence as a fallback
 */

const CONFIG_STORAGE_KEY = 'v2ray-client-config'

export interface StoredConfig {
  servers: Array<{
    id: string
    name: string
    protocol: string
    address: string
    port: number
    uuid?: string
    password?: string
    encryption?: string
    network?: string
    security?: string
    tlsSettings?: any
    createdAt: string
    updatedAt: string
  }>
  selectedServerId: string | null
  proxyMode: string
  customRules: Array<{
    id: string
    domain: string
    strategy: string
    enabled: boolean
  }>
  autoStart: boolean
  autoConnect: boolean
  minimizeToTray: boolean
  socksPort: number
  httpPort: number
}

/**
 * Save configuration to localStorage
 */
export function saveConfigToStorage(config: StoredConfig): void {
  try {
    const json = JSON.stringify(config, null, 2)
    localStorage.setItem(CONFIG_STORAGE_KEY, json)
    console.log('[ConfigStorage] Configuration saved to localStorage')
  } catch (error) {
    console.error('[ConfigStorage] Failed to save to localStorage:', error)
  }
}

/**
 * Load configuration from localStorage
 */
export function loadConfigFromStorage(): StoredConfig | null {
  try {
    const json = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!json) {
      console.log('[ConfigStorage] No configuration found in localStorage')
      return null
    }
    
    const config = JSON.parse(json) as StoredConfig
    console.log('[ConfigStorage] Configuration loaded from localStorage')
    console.log('[ConfigStorage] Servers count:', config.servers?.length ?? 0)
    return config
  } catch (error) {
    console.error('[ConfigStorage] Failed to load from localStorage:', error)
    return null
  }
}

/**
 * Clear configuration from localStorage
 */
export function clearConfigFromStorage(): void {
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY)
    console.log('[ConfigStorage] Configuration cleared from localStorage')
  } catch (error) {
    console.error('[ConfigStorage] Failed to clear localStorage:', error)
  }
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}