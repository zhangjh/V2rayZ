/**
 * 更新管理 IPC 处理器
 */

import { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { registerIpcHandler } from '../ipc-handler';
import { UpdateService } from '../../services/UpdateService';
import type { UpdateCheckResult, UpdateInfo } from '../../../shared/types/update';

let updateService: UpdateService | null = null;

/**
 * 设置 UpdateService 实例
 */
export function setUpdateService(service: UpdateService): void {
  updateService = service;
}

/**
 * 注册更新相关的 IPC 处理器
 */
export function registerUpdateHandlers(): void {
  // 检查更新
  registerIpcHandler<{ includePrerelease?: boolean }, UpdateCheckResult>(
    IPC_CHANNELS.UPDATE_CHECK,
    async (_event: IpcMainInvokeEvent, args) => {
      if (!updateService) {
        return { hasUpdate: false, error: 'UpdateService not initialized' };
      }
      return updateService.checkForUpdate(args?.includePrerelease ?? false);
    }
  );

  // 下载更新
  registerIpcHandler<
    { updateInfo: UpdateInfo },
    { success: boolean; filePath?: string; error?: string }
  >(IPC_CHANNELS.UPDATE_DOWNLOAD, async (_event: IpcMainInvokeEvent, args) => {
    if (!updateService) {
      return { success: false, error: 'UpdateService not initialized' };
    }
    if (!args?.updateInfo) {
      return { success: false, error: 'Missing updateInfo' };
    }
    const filePath = await updateService.downloadUpdate(args.updateInfo);
    if (filePath) {
      return { success: true, filePath };
    }
    return { success: false, error: '下载失败' };
  });

  // 安装更新
  registerIpcHandler<{ filePath: string }, { success: boolean; error?: string }>(
    IPC_CHANNELS.UPDATE_INSTALL,
    async (_event: IpcMainInvokeEvent, args) => {
      if (!updateService) {
        return { success: false, error: 'UpdateService not initialized' };
      }
      if (!args?.filePath) {
        return { success: false, error: 'Missing filePath' };
      }
      const success = await updateService.installUpdate(args.filePath);
      return { success };
    }
  );

  // 跳过版本
  registerIpcHandler<{ version: string }, { success: boolean }>(
    IPC_CHANNELS.UPDATE_SKIP,
    async (_event: IpcMainInvokeEvent, args) => {
      if (!updateService) {
        return { success: false };
      }
      if (args?.version) {
        updateService.skipVersion(args.version);
      }
      return { success: true };
    }
  );

  // 打开 Releases 页面
  registerIpcHandler<void, { success: boolean }>(IPC_CHANNELS.UPDATE_OPEN_RELEASES, async () => {
    if (updateService) {
      updateService.openReleasesPage();
    }
    return { success: true };
  });

  console.log('[Update Handlers] Registered all update IPC handlers');
}
