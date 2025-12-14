/**
 * Jest 测试环境设置
 * Mock Electron 模块
 */

import * as path from 'path';
import * as os from 'os';

// Mock Electron app
// 用于存储自启动状态的全局变量
let mockAutoStartEnabled = false;

jest.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') {
        return path.join(os.tmpdir(), 'v2rayz-test-userdata');
      }
      if (name === 'exe') {
        // 返回一个模拟的可执行文件路径
        return path.join(os.tmpdir(), 'v2rayz-test.exe');
      }
      return os.tmpdir();
    },
    on: jest.fn(),
    quit: jest.fn(),
    isReady: jest.fn(() => true),
    whenReady: jest.fn(() => Promise.resolve()),
    setLoginItemSettings: jest.fn((settings: { openAtLogin: boolean; openAsHidden: boolean }) => {
      mockAutoStartEnabled = settings.openAtLogin;
    }),
    getLoginItemSettings: jest.fn(() => ({
      openAtLogin: mockAutoStartEnabled,
      openAsHidden: false,
      wasOpenedAtLogin: false,
      wasOpenedAsHidden: false,
      restoreState: false,
    })),
  },
  BrowserWindow: jest.fn(),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    removeHandler: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    send: jest.fn(),
  },
}));
