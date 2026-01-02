/**
 * 代理管理 IPC 处理器
 * 处理代理相关的 IPC 请求
 */

import { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { UserConfig, ProxyStatus } from '../../../shared/types';
import { registerIpcHandler } from '../ipc-handler';
import { ProxyManager } from '../../services/ProxyManager';
import { ISystemProxyManager } from '../../services/SystemProxyManager';

/**
 * 托盘状态更新回调
 */
export type TrayStateUpdateCallback = (isRunning: boolean, hasError?: boolean) => void;

let trayStateCallback: TrayStateUpdateCallback | null = null;

/**
 * 设置托盘状态更新回调
 */
export function setTrayStateCallback(callback: TrayStateUpdateCallback): void {
  trayStateCallback = callback;
}

/**
 * 注册代理管理相关的 IPC 处理器
 */
export function registerProxyHandlers(
  proxyManager: ProxyManager,
  systemProxyManager?: ISystemProxyManager
): void {
  // 启动代理
  registerIpcHandler<UserConfig, void>(
    IPC_CHANNELS.PROXY_START,
    async (_event: IpcMainInvokeEvent, config: UserConfig) => {
      console.log('[Proxy Handlers] PROXY_START received config:', JSON.stringify(config, null, 2));
      console.log('[Proxy Handlers] config type:', typeof config);
      console.log('[Proxy Handlers] config selectedServerId:', config?.selectedServerId);
      console.log('[Proxy Handlers] config proxyModeType:', config?.proxyModeType);
      console.log('[Proxy Handlers] config proxyMode:', config?.proxyMode);

      if (!config) {
        throw new Error('配置参数未传递');
      }

      // 启动 sing-box 进程
      await proxyManager.start(config);

      // 系统代理模式：设置系统代理
      const modeType = (config.proxyModeType || 'systemProxy').toLowerCase();
      if (modeType === 'systemproxy' && systemProxyManager) {
        console.log('[Proxy Handlers] Setting system proxy...');
        await systemProxyManager.enableProxy(
          '127.0.0.1',
          config.httpPort || 65533,
          config.socksPort || 65534
        );
        console.log('[Proxy Handlers] System proxy enabled');
      }

      // 更新托盘状态
      if (trayStateCallback) {
        trayStateCallback(true);
      }
    }
  );

  // 停止代理
  registerIpcHandler<void, void>(IPC_CHANNELS.PROXY_STOP, async (_event: IpcMainInvokeEvent) => {
    // 先禁用系统代理（不管当前状态如何，都尝试禁用）
    if (systemProxyManager) {
      try {
        console.log('[Proxy Handlers] Disabling system proxy...');
        await systemProxyManager.disableProxy();
        console.log('[Proxy Handlers] System proxy disabled');
      } catch (error) {
        console.error('[Proxy Handlers] Failed to disable system proxy:', error);
      }
    }

    // 停止 sing-box 进程
    await proxyManager.stop();

    // 更新托盘状态
    if (trayStateCallback) {
      trayStateCallback(false);
    }
  });

  // 获取代理状态
  registerIpcHandler<void, ProxyStatus>(
    IPC_CHANNELS.PROXY_GET_STATUS,
    async (_event: IpcMainInvokeEvent) => {
      return proxyManager.getStatus();
    }
  );

  // 重启代理
  registerIpcHandler<UserConfig, void>(
    IPC_CHANNELS.PROXY_RESTART,
    async (_event: IpcMainInvokeEvent, config: UserConfig) => {
      await proxyManager.restart(config);
    }
  );

  console.log('[Proxy Handlers] Registered all proxy IPC handlers');
}
