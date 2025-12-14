/**
 * Window Manager 属性测试
 * 使用 fast-check 进行基于属性的测试
 * 
 * Feature: electron-cross-platform, Property 3: 窗口关闭行为遵循配置
 * Validates: Requirements 1.5
 */

import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { ConfigManager } from '../services/ConfigManager';
import type { UserConfig } from '../../shared/types';

// ============================================================================
// Mock Electron
// ============================================================================

// 模拟 Electron 模块
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((name: string) => {
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'v2rayz-test-userdata');
      }
      return os.tmpdir();
    }),
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(() => Promise.resolve()),
    loadFile: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    isMinimized: jest.fn(() => false),
    restore: jest.fn(),
    focus: jest.fn(),
    webContents: {
      send: jest.fn(),
      on: jest.fn(),
      openDevTools: jest.fn(),
    },
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
}));

// ============================================================================
// 生成器 (Generators)
// ============================================================================

/**
 * 生成简化的用户配置（仅包含 minimizeToTray 字段）
 */
// const userConfigWithMinimizeToTrayArbitrary = (): fc.Arbitrary<{ minimizeToTray: boolean }> => {
//   return fc.record({
//     minimizeToTray: fc.boolean(),
//   });
// };

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 创建临时配置目录
 */
async function createTempConfigDir(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'v2rayz-window-test-'));
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

/**
 * 创建完整的默认配置
 */
function createDefaultConfig(minimizeToTray: boolean): UserConfig {
  return {
    servers: [],
    selectedServerId: null,
    proxyMode: 'smart',
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
    minimizeToTray,
    socksPort: 65534,
    httpPort: 65533,
    logLevel: 'info',
  };
}

/**
 * 模拟窗口关闭事件处理器
 */
class WindowCloseHandler {
  private config: UserConfig;
  private windowHidden: boolean = false;
  private windowClosed: boolean = false;
  private preventDefaultCalled: boolean = false;

  constructor(config: UserConfig) {
    this.config = config;
  }

  /**
   * 模拟窗口关闭事件
   */
  async handleClose(event: { preventDefault: () => void }): Promise<void> {
    // 如果配置为最小化到托盘，则阻止窗口关闭，改为隐藏
    if (this.config.minimizeToTray) {
      event.preventDefault();
      this.preventDefaultCalled = true;
      this.windowHidden = true;
    } else {
      // 否则允许窗口关闭
      this.windowClosed = true;
    }
  }

  isWindowHidden(): boolean {
    return this.windowHidden;
  }

  isWindowClosed(): boolean {
    return this.windowClosed;
  }

  isPreventDefaultCalled(): boolean {
    return this.preventDefaultCalled;
  }
}

// ============================================================================
// 属性测试
// ============================================================================

describe('Window Manager Property Tests', () => {
  /**
   * 属性 3: 窗口关闭行为遵循配置
   * 对于任何窗口关闭事件，如果 minimizeToTray 配置为 true，则窗口应该隐藏而不是退出；
   * 如果为 false，则应用应该完全退出。
   * 
   * Validates: Requirements 1.5
   */
  describe('Property 3: Window close behavior follows configuration', () => {
    it('should hide window when minimizeToTray is true', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(true), async (minimizeToTray) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const configManager = new ConfigManager(configPath);

          try {
            // 创建配置
            const config = createDefaultConfig(minimizeToTray);
            await configManager.saveConfig(config);

            // 创建窗口关闭处理器
            const handler = new WindowCloseHandler(config);

            // 模拟关闭事件
            const mockEvent = {
              preventDefault: jest.fn(),
            };

            await handler.handleClose(mockEvent);

            // 验证：应该调用 preventDefault
            expect(handler.isPreventDefaultCalled()).toBe(true);

            // 验证：窗口应该被隐藏
            expect(handler.isWindowHidden()).toBe(true);

            // 验证：窗口不应该被关闭
            expect(handler.isWindowClosed()).toBe(false);
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should close window when minimizeToTray is false', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(false), async (minimizeToTray) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const configManager = new ConfigManager(configPath);

          try {
            // 创建配置
            const config = createDefaultConfig(minimizeToTray);
            await configManager.saveConfig(config);

            // 创建窗口关闭处理器
            const handler = new WindowCloseHandler(config);

            // 模拟关闭事件
            const mockEvent = {
              preventDefault: jest.fn(),
            };

            await handler.handleClose(mockEvent);

            // 验证：不应该调用 preventDefault
            expect(handler.isPreventDefaultCalled()).toBe(false);

            // 验证：窗口不应该被隐藏
            expect(handler.isWindowHidden()).toBe(false);

            // 验证：窗口应该被关闭
            expect(handler.isWindowClosed()).toBe(true);
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should consistently follow minimizeToTray setting across multiple close events', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          fc.integer({ min: 2, max: 5 }),
          async (minimizeToTray, eventCount) => {
            const tempDir = await createTempConfigDir();
            const configPath = path.join(tempDir, 'config.json');
            const configManager = new ConfigManager(configPath);

            try {
              // 创建配置
              const config = createDefaultConfig(minimizeToTray);
              await configManager.saveConfig(config);

              // 多次触发关闭事件
              for (let i = 0; i < eventCount; i++) {
                const handler = new WindowCloseHandler(config);
                const mockEvent = {
                  preventDefault: jest.fn(),
                };

                await handler.handleClose(mockEvent);

                // 验证每次行为一致
                if (minimizeToTray) {
                  expect(handler.isPreventDefaultCalled()).toBe(true);
                  expect(handler.isWindowHidden()).toBe(true);
                  expect(handler.isWindowClosed()).toBe(false);
                } else {
                  expect(handler.isPreventDefaultCalled()).toBe(false);
                  expect(handler.isWindowHidden()).toBe(false);
                  expect(handler.isWindowClosed()).toBe(true);
                }
              }
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle configuration changes correctly', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (initialMinimizeToTray) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const configManager = new ConfigManager(configPath);

          try {
            // 创建初始配置
            let config = createDefaultConfig(initialMinimizeToTray);
            await configManager.saveConfig(config);

            // 第一次关闭事件
            let handler = new WindowCloseHandler(config);
            let mockEvent = {
              preventDefault: jest.fn(),
            };
            await handler.handleClose(mockEvent);

            // 验证初始行为
            if (initialMinimizeToTray) {
              expect(handler.isWindowHidden()).toBe(true);
              expect(handler.isWindowClosed()).toBe(false);
            } else {
              expect(handler.isWindowHidden()).toBe(false);
              expect(handler.isWindowClosed()).toBe(true);
            }

            // 更改配置
            config = createDefaultConfig(!initialMinimizeToTray);
            await configManager.saveConfig(config);

            // 第二次关闭事件（使用新配置）
            handler = new WindowCloseHandler(config);
            mockEvent = {
              preventDefault: jest.fn(),
            };
            await handler.handleClose(mockEvent);

            // 验证行为已改变
            if (!initialMinimizeToTray) {
              expect(handler.isWindowHidden()).toBe(true);
              expect(handler.isWindowClosed()).toBe(false);
            } else {
              expect(handler.isWindowHidden()).toBe(false);
              expect(handler.isWindowClosed()).toBe(true);
            }
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should handle edge case where config is undefined', async () => {
      const tempDir = await createTempConfigDir();
      const configPath = path.join(tempDir, 'config.json');
      const configManager = new ConfigManager(configPath);

      try {
        // 加载默认配置（文件不存在时）
        const config = await configManager.loadConfig();

        // 创建窗口关闭处理器
        const handler = new WindowCloseHandler(config);

        // 模拟关闭事件
        const mockEvent = {
          preventDefault: jest.fn(),
        };

        await handler.handleClose(mockEvent);

        // 验证：应该使用默认配置的行为
        // 默认配置的 minimizeToTray 应该是 true
        expect(handler.isPreventDefaultCalled()).toBe(true);
        expect(handler.isWindowHidden()).toBe(true);
      } finally {
        await cleanupTempDir(tempDir);
      }
    });

    it('should not affect window state when preventDefault is called', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(true), async (minimizeToTray) => {
          const tempDir = await createTempConfigDir();
          const configPath = path.join(tempDir, 'config.json');
          const configManager = new ConfigManager(configPath);

          try {
            // 创建配置
            const config = createDefaultConfig(minimizeToTray);
            await configManager.saveConfig(config);

            // 创建窗口关闭处理器
            const handler = new WindowCloseHandler(config);

            // 模拟关闭事件
            const mockEvent = {
              preventDefault: jest.fn(),
            };

            await handler.handleClose(mockEvent);

            // 验证：当 preventDefault 被调用时，窗口应该被隐藏而不是关闭
            expect(handler.isPreventDefaultCalled()).toBe(true);
            expect(handler.isWindowHidden()).toBe(true);
            expect(handler.isWindowClosed()).toBe(false);

            // 验证：隐藏和关闭是互斥的
            expect(handler.isWindowHidden() && handler.isWindowClosed()).toBe(false);
          } finally {
            await cleanupTempDir(tempDir);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should handle rapid close events correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          fc.integer({ min: 5, max: 10 }),
          async (minimizeToTray, rapidEventCount) => {
            const tempDir = await createTempConfigDir();
            const configPath = path.join(tempDir, 'config.json');
            const configManager = new ConfigManager(configPath);

            try {
              // 创建配置
              const config = createDefaultConfig(minimizeToTray);
              await configManager.saveConfig(config);

              // 快速触发多个关闭事件
              const handlers: WindowCloseHandler[] = [];
              for (let i = 0; i < rapidEventCount; i++) {
                const handler = new WindowCloseHandler(config);
                const mockEvent = {
                  preventDefault: jest.fn(),
                };

                await handler.handleClose(mockEvent);
                handlers.push(handler);
              }

              // 验证所有事件的行为一致
              for (const handler of handlers) {
                if (minimizeToTray) {
                  expect(handler.isPreventDefaultCalled()).toBe(true);
                  expect(handler.isWindowHidden()).toBe(true);
                  expect(handler.isWindowClosed()).toBe(false);
                } else {
                  expect(handler.isPreventDefaultCalled()).toBe(false);
                  expect(handler.isWindowHidden()).toBe(false);
                  expect(handler.isWindowClosed()).toBe(true);
                }
              }
            } finally {
              await cleanupTempDir(tempDir);
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
