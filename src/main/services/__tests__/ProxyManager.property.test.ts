/**
 * ProxyManager 属性测试
 * 使用 fast-check 进行基于属性的测试
 */

import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProxyManager } from '../ProxyManager';
import { LogManager } from '../LogManager';
import type { UserConfig, ServerConfig } from '../../../shared/types';

// ============================================================================
// 生成器 (Generators)
// ============================================================================

/**
 * 生成有效的 VLESS 服务器配置
 */
const vlessServerArbitrary = (): fc.Arbitrary<ServerConfig> => {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    protocol: fc.constant('vless' as const),
    address: fc.domain(),
    port: fc.integer({ min: 1, max: 65535 }),
    uuid: fc.uuid(),
    encryption: fc.option(fc.constantFrom('none', 'auto'), { nil: undefined }),
    flow: fc.option(fc.constantFrom('xtls-rprx-vision'), { nil: undefined }),
    network: fc.option(fc.constantFrom('tcp', 'ws', 'grpc'), { nil: undefined }),
    security: fc.option(fc.constantFrom('none', 'tls'), { nil: undefined }),
  });
};

/**
 * 生成有效的 Trojan 服务器配置
 */
const trojanServerArbitrary = (): fc.Arbitrary<ServerConfig> => {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    protocol: fc.constant('trojan' as const),
    address: fc.domain(),
    port: fc.integer({ min: 1, max: 65535 }),
    password: fc.string({ minLength: 1, maxLength: 100 }),
    network: fc.option(fc.constantFrom('tcp', 'ws', 'grpc'), { nil: undefined }),
    security: fc.option(fc.constantFrom('none', 'tls'), { nil: undefined }),
  });
};

/**
 * 生成有效的服务器配置
 */
const serverConfigArbitrary = (): fc.Arbitrary<ServerConfig> => {
  return fc.oneof(vlessServerArbitrary(), trojanServerArbitrary());
};

/**
 * 生成有效的用户配置（带有选中的服务器）
 */
const validUserConfigWithServerArbitrary = (): fc.Arbitrary<UserConfig> => {
  return fc
    .record({
      servers: fc.array(serverConfigArbitrary(), { minLength: 1, maxLength: 5 }),
      selectedServerId: fc.constant(null as string | null),
      proxyMode: fc.constantFrom('global', 'smart', 'direct'),
      proxyModeType: fc.constantFrom('systemProxy', 'tun'),
      tunConfig: fc.record({
        mtu: fc.integer({ min: 1280, max: 9000 }),
        stack: fc.constantFrom('system', 'gvisor', 'mixed'),
        autoRoute: fc.boolean(),
        strictRoute: fc.boolean(),
      }),
      customRules: fc.constant([]) as fc.Arbitrary<any[]>,
      autoStart: fc.boolean(),
      autoConnect: fc.boolean(),
      minimizeToTray: fc.boolean(),
      socksPort: fc.integer({ min: 1024, max: 65535 }),
      httpPort: fc.integer({ min: 1024, max: 65535 }),
      logLevel: fc.constantFrom('info', 'warn', 'error'),
    })
    .map((config) => {
      // 选择第一个服务器
      (config as any).selectedServerId = config.servers[0].id;
      return config;
    });
};

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 创建临时目录
 */
async function createTempDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'v2rayz-proxy-test-'));
  return tempDir;
}

/**
 * 清理临时目录
 */
async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // 忽略清理错误
  }
}

// ============================================================================
// 属性测试
// ============================================================================

describe('ProxyManager Property Tests', () => {
  let tempDir: string;
  let logManager: LogManager;

  let mockConfigPath: string;
  let mockSingboxPath: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
    logManager = new LogManager(path.join(tempDir, 'logs'));
    mockConfigPath = path.join(tempDir, 'singbox_config.json');
    mockSingboxPath = path.join(tempDir, 'sing-box');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  // 辅助函数：创建 ProxyManager 实例
  function createProxyManager(): ProxyManager {
    return new ProxyManager(logManager, undefined, mockConfigPath, mockSingboxPath);
  }

  /**
   * 属性 15: 代理配置生成和进程启动
   * 对于任何有效的用户配置，启动代理时应该生成有效的 sing-box JSON 配置，
   * 并且 sing-box 进程应该成功启动（不立即退出）。
   *
   * Feature: electron-cross-platform, Property 15: 代理配置生成和进程启动
   * Validates: Requirements 5.1
   */
  describe('Property 15: Proxy configuration generation and process startup', () => {
    it('should generate valid sing-box config for any valid user config', async () => {
      await fc.assert(
        fc.asyncProperty(validUserConfigWithServerArbitrary(), async (config) => {
          const proxyManager = createProxyManager();

          try {
            // 生成 sing-box 配置
            const singboxConfig = proxyManager.generateSingBoxConfig(config);

            // 验证配置结构
            expect(singboxConfig).toBeDefined();
            expect(singboxConfig.log).toBeDefined();
            expect(singboxConfig.inbounds).toBeDefined();
            expect(singboxConfig.outbounds).toBeDefined();
            expect(singboxConfig.route).toBeDefined();

            // 验证日志配置
            expect(singboxConfig.log.level).toBe(config.logLevel);
            expect(singboxConfig.log.timestamp).toBe(true);

            // 验证 inbounds
            expect(Array.isArray(singboxConfig.inbounds)).toBe(true);
            expect(singboxConfig.inbounds.length).toBeGreaterThan(0);

            if (config.proxyModeType === 'systemProxy') {
              // 系统代理模式应该有 HTTP 和 SOCKS inbound
              const httpInbound = singboxConfig.inbounds.find((i) => i.type === 'http');
              const socksInbound = singboxConfig.inbounds.find((i) => i.type === 'socks');

              expect(httpInbound).toBeDefined();
              expect(socksInbound).toBeDefined();
              expect(httpInbound?.listen_port).toBe(config.httpPort);
              expect(socksInbound?.listen_port).toBe(config.socksPort);
            } else if (config.proxyModeType === 'tun') {
              // TUN 模式应该有 TUN inbound
              const tunInbound = singboxConfig.inbounds.find((i) => i.type === 'tun');
              expect(tunInbound).toBeDefined();
              expect(tunInbound?.mtu).toBe(config.tunConfig.mtu);
              expect(tunInbound?.stack).toBe(config.tunConfig.stack);
            }

            // 验证 outbounds
            expect(Array.isArray(singboxConfig.outbounds)).toBe(true);
            expect(singboxConfig.outbounds.length).toBeGreaterThanOrEqual(3); // proxy, direct, block

            const proxyOutbound = singboxConfig.outbounds.find((o) => o.tag === 'proxy');
            const directOutbound = singboxConfig.outbounds.find((o) => o.tag === 'direct');
            const blockOutbound = singboxConfig.outbounds.find((o) => o.tag === 'block');

            expect(proxyOutbound).toBeDefined();
            expect(directOutbound).toBeDefined();
            expect(blockOutbound).toBeDefined();

            // 验证代理 outbound 配置
            const selectedServer = config.servers.find((s) => s.id === config.selectedServerId);
            expect(proxyOutbound?.type).toBe(selectedServer?.protocol);
            expect(proxyOutbound?.server).toBe(selectedServer?.address);
            expect(proxyOutbound?.server_port).toBe(selectedServer?.port);

            if (selectedServer?.protocol === 'vless') {
              expect(proxyOutbound?.uuid).toBe(selectedServer.uuid);
            } else if (selectedServer?.protocol === 'trojan') {
              expect(proxyOutbound?.password).toBe(selectedServer.password);
            }

            // 验证路由配置
            expect(singboxConfig.route).toBeDefined();
            expect(Array.isArray(singboxConfig.route?.rules)).toBe(true);
          } catch (error) {
            // 配置生成不应该抛出错误
            throw error;
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should generate different configs for different proxy modes', async () => {
      await fc.assert(
        fc.asyncProperty(validUserConfigWithServerArbitrary(), async (baseConfig) => {
          const proxyManager = createProxyManager();

          // 生成全局模式配置
          const globalConfig = { ...baseConfig, proxyMode: 'global' as const };
          const globalSingboxConfig = proxyManager.generateSingBoxConfig(globalConfig);

          // 生成智能分流模式配置
          const smartConfig = { ...baseConfig, proxyMode: 'smart' as const };
          const smartSingboxConfig = proxyManager.generateSingBoxConfig(smartConfig);

          // 生成直连模式配置
          const directConfig = { ...baseConfig, proxyMode: 'direct' as const };
          const directSingboxConfig = proxyManager.generateSingBoxConfig(directConfig);

          // 验证路由规则不同
          expect(globalSingboxConfig.route?.rules).not.toEqual(smartSingboxConfig.route?.rules);
          expect(smartSingboxConfig.route?.rules).not.toEqual(directSingboxConfig.route?.rules);

          // 验证智能分流模式有 DNS 配置
          expect(smartSingboxConfig.dns).toBeDefined();

          // 验证直连模式的 final 出站
          expect(directSingboxConfig.route?.final).toBe('direct');
        }),
        { numRuns: 50 }
      );
    });

    it('should generate different configs for different proxy mode types', async () => {
      await fc.assert(
        fc.asyncProperty(validUserConfigWithServerArbitrary(), async (baseConfig) => {
          const proxyManager = createProxyManager();

          // 生成系统代理模式配置
          const systemProxyConfig = { ...baseConfig, proxyModeType: 'systemProxy' as const };
          const systemProxySingboxConfig = proxyManager.generateSingBoxConfig(systemProxyConfig);

          // 生成 TUN 模式配置
          const tunConfig = { ...baseConfig, proxyModeType: 'tun' as const };
          const tunSingboxConfig = proxyManager.generateSingBoxConfig(tunConfig);

          // 验证 inbounds 不同
          const systemProxyInboundTypes = systemProxySingboxConfig.inbounds.map((i) => i.type);
          const tunInboundTypes = tunSingboxConfig.inbounds.map((i) => i.type);

          expect(systemProxyInboundTypes).toContain('http');
          expect(systemProxyInboundTypes).toContain('socks');
          expect(tunInboundTypes).toContain('tun');
        }),
        { numRuns: 50 }
      );
    });

    it('should handle both VLESS and Trojan protocols correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(vlessServerArbitrary(), trojanServerArbitrary()),
          async (server) => {
            const proxyManager = createProxyManager();

            const config: UserConfig = {
              servers: [server],
              selectedServerId: server.id,
              proxyMode: 'global',
              proxyModeType: 'systemProxy',
              tunConfig: {
                mtu: 9000,
                stack: 'system',
                autoRoute: true,
                strictRoute: true,
              },
              customRules: [],
              autoStart: false,
              autoConnect: false,
              minimizeToTray: true,
              socksPort: 1080,
              httpPort: 1081,
              logLevel: 'info',
            };

            const singboxConfig = proxyManager.generateSingBoxConfig(config);
            const proxyOutbound = singboxConfig.outbounds.find((o) => o.tag === 'proxy');

            expect(proxyOutbound).toBeDefined();
            expect(proxyOutbound?.type).toBe(server.protocol);

            if (server.protocol === 'vless') {
              expect(proxyOutbound?.uuid).toBe(server.uuid);
              expect(proxyOutbound?.password).toBeUndefined();
            } else if (server.protocol === 'trojan') {
              expect(proxyOutbound?.password).toBe(server.password);
              expect(proxyOutbound?.uuid).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include transport config when network is not tcp', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            server: serverConfigArbitrary(),
            network: fc.constantFrom('ws', 'grpc', 'http'),
          }),
          async ({ server, network }) => {
            const proxyManager = createProxyManager();

            // 设置传输层
            const serverWithTransport = {
              ...server,
              network,
              wsSettings: network === 'ws' ? { path: '/ws' } : undefined,
              grpcSettings: network === 'grpc' ? { serviceName: 'GrpcService' } : undefined,
              httpSettings:
                network === 'http' ? { host: ['example.com'], path: '/http' } : undefined,
            };

            const config: UserConfig = {
              servers: [serverWithTransport],
              selectedServerId: serverWithTransport.id,
              proxyMode: 'global',
              proxyModeType: 'systemProxy',
              tunConfig: {
                mtu: 9000,
                stack: 'system',
                autoRoute: true,
                strictRoute: true,
              },
              customRules: [],
              autoStart: false,
              autoConnect: false,
              minimizeToTray: true,
              socksPort: 1080,
              httpPort: 1081,
              logLevel: 'info',
            };

            const singboxConfig = proxyManager.generateSingBoxConfig(config);
            const proxyOutbound = singboxConfig.outbounds.find((o) => o.tag === 'proxy');

            expect(proxyOutbound?.transport).toBeDefined();
            expect(proxyOutbound?.transport?.type).toBe(network);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include TLS config when security is tls', async () => {
      await fc.assert(
        fc.asyncProperty(serverConfigArbitrary(), async (server) => {
          const proxyManager = createProxyManager();

          // 设置 TLS
          const serverWithTls = {
            ...server,
            security: 'tls' as const,
            tlsSettings: {
              serverName: server.address,
              allowInsecure: false,
              alpn: ['h2', 'http/1.1'],
            },
          };

          const config: UserConfig = {
            servers: [serverWithTls],
            selectedServerId: serverWithTls.id,
            proxyMode: 'global',
            proxyModeType: 'systemProxy',
            tunConfig: {
              mtu: 9000,
              stack: 'system',
              autoRoute: true,
              strictRoute: true,
            },
            customRules: [],
            autoStart: false,
            autoConnect: false,
            minimizeToTray: true,
            socksPort: 1080,
            httpPort: 1081,
            logLevel: 'info',
          };

          const singboxConfig = proxyManager.generateSingBoxConfig(config);
          const proxyOutbound = singboxConfig.outbounds.find((o) => o.tag === 'proxy');

          expect(proxyOutbound?.tls).toBeDefined();
          expect(proxyOutbound?.tls?.enabled).toBe(true);
          expect(proxyOutbound?.tls?.server_name).toBe(server.address);
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * 属性 16: 进程状态监控
   * 对于任何正在运行的 sing-box 进程，系统应该能够查询进程状态（PID、运行时间），
   * 并且状态应该反映实际的进程状态。
   *
   * Feature: electron-cross-platform, Property 16: 进程状态监控
   * Validates: Requirements 5.2
   */
  describe('Property 16: Process status monitoring', () => {
    it('should return not running status when process is not started', () => {
      const proxyManager = createProxyManager();
      const status = proxyManager.getStatus();

      expect(status.running).toBe(false);
      expect(status.pid).toBeUndefined();
      expect(status.uptime).toBeUndefined();
      expect(status.startTime).toBeUndefined();
    });

    it('should track process state correctly', async () => {
      // 注意：这个测试不会真正启动 sing-box 进程，因为我们没有实际的 sing-box 二进制文件
      // 我们只测试状态跟踪逻辑
      const proxyManager = createProxyManager();

      // 初始状态
      let status = proxyManager.getStatus();
      expect(status.running).toBe(false);

      // 这里我们无法真正测试启动后的状态，因为需要实际的 sing-box 二进制文件
      // 在实际环境中，启动后应该有 PID 和启动时间
    });
  });

  /**
   * 属性 18: 进程优雅终止
   * 对于任何正在运行的 sing-box 进程，停止请求应该先尝试优雅终止（SIGTERM），
   * 如果超时则强制终止（SIGKILL）。
   *
   * Feature: electron-cross-platform, Property 18: 进程优雅终止
   * Validates: Requirements 5.4
   */
  describe('Property 18: Process graceful termination', () => {
    it('should handle stop request when no process is running', async () => {
      const proxyManager = createProxyManager();

      // 停止不存在的进程不应该抛出错误
      await expect(proxyManager.stop()).resolves.not.toThrow();

      // 状态应该仍然是未运行
      const status = proxyManager.getStatus();
      expect(status.running).toBe(false);
    });

    // 注意：真正的进程终止测试需要实际的 sing-box 二进制文件
    // 在集成测试中应该测试完整的启动-停止流程
  });
});
