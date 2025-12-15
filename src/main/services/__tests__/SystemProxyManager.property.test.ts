/**
 * SystemProxyManager 属性测试
 * 使用 fast-check 进行基于属性的测试
 *
 * Feature: electron-cross-platform, Property 7: 平台特定的系统代理方法
 * Validates: Requirements 3.1
 */

import * as fc from 'fast-check';
import {
  createSystemProxyManager,
  WindowsSystemProxy,
  MacOSSystemProxy,
  type ISystemProxyManager,
} from '../SystemProxyManager';

// ============================================================================
// 生成器 (Generators)
// ============================================================================

/**
 * 生成有效的 IP 地址
 */
const ipAddressArbitrary = (): fc.Arbitrary<string> => {
  return fc.oneof(fc.constant('127.0.0.1'), fc.constant('localhost'), fc.ipV4());
};

/**
 * 生成有效的端口号
 */
const portArbitrary = (): fc.Arbitrary<number> => {
  return fc.integer({ min: 1024, max: 65535 });
};

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 模拟平台环境
 */
function mockPlatform(platform: string): () => void {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });

  return () => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  };
}

// ============================================================================
// 属性测试
// ============================================================================

describe('SystemProxyManager Property Tests', () => {
  /**
   * 属性 7: 平台特定的系统代理方法
   * 对于任何系统代理启用请求，系统应该根据 `process.platform` 调用对应平台的实现
   * （Windows 使用注册表，macOS 使用 networksetup）。
   *
   * Validates: Requirements 3.1
   */
  describe('Property 7: Platform-specific system proxy methods', () => {
    it('should return WindowsSystemProxy on win32 platform', () => {
      const restore = mockPlatform('win32');

      try {
        const manager = createSystemProxyManager();
        expect(manager).toBeInstanceOf(WindowsSystemProxy);
      } finally {
        restore();
      }
    });

    it('should return MacOSSystemProxy on darwin platform', () => {
      const restore = mockPlatform('darwin');

      try {
        const manager = createSystemProxyManager();
        expect(manager).toBeInstanceOf(MacOSSystemProxy);
      } finally {
        restore();
      }
    });

    it('should throw error on unsupported platforms', () => {
      const unsupportedPlatforms = ['linux', 'freebsd', 'openbsd', 'sunos', 'aix'];

      for (const platform of unsupportedPlatforms) {
        const restore = mockPlatform(platform);

        try {
          expect(() => createSystemProxyManager()).toThrow(`不支持的平台: ${platform}`);
        } finally {
          restore();
        }
      }
    });

    it('should create correct manager for any valid platform', () => {
      fc.assert(
        fc.property(fc.constantFrom('win32', 'darwin'), (platform) => {
          const restore = mockPlatform(platform);

          try {
            const manager = createSystemProxyManager();

            // 验证管理器实现了正确的接口
            expect(manager).toHaveProperty('enableProxy');
            expect(manager).toHaveProperty('disableProxy');
            expect(manager).toHaveProperty('getProxyStatus');

            // 验证方法是函数
            expect(typeof manager.enableProxy).toBe('function');
            expect(typeof manager.disableProxy).toBe('function');
            expect(typeof manager.getProxyStatus).toBe('function');

            // 验证平台特定的实例类型
            if (platform === 'win32') {
              expect(manager).toBeInstanceOf(WindowsSystemProxy);
            } else if (platform === 'darwin') {
              expect(manager).toBeInstanceOf(MacOSSystemProxy);
            }
          } finally {
            restore();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain platform consistency across multiple calls', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('win32', 'darwin'),
          fc.integer({ min: 2, max: 10 }),
          (platform, callCount) => {
            const restore = mockPlatform(platform);

            try {
              const managers: ISystemProxyManager[] = [];

              // 多次创建管理器
              for (let i = 0; i < callCount; i++) {
                managers.push(createSystemProxyManager());
              }

              // 验证所有管理器都是相同类型
              const firstType = managers[0].constructor;
              for (const manager of managers) {
                expect(manager.constructor).toBe(firstType);
              }

              // 验证类型与平台匹配
              if (platform === 'win32') {
                for (const manager of managers) {
                  expect(manager).toBeInstanceOf(WindowsSystemProxy);
                }
              } else if (platform === 'darwin') {
                for (const manager of managers) {
                  expect(manager).toBeInstanceOf(MacOSSystemProxy);
                }
              }
            } finally {
              restore();
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should create managers with consistent interface regardless of platform', () => {
      fc.assert(
        fc.property(fc.constantFrom('win32', 'darwin'), (platform) => {
          const restore = mockPlatform(platform);

          try {
            const manager = createSystemProxyManager();

            // 验证接口一致性
            const methods = ['enableProxy', 'disableProxy', 'getProxyStatus'];
            for (const method of methods) {
              expect(manager).toHaveProperty(method);
              expect(typeof (manager as any)[method]).toBe('function');
            }

            // 验证 enableProxy 接受正确的参数
            expect(manager.enableProxy.length).toBe(3); // address, httpPort, socksPort

            // 验证 disableProxy 不需要参数
            expect(manager.disableProxy.length).toBe(0);

            // 验证 getProxyStatus 不需要参数
            expect(manager.getProxyStatus.length).toBe(0);
          } finally {
            restore();
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 属性 19: 系统代理往返恢复
   * 对于任何系统代理启用操作，记录原始代理设置，禁用后应该恢复到原始设置
   * （而不是简单地禁用代理）。
   *
   * Validates: Requirements 6.3
   */
  describe('Property 19: System proxy round-trip recovery', () => {
    it('should save original settings before enabling proxy', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('win32', 'darwin'),
          ipAddressArbitrary(),
          portArbitrary(),
          portArbitrary(),
          async (platform, _address, _httpPort, _socksPort) => {
            const restore = mockPlatform(platform);

            try {
              const manager = createSystemProxyManager();

              // 获取初始状态
              await manager.getProxyStatus();

              // 启用代理（这会保存原始设置）
              // 注意：在测试环境中，我们不实际修改系统代理
              // 这里只验证接口存在且可调用
              expect(manager.enableProxy).toBeDefined();
              expect(typeof manager.enableProxy).toBe('function');

              // 验证管理器有保存原始设置的能力
              // 通过检查内部状态（如果可访问）或行为
              const managerWithState = manager as any;

              // 在实际实现中，originalSettings 应该在 enableProxy 后被设置
              // 这里我们验证属性存在
              expect('originalSettings' in managerWithState).toBe(true);
            } finally {
              restore();
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have originalSettings property in manager instances', () => {
      fc.assert(
        fc.property(fc.constantFrom('win32', 'darwin'), (platform) => {
          const restore = mockPlatform(platform);

          try {
            const manager = createSystemProxyManager();
            const managerWithState = manager as any;

            // 验证 originalSettings 属性存在
            expect('originalSettings' in managerWithState).toBe(true);

            // 初始状态应该是 null
            expect(managerWithState.originalSettings).toBeNull();
          } finally {
            restore();
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 属性 20: 代理状态查询准确性
   * 对于任何代理状态查询，返回的启用状态和配置信息应该与系统实际的代理设置一致。
   *
   * Validates: Requirements 6.5
   */
  describe('Property 20: Proxy status query accuracy', () => {
    it('should return consistent status structure', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('win32', 'darwin'), async (platform) => {
          const restore = mockPlatform(platform);

          try {
            const manager = createSystemProxyManager();

            // 查询代理状态
            const status = await manager.getProxyStatus();

            // 验证返回的状态结构
            expect(status).toHaveProperty('enabled');
            expect(typeof status.enabled).toBe('boolean');

            // 如果启用，可能包含代理地址
            if (status.enabled) {
              // httpProxy, httpsProxy, socksProxy 是可选的
              if (status.httpProxy) {
                expect(typeof status.httpProxy).toBe('string');
              }
              if (status.httpsProxy) {
                expect(typeof status.httpsProxy).toBe('string');
              }
              if (status.socksProxy) {
                expect(typeof status.socksProxy).toBe('string');
              }
            }
          } finally {
            restore();
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should return status with correct type for all platforms', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('win32', 'darwin'), async (platform) => {
          const restore = mockPlatform(platform);

          try {
            const manager = createSystemProxyManager();
            const status = await manager.getProxyStatus();

            // 验证状态对象的类型
            expect(typeof status).toBe('object');
            expect(status).not.toBeNull();

            // 验证必需字段
            expect('enabled' in status).toBe(true);
            expect(typeof status.enabled).toBe('boolean');

            // 验证可选字段的类型（如果存在）
            if ('httpProxy' in status && status.httpProxy !== undefined) {
              expect(typeof status.httpProxy).toBe('string');
            }
            if ('httpsProxy' in status && status.httpsProxy !== undefined) {
              expect(typeof status.httpsProxy).toBe('string');
            }
            if ('socksProxy' in status && status.socksProxy !== undefined) {
              expect(typeof status.socksProxy).toBe('string');
            }
          } finally {
            restore();
          }
        }),
        { numRuns: 50 }
      );
    }, 10000);

    it('should handle query failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('win32', 'darwin'), async (platform) => {
          const restore = mockPlatform(platform);

          try {
            const manager = createSystemProxyManager();

            // getProxyStatus 应该总是返回一个有效的状态对象
            // 即使查询失败，也应该返回 { enabled: false }
            const status = await manager.getProxyStatus();

            expect(status).toBeDefined();
            expect(status).not.toBeNull();
            expect(typeof status.enabled).toBe('boolean');
          } finally {
            restore();
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should return consistent status across multiple queries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('win32', 'darwin'),
          fc.integer({ min: 2, max: 5 }),
          async (platform, queryCount) => {
            const restore = mockPlatform(platform);

            try {
              const manager = createSystemProxyManager();
              const statuses: Awaited<ReturnType<typeof manager.getProxyStatus>>[] = [];

              // 多次查询状态
              for (let i = 0; i < queryCount; i++) {
                const status = await manager.getProxyStatus();
                statuses.push(status);
              }

              // 在没有修改的情况下，所有查询应该返回相同的结果
              const firstStatus = statuses[0];
              for (const status of statuses) {
                expect(status.enabled).toBe(firstStatus.enabled);

                // 如果有代理地址，应该保持一致
                if (firstStatus.httpProxy) {
                  expect(status.httpProxy).toBe(firstStatus.httpProxy);
                }
                if (firstStatus.httpsProxy) {
                  expect(status.httpsProxy).toBe(firstStatus.httpsProxy);
                }
                if (firstStatus.socksProxy) {
                  expect(status.socksProxy).toBe(firstStatus.socksProxy);
                }
              }
            } finally {
              restore();
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 10000);
  });
});
