/**
 * 配置管理 IPC 处理器
 * 处理配置相关的 IPC 请求
 */

import { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { UserConfig, ProxyMode } from '../../../shared/types';
import { registerIpcHandler } from '../ipc-handler';
import { ConfigManager } from '../../services/ConfigManager';

/**
 * 注册配置管理相关的 IPC 处理器
 */
export function registerConfigHandlers(configManager: ConfigManager): void {
  // 获取配置
  registerIpcHandler<void, UserConfig>(
    IPC_CHANNELS.CONFIG_GET,
    async (_event: IpcMainInvokeEvent) => {
      return await configManager.loadConfig();
    }
  );

  // 保存配置
  registerIpcHandler<UserConfig, void>(
    IPC_CHANNELS.CONFIG_SAVE,
    async (_event: IpcMainInvokeEvent, config: UserConfig) => {
      await configManager.saveConfig(config);
    }
  );

  // 更新代理模式
  registerIpcHandler<{ mode: ProxyMode }, void>(
    IPC_CHANNELS.CONFIG_UPDATE_MODE,
    async (_event: IpcMainInvokeEvent, args: { mode: ProxyMode }) => {
      await configManager.set('proxyMode', args.mode);
    }
  );

  // 获取配置项
  registerIpcHandler<{ key: keyof UserConfig }, any>(
    IPC_CHANNELS.CONFIG_GET_VALUE,
    async (_event: IpcMainInvokeEvent, args: { key: keyof UserConfig }) => {
      return configManager.get(args.key);
    }
  );

  // 设置配置项
  registerIpcHandler<{ key: keyof UserConfig; value: any }, void>(
    IPC_CHANNELS.CONFIG_SET_VALUE,
    async (_event: IpcMainInvokeEvent, args: { key: keyof UserConfig; value: any }) => {
      await configManager.set(args.key, args.value);
    }
  );

  console.log('[Config Handlers] Registered all config IPC handlers');
}
