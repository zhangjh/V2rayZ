/**
 * 属性测试：UI 交互触发正确操作
 * 
 * 属性 2: UI 交互触发正确的后端操作
 * 对于任何 UI 交互事件（如按钮点击、表单提交），系统应该触发对应的 IPC 调用，
 * 并且调用的通道名称和参数应该与交互类型匹配。
 * 
 * 验证: 需求 1.4
 * 
 * Feature: electron-cross-platform, Property 2: UI 交互触发正确的后端操作
 */

import * as fc from 'fast-check';
import { api } from '../ipc/api-client';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { UserConfig, ServerConfig, DomainRule } from '../../shared/types';

// Mock IPC client
jest.mock('../ipc/ipc-client', () => ({
  ipcClient: {
    invoke: jest.fn(),
    on: jest.fn(() => jest.fn()), // 返回取消订阅函数
  },
}));

// 导入 mock 后的 ipcClient
import { ipcClient } from '../ipc/ipc-client';

describe('属性测试: UI 交互触发正确的后端操作', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 属性 2.1: 代理启动交互触发正确的 IPC 调用
   * 对于任何代理启动操作，应该调用 PROXY_START 通道
   */
  test('属性 2.1: 代理启动交互触发正确的 IPC 调用', async () => {
    // 模拟成功响应
    (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

    // 执行代理启动操作
    await api.proxy.start();

    // 验证调用了正确的通道
    expect(ipcClient.invoke).toHaveBeenCalledWith(IPC_CHANNELS.PROXY_START);
    expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
  });

  /**
   * 属性 2.2: 代理停止交互触发正确的 IPC 调用
   * 对于任何代理停止操作，应该调用 PROXY_STOP 通道
   */
  test('属性 2.2: 代理停止交互触发正确的 IPC 调用', async () => {
    (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

    await api.proxy.stop();

    expect(ipcClient.invoke).toHaveBeenCalledWith(IPC_CHANNELS.PROXY_STOP);
    expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
  });

  /**
   * 属性 2.3: 配置保存交互触发正确的 IPC 调用和参数
   * 对于任何有效的配置对象，保存操作应该调用 CONFIG_SAVE 通道并传递配置
   */
  test('属性 2.3: 配置保存交互触发正确的 IPC 调用和参数', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          servers: fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string(),
              protocol: fc.constantFrom('vless', 'trojan'),
              address: fc.string(),
              port: fc.integer({ min: 1, max: 65535 }),
            })
          ),
          selectedServerId: fc.option(fc.uuid(), { nil: null }),
          proxyMode: fc.constantFrom('global', 'smart', 'direct'),
          proxyModeType: fc.constantFrom('systemProxy', 'tun'),
          customRules: fc.array(
            fc.record({
              id: fc.uuid(),
              domain: fc.string(),
              action: fc.constantFrom('proxy', 'direct', 'block'),
            })
          ),
          autoStart: fc.boolean(),
          autoConnect: fc.boolean(),
          minimizeToTray: fc.boolean(),
          socksPort: fc.integer({ min: 1024, max: 65535 }),
          httpPort: fc.integer({ min: 1024, max: 65535 }),
        }),
        async (config) => {
          // 在每次迭代前重置 mock
          jest.clearAllMocks();
          (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

          // 执行配置保存操作
          await api.config.save(config as UserConfig);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.CONFIG_SAVE,
            config
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 2.4: 代理模式切换交互触发正确的 IPC 调用
   * 对于任何有效的代理模式，切换操作应该调用 CONFIG_UPDATE_MODE 通道
   */
  test('属性 2.4: 代理模式切换交互触发正确的 IPC 调用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('global', 'smart', 'direct'),
        async (mode) => {
          jest.clearAllMocks();
          (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

          // 执行代理模式切换操作
          await api.config.updateMode(mode);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.CONFIG_UPDATE_MODE,
            { mode }
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * 属性 2.5: 服务器切换交互触发正确的 IPC 调用
   * 对于任何服务器 ID，切换操作应该调用 SERVER_SWITCH 通道
   */
  test('属性 2.5: 服务器切换交互触发正确的 IPC 调用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (serverId) => {
          jest.clearAllMocks();
          (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

          // 执行服务器切换操作
          await api.server.switch(serverId);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.SERVER_SWITCH,
            { serverId }
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 2.6: 服务器添加交互触发正确的 IPC 调用和参数
   * 对于任何有效的服务器配置，添加操作应该调用 SERVER_ADD 通道
   */
  test('属性 2.6: 服务器添加交互触发正确的 IPC 调用和参数', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1 }),
          protocol: fc.constantFrom('vless', 'trojan'),
          address: fc.string({ minLength: 1 }),
          port: fc.integer({ min: 1, max: 65535 }),
          uuid: fc.option(fc.uuid()),
          password: fc.option(fc.string()),
        }),
        async (server) => {
          jest.clearAllMocks();
          const mockResponse: ServerConfig = {
            ...server,
            id: 'generated-id',
          } as ServerConfig;

          (ipcClient.invoke as jest.Mock).mockResolvedValue(mockResponse);

          // 执行服务器添加操作
          const result = await api.server.add(server as Omit<ServerConfig, 'id'>);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.SERVER_ADD,
            server
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);

          // 验证返回值包含生成的 ID
          expect(result).toHaveProperty('id');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 2.7: 服务器删除交互触发正确的 IPC 调用
   * 对于任何服务器 ID，删除操作应该调用 SERVER_DELETE 通道
   */
  test('属性 2.7: 服务器删除交互触发正确的 IPC 调用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (serverId) => {
          jest.clearAllMocks();
          (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

          // 执行服务器删除操作
          await api.server.delete(serverId);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.SERVER_DELETE,
            { serverId }
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 2.8: 协议 URL 解析交互触发正确的 IPC 调用
   * 对于任何协议 URL，解析操作应该调用 SERVER_PARSE_URL 通道
   */
  test('属性 2.8: 协议 URL 解析交互触发正确的 IPC 调用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string().map(s => `vless://${s}`),
          fc.string().map(s => `trojan://${s}`)
        ),
        async (url) => {
          jest.clearAllMocks();
          const mockParsedServer = {
            name: 'Parsed Server',
            protocol: 'vless',
            address: 'example.com',
            port: 443,
          };

          (ipcClient.invoke as jest.Mock).mockResolvedValue(mockParsedServer);

          // 执行 URL 解析操作
          await api.server.parseUrl(url);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.SERVER_PARSE_URL,
            { url }
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 2.9: 路由规则添加交互触发正确的 IPC 调用
   * 对于任何有效的路由规则，添加操作应该调用 RULES_ADD 通道
   */
  test('属性 2.9: 路由规则添加交互触发正确的 IPC 调用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          domain: fc.string({ minLength: 1 }),
          action: fc.constantFrom('proxy', 'direct', 'block'),
          enabled: fc.boolean(),
        }),
        async (rule) => {
          jest.clearAllMocks();
          const mockResponse: DomainRule = {
            ...rule,
            id: 'generated-id',
          };

          (ipcClient.invoke as jest.Mock).mockResolvedValue(mockResponse);

          // 执行规则添加操作
          await api.rules.add(rule as Omit<DomainRule, 'id'>);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.RULES_ADD,
            rule
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 2.10: 路由规则删除交互触发正确的 IPC 调用
   * 对于任何规则 ID，删除操作应该调用 RULES_DELETE 通道
   */
  test('属性 2.10: 路由规则删除交互触发正确的 IPC 调用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (ruleId) => {
          jest.clearAllMocks();
          (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

          // 执行规则删除操作
          await api.rules.delete(ruleId);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.RULES_DELETE,
            { ruleId }
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 2.11: 系统代理启用交互触发正确的 IPC 调用
   * 对于任何有效的地址和端口，启用操作应该调用 SYSTEM_PROXY_ENABLE 通道
   */
  test('属性 2.11: 系统代理启用交互触发正确的 IPC 调用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 65535 }),
        async (address, port) => {
          jest.clearAllMocks();
          (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

          // 执行系统代理启用操作
          await api.systemProxy.enable(address, port);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.SYSTEM_PROXY_ENABLE,
            { address, port }
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 2.12: 自启动设置交互触发正确的 IPC 调用
   * 对于任何布尔值，自启动设置应该调用 AUTO_START_SET 通道
   */
  test('属性 2.12: 自启动设置交互触发正确的 IPC 调用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (enabled) => {
          jest.clearAllMocks();
          (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

          // 执行自启动设置操作
          await api.autoStart.set(enabled);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.AUTO_START_SET,
            { enabled }
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * 属性 2.13: 日志级别设置交互触发正确的 IPC 调用
   * 对于任何有效的日志级别，设置操作应该调用 LOGS_SET_LEVEL 通道
   */
  test('属性 2.13: 日志级别设置交互触发正确的 IPC 调用', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('debug', 'info', 'warn', 'error'),
        async (level) => {
          jest.clearAllMocks();
          (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

          // 执行日志级别设置操作
          await api.logs.setLevel(level);

          // 验证调用了正确的通道和参数
          expect(ipcClient.invoke).toHaveBeenCalledWith(
            IPC_CHANNELS.LOGS_SET_LEVEL,
            { level }
          );
          expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * 属性 2.14: 统计信息重置交互触发正确的 IPC 调用
   * 统计重置操作应该调用 STATS_RESET 通道
   */
  test('属性 2.14: 统计信息重置交互触发正确的 IPC 调用', async () => {
    (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

    // 执行统计重置操作
    await api.stats.reset();

    // 验证调用了正确的通道
    expect(ipcClient.invoke).toHaveBeenCalledWith(IPC_CHANNELS.STATS_RESET);
    expect(ipcClient.invoke).toHaveBeenCalledTimes(1);
  });

  /**
   * 属性 2.15: 多个连续交互触发对应的 IPC 调用序列
   * 对于任何交互序列，每个交互应该触发对应的 IPC 调用，且顺序正确
   */
  test('属性 2.15: 多个连续交互触发对应的 IPC 调用序列', async () => {
    (ipcClient.invoke as jest.Mock).mockResolvedValue(undefined);

    // 执行一系列操作
    await api.proxy.start();
    await api.config.updateMode('global');
    await api.proxy.stop();

    // 验证调用顺序和通道
    expect(ipcClient.invoke).toHaveBeenNthCalledWith(1, IPC_CHANNELS.PROXY_START);
    expect(ipcClient.invoke).toHaveBeenNthCalledWith(
      2,
      IPC_CHANNELS.CONFIG_UPDATE_MODE,
      { mode: 'global' }
    );
    expect(ipcClient.invoke).toHaveBeenNthCalledWith(3, IPC_CHANNELS.PROXY_STOP);
    expect(ipcClient.invoke).toHaveBeenCalledTimes(3);
  });

  /**
   * 属性 2.16: 事件监听器注册触发正确的 IPC 订阅
   * 对于任何事件类型，监听器注册应该调用 ipcClient.on
   */
  test('属性 2.16: 事件监听器注册触发正确的 IPC 订阅', async () => {
    const mockListener = jest.fn();

    // 注册代理启动事件监听器
    const unsubscribe1 = api.proxy.onStarted(mockListener);
    expect(ipcClient.on).toHaveBeenCalledWith(
      IPC_CHANNELS.EVENT_PROXY_STARTED,
      mockListener
    );

    // 注册配置变化事件监听器
    const unsubscribe2 = api.config.onChanged(mockListener);
    expect(ipcClient.on).toHaveBeenCalledWith(
      IPC_CHANNELS.EVENT_CONFIG_CHANGED,
      mockListener
    );

    // 验证返回了取消订阅函数
    expect(typeof unsubscribe1).toBe('function');
    expect(typeof unsubscribe2).toBe('function');
  });
});
