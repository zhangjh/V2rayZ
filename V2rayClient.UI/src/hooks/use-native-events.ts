/**
 * React hook for listening to native events from C# backend
 */

import { useEffect } from 'react'
import type { NativeEventData, NativeEventListener } from '@/bridge/types'
import { addEventListener, removeEventListener } from '@/bridge/native-api'
import { ErrorHandler, ErrorCategory } from '@/lib/error-handler'

export function useNativeEvent<K extends keyof NativeEventData>(
  eventName: K,
  callback: NativeEventListener<K>
) {
  useEffect(() => {
    addEventListener(eventName, callback)

    return () => {
      removeEventListener(eventName, callback)
    }
  }, [eventName, callback])
}

/**
 * Hook to listen to all native events and update store
 */
export function useNativeEventListeners() {
  const handleProcessStarted = (data: NativeEventData['processStarted']) => {
    console.log('Process started:', data)
    // Refresh connection status when process starts
    import('@/store/app-store').then(({ useAppStore }) => {
      const refreshConnectionStatus = useAppStore.getState().refreshConnectionStatus
      refreshConnectionStatus()
    })
  }

  const handleProcessStopped = (data: NativeEventData['processStopped']) => {
    console.log('Process stopped:', data)
    // Refresh connection status when process stops
    import('@/store/app-store').then(({ useAppStore }) => {
      const refreshConnectionStatus = useAppStore.getState().refreshConnectionStatus
      refreshConnectionStatus()
    })
  }

  const handleProcessError = (data: NativeEventData['processError']) => {
    console.error('Process error:', data)

    // Display user-friendly error notification
    if (data.error) {
      // Determine error category and retry capability
      let category = ErrorCategory.Process;
      let canRetry = true;

      // Check for Trojan-specific errors
      if (data.error.includes('Trojan') || data.error.includes('trojan')) {
        category = ErrorCategory.Connection;

        // Authentication and config errors are not retryable
        if (data.error.includes('认证失败') ||
          data.error.includes('密码错误') ||
          data.error.includes('配置错误')) {
          canRetry = false;
        }
      }

      // Check for VLESS-specific errors
      if (data.error.includes('VLESS') || data.error.includes('vless')) {
        category = ErrorCategory.Connection;

        if (data.error.includes('UUID 错误') || data.error.includes('认证失败')) {
          canRetry = false;
        }
      }

      // Check for protocol errors
      if (data.error.includes('不支持的协议') || data.error.includes('Protocol')) {
        category = ErrorCategory.Config;
        canRetry = false;
      }

      // Handle the error with appropriate category
      ErrorHandler.handle({
        category,
        userMessage: data.error,
        technicalMessage: data.error,
        canRetry,
      });
    }
  }

  const handleConfigChanged = (data: NativeEventData['configChanged']) => {
    console.log('Config changed:', data)
    // 只有在非用户主动操作时才重新加载配置
    // 这里可以根据需要添加更复杂的逻辑来判断是否需要重新加载
    import('@/store/app-store').then(({ useAppStore }) => {
      const state = useAppStore.getState()
      // 如果当前没有在加载状态，说明不是用户主动操作，可以重新加载
      if (!state.isLoading) {
        console.log('Config changed by external source, reloading...')
        const loadConfig = state.loadConfig
        loadConfig()
      } else {
        console.log('Config changed during user operation, skipping reload')
      }
    })
  }

  const handleStatsUpdated = (data: NativeEventData['statsUpdated']) => {
    console.log('Stats updated:', data)
  }

  const handleNavigateToPage = (page: string) => {
    console.log('Navigate to page:', page)
    // Import useAppStore dynamically to avoid circular dependency
    import('@/store/app-store').then(({ useAppStore }) => {
      const setCurrentView = useAppStore.getState().setCurrentView
      setCurrentView(page)
    })
  }

  const handleProxyModeSwitched = (data: NativeEventData['proxyModeSwitched']) => {
    console.log('Proxy mode switched:', data)
    // Import toast dynamically to show notification
    import('sonner').then(({ toast }) => {
      const modeText = data.newMode === 'Tun' ? 'TUN模式' : '系统代理模式'
      toast.success('代理模式切换成功', {
        description: `已切换到${modeText}`,
      })
    })
    // Reload config to reflect the change
    import('@/store/app-store').then(({ useAppStore }) => {
      const loadConfig = useAppStore.getState().loadConfig
      loadConfig()
    })
  }

  const handleProxyModeSwitchFailed = (data: NativeEventData['proxyModeSwitchFailed']) => {
    console.error('Proxy mode switch failed:', data)
    // Import toast dynamically to show error notification
    import('sonner').then(({ toast }) => {
      toast.error('代理模式切换失败', {
        description: data.error || '切换过程中发生错误',
      })
    })
  }

  useNativeEvent('processStarted', handleProcessStarted)
  useNativeEvent('processStopped', handleProcessStopped)
  useNativeEvent('processError', handleProcessError)
  useNativeEvent('configChanged', handleConfigChanged)
  useNativeEvent('statsUpdated', handleStatsUpdated)
  useNativeEvent('navigateToPage', handleNavigateToPage)
  useNativeEvent('proxyModeSwitched', handleProxyModeSwitched)
  useNativeEvent('proxyModeSwitchFailed', handleProxyModeSwitchFailed)
}
