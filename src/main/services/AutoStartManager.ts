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
  private readonly appName = 'FlowZ';
  private readonly regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

  /**
   * 设置自启动
   */
  async setAutoStart(enabled: boolean): Promise<boolean> {
    try {
      const exePath = app.getPath('exe');

      if (enabled) {
        // 添加注册表项
        // Windows 路径需要正确转义，使用双引号包裹整个路径
        const escapedPath = exePath.replace(/\\/g, '\\\\');
        await execAsync(
          `reg add "${this.regKey}" /v "${this.appName}" /t REG_SZ /d "\\"${escapedPath}\\"" /f`
        );
        console.log(`[AutoStart] Added registry entry for: ${exePath}`);
      } else {
        // 删除注册表项
        try {
          await execAsync(`reg delete "${this.regKey}" /v "${this.appName}" /f`);
          console.log(`[AutoStart] Removed registry entry`);
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
      console.error('[AutoStart] Error:', error);
      throw new Error(
        `设置 Windows 自启动失败: ${error instanceof Error ? error.message : String(error)}`
      );
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
    } catch {
      // 查询失败通常意味着注册表项不存在，即未启用自启动
      return false;
    }
  }
}

/**
 * macOS 自启动管理器
 * 使用 LaunchAgents plist 文件管理启动项（更可靠，不依赖应用签名）
 */
export class MacOSAutoStart extends AutoStartBase {
  private readonly plistName = 'com.flowz.app.plist';

  /**
   * 获取 LaunchAgents 目录路径
   */
  private getLaunchAgentsPath(): string {
    const homedir = require('os').homedir();
    return require('path').join(homedir, 'Library', 'LaunchAgents');
  }

  /**
   * 获取 plist 文件路径
   */
  private getPlistPath(): string {
    return require('path').join(this.getLaunchAgentsPath(), this.plistName);
  }

  /**
   * 设置自启动
   */
  async setAutoStart(enabled: boolean): Promise<boolean> {
    const fs = require('fs').promises;

    try {
      const plistPath = this.getPlistPath();
      const launchAgentsDir = this.getLaunchAgentsPath();

      if (enabled) {
        // 确保 LaunchAgents 目录存在
        await fs.mkdir(launchAgentsDir, { recursive: true });

        // 获取应用路径
        const appPath = app.getPath('exe');
        // exe 路径类似 /Applications/FlowZ.app/Contents/MacOS/FlowZ
        // 我们需要 /Applications/FlowZ.app
        const appBundlePath = appPath.replace(/\/Contents\/MacOS\/.*$/, '');

        // 创建 plist 内容
        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.flowz.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/open</string>
        <string>-a</string>
        <string>${appBundlePath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
`;

        // 写入 plist 文件
        await fs.writeFile(plistPath, plistContent, 'utf-8');
        console.log(`[AutoStart] Created plist at: ${plistPath}`);
      } else {
        // 删除 plist 文件
        try {
          await fs.unlink(plistPath);
          console.log(`[AutoStart] Removed plist at: ${plistPath}`);
        } catch (error: any) {
          // 文件不存在时忽略错误
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      return true;
    } catch (error) {
      throw new Error(
        `设置 macOS 自启动失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 查询自启动状态
   */
  async isAutoStartEnabled(): Promise<boolean> {
    const fs = require('fs').promises;

    try {
      const plistPath = this.getPlistPath();
      await fs.access(plistPath);
      return true;
    } catch {
      return false;
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
