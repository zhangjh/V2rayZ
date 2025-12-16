/**
 * 版本信息 IPC 处理器
 * 处理版本信息相关的 IPC 请求
 */

import { IpcMainInvokeEvent, app } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { registerIpcHandler } from '../ipc-handler';

// 从 package.json 读取 sing-box 版本
const packageJson = require('../../../../../package.json');
const SINGBOX_VERSION = packageJson.singboxVersion || 'Unknown';

interface VersionInfo {
  appVersion: string;
  appName: string;
  buildDate: string;
  singBoxVersion: string;
  copyright: string;
  repositoryUrl: string;
}

/**
 * 注册版本信息相关的 IPC 处理器
 */
export function registerVersionHandlers(): void {
  registerIpcHandler<void, VersionInfo>(
    IPC_CHANNELS.VERSION_GET_INFO,
    async (_event: IpcMainInvokeEvent) => {
      return {
        appVersion: app.getVersion(),
        appName: 'FlowZ',
        buildDate: new Date().toISOString().split('T')[0],
        singBoxVersion: SINGBOX_VERSION,
        copyright: `© ${new Date().getFullYear()} FlowZ. All rights reserved.`,
        repositoryUrl: 'https://github.com/zhangjh/FlowZ',
      };
    }
  );

  console.log('[Version Handlers] Registered all version IPC handlers');
}
