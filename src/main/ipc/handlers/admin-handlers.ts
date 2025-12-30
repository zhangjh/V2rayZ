/**
 * 管理员权限 IPC 处理器
 */

import { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { registerIpcHandler } from '../ipc-handler';
import { adminPrivilegeService } from '../../services/AdminPrivilege';

export interface AdminCheckResult {
  isAdmin: boolean;
  platform: NodeJS.Platform;
  needsElevationForTun: boolean;
}

/**
 * 注册管理员权限相关的 IPC 处理器
 */
export function registerAdminHandlers(): void {
  // 检查管理员权限
  registerIpcHandler<void, AdminCheckResult>(
    IPC_CHANNELS.ADMIN_CHECK,
    async (_event: IpcMainInvokeEvent) => {
      const isAdmin = adminPrivilegeService.isAdmin();
      const needsElevation = adminPrivilegeService.needsElevationForTun();
      console.log('[Admin Handlers] ADMIN_CHECK:', {
        isAdmin,
        platform: process.platform,
        needsElevation,
      });
      return {
        isAdmin,
        platform: process.platform,
        needsElevationForTun: needsElevation,
      };
    }
  );

  console.log('[Admin Handlers] Registered all admin IPC handlers');
}
