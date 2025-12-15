/**
 * ConfigManager 属性测试
 * 使用 fast-check 进行基于属性的测试
 *
 * Feature: electron-cross-platform, Property 12: 配置验证和保存
 * Validates: Requirements 4.2
 */

import * as fc from 'fast-check';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../ConfigManager';
import type { UserConfig, ServerConfig, DomainRule } from '../../../shared/types';

// ============================================================================
// 生成器 (Generators)
// ============================================================================

/**
 * 生成有效的服务器配置
 */
const serverConfigArbitrary = (): fc.Arbitrary<ServerConfig> => {
  return fc.oneof(
    // VLESS 服务器
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      protocol: fc.constant('vless' as const),
      address: fc.domain(),
      port: fc.integer({ min: 1, max: 65535 }),
      uuid: fc.uuid(),
      encryption: fc.option(fc.constantFrom('none', 'auto', 'aes-128-gcm'), { nil: undefined }),
      flow: fc.option(fc.constantFrom('xtls-rprx-vision', 'xtls-rprx-vision-udp443'), {
        nil: undefined,
      }),
      network: fc.option(fc.constantFrom('tcp', 'ws', 'grpc', 'http'), { nil: undefined }),
      security: fc.option(fc.constantFrom('none', 'tls', 'reality'), { nil: undefined }),
    }),
    // Trojan 服务器
    fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      protocol: fc.constant('trojan' as const),
      address: fc.domain(),
      port: fc.integer({ min: 1, max: 65535 }),
      password: fc.string({ minLength: 1, maxLength: 100 }),
      network: fc.option(fc.constantFrom('tcp', 'ws', 'grpc', 'http'), { nil: undefined }),
      security: fc.option(fc.constantFrom('none', 'tls', 'reality'), { nil: undefined }),
    })
  );
};

/**
 * 生成有效的域名规则
 */
const domainRuleArbitrary = (): fc.Arbitrary<DomainRule> => {
  return fc.record({
    id: fc.uuid(),
    domain: fc.domain(),
    action: fc.constantFrom('proxy', 'direct', 'block'),
    enabled: fc.boolean(),
  });
};

/**
 * 生成有效的用户配置
 */
const validUserConfigArbitrary = (): fc.Arbitrary<UserConfig> => {
  return fc
    .record({
      servers: fc.array(serverConfigArbitrary(), { maxLength: 10 }),
      selectedServerId: fc.constant(null as string | null), // 先设置为 null，后面会修正
      proxyMode: fc.constantFrom('global', 'smart', 'direct'),
      proxyModeType: fc.constantFrom('systemProxy', 'tun'),
      tunConfig: fc.record({
        mtu: fc.integer({ min: 1280, max: 65535 }),
        stack: fc.constantFrom('system', 'gvisor', 'mixed'),
        autoRoute: fc.boolean(),
        strictRoute: fc.boolean(),
        interfaceName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
        inet4Address: fc.option(fc.ipV4(), { nil: undefined }),
        inet6Address: fc.option(fc.ipV6(), { nil: undefined }),
      }),
      customRules: fc.array(domainRuleArbitrary(), { maxLength: 20 }),
      autoStart: fc.boolean(),
      autoConnect: fc.boolean(),
      minimizeToTray: fc.boolean(),
      socksPort: fc.integer({ min: 1, max: 65535 }),
      httpPort: fc.integer({ min: 1, max: 65535 }),
      logLevel: fc.constantFrom('debug', 'info', 'warn', 'error', 'fatal'),
    })
    .map((config) => {
      // 修正 selectedServerId：如果有服务器，随机选择一个或 null
      if (config.servers.length > 0) {
        const shouldSelect = Math.random() > 0.5;
        if (shouldSelect) {
          const randomIndex = Math.floor(Math.random() * config.servers.length);
          (config as any).selectedServerId = config.servers[randomIndex].id;
        }
      }
      return config;
    });
};

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 创建临时配置目录
 */
async function createTempConfigDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'v2rayz-test-'));
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

describe('ConfigManager Property Tests', () => {
  /**
   * 属性 12: 配置验证和保存
   * 对于任何配置修改请求，系统应该先验证配置的有效性（必填字段、类型检查、范围检查），
   * 只有验证通过才保存到文件。
   *
   * Validates: Requirements 4.2
   */
  describe('Property 12: Configuration validation and save', () => {
    it('should validate config before saving - valid configs should be saved', async () => {
      await fc.assert(
        fc.asyncProperty(validUserConfigArbitrary(), async (config) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const manager = new ConfigManager(configPath);

          try {
            // 保存配置应该成功
            await manager.saveConfig(config);

            // 验证文件已创建
            const fileExists = await fs
              .access(configPath)
              .then(() => true)
              .catch(() => false);
            expect(fileExists).toBe(true);

            // 验证文件内容
            const content = await fs.readFile(configPath, 'utf-8');
            const savedConfig = JSON.parse(content);

            // 验证保存的配置与原配置一致
            expect(savedConfig).toEqual(config);
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid configs - missing required fields', async () => {
      const tempDir = await createTempConfigDir();
      const configPath = path.join(tempDir, 'config.json');
      const manager = new ConfigManager(configPath);

      try {
        // 先加载一个有效配置作为基础
        await manager.loadConfig();
        const baseConfig = await manager.loadConfig();

        // 测试缺少必填字段的配置
        const invalidConfigs = [
          { ...baseConfig, servers: 'not-an-array' },
          { ...baseConfig, proxyMode: 'invalid-mode' },
          { ...baseConfig, socksPort: -1 },
          { ...baseConfig, httpPort: 70000 },
          { ...baseConfig, logLevel: 'invalid-level' },
        ];

        for (const invalidConfig of invalidConfigs) {
          await expect(manager.saveConfig(invalidConfig as any)).rejects.toThrow();
        }
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it('should reject invalid server configs', async () => {
      await fc.assert(
        fc.asyncProperty(validUserConfigArbitrary(), async (baseConfig) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const manager = new ConfigManager(configPath);

          try {
            // 创建无效的服务器配置
            const invalidServer = {
              id: 'test-id',
              name: 'test-server',
              protocol: 'vless' as const,
              address: 'example.com',
              port: 443,
              // 缺少 uuid（VLESS 必需）
            };

            const invalidConfig = {
              ...baseConfig,
              servers: [invalidServer as any],
            };

            // 应该抛出错误
            await expect(manager.saveConfig(invalidConfig)).rejects.toThrow();
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should reject config with invalid selectedServerId', async () => {
      await fc.assert(
        fc.asyncProperty(validUserConfigArbitrary(), async (baseConfig) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const manager = new ConfigManager(configPath);

          try {
            // 设置一个不存在的 selectedServerId
            const invalidConfig = {
              ...baseConfig,
              selectedServerId: 'non-existent-id',
            };

            // 应该抛出错误
            await expect(manager.saveConfig(invalidConfig)).rejects.toThrow();
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should reject config with invalid port ranges', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUserConfigArbitrary(),
          fc.integer({ min: -1000, max: 0 }),
          fc.integer({ min: 65536, max: 100000 }),
          async (baseConfig, invalidLowPort, invalidHighPort) => {
            const tempDir = await createTempConfigDir();
            const configPath = path.join(tempDir, 'config.json');
            const manager = new ConfigManager(configPath);

            try {
              // 测试无效的低端口
              const configWithLowPort = {
                ...baseConfig,
                socksPort: invalidLowPort,
              };
              await expect(manager.saveConfig(configWithLowPort)).rejects.toThrow();

              // 测试无效的高端口
              const configWithHighPort = {
                ...baseConfig,
                httpPort: invalidHighPort,
              };
              await expect(manager.saveConfig(configWithHighPort)).rejects.toThrow();
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject config with invalid TUN config', async () => {
      await fc.assert(
        fc.asyncProperty(validUserConfigArbitrary(), async (baseConfig) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const manager = new ConfigManager(configPath);

          try {
            // 测试无效的 MTU
            const configWithInvalidMtu = {
              ...baseConfig,
              tunConfig: {
                ...baseConfig.tunConfig,
                mtu: 100, // 太小
              },
            };
            await expect(manager.saveConfig(configWithInvalidMtu)).rejects.toThrow();

            // 测试无效的 stack
            const configWithInvalidStack = {
              ...baseConfig,
              tunConfig: {
                ...baseConfig.tunConfig,
                stack: 'invalid-stack' as any,
              },
            };
            await expect(manager.saveConfig(configWithInvalidStack)).rejects.toThrow();
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * 属性 13: 配置往返一致性
   * 对于任何有效的用户配置，保存到文件后重新加载，应该得到等价的配置对象（所有字段值相同）。
   *
   * Validates: Requirements 4.3
   */
  describe('Property 13: Configuration round-trip consistency', () => {
    it('should preserve config after save and load - round trip property', async () => {
      await fc.assert(
        fc.asyncProperty(validUserConfigArbitrary(), async (originalConfig) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const manager = new ConfigManager(configPath);

          try {
            // 保存配置
            await manager.saveConfig(originalConfig);

            // 重新加载配置
            const loadedConfig = await manager.loadConfig();

            // 验证加载的配置与原配置一致
            expect(loadedConfig).toEqual(originalConfig);

            // 验证每个字段
            expect(loadedConfig.servers).toEqual(originalConfig.servers);
            expect(loadedConfig.selectedServerId).toBe(originalConfig.selectedServerId);
            expect(loadedConfig.proxyMode).toBe(originalConfig.proxyMode);
            expect(loadedConfig.proxyModeType).toBe(originalConfig.proxyModeType);
            expect(loadedConfig.tunConfig).toEqual(originalConfig.tunConfig);
            expect(loadedConfig.customRules).toEqual(originalConfig.customRules);
            expect(loadedConfig.autoStart).toBe(originalConfig.autoStart);
            expect(loadedConfig.autoConnect).toBe(originalConfig.autoConnect);
            expect(loadedConfig.minimizeToTray).toBe(originalConfig.minimizeToTray);
            expect(loadedConfig.socksPort).toBe(originalConfig.socksPort);
            expect(loadedConfig.httpPort).toBe(originalConfig.httpPort);
            expect(loadedConfig.logLevel).toBe(originalConfig.logLevel);
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should preserve config through multiple save/load cycles', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUserConfigArbitrary(),
          fc.integer({ min: 2, max: 5 }),
          async (originalConfig, cycles) => {
            const tempDir = await createTempConfigDir();
            const configPath = path.join(tempDir, 'config.json');
            const manager = new ConfigManager(configPath);

            try {
              let currentConfig = originalConfig;

              // 多次保存和加载
              for (let i = 0; i < cycles; i++) {
                await manager.saveConfig(currentConfig);
                currentConfig = await manager.loadConfig();
              }

              // 最终配置应该与原配置一致
              expect(currentConfig).toEqual(originalConfig);
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should preserve complex server configurations', async () => {
      await fc.assert(
        fc.asyncProperty(validUserConfigArbitrary(), async (baseConfig) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const manager = new ConfigManager(configPath);

          try {
            // 确保有服务器配置
            if (baseConfig.servers.length === 0) {
              // 添加一个复杂的 VLESS 服务器
              baseConfig.servers.push({
                id: 'test-vless-id',
                name: 'Test VLESS Server',
                protocol: 'vless',
                address: 'example.com',
                port: 443,
                uuid: '12345678-1234-1234-1234-123456789abc',
                encryption: 'none',
                flow: 'xtls-rprx-vision',
                network: 'ws',
                security: 'tls',
                tlsSettings: {
                  serverName: 'example.com',
                  allowInsecure: false,
                  alpn: ['h2', 'http/1.1'],
                  fingerprint: 'chrome',
                },
                wsSettings: {
                  path: '/websocket',
                  headers: {
                    Host: 'example.com',
                  },
                  maxEarlyData: 2048,
                  earlyDataHeaderName: 'Sec-WebSocket-Protocol',
                },
              });
            }

            // 保存并重新加载
            await manager.saveConfig(baseConfig);
            const loadedConfig = await manager.loadConfig();

            // 验证服务器配置完整性
            expect(loadedConfig.servers).toEqual(baseConfig.servers);

            // 验证嵌套对象
            for (let i = 0; i < baseConfig.servers.length; i++) {
              const original = baseConfig.servers[i];
              const loaded = loadedConfig.servers[i];

              expect(loaded.tlsSettings).toEqual(original.tlsSettings);
              expect(loaded.wsSettings).toEqual(original.wsSettings);
              expect(loaded.grpcSettings).toEqual(original.grpcSettings);
              expect(loaded.httpSettings).toEqual(original.httpSettings);
            }
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should preserve custom rules with all properties', async () => {
      await fc.assert(
        fc.asyncProperty(validUserConfigArbitrary(), async (baseConfig) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const manager = new ConfigManager(configPath);

          try {
            // 确保有自定义规则
            if (baseConfig.customRules.length === 0) {
              baseConfig.customRules.push({
                id: 'rule-1',
                domain: 'example.com',
                action: 'proxy',
                enabled: true,
              });
              baseConfig.customRules.push({
                id: 'rule-2',
                domain: 'test.org',
                action: 'direct',
                enabled: false,
              });
            }

            // 保存并重新加载
            await manager.saveConfig(baseConfig);
            const loadedConfig = await manager.loadConfig();

            // 验证规则完整性
            expect(loadedConfig.customRules).toEqual(baseConfig.customRules);
            expect(loadedConfig.customRules.length).toBe(baseConfig.customRules.length);

            // 验证每个规则的所有属性
            for (let i = 0; i < baseConfig.customRules.length; i++) {
              expect(loadedConfig.customRules[i].id).toBe(baseConfig.customRules[i].id);
              expect(loadedConfig.customRules[i].domain).toBe(baseConfig.customRules[i].domain);
              expect(loadedConfig.customRules[i].action).toBe(baseConfig.customRules[i].action);
              expect(loadedConfig.customRules[i].enabled).toBe(baseConfig.customRules[i].enabled);
            }
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * 属性 14: 配置文件权限保护
   * 对于任何保存的配置文件，文件权限应该设置为仅当前用户可读写（Unix: 0600，Windows: 仅所有者访问）。
   *
   * Validates: Requirements 4.5
   */
  describe('Property 14: Configuration file permission protection', () => {
    it('should set correct file permissions on Unix systems', async () => {
      // 跳过 Windows 测试
      if (process.platform === 'win32') {
        return;
      }

      await fc.assert(
        fc.asyncProperty(validUserConfigArbitrary(), async (config) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const manager = new ConfigManager(configPath);

          try {
            // 保存配置
            await manager.saveConfig(config);

            // 检查文件权限
            const stats = await fs.stat(configPath);
            const mode = stats.mode & 0o777; // 获取权限位

            // 验证权限为 0600 (仅所有者可读写)
            expect(mode).toBe(0o600);
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should maintain file permissions after multiple saves', async () => {
      // 跳过 Windows 测试
      if (process.platform === 'win32') {
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          validUserConfigArbitrary(),
          fc.integer({ min: 2, max: 5 }),
          async (config, saveCount) => {
            const tempDir = await createTempConfigDir();
            const configPath = path.join(tempDir, 'config.json');
            const manager = new ConfigManager(configPath);

            try {
              // 多次保存配置
              for (let i = 0; i < saveCount; i++) {
                await manager.saveConfig(config);

                // 每次保存后检查权限
                const stats = await fs.stat(configPath);
                const mode = stats.mode & 0o777;
                expect(mode).toBe(0o600);
              }
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should protect config file from unauthorized access', async () => {
      // 跳过 Windows 测试
      if (process.platform === 'win32') {
        return;
      }

      await fc.assert(
        fc.asyncProperty(validUserConfigArbitrary(), async (config) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const manager = new ConfigManager(configPath);

          try {
            // 保存配置
            await manager.saveConfig(config);

            // 检查文件权限
            const stats = await fs.stat(configPath);
            const mode = stats.mode & 0o777;

            // 验证其他用户和组没有任何权限
            const groupPermissions = (mode & 0o070) >> 3;
            const otherPermissions = mode & 0o007;

            expect(groupPermissions).toBe(0);
            expect(otherPermissions).toBe(0);

            // 验证所有者有读写权限
            const ownerPermissions = (mode & 0o700) >> 6;
            expect(ownerPermissions).toBe(6); // 6 = 读(4) + 写(2)
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should handle permission setting on Windows gracefully', async () => {
      // 仅在 Windows 上运行
      if (process.platform !== 'win32') {
        return;
      }

      await fc.assert(
        fc.asyncProperty(validUserConfigArbitrary(), async (config) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const manager = new ConfigManager(configPath);

          try {
            // 保存配置应该成功（即使不设置 Unix 权限）
            await expect(manager.saveConfig(config)).resolves.not.toThrow();

            // 验证文件已创建
            const fileExists = await fs
              .access(configPath)
              .then(() => true)
              .catch(() => false);
            expect(fileExists).toBe(true);
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });
  });
});
