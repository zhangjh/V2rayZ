/**
 * 自启动管理 IPC 处理器
 */

import { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { AutoStartStatus } from '../../../shared/types';
import { registerIpcHandler } from '../ipc-handler';
import { createAutoStartManager, IAutoStartManager } from '../../services/AutoStartManager';

let autoStartManager: IAutoStartManager | null = null;

/**
 * 获取自启动管理器实例
 */
function getAutoStartManager(): IAutoStartManager {
  if (!autoStartManager) {
    autoStartManager = createAutoStartManager();
  }
  return autoStartManager;
}

/**
 * 注册自启动管理相关的 IPC 处理器
 */
export function registerAutoStartHandlers(): void {
  // 设置自启动
  registerIpcHandler<{ enabled: boolean }, boolean>(
    IPC_CHANNELS.AUTO_START_SET,
    async (_event: IpcMainInvokeEvent, args: { enabled: boolean }) => {
      console.log('[AutoStart Handlers] AUTO_START_SET:', args.enabled);
      const manager = getAutoStartManager();
      return await manager.setAutoStart(args.enabled);
    }
  );

  // 获取自启动状态
  registerIpcHandler<void, AutoStartStatus>(
    IPC_CHANNELS.AUTO_START_GET_STATUS,
    async (_event: IpcMainInvokeEvent) => {
      const manager = getAutoStartManager();
      const enabled = await manager.isAutoStartEnabled();
      console.log('[AutoStart Handlers] AUTO_START_GET_STATUS:', enabled);
      return { enabled };
    }
  );

  console.log('[AutoStart Handlers] Registered all autostart IPC handlers');
}
