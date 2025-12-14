import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import { LogManager } from './LogManager';

/**
 * 托盘图标状态
 */
export type TrayIconState = 'idle' | 'connected' | 'connecting';

/**
 * 托盘管理器接口
 */
export interface ITrayManager {
  /**
   * 创建托盘图标
   */
  createTray(): void;

  /**
   * 销毁托盘图标
   */
  destroyTray(): void;

  /**
   * 更新托盘图标状态
   */
  updateTrayIcon(state: TrayIconState): void;

  /**
   * 更新托盘菜单
   */
  updateTrayMenu(isProxyRunning: boolean): void;
}

/**
 * 托盘管理器
 * 负责创建和管理系统托盘图标及其上下文菜单
 */
export class TrayManager implements ITrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private logManager: LogManager;
  private currentState: TrayIconState = 'idle';
  private isProxyRunning: boolean = false;

  // 回调函数
  private onStartProxy?: () => void;
  private onStopProxy?: () => void;
  private onShowWindow?: () => void;
  private onQuit?: () => void;

  constructor(
    mainWindow: BrowserWindow | null,
    logManager: LogManager,
    callbacks?: {
      onStartProxy?: () => void;
      onStopProxy?: () => void;
      onShowWindow?: () => void;
      onQuit?: () => void;
    }
  ) {
    this.mainWindow = mainWindow;
    this.logManager = logManager;
    this.onStartProxy = callbacks?.onStartProxy;
    this.onStopProxy = callbacks?.onStopProxy;
    this.onShowWindow = callbacks?.onShowWindow;
    this.onQuit = callbacks?.onQuit;
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * 创建托盘图标
   */
  createTray(): void {
    if (this.tray) {
      this.logManager.addLog('warn', 'Tray already exists', 'TrayManager');
      return;
    }

    try {
      const icon = this.loadTrayIcon('idle');

      this.tray = new Tray(icon);
      this.tray.setToolTip('V2rayZ');

      // 设置托盘图标点击事件
      this.tray.on('click', () => {
        this.handleTrayClick();
      });

      // 创建上下文菜单
      this.updateTrayMenu(false);

      this.logManager.addLog('info', 'Tray icon created', 'TrayManager');
    } catch (error) {
      this.logManager.addLog(
        'error',
        `Failed to create tray icon: ${error instanceof Error ? error.message : String(error)}`,
        'TrayManager'
      );
    }
  }

  /**
   * 销毁托盘图标
   */
  destroyTray(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      this.logManager.addLog('info', 'Tray icon destroyed', 'TrayManager');
    }
  }

  /**
   * 更新托盘图标状态
   */
  updateTrayIcon(state: TrayIconState): void {
    if (!this.tray) {
      this.logManager.addLog('warn', 'Cannot update tray icon: tray not created', 'TrayManager');
      return;
    }

    try {
      this.currentState = state;
      const icon = this.loadTrayIcon(state);

      this.tray.setImage(icon);

      // 更新工具提示
      const tooltips: Record<TrayIconState, string> = {
        idle: 'V2rayZ - 未连接',
        connecting: 'V2rayZ - 连接中...',
        connected: 'V2rayZ - 已连接',
      };
      this.tray.setToolTip(tooltips[state]);

      this.logManager.addLog('info', `Tray icon updated to state: ${state}`, 'TrayManager');
    } catch (error) {
      this.logManager.addLog(
        'error',
        `Failed to update tray icon: ${error instanceof Error ? error.message : String(error)}`,
        'TrayManager'
      );
    }
  }

  /**
   * 更新托盘菜单
   */
  updateTrayMenu(isProxyRunning: boolean): void {
    if (!this.tray) {
      this.logManager.addLog('warn', 'Cannot update tray menu: tray not created', 'TrayManager');
      return;
    }

    this.isProxyRunning = isProxyRunning;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: isProxyRunning ? '停止代理' : '启动代理',
        click: () => {
          if (isProxyRunning) {
            this.handleStopProxy();
          } else {
            this.handleStartProxy();
          }
        },
      },
      { type: 'separator' },
      {
        label: '显示窗口',
        click: () => {
          this.handleShowWindow();
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          this.handleQuit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
    this.logManager.addLog('info', 'Tray menu updated', 'TrayManager');
  }

  /**
   * 加载托盘图标
   * 如果图标文件不存在，使用内置的默认图标
   */
  private loadTrayIcon(state: TrayIconState): Electron.NativeImage {
    const { resourceManager } = require('./ResourceManager');
    const iconPath = resourceManager.getTrayIconPath(state === 'connected');
    
    // 检查图标文件是否存在
    const fs = require('fs');
    let icon: Electron.NativeImage;
    
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
      this.logManager.addLog('debug', `Loaded tray icon from: ${iconPath}`, 'TrayManager');
      
      // macOS 托盘图标需要调整大小为 22x22（或 16x16）
      // 高 DPI 屏幕会自动使用 @2x 版本
      if (process.platform === 'darwin') {
        icon = icon.resize({ width: 18, height: 18 });
      }
    } else {
      // 图标文件不存在，创建一个简单的默认图标
      this.logManager.addLog('warn', `Tray icon not found: ${iconPath}, using default`, 'TrayManager');
      icon = this.createDefaultTrayIcon();
    }
    
    // 在 macOS 上，托盘图标应该是模板图像
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }
    
    return icon;
  }
  
  /**
   * 创建默认托盘图标（当图标文件不存在时使用）
   */
  private createDefaultTrayIcon(): Electron.NativeImage {
    // 创建一个 22x22 的简单图标（V 字形状）
    const size = 22;
    const canvas = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="transparent"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" 
              font-family="Arial" font-size="16" font-weight="bold" fill="black">V</text>
      </svg>
    `;
    return nativeImage.createFromDataURL(
      `data:image/svg+xml;base64,${Buffer.from(canvas).toString('base64')}`
    );
  }


  /**
   * 处理托盘图标点击事件
   */
  private handleTrayClick(): void {
    this.logManager.addLog('info', 'Tray icon clicked', 'TrayManager');
    this.handleShowWindow();
  }

  /**
   * 处理启动代理
   */
  private handleStartProxy(): void {
    this.logManager.addLog('info', 'Start proxy clicked from tray', 'TrayManager');
    if (this.onStartProxy) {
      this.onStartProxy();
    }
  }

  /**
   * 处理停止代理
   */
  private handleStopProxy(): void {
    this.logManager.addLog('info', 'Stop proxy clicked from tray', 'TrayManager');
    if (this.onStopProxy) {
      this.onStopProxy();
    }
  }

  /**
   * 处理显示窗口
   */
  private handleShowWindow(): void {
    this.logManager.addLog('info', 'Show window clicked from tray', 'TrayManager');
    if (this.onShowWindow) {
      this.onShowWindow();
    } else if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  /**
   * 处理退出应用
   */
  private handleQuit(): void {
    this.logManager.addLog('info', 'Quit clicked from tray', 'TrayManager');
    if (this.onQuit) {
      this.onQuit();
    } else {
      app.quit();
    }
  }

  /**
   * 获取托盘是否已创建（用于测试）
   */
  isTrayCreated(): boolean {
    return this.tray !== null;
  }

  /**
   * 获取当前代理运行状态（用于测试）
   */
  getProxyRunningState(): boolean {
    return this.isProxyRunning;
  }

  /**
   * 获取当前图标状态（用于测试）
   */
  getCurrentIconState(): TrayIconState {
    return this.currentState;
  }
}
