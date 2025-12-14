/**
 * 自启动管理服务
 * 负责跨平台的开机自启动设置和管理
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { app } from 'electron';

const execAsync = promisify(exec);

/**
 * 自启动管理器接口
 */
export interface IAutoStartManager {
  /**
   * 设置自启动
   * @param enabled 是否启用自启动
   * @returns 操作是否成功
   */
  setAutoStart(enabled: boolean): Promise<boolean>;

  /**
   * 查询自启动状态
   * @returns 是否已启用自启动
   */
  isAutoStartEnabled(): Promise<boolean>;
}

/**
 * 自启动管理器基类
 */
export abstract class AutoStartBase implements IAutoStartManager {
  abstract setAutoStart(enabled: boolean): Promise<boolean>;
  abstract isAutoStartEnabled(): Promise<boolean>;
}

/**
 * Windows 自启动管理器
 * 使用注册表 Run 键管理启动项
 */
export class WindowsAutoStart extends AutoStartBase {
  private readonly appName = 'V2rayZ';
  private readonly regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

  /**
   * 设置自启动
   */
  async setAutoStart(enabled: boolean): Promise<boolean> {
    try {
      const exePath = app.getPath('exe');

      if (enabled) {
        // 添加注册表项
        // 使用引号包裹路径以处理包含空格的路径
        await execAsync(`reg add "${this.regKey}" /v "${this.appName}" /t REG_SZ /d "\\"${exePath}\\"" /f`);
      } else {
        // 删除注册表项
        try {
          await execAsync(`reg delete "${this.regKey}" /v "${this.appName}" /f`);
        } catch (error) {
          // 如果注册表项不存在，删除会失败，这是正常的
          // 检查是否是因为项不存在而失败
          const isEnabled = await this.isAutoStartEnabled();
          if (isEnabled) {
            // 如果仍然存在，说明删除真的失败了
            throw error;
          }
          // 否则，项不存在，删除操作可以认为成功
        }
      }

      return true;
    } catch (error) {
      throw new Error(`设置 Windows 自启动失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 查询自启动状态
   */
  async isAutoStartEnabled(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`reg query "${this.regKey}" /v "${this.appName}"`);
      // 检查输出是否包含应用名称
      return stdout.includes(this.appName);
    } catch (error) {
      // 查询失败通常意味着注册表项不存在，即未启用自启动
      return false;
    }
  }
}

/**
 * macOS 自启动管理器
 * 使用 Electron app.setLoginItemSettings API
 */
export class MacOSAutoStart extends AutoStartBase {
  /**
   * 设置自启动
   */
  async setAutoStart(enabled: boolean): Promise<boolean> {
    try {
      // 使用 Electron 的 app.setLoginItemSettings
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: false,
      });

      return true;
    } catch (error) {
      throw new Error(`设置 macOS 自启动失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 查询自启动状态
   */
  async isAutoStartEnabled(): Promise<boolean> {
    try {
      const settings = app.getLoginItemSettings();
      return settings.openAtLogin;
    } catch (error) {
      throw new Error(`查询 macOS 自启动状态失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * 创建自启动管理器
 * 根据当前平台返回对应的实现
 */
export function createAutoStartManager(): IAutoStartManager {
  const platform = process.platform;

  if (platform === 'win32') {
    return new WindowsAutoStart();
  } else if (platform === 'darwin') {
    return new MacOSAutoStart();
  }

  throw new Error(`不支持的平台: ${platform}`);
}
