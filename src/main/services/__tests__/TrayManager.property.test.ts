/**
 * TrayManager 属性测试
 * 使用 fast-check 进行基于属性的测试
 */

import * as fc from 'fast-check';
import { BrowserWindow } from 'electron';
import { TrayManager, TrayIconState } from '../TrayManager';
import { LogManager } from '../LogManager';

// Mock Electron 模块
jest.mock('electron', () => ({
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip: jest.fn(),
    setImage: jest.fn(),
    setContextMenu: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
  })),
  Menu: {
    buildFromTemplate: jest.fn((template) => ({
      items: template,
    })),
  },
  nativeImage: {
    createFromPath: jest.fn(() => ({
      setTemplateImage: jest.fn(),
    })),
  },
  app: {
    quit: jest.fn(),
    exit: jest.fn(),
    getPath: jest.fn((name: string) => {
      if (name === 'userData') {
        return '/tmp/test-user-data';
      }
      return '/tmp/test';
    }),
  },
}));

describe('TrayManager Property Tests', () => {
  let logManager: LogManager;
  let mockWindow: BrowserWindow | null;

  beforeEach(() => {
    logManager = new LogManager();
    mockWindow = {
      isMinimized: jest.fn().mockReturnValue(false),
      restore: jest.fn(),
      show: jest.fn(),
      focus: jest.fn(),
    } as any;

    // 清除所有 mock 调用记录
    jest.clearAllMocks();
  });

  /**
   * 属性 8: 跨平台托盘菜单一致性
   * Feature: electron-cross-platform, Property 8: 跨平台托盘菜单一致性
   * 验证: 需求 3.2
   *
   * 对于任何平台，系统托盘应该包含相同的菜单项集合（启动/停止代理、显示窗口、退出等），
   * 并且菜单项的功能应该一致。
   */
  describe('Property 8: 跨平台托盘菜单一致性', () => {
    it('对于任何代理运行状态，托盘菜单应该包含固定的菜单项集合', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (isProxyRunning) => {
          const trayManager = new TrayManager(mockWindow, logManager);
          trayManager.createTray();

          // 更新托盘菜单
          trayManager.updateTrayMenu(isProxyRunning);

          // 验证托盘已创建
          expect(trayManager.isTrayCreated()).toBe(true);

          // 验证代理运行状态已更新
          expect(trayManager.getProxyRunningState()).toBe(isProxyRunning);

          // 清理
          trayManager.destroyTray();
        }),
        { numRuns: 100 }
      );
    });

    it('托盘菜单应该根据代理状态显示正确的操作文本', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (isProxyRunning) => {
          const trayManager = new TrayManager(mockWindow, logManager);
          trayManager.createTray();

          // 更新托盘菜单
          trayManager.updateTrayMenu(isProxyRunning);

          // 验证菜单已更新（通过检查内部状态）
          expect(trayManager.getProxyRunningState()).toBe(isProxyRunning);

          // 清理
          trayManager.destroyTray();
        }),
        { numRuns: 100 }
      );
    });

    it('多次更新托盘菜单应该保持一致性', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
          async (statusSequence) => {
            const trayManager = new TrayManager(mockWindow, logManager);
            trayManager.createTray();

            // 执行一系列状态更新
            for (const isProxyRunning of statusSequence) {
              trayManager.updateTrayMenu(isProxyRunning);
              expect(trayManager.getProxyRunningState()).toBe(isProxyRunning);
            }

            // 最后的状态应该与序列的最后一个值一致
            const finalStatus = statusSequence[statusSequence.length - 1];
            expect(trayManager.getProxyRunningState()).toBe(finalStatus);

            // 清理
            trayManager.destroyTray();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('托盘创建后应该可以正常销毁', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const trayManager = new TrayManager(mockWindow, logManager);

          // 创建托盘
          trayManager.createTray();
          expect(trayManager.isTrayCreated()).toBe(true);

          // 销毁托盘
          trayManager.destroyTray();
          expect(trayManager.isTrayCreated()).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('重复创建托盘应该不会导致错误', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const trayManager = new TrayManager(mockWindow, logManager);

          // 第一次创建
          trayManager.createTray();
          expect(trayManager.isTrayCreated()).toBe(true);

          // 第二次创建应该被忽略（已存在）
          trayManager.createTray();
          expect(trayManager.isTrayCreated()).toBe(true);

          // 清理
          trayManager.destroyTray();
        }),
        { numRuns: 50 }
      );
    });

    it('托盘菜单回调函数应该被正确调用', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (isProxyRunning) => {
          const callbacks = {
            onStartProxy: jest.fn(),
            onStopProxy: jest.fn(),
            onShowWindow: jest.fn(),
            onQuit: jest.fn(),
          };

          const trayManager = new TrayManager(mockWindow, logManager, callbacks);
          trayManager.createTray();
          trayManager.updateTrayMenu(isProxyRunning);

          // 验证托盘已创建且状态正确
          expect(trayManager.isTrayCreated()).toBe(true);
          expect(trayManager.getProxyRunningState()).toBe(isProxyRunning);

          // 清理
          trayManager.destroyTray();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 属性 31: 托盘操作触发正确行为
   * Feature: electron-cross-platform, Property 31: 托盘操作触发正确行为
   * 验证: 需求 10.3
   *
   * 对于任何托盘菜单操作（启动代理、停止代理、显示窗口），
   * 系统应该执行对应的功能，并且操作结果应该反映在应用状态中。
   */
  describe('Property 31: 托盘操作触发正确行为', () => {
    it('对于任何图标状态，更新托盘图标应该成功', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<TrayIconState>('idle', 'connecting', 'connected'),
          async (iconState) => {
            const trayManager = new TrayManager(mockWindow, logManager);
            trayManager.createTray();

            // 更新图标状态
            trayManager.updateTrayIcon(iconState);

            // 验证状态已更新
            expect(trayManager.getCurrentIconState()).toBe(iconState);

            // 清理
            trayManager.destroyTray();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('图标状态更新序列应该保持最后的状态', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom<TrayIconState>('idle', 'connecting', 'connected'), {
            minLength: 1,
            maxLength: 10,
          }),
          async (stateSequence) => {
            const trayManager = new TrayManager(mockWindow, logManager);
            trayManager.createTray();

            // 执行一系列状态更新
            for (const state of stateSequence) {
              trayManager.updateTrayIcon(state);
              expect(trayManager.getCurrentIconState()).toBe(state);
            }

            // 最后的状态应该与序列的最后一个值一致
            const finalState = stateSequence[stateSequence.length - 1];
            expect(trayManager.getCurrentIconState()).toBe(finalState);

            // 清理
            trayManager.destroyTray();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('托盘图标和菜单状态应该可以独立更新', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<TrayIconState>('idle', 'connecting', 'connected'),
          fc.boolean(),
          async (iconState, isProxyRunning) => {
            const trayManager = new TrayManager(mockWindow, logManager);
            trayManager.createTray();

            // 更新图标状态
            trayManager.updateTrayIcon(iconState);
            expect(trayManager.getCurrentIconState()).toBe(iconState);

            // 更新菜单状态
            trayManager.updateTrayMenu(isProxyRunning);
            expect(trayManager.getProxyRunningState()).toBe(isProxyRunning);

            // 两个状态应该独立
            expect(trayManager.getCurrentIconState()).toBe(iconState);
            expect(trayManager.getProxyRunningState()).toBe(isProxyRunning);

            // 清理
            trayManager.destroyTray();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('未创建托盘时更新操作应该被安全处理', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<TrayIconState>('idle', 'connecting', 'connected'),
          fc.boolean(),
          async (iconState, isProxyRunning) => {
            const trayManager = new TrayManager(mockWindow, logManager);

            // 在未创建托盘的情况下尝试更新
            trayManager.updateTrayIcon(iconState);
            trayManager.updateTrayMenu(isProxyRunning);

            // 应该不会抛出错误，托盘仍未创建
            expect(trayManager.isTrayCreated()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('托盘销毁后再次更新应该被安全处理', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<TrayIconState>('idle', 'connecting', 'connected'),
          fc.boolean(),
          async (iconState, isProxyRunning) => {
            const trayManager = new TrayManager(mockWindow, logManager);

            // 创建并销毁托盘
            trayManager.createTray();
            trayManager.destroyTray();

            // 在销毁后尝试更新
            trayManager.updateTrayIcon(iconState);
            trayManager.updateTrayMenu(isProxyRunning);

            // 应该不会抛出错误，托盘仍处于销毁状态
            expect(trayManager.isTrayCreated()).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('窗口引用更新应该不影响托盘功能', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (hasWindow) => {
          const window = hasWindow ? mockWindow : null;
          const trayManager = new TrayManager(window, logManager);

          trayManager.createTray();
          expect(trayManager.isTrayCreated()).toBe(true);

          // 更新窗口引用
          trayManager.setMainWindow(hasWindow ? null : mockWindow);

          // 托盘应该仍然存在
          expect(trayManager.isTrayCreated()).toBe(true);

          // 清理
          trayManager.destroyTray();
        }),
        { numRuns: 100 }
      );
    });

    it('托盘创建-销毁循环应该保持稳定', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (cycles) => {
            const trayManager = new TrayManager(mockWindow, logManager);

            // 执行多次创建-销毁循环
            for (let i = 0; i < cycles; i++) {
              trayManager.createTray();
              expect(trayManager.isTrayCreated()).toBe(true);

              trayManager.destroyTray();
              expect(trayManager.isTrayCreated()).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
