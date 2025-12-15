/**
 * React hook for listening to IPC events from Electron main process
 */

import { useEffect } from 'react';
import { api } from '../ipc';
import { ErrorHandler, ErrorCategory } from '../lib/error-handler';

// 定义事件数据类型
interface NativeEventData {
  processStarted: { pid: number; timestamp: string };
  processStopped: { timestamp: string };
  processError: { error: string; timestamp: string };
  configChanged: { key?: string; oldValue?: any; newValue?: any };
  statsUpdated: any;
  navigateToPage: string;
  proxyModeSwitched: { success: boolean; newMode: string };
  proxyModeSwitchFailed: { success: boolean; error: string };
}

type NativeEventListener<K extends keyof NativeEventData> = (data: NativeEventData[K]) => void;

export function useNativeEvent<K extends keyof NativeEventData>(
  eventName: K,
  callback: NativeEventListener<K>
) {
  useEffect(() => {
    // 根据事件名称注册对应的监听器
    let unsubscribe: (() => void) | undefined;

    switch (eventName) {
      case 'processStarted':
        unsubscribe = api.proxy.onStarted(callback as any);
        break;
      case 'processStopped':
        unsubscribe = api.proxy.onStopped(callback as any);
        break;
      case 'processError':
        unsubscribe = api.proxy.onError(callback as any);
        break;
      case 'configChanged':
        unsubscribe = api.config.onChanged(callback as any);
        break;
      case 'statsUpdated':
        unsubscribe = api.stats.onUpdated(callback as any);
        break;
      default:
        console.warn(`Unknown event: ${eventName}`);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [eventName, callback]);
}

/**
 * Hook to listen to all native events and update store
 */
export function useNativeEventListeners() {
  const handleProcessStarted = (data: NativeEventData['processStarted']) => {
    console.log('Process started:', data);
    // Refresh connection status when process starts
    import('../store/app-store').then(({ useAppStore }) => {
      const refreshConnectionStatus = useAppStore.getState().refreshConnectionStatus;
      refreshConnectionStatus();
    });
  };

  const handleProcessStopped = (data: NativeEventData['processStopped']) => {
    console.log('Process stopped:', data);
    // Refresh connection status when process stops
    import('../store/app-store').then(({ useAppStore }) => {
      const refreshConnectionStatus = useAppStore.getState().refreshConnectionStatus;
      refreshConnectionStatus();
    });
  };

  const handleProcessError = (data: NativeEventData['processError']) => {
    console.error('Process error:', data);

    // Display user-friendly error notification
    if (data.error) {
      // Determine error category and retry capability
      let category = ErrorCategory.Process;
      let canRetry = true;

      // Check for Trojan-specific errors
      if (data.error.includes('Trojan') || data.error.includes('trojan')) {
        category = ErrorCategory.Connection;

        // Authentication and config errors are not retryable
        if (
          data.error.includes('认证失败') ||
          data.error.includes('密码错误') ||
          data.error.includes('配置错误')
        ) {
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
  };

  const handleConfigChanged = (data: NativeEventData['configChanged']) => {
    console.log('Config changed:', data);
    // 只有在非用户主动操作时才重新加载配置
    // 这里可以根据需要添加更复杂的逻辑来判断是否需要重新加载
    import('../store/app-store').then(({ useAppStore }) => {
      const state = useAppStore.getState();
      // 如果当前没有在加载状态，说明不是用户主动操作，可以重新加载
      if (!state.isLoading) {
        console.log('Config changed by external source, reloading...');
        const loadConfig = state.loadConfig;
        loadConfig();
      } else {
        console.log('Config changed during user operation, skipping reload');
      }
    });
  };

  const handleStatsUpdated = (data: NativeEventData['statsUpdated']) => {
    console.log('Stats updated:', data);
    // 更新统计信息到 store
    import('../store/app-store').then(({ useAppStore }) => {
      useAppStore.getState().refreshStatistics();
    });
  };

  useNativeEvent('processStarted', handleProcessStarted);
  useNativeEvent('processStopped', handleProcessStopped);
  useNativeEvent('processError', handleProcessError);
  useNativeEvent('configChanged', handleConfigChanged);
  useNativeEvent('statsUpdated', handleStatsUpdated);
}
