/**
 * 管理员权限管理服务
 * 用于检测和提升 Windows/macOS 下的管理员权限
 */

import { app, dialog } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';

export interface IAdminPrivilege {
  isAdmin(): boolean;
  requestElevation(): Promise<boolean>;
  needsElevationForTun(): boolean;
}

/**
 * 检测当前进程是否以管理员权限运行
 */
export function isRunningAsAdmin(): boolean {
  if (process.platform === 'win32') {
    return isWindowsAdmin();
  } else if (process.platform === 'darwin') {
    return isMacOSAdmin();
  }
  return false;
}

/**
 * Windows 管理员权限检测
 * 通过尝试访问需要管理员权限的注册表项来判断
 */
function isWindowsAdmin(): boolean {
  try {
    const { execSync } = require('child_process');
    execSync('net session', { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * macOS 管理员权限检测
 */
function isMacOSAdmin(): boolean {
  try {
    const { execSync } = require('child_process');
    const result = execSync('id -u', { encoding: 'utf-8' }).trim();
    return result === '0';
  } catch {
    return false;
  }
}

/**
 * 请求以管理员权限重启应用
 * @returns Promise<boolean> 如果用户同意重启返回 true，否则返回 false
 */
export async function requestElevatedRestart(): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: 'warning',
    title: '需要管理员权限',
    message: 'TUN 模式需要管理员权限才能创建虚拟网络接口。',
    detail: '是否以管理员身份重新启动应用程序？\n\n重启后将自动恢复当前状态。',
    buttons: ['以管理员身份重启', '取消'],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    await launchElevated();
    return true;
  }

  return false;
}

/**
 * 以管理员权限启动新实例
 */
async function launchElevated(): Promise<void> {
  const exePath = app.getPath('exe');

  if (process.platform === 'win32') {
    await launchElevatedWindows(exePath);
  } else if (process.platform === 'darwin') {
    await launchElevatedMacOS(exePath);
  }
}

/**
 * Windows 下以管理员权限启动
 * 使用 PowerShell 的 Start-Process -Verb RunAs
 */
async function launchElevatedWindows(exePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const workingDir = path.dirname(exePath);

    // 使用 -PassThru 来确保进程启动，使用 try-catch 捕获 UAC 取消
    const psScript = `
      try {
        $process = Start-Process -FilePath '${exePath.replace(/'/g, "''")}' -Verb RunAs -WorkingDirectory '${workingDir.replace(/'/g, "''")}' -PassThru
        if ($process) {
          Write-Output "SUCCESS"
          exit 0
        } else {
          Write-Output "FAILED"
          exit 1
        }
      } catch {
        Write-Output "ERROR: $_"
        exit 1
      }
    `;

    console.log('[AdminPrivilege] Launching elevated process:', exePath);
    console.log('[AdminPrivilege] Working directory:', workingDir);

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      }
    );

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('error', (error) => {
      console.error('[AdminPrivilege] Failed to spawn PowerShell:', error);
      reject(error);
    });

    child.on('exit', (code) => {
      console.log('[AdminPrivilege] PowerShell exit code:', code);
      console.log('[AdminPrivilege] stdout:', stdout.trim());
      if (stderr) {
        console.log('[AdminPrivilege] stderr:', stderr.trim());
      }

      if (code === 0 && stdout.includes('SUCCESS')) {
        // 成功启动新进程，退出当前进程
        console.log('[AdminPrivilege] Elevated process started, quitting current instance');
        setTimeout(() => {
          app.quit();
        }, 500);
        resolve();
      } else {
        // 用户取消了 UAC 或发生错误
        const errorMsg = stderr || stdout || '用户取消了管理员权限请求';
        console.error('[AdminPrivilege] Failed to start elevated process:', errorMsg);
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * macOS 下以管理员权限启动
 * 使用 osascript 请求权限，然后用 sudo 启动新进程
 */
async function launchElevatedMacOS(exePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 对于 Electron app，exePath 通常已经是 /path/to/App.app/Contents/MacOS/AppName
    // 我们需要找到 .app bundle 的路径来使用 open 命令
    let appBundlePath = exePath;

    // 如果路径包含 Contents/MacOS，向上找到 .app bundle
    const contentsIndex = exePath.indexOf('/Contents/MacOS/');
    if (contentsIndex !== -1) {
      appBundlePath = exePath.substring(0, contentsIndex);
    }

    console.log('[AdminPrivilege] exe path:', exePath);
    console.log('[AdminPrivilege] app bundle path:', appBundlePath);

    // 方案：先用 osascript 获取管理员权限创建一个标记文件，
    // 然后用 sudo -b 在后台启动应用
    // 转义路径中的特殊字符
    const escapedExePath = exePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    // 使用 sudo -b 在后台以 root 权限运行，同时设置 ELECTRON_RUN_AS_NODE=0 确保正常启动
    const script = `do shell script "sudo -b \\"${escapedExePath}\\" > /dev/null 2>&1" with administrator privileges`;

    console.log('[AdminPrivilege] Launching elevated with script:', script);

    const child = spawn('/usr/bin/osascript', ['-e', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('error', (error) => {
      console.error('[AdminPrivilege] Failed to launch elevated process:', error);
      reject(error);
    });

    child.on('exit', (code) => {
      console.log('[AdminPrivilege] osascript exit code:', code);
      if (stdout) console.log('[AdminPrivilege] stdout:', stdout.trim());
      if (stderr) console.log('[AdminPrivilege] stderr:', stderr.trim());

      if (code === 0) {
        console.log('[AdminPrivilege] Elevated process started, quitting current instance');
        // 给新进程一点时间启动
        setTimeout(() => {
          app.quit();
        }, 1500);
        resolve();
      } else {
        const errorMsg = stderr || '用户取消了管理员权限请求';
        console.error('[AdminPrivilege] Failed to start elevated process:', errorMsg);
        reject(new Error(errorMsg));
      }
    });
  });
}

/**
 * 检查 TUN 模式是否需要管理员权限
 * Windows 和 macOS 都需要
 */
export function needsAdminForTun(): boolean {
  return process.platform === 'win32' || process.platform === 'darwin';
}

/**
 * 管理员权限服务类
 */
export class AdminPrivilegeService implements IAdminPrivilege {
  private _isAdmin: boolean | null = null;

  /**
   * 检测当前是否有管理员权限（带缓存）
   */
  isAdmin(): boolean {
    if (this._isAdmin === null) {
      this._isAdmin = isRunningAsAdmin();
    }
    return this._isAdmin;
  }

  /**
   * 请求提升权限（重启应用）
   */
  async requestElevation(): Promise<boolean> {
    return requestElevatedRestart();
  }

  /**
   * 检查 TUN 模式是否需要提升权限
   */
  needsElevationForTun(): boolean {
    return needsAdminForTun() && !this.isAdmin();
  }

  /**
   * 清除缓存的权限状态
   */
  clearCache(): void {
    this._isAdmin = null;
  }
}

// 导出单例
export const adminPrivilegeService = new AdminPrivilegeService();
