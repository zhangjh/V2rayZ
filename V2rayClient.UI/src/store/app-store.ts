/**
 * Zustand store for application state management
 */

import { create } from 'zustand'
import type {
  ConnectionStatus,
  TrafficStats,
  UserConfig,
  DomainRule,
  ProxyMode,
} from '@/bridge/types'
import * as nativeApi from '@/bridge/native-api'

interface AppState {
  // UI State
  currentView: string
  isLoading: boolean
  error: string | null

  // Connection State
  connectionStatus: ConnectionStatus | null
  
  // Configuration
  config: UserConfig | null
  
  // Statistics
  stats: TrafficStats | null

  // Actions
  setCurrentView: (view: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Proxy Control Actions
  startProxy: () => Promise<void>
  stopProxy: () => Promise<void>
  
  // Configuration Actions
  loadConfig: () => Promise<void>
  saveConfig: (config: UserConfig) => Promise<void>
  updateProxyMode: (mode: ProxyMode) => Promise<void>
  
  // Status Actions
  refreshConnectionStatus: () => Promise<void>
  refreshStatistics: () => Promise<void>
  resetStatistics: () => Promise<void>
  
  // Custom Rules Actions
  addCustomRule: (rule: DomainRule) => Promise<void>
  addCustomRulesBatch: (rules: DomainRule[]) => Promise<void>
  updateCustomRule: (rule: DomainRule) => Promise<void>
  deleteCustomRule: (ruleId: string) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial State
  currentView: 'home',
  isLoading: false,
  error: null,
  connectionStatus: null,
  config: null,
  stats: null,

  // UI Actions
  setCurrentView: (view) => set({ currentView: view }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Proxy Control Actions
  startProxy: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await nativeApi.startProxy()
      if (!response.success) {
        set({ error: response.error || 'Failed to start proxy', isLoading: false })
        // Refresh status to ensure UI reflects actual state
        await get().refreshConnectionStatus()
        return
      }
      
      // Poll connection status until connected or timeout
      const maxAttempts = 20 // 10 seconds (20 * 500ms)
      let attempts = 0
      
      const pollStatus = async (): Promise<void> => {
        attempts++
        await get().refreshConnectionStatus()
        
        const status = get().connectionStatus
        
        // Debug logging
        console.log(`[StartProxy] Polling attempt ${attempts}:`, {
          v2rayRunning: status?.v2ray?.running,
          proxyEnabled: status?.proxy?.enabled,
          v2rayError: status?.v2ray?.error,
          v2rayPid: status?.v2ray?.pid
        })
        
        // Check if connected (both V2ray running AND proxy enabled)
        if (status?.v2ray?.running && status?.proxy?.enabled) {
          console.log('[StartProxy] Connection successful!')
          set({ isLoading: false })
          return
        }
        
        // Check for V2ray errors
        if (status?.v2ray?.error) {
          console.log('[StartProxy] V2ray error detected:', status.v2ray.error)
          set({ 
            error: status.v2ray.error, 
            isLoading: false 
          })
          return
        }
        
        // Check if V2ray failed to start (not running and no error means startup failed)
        if (attempts > 3 && !status?.v2ray?.running) {
          console.log('[StartProxy] V2ray failed to start')
          set({ 
            error: 'V2ray 启动失败：进程无法正常启动，请检查服务器配置', 
            isLoading: false 
          })
          return
        }
        
        // Check timeout
        if (attempts >= maxAttempts) {
          console.log('[StartProxy] Connection timeout')
          set({ 
            error: '连接超时：无法在预期时间内建立连接，请检查服务器配置', 
            isLoading: false 
          })
          return
        }
        
        // Continue polling
        setTimeout(pollStatus, 500)
      }
      
      // Start polling immediately
      await pollStatus()
      
    } catch (error) {
      set({ error: String(error), isLoading: false })
      // Refresh status to ensure UI reflects actual state
      await get().refreshConnectionStatus()
    }
  },

  stopProxy: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await nativeApi.stopProxy()
      if (!response.success) {
        set({ error: response.error || 'Failed to stop proxy' })
      } else {
        // Refresh status after stopping
        await get().refreshConnectionStatus()
      }
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  // Configuration Actions
  loadConfig: async () => {
    set({ isLoading: true, error: null })
    try {
      console.log('[Store] Loading config...')
      const response = await nativeApi.getConfig()
      console.log('[Store] Config response:', response)
      
      if (response.success && response.data) {
        console.log('[Store] Config loaded successfully:', response.data)
        
        // Migrate old config format to new format if needed
        let config = response.data
        if (config.server && !config.servers) {
          // Old format: migrate single server to servers array
          const migratedServer = {
            ...config.server,
            id: crypto.randomUUID(),
            name: `${config.server.protocol} 服务器`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          
          config = {
            ...config,
            servers: [migratedServer],
            selectedServerId: migratedServer.id,
          }
          delete config.server
          
          // Save migrated config
          await get().saveConfig(config)
        }
        
        set({ config })
      } else {
        console.error('[Store] Failed to load config:', response.error)
        set({ error: response.error || 'Failed to load config' })
      }
    } catch (error) {
      console.error('[Store] Exception loading config:', error)
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  saveConfig: async (config) => {
    set({ isLoading: true, error: null })
    try {
      console.log('[Store] Saving config:', config)
      
      // Ensure enums are strings, not numbers
      const cleanConfig: UserConfig = {
        ...config,
        proxyMode: (typeof config.proxyMode === 'number' 
          ? (['Global', 'Smart', 'Direct'][config.proxyMode] || 'Smart')
          : config.proxyMode) as ProxyMode,
        customRules: config.customRules.map(rule => ({
          ...rule,
          strategy: (typeof rule.strategy === 'number'
            ? (['Proxy', 'Direct'][rule.strategy] || 'Proxy')
            : rule.strategy) as 'Proxy' | 'Direct'
        }))
      }
      
      console.log('[Store] Clean config:', cleanConfig)
      
      const response = await nativeApi.saveConfig(cleanConfig)
      console.log('[Store] Save response:', response)
      
      if (response.success) {
        console.log('[Store] Config saved successfully')
        set({ config: cleanConfig })
      } else {
        console.error('[Store] Failed to save config:', response.error)
        set({ error: response.error || 'Failed to save config' })
        throw new Error(response.error || 'Failed to save config')
      }
    } catch (error) {
      console.error('[Store] Exception saving config:', error)
      set({ error: String(error) })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  updateProxyMode: async (mode) => {
    set({ isLoading: true, error: null })
    try {
      const response = await nativeApi.updateProxyMode(mode)
      if (response.success) {
        // Update local config
        const currentConfig = get().config
        if (currentConfig) {
          set({ config: { ...currentConfig, proxyMode: mode } })
        }
      } else {
        set({ error: response.error || 'Failed to update proxy mode' })
      }
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  // Status Actions
  refreshConnectionStatus: async () => {
    try {
      const response = await nativeApi.getConnectionStatus()
      if (response.success && response.data) {
        set({ connectionStatus: response.data })
      }
    } catch (error) {
      console.error('Failed to refresh connection status:', error)
    }
  },

  refreshStatistics: async () => {
    try {
      const response = await nativeApi.getStatistics()
      if (response.success && response.data) {
        set({ stats: response.data })
      }
    } catch (error) {
      console.error('Failed to refresh statistics:', error)
    }
  },

  resetStatistics: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await nativeApi.resetStatistics()
      if (response.success) {
        set({
          stats: {
            uploadTotal: 0,
            downloadTotal: 0,
            uploadSpeed: 0,
            downloadSpeed: 0,
          },
        })
      } else {
        set({ error: response.error || 'Failed to reset statistics' })
      }
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  // Custom Rules Actions
  addCustomRule: async (rule) => {
    set({ isLoading: true, error: null })
    try {
      const response = await nativeApi.addCustomRule(rule)
      if (response.success) {
        // Reload config to get updated rules
        await get().loadConfig()
      } else {
        set({ error: response.error || 'Failed to add custom rule' })
      }
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },

  addCustomRulesBatch: async (rules) => {
    set({ isLoading: true, error: null })
    try {
      const response = await nativeApi.addCustomRulesBatch(rules)
      if (response.success) {
        // Reload config to get updated rules
        await get().loadConfig()
      } else {
        set({ error: response.error || 'Failed to add custom rules' })
        throw new Error(response.error || 'Failed to add custom rules')
      }
    } catch (error) {
      set({ error: String(error) })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  updateCustomRule: async (rule) => {
    console.log('[Store] updateCustomRule called with:', rule)
    set({ isLoading: true, error: null })
    try {
      console.log('[Store] Calling nativeApi.updateCustomRule...')
      const response = await nativeApi.updateCustomRule(rule)
      console.log('[Store] updateCustomRule response:', response)
      
      if (response.success) {
        console.log('[Store] Rule updated successfully, reloading config...')
        // Reload config to get updated rules
        await get().loadConfig()
        console.log('[Store] Config reloaded after rule update')
      } else {
        console.error('[Store] Failed to update rule:', response.error)
        set({ error: response.error || 'Failed to update custom rule' })
        throw new Error(response.error || 'Failed to update custom rule')
      }
    } catch (error) {
      console.error('[Store] Exception in updateCustomRule:', error)
      set({ error: String(error) })
      throw error
    } finally {
      console.log('[Store] updateCustomRule completed, setting isLoading to false')
      set({ isLoading: false })
    }
  },

  deleteCustomRule: async (ruleId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await nativeApi.deleteCustomRule(ruleId)
      if (response.success) {
        // Reload config to get updated rules
        await get().loadConfig()
      } else {
        set({ error: response.error || 'Failed to delete custom rule' })
      }
    } catch (error) {
      set({ error: String(error) })
    } finally {
      set({ isLoading: false })
    }
  },
}))
