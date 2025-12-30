/**
 * 路由规则管理 IPC 处理器
 */

import { IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { DomainRule } from '../../../shared/types';
import { registerIpcHandler } from '../ipc-handler';
import { ConfigManager } from '../../services/ConfigManager';
import { ipcEventEmitter } from '../ipc-events';
import { mainEventEmitter, MAIN_EVENTS } from '../main-events';

/**
 * 注册路由规则相关的 IPC 处理器
 */
export function registerRulesHandlers(configManager: ConfigManager): void {
  // 获取所有规则
  registerIpcHandler<void, DomainRule[]>(
    IPC_CHANNELS.RULES_GET_ALL,
    async (_event: IpcMainInvokeEvent) => {
      const config = await configManager.loadConfig();
      return config.customRules || [];
    }
  );

  // 添加规则
  registerIpcHandler<DomainRule, DomainRule>(
    IPC_CHANNELS.RULES_ADD,
    async (_event: IpcMainInvokeEvent, rule: DomainRule) => {
      const config = await configManager.loadConfig();
      const newRule: DomainRule = {
        ...rule,
        id: rule.id || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      };

      if (!config.customRules) {
        config.customRules = [];
      }
      config.customRules.push(newRule);
      await configManager.saveConfig(config);
      
      // 广播和触发事件
      ipcEventEmitter.sendToAll('event:configChanged', { newValue: config });
      mainEventEmitter.emit(MAIN_EVENTS.CONFIG_CHANGED, config);

      console.log('[Rules Handlers] Rule added:', newRule.id);
      return newRule;
    }
  );

  // 更新规则
  registerIpcHandler<DomainRule, void>(
    IPC_CHANNELS.RULES_UPDATE,
    async (_event: IpcMainInvokeEvent, rule: DomainRule) => {
      const config = await configManager.loadConfig();

      if (!config.customRules) {
        throw new Error('No rules found');
      }

      const index = config.customRules.findIndex((r) => r.id === rule.id);
      if (index === -1) {
        throw new Error(`Rule not found: ${rule.id}`);
      }

      config.customRules[index] = rule;
      await configManager.saveConfig(config);

      // 广播和触发事件
      ipcEventEmitter.sendToAll('event:configChanged', { newValue: config });
      mainEventEmitter.emit(MAIN_EVENTS.CONFIG_CHANGED, config);

      console.log('[Rules Handlers] Rule updated:', rule.id);
    }
  );

  // 删除规则
  registerIpcHandler<{ ruleId: string }, void>(
    IPC_CHANNELS.RULES_DELETE,
    async (_event: IpcMainInvokeEvent, args: { ruleId: string }) => {
      const config = await configManager.loadConfig();

      if (!config.customRules) {
        throw new Error('No rules found');
      }

      const index = config.customRules.findIndex((r) => r.id === args.ruleId);
      if (index === -1) {
        throw new Error(`Rule not found: ${args.ruleId}`);
      }

      config.customRules.splice(index, 1);
      await configManager.saveConfig(config);

      // 广播和触发事件
      ipcEventEmitter.sendToAll('event:configChanged', { newValue: config });
      mainEventEmitter.emit(MAIN_EVENTS.CONFIG_CHANGED, config);

      console.log('[Rules Handlers] Rule deleted:', args.ruleId);
    }
  );

  console.log('[Rules Handlers] Registered all rules IPC handlers');
}
