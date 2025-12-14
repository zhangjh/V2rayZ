/**
 * API 客户端
 * 封装所有 IPC 调用方法，提供类型安全的 API 接口
 */

import { ipcClient } from './ipc-client';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type {
  UserConfig,
  ServerConfig,
  ProxyStatus,
  SystemProxyStatus,
  LogEntry,
  TrafficStats,
  DomainRule,
  AutoStartStatus,
  ConnectionStateInfo,
} from '../../shared/types';

/**
 * 代理控制 API
 */
export const proxyApi = {
  /**
   * 启动代理
   * @param config 用户配置
   */
  async start(config: UserConfig): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.PROXY_START, config);
  },

  /**
   * 停止代理
   */
  async stop(): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.PROXY_STOP);
  },

  /**
   * 重启代理
   */
  async restart(): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.PROXY_RESTART);
  },

  /**
   * 获取代理状态
   */
  async getStatus(): Promise<ProxyStatus> {
    return ipcClient.invoke(IPC_CHANNELS.PROXY_GET_STATUS);
  },

  /**
   * 监听代理启动事件
   */
  onStarted(listener: (data: { pid: number; timestamp: string }) => void): () => void {
    return ipcClient.on(IPC_CHANNELS.EVENT_PROXY_STARTED, listener);
  },

  /**
   * 监听代理停止事件
   */
  onStopped(listener: (data: { timestamp: string }) => void): () => void {
    return ipcClient.on(IPC_CHANNELS.EVENT_PROXY_STOPPED, listener);
  },

  /**
   * 监听代理错误事件
   */
  onError(listener: (data: { error: string; timestamp: string }) => void): () => void {
    return ipcClient.on(IPC_CHANNELS.EVENT_PROXY_ERROR, listener);
  },
};

/**
 * 配置管理 API
 */
export const configApi = {
  /**
   * 获取完整配置
   */
  async get(): Promise<UserConfig> {
    return ipcClient.invoke(IPC_CHANNELS.CONFIG_GET);
  },

  /**
   * 保存完整配置
   */
  async save(config: UserConfig): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.CONFIG_SAVE, config);
  },

  /**
   * 更新代理模式
   */
  async updateMode(mode: UserConfig['proxyMode']): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.CONFIG_UPDATE_MODE, { mode });
  },

  /**
   * 获取配置值
   */
  async getValue<T = any>(key: string): Promise<T> {
    return ipcClient.invoke(IPC_CHANNELS.CONFIG_GET_VALUE, { key });
  },

  /**
   * 设置配置值
   */
  async setValue(key: string, value: any): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.CONFIG_SET_VALUE, { key, value });
  },

  /**
   * 监听配置变化事件
   */
  onChanged(listener: (data: { key?: string; oldValue?: any; newValue?: any }) => void): () => void {
    return ipcClient.on(IPC_CHANNELS.EVENT_CONFIG_CHANGED, listener);
  },
};

/**
 * 服务器管理 API
 */
export const serverApi = {
  /**
   * 获取所有服务器
   */
  async getAll(): Promise<ServerConfig[]> {
    return ipcClient.invoke(IPC_CHANNELS.SERVER_GET_ALL);
  },

  /**
   * 添加服务器
   */
  async add(server: Omit<ServerConfig, 'id'>): Promise<ServerConfig> {
    return ipcClient.invoke(IPC_CHANNELS.SERVER_ADD, server);
  },

  /**
   * 更新服务器
   */
  async update(server: ServerConfig): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.SERVER_UPDATE, server);
  },

  /**
   * 删除服务器
   */
  async delete(serverId: string): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.SERVER_DELETE, { serverId });
  },

  /**
   * 切换服务器
   */
  async switch(serverId: string): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.SERVER_SWITCH, { serverId });
  },

  /**
   * 解析协议 URL
   */
  async parseUrl(url: string): Promise<Omit<ServerConfig, 'id'>> {
    return ipcClient.invoke(IPC_CHANNELS.SERVER_PARSE_URL, { url });
  },

  /**
   * 从 URL 添加服务器
   */
  async addFromUrl(url: string, name?: string): Promise<ServerConfig> {
    return ipcClient.invoke(IPC_CHANNELS.SERVER_ADD_FROM_URL, { url, name });
  },
};

/**
 * 路由规则管理 API
 */
export const rulesApi = {
  /**
   * 获取所有规则
   */
  async getAll(): Promise<DomainRule[]> {
    return ipcClient.invoke(IPC_CHANNELS.RULES_GET_ALL);
  },

  /**
   * 添加规则
   */
  async add(rule: Omit<DomainRule, 'id'>): Promise<DomainRule> {
    return ipcClient.invoke(IPC_CHANNELS.RULES_ADD, rule);
  },

  /**
   * 更新规则
   */
  async update(rule: DomainRule): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.RULES_UPDATE, rule);
  },

  /**
   * 删除规则
   */
  async delete(ruleId: string): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.RULES_DELETE, { ruleId });
  },
};

/**
 * 日志管理 API
 */
export const logsApi = {
  /**
   * 获取日志
   */
  async get(limit?: number): Promise<LogEntry[]> {
    return ipcClient.invoke(IPC_CHANNELS.LOGS_GET, { limit });
  },

  /**
   * 清空日志
   */
  async clear(): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.LOGS_CLEAR);
  },

  /**
   * 设置日志级别
   */
  async setLevel(level: LogEntry['level']): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.LOGS_SET_LEVEL, { level });
  },

  /**
   * 监听日志接收事件
   */
  onReceived(listener: (log: LogEntry) => void): () => void {
    return ipcClient.on(IPC_CHANNELS.EVENT_LOG_RECEIVED, listener);
  },
};

/**
 * 系统代理管理 API
 */
export const systemProxyApi = {
  /**
   * 启用系统代理
   */
  async enable(address: string, port: number): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.SYSTEM_PROXY_ENABLE, { address, port });
  },

  /**
   * 禁用系统代理
   */
  async disable(): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.SYSTEM_PROXY_DISABLE);
  },

  /**
   * 获取系统代理状态
   */
  async getStatus(): Promise<SystemProxyStatus> {
    return ipcClient.invoke(IPC_CHANNELS.SYSTEM_PROXY_GET_STATUS);
  },
};

/**
 * 自启动管理 API
 */
export const autoStartApi = {
  /**
   * 设置自启动
   */
  async set(enabled: boolean): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.AUTO_START_SET, { enabled });
  },

  /**
   * 获取自启动状态
   */
  async getStatus(): Promise<AutoStartStatus> {
    return ipcClient.invoke(IPC_CHANNELS.AUTO_START_GET_STATUS);
  },
};

/**
 * 统计信息 API
 */
export const statsApi = {
  /**
   * 获取流量统计
   */
  async get(): Promise<TrafficStats> {
    return ipcClient.invoke(IPC_CHANNELS.STATS_GET);
  },

  /**
   * 重置流量统计
   */
  async reset(): Promise<void> {
    return ipcClient.invoke(IPC_CHANNELS.STATS_RESET);
  },

  /**
   * 监听统计更新事件
   */
  onUpdated(listener: (stats: TrafficStats) => void): () => void {
    return ipcClient.on(IPC_CHANNELS.EVENT_STATS_UPDATED, listener);
  },
};

/**
 * 连接状态 API
 */
export const connectionApi = {
  /**
   * 监听连接状态变化事件
   */
  onStateChanged(listener: (state: ConnectionStateInfo) => void): () => void {
    return ipcClient.on(IPC_CHANNELS.EVENT_CONNECTION_STATE_CHANGED, listener);
  },
};

/**
 * 统一的 API 客户端
 */
export const api = {
  proxy: proxyApi,
  config: configApi,
  server: serverApi,
  rules: rulesApi,
  logs: logsApi,
  systemProxy: systemProxyApi,
  autoStart: autoStartApi,
  stats: statsApi,
  connection: connectionApi,
};

/**
 * 默认导出
 */
export default api;
