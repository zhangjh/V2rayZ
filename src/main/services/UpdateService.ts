/**
 * 更新检查服务
 * 通过 GitHub API 检查新版本并支持下载
 */

import { app, shell, BrowserWindow, dialog } from 'electron';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { LogManager } from './LogManager';
import type { UpdateInfo, UpdateCheckResult, UpdateProgress } from '../../shared/types/update';

const GITHUB_OWNER = 'zhangjh';
const GITHUB_REPO = 'FlowZ';

export class UpdateService {
  private logManager: LogManager;
  private mainWindow: BrowserWindow | null = null;
  private downloadProgress: UpdateProgress = {
    status: 'idle',
    percentage: 0,
    message: '',
  };
  private skippedVersion: string | null = null;
  private cleanupCallback: (() => Promise<void>) | null = null;

  constructor(logManager: LogManager) {
    this.logManager = logManager;
    this.loadSkippedVersion();
  }

  /**
   * 设置清理回调函数
   * 在安装更新前会调用此函数来停止代理进程等资源
   */
  setCleanupCallback(callback: () => Promise<void>): void {
    this.cleanupCallback = callback;
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * 检查更新
   */
  async checkForUpdate(includePrerelease = false): Promise<UpdateCheckResult> {
    try {
      this.logManager.addLog('info', '开始检查更新...', 'UpdateService');
      this.updateProgress({ status: 'checking', percentage: 0, message: '正在检查更新...' });

      const releases = await this.fetchReleases();

      // 过滤并排序
      const validReleases = releases
        .filter((r: any) => includePrerelease || !r.prerelease)
        .sort(
          (a: any, b: any) =>
            new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
        );

      if (validReleases.length === 0) {
        this.logManager.addLog('warn', '未找到任何发布版本', 'UpdateService');
        this.updateProgress({ status: 'no-update', percentage: 0, message: '未找到发布版本' });
        return { hasUpdate: false };
      }

      const latestRelease = validReleases[0];
      const currentVersion = app.getVersion();
      const latestVersion = latestRelease.tag_name.replace(/^v/, '');

      // 检查是否为新版本
      if (!this.isNewerVersion(latestVersion, currentVersion)) {
        this.logManager.addLog('info', `当前已是最新版本: ${currentVersion}`, 'UpdateService');
        this.updateProgress({ status: 'no-update', percentage: 0, message: '当前已是最新版本' });
        return { hasUpdate: false };
      }

      // 查找适合当前平台的安装包
      const asset = this.findSuitableAsset(latestRelease.assets);

      if (!asset) {
        this.logManager.addLog('warn', '未找到适合当前平台的安装包', 'UpdateService');
        this.updateProgress({
          status: 'no-update',
          percentage: 0,
          message: '未找到适合当前平台的安装包',
        });
        return { hasUpdate: false };
      }

      const updateInfo: UpdateInfo = {
        version: latestRelease.tag_name,
        title: latestRelease.name || latestRelease.tag_name,
        releaseNotes: latestRelease.body || '',
        downloadUrl: asset.browser_download_url,
        fileSize: asset.size,
        publishedAt: latestRelease.published_at,
        isPrerelease: latestRelease.prerelease,
        fileName: asset.name,
      };

      // 检查是否被跳过
      if (this.skippedVersion === latestVersion) {
        this.logManager.addLog('info', `版本 ${latestVersion} 已被用户跳过`, 'UpdateService');
        this.updateProgress({ status: 'no-update', percentage: 0, message: '此版本已被跳过' });
        return { hasUpdate: false };
      }

      this.logManager.addLog('info', `发现新版本: ${latestVersion}`, 'UpdateService');
      this.updateProgress({
        status: 'update-available',
        percentage: 0,
        message: `发现新版本 ${latestVersion}`,
      });

      return { hasUpdate: true, updateInfo };
    } catch (error: any) {
      const errorMessage = error?.message || '检查更新失败';
      this.logManager.addLog('error', `检查更新失败: ${errorMessage}`, 'UpdateService');
      this.updateProgress({
        status: 'error',
        percentage: 0,
        message: '检查更新失败',
        error: errorMessage,
      });
      return { hasUpdate: false, error: errorMessage };
    }
  }

  /**
   * 下载更新
   */
  async downloadUpdate(updateInfo: UpdateInfo): Promise<string | null> {
    try {
      this.logManager.addLog('info', `开始下载更新: ${updateInfo.version}`, 'UpdateService');
      this.updateProgress({ status: 'downloading', percentage: 0, message: '正在下载更新...' });

      const downloadDir = app.getPath('temp');
      const filePath = path.join(downloadDir, updateInfo.fileName);

      // 如果文件已存在，先删除
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await this.downloadFile(updateInfo.downloadUrl, filePath, updateInfo.fileSize);

      this.logManager.addLog('info', `更新下载完成: ${filePath}`, 'UpdateService');
      this.updateProgress({ status: 'downloaded', percentage: 100, message: '下载完成' });

      return filePath;
    } catch (error: any) {
      const errorMessage = error?.message || '下载更新失败';
      this.logManager.addLog('error', `下载更新失败: ${errorMessage}`, 'UpdateService');
      this.updateProgress({
        status: 'error',
        percentage: 0,
        message: '下载失败',
        error: errorMessage,
      });
      return null;
    }
  }

  /**
   * 安装更新（打开下载的安装包）
   */
  async installUpdate(installerPath: string): Promise<boolean> {
    try {
      this.logManager.addLog('info', `准备安装更新: ${installerPath}`, 'UpdateService');

      // 检查文件是否存在
      if (!fs.existsSync(installerPath)) {
        this.logManager.addLog('error', `安装包不存在: ${installerPath}`, 'UpdateService');
        return false;
      }

      // 在安装更新前，先清理资源（停止代理进程等）
      // 这是关键步骤，否则 Windows 上会因为文件被占用而安装失败
      if (this.cleanupCallback) {
        this.logManager.addLog('info', '正在停止代理进程...', 'UpdateService');
        try {
          await this.cleanupCallback();
          this.logManager.addLog('info', '代理进程已停止', 'UpdateService');
        } catch (error: any) {
          this.logManager.addLog('warn', `停止代理进程时出错: ${error?.message}`, 'UpdateService');
          // 继续安装，不要因为清理失败而中断
        }
      }

      if (process.platform === 'win32') {
        // Windows: 使用 VBScript 完全隐藏窗口运行安装程序
        const { spawn } = require('child_process');
        const vbsPath = path.join(app.getPath('temp'), 'flowz_update.vbs');

        // VBScript: 等待 2 秒确保应用完全退出，然后静默启动安装程序
        // WScript.Shell.Run 的第二个参数 0 表示隐藏窗口，第三个参数 false 表示不等待
        const vbsContent = [
          'WScript.Sleep 2000',
          `Set WshShell = CreateObject("WScript.Shell")`,
          `WshShell.Run """${installerPath.replace(/\\/g, '\\\\')}""", 1, False`,
          // 删除自身
          `Set fso = CreateObject("Scripting.FileSystemObject")`,
          `fso.DeleteFile WScript.ScriptFullName, True`,
        ].join('\r\n');

        fs.writeFileSync(vbsPath, vbsContent, 'utf-8');

        // 使用 wscript 运行 VBS（完全无窗口）
        const vbs = spawn('wscript.exe', [vbsPath], {
          detached: true,
          stdio: 'ignore',
          shell: false,
        });
        vbs.unref();

        this.logManager.addLog('info', '更新脚本已启动，正在退出应用...', 'UpdateService');

        // 给一点时间让 VBS 启动，然后退出应用
        setTimeout(() => {
          app.exit(0);
        }, 500);
      } else if (process.platform === 'darwin') {
        // macOS: 打开 DMG 文件，用户需要手动拖拽安装
        const { spawn } = require('child_process');

        // 创建一个 shell 脚本来处理更新
        const scriptPath = path.join(app.getPath('temp'), 'flowz_update.sh');

        // 脚本内容：等待应用退出，挂载 DMG，复制新版本，卸载 DMG，启动新版本
        const scriptContent = `#!/bin/bash
sleep 2
# 打开 DMG 文件让用户手动安装
open "${installerPath}"
`;

        fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

        // 使用 spawn 启动独立进程执行脚本
        const child = spawn('/bin/bash', [scriptPath], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();

        this.logManager.addLog('info', 'DMG 文件将在应用退出后打开...', 'UpdateService');

        setTimeout(() => {
          app.exit(0);
        }, 1000);
      } else {
        // Linux: 直接打开安装包
        await shell.openPath(installerPath);
        this.logManager.addLog('info', '安装程序已启动，正在退出应用...', 'UpdateService');
        setTimeout(() => {
          app.exit(0);
        }, 1000);
      }

      return true;
    } catch (error: any) {
      this.logManager.addLog('error', `安装更新失败: ${error?.message}`, 'UpdateService');
      return false;
    }
  }

  /**
   * 跳过此版本
   */
  skipVersion(version: string): void {
    this.skippedVersion = version.replace(/^v/, '');
    this.saveSkippedVersion();
    this.logManager.addLog('info', `已跳过版本: ${version}`, 'UpdateService');
  }

  /**
   * 打开 GitHub Releases 页面
   */
  openReleasesPage(): void {
    shell.openExternal(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`);
  }

  /**
   * 显示更新对话框
   */
  async showUpdateDialog(updateInfo: UpdateInfo): Promise<'update' | 'later' | 'skip'> {
    if (!this.mainWindow) {
      return 'later';
    }

    const currentVersion = app.getVersion();
    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${updateInfo.version}`,
      detail: `当前版本: v${currentVersion}\n新版本: ${updateInfo.version}\n\n${updateInfo.releaseNotes.substring(0, 500)}${updateInfo.releaseNotes.length > 500 ? '...' : ''}`,
      buttons: ['立即更新', '稍后提醒', '跳过此版本'],
      defaultId: 0,
      cancelId: 1,
    });

    switch (result.response) {
      case 0:
        return 'update';
      case 2:
        return 'skip';
      default:
        return 'later';
    }
  }

  /**
   * 获取当前下载进度
   */
  getProgress(): UpdateProgress {
    return { ...this.downloadProgress };
  }

  // ========== 私有方法 ==========

  private async fetchReleases(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
        method: 'GET',
        headers: {
          'User-Agent': 'FlowZ-Electron',
          Accept: 'application/vnd.github.v3+json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`GitHub API 返回错误: ${res.statusCode}`));
            }
          } catch {
            reject(new Error('解析 GitHub API 响应失败'));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      req.end();
    });
  }

  private findSuitableAsset(assets: any[]): any | null {
    const platform = process.platform;
    const arch = process.arch;

    // 根据平台选择合适的安装包
    // 文件命名格式: FlowZ-{version}-{platform}-{arch}.{ext}
    // 例如: FlowZ-3.0.3-mac-arm64.dmg, FlowZ-3.0.3-win-x64.exe

    if (platform === 'win32') {
      // Windows: 查找 .exe 安装包
      const winAsset = assets.find(
        (a: any) => a.name.endsWith('.exe') && a.name.includes('win')
      );
      return winAsset || null;
    } else if (platform === 'darwin') {
      // macOS: 优先选择对应架构的 dmg
      const archPattern = arch === 'arm64' ? 'mac-arm64' : 'mac-x64';

      // 优先匹配精确架构
      let asset = assets.find(
        (a: any) => a.name.includes(archPattern) && a.name.endsWith('.dmg')
      );

      // 如果没找到，尝试通用 dmg
      if (!asset) {
        asset = assets.find((a: any) => a.name.endsWith('.dmg'));
      }

      return asset || null;
    } else if (platform === 'linux') {
      // Linux: 优先 AppImage，其次 deb
      let asset = assets.find((a: any) => a.name.endsWith('.AppImage'));
      if (!asset) {
        asset = assets.find((a: any) => a.name.endsWith('.deb'));
      }
      return asset || null;
    }

    return null;
  }

  private isNewerVersion(latest: string, current: string): boolean {
    try {
      const latestParts = latest.split('.').map(Number);
      const currentParts = current.split('.').map(Number);

      for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
        const l = latestParts[i] || 0;
        const c = currentParts[i] || 0;
        if (l > c) return true;
        if (l < c) return false;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async downloadFile(url: string, destPath: string, totalSize: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      let downloadedBytes = 0;

      const request = (downloadUrl: string) => {
        https
          .get(downloadUrl, { headers: { 'User-Agent': 'FlowZ-Electron' } }, (response) => {
            // 处理重定向
            if (response.statusCode === 302 || response.statusCode === 301) {
              const redirectUrl = response.headers.location;
              if (redirectUrl) {
                request(redirectUrl);
                return;
              }
            }

            if (response.statusCode !== 200) {
              reject(new Error(`下载失败: HTTP ${response.statusCode}`));
              return;
            }

            response.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              file.write(chunk);

              if (totalSize > 0) {
                const percentage = Math.round((downloadedBytes / totalSize) * 100);
                this.updateProgress({
                  status: 'downloading',
                  percentage,
                  message: `正在下载更新... ${percentage}%`,
                });
              }
            });

            response.on('end', () => {
              file.end();
              resolve();
            });

            response.on('error', (err) => {
              file.close();
              fs.unlinkSync(destPath);
              reject(err);
            });
          })
          .on('error', (err) => {
            file.close();
            if (fs.existsSync(destPath)) {
              fs.unlinkSync(destPath);
            }
            reject(err);
          });
      };

      request(url);
    });
  }

  private updateProgress(progress: UpdateProgress): void {
    this.downloadProgress = progress;
    // 发送进度到渲染进程
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update:progress', progress);
    }
  }

  private loadSkippedVersion(): void {
    try {
      const configPath = path.join(app.getPath('userData'), 'skipped_version.txt');
      if (fs.existsSync(configPath)) {
        this.skippedVersion = fs.readFileSync(configPath, 'utf-8').trim();
      }
    } catch {
      // 忽略错误
    }
  }

  private saveSkippedVersion(): void {
    try {
      const configPath = path.join(app.getPath('userData'), 'skipped_version.txt');
      if (this.skippedVersion) {
        fs.writeFileSync(configPath, this.skippedVersion);
      } else if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    } catch {
      // 忽略错误
    }
  }
}
