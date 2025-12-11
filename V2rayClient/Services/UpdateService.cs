using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using Octokit;
using Serilog;
using V2rayClient.Models;

namespace V2rayClient.Services;

/// <summary>
/// 自动更新服务
/// </summary>
public class UpdateService
{
    private readonly GitHubClient _githubClient;
    private readonly HttpClient _httpClient;
    private readonly ILogger _logger;
    private readonly string _owner = "zhangjh";
    private readonly string _repo = "V2rayZ";
    private readonly string _tempDir;

    public UpdateService()
    {
        _githubClient = new GitHubClient(new ProductHeaderValue("V2rayZ"));
        _httpClient = new HttpClient();
        _logger = Log.ForContext<UpdateService>();
        _tempDir = Path.Combine(Path.GetTempPath(), "V2rayZ_Update");
    }

    /// <summary>
    /// 更新进度事件
    /// </summary>
    public event EventHandler<UpdateProgress>? ProgressChanged;

    /// <summary>
    /// 检查更新
    /// </summary>
    /// <param name="includePrerelease">是否包含预发布版本</param>
    /// <returns>更新信息，如果没有更新则返回null</returns>
    public async Task<UpdateInfo?> CheckForUpdateAsync(bool includePrerelease = false)
    {
        try
        {
            _logger.Information("开始检查更新...");
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Checking,
                Message = "正在检查更新..."
            });

            var releases = await _githubClient.Repository.Release.GetAll(_owner, _repo);
            var latestRelease = releases
                .Where(r => includePrerelease || !r.Prerelease)
                .OrderByDescending(r => r.PublishedAt)
                .FirstOrDefault();

            if (latestRelease == null)
            {
                _logger.Warning("未找到任何发布版本");
                OnProgressChanged(new UpdateProgress
                {
                    Status = UpdateStatus.NoUpdate,
                    Message = "未找到发布版本"
                });
                return null;
            }

            var updateInfo = new UpdateInfo
            {
                Version = latestRelease.TagName,
                Title = latestRelease.Name ?? latestRelease.TagName,
                ReleaseNotes = latestRelease.Body ?? "",
                PublishedAt = latestRelease.PublishedAt?.DateTime ?? DateTime.Now,
                IsPrerelease = latestRelease.Prerelease
            };

            // 查找Windows安装包或压缩包
            var asset = latestRelease.Assets
                .FirstOrDefault(a => a.Name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ||
                                   a.Name.EndsWith(".msi", StringComparison.OrdinalIgnoreCase) ||
                                   a.Name.EndsWith(".zip", StringComparison.OrdinalIgnoreCase));

            if (asset != null)
            {
                updateInfo.DownloadUrl = asset.BrowserDownloadUrl;
                updateInfo.FileSize = asset.Size;
            }
            else
            {
                _logger.Warning("未找到Windows更新包");
                OnProgressChanged(new UpdateProgress
                {
                    Status = UpdateStatus.Error,
                    Message = "未找到Windows更新包",
                    ErrorMessage = "发布版本中没有找到.exe、.msi或.zip文件"
                });
                return null;
            }

            // 检查是否为新版本
            if (!updateInfo.IsNewerThan(VersionInfo.Version))
            {
                _logger.Information("当前已是最新版本: {CurrentVersion}", VersionInfo.Version);
                OnProgressChanged(new UpdateProgress
                {
                    Status = UpdateStatus.NoUpdate,
                    Message = "当前已是最新版本"
                });
                return null;
            }

            _logger.Information("发现新版本: {NewVersion}", updateInfo.Version);
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.UpdateAvailable,
                Message = $"发现新版本 {updateInfo.Version}"
            });

            return updateInfo;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "检查更新时发生错误");
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Error,
                Message = "检查更新失败",
                ErrorMessage = ex.Message
            });
            return null;
        }
    }

    /// <summary>
    /// 下载更新
    /// </summary>
    /// <param name="updateInfo">更新信息</param>
    /// <returns>下载的文件路径</returns>
    public async Task<string?> DownloadUpdateAsync(UpdateInfo updateInfo)
    {
        try
        {
            _logger.Information("开始下载更新: {Version}", updateInfo.Version);
            
            // 获取当前应用程序目录
            var currentExePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
            var currentDir = Path.GetDirectoryName(currentExePath);
            
            if (string.IsNullOrEmpty(currentDir))
            {
                throw new InvalidOperationException("无法获取当前应用程序目录");
            }
            
            // 直接下载到应用程序目录
            var filePath = Path.Combine(currentDir, "update.zip");
            _logger.Information("下载到应用程序目录: {Path}", filePath);

            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Downloading,
                Message = "正在下载更新..."
            });

            // 如果文件已存在，先删除
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }

            using var response = await _httpClient.GetAsync(updateInfo.DownloadUrl, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            var totalBytes = response.Content.Headers.ContentLength ?? 0;
            var downloadedBytes = 0L;

            using var contentStream = await response.Content.ReadAsStreamAsync();
            using var fileStream = new FileStream(filePath, System.IO.FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);

            var buffer = new byte[8192];
            int bytesRead;

            while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
            {
                await fileStream.WriteAsync(buffer, 0, bytesRead);
                downloadedBytes += bytesRead;

                if (totalBytes > 0)
                {
                    var percentage = (int)((downloadedBytes * 100) / totalBytes);
                    OnProgressChanged(new UpdateProgress
                    {
                        Status = UpdateStatus.Downloading,
                        Percentage = percentage,
                        Message = $"正在下载更新... {percentage}%"
                    });
                }
            }

            _logger.Information("更新下载完成: {FilePath}", filePath);
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Downloaded,
                Percentage = 100,
                Message = "下载完成"
            });

            return filePath;
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.Error(ex, "下载更新时权限不足");
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Error,
                Message = "权限不足",
                ErrorMessage = "无法写入应用程序目录，请以管理员身份运行软件后重试"
            });
            return null;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "下载更新时发生错误");
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Error,
                Message = "下载失败",
                ErrorMessage = ex.Message
            });
            return null;
        }
    }

    /// <summary>
    /// 安装更新
    /// </summary>
    /// <param name="installerPath">安装包路径</param>
    /// <returns>是否成功启动安装程序</returns>
    public async Task<bool> InstallUpdateAsync(string installerPath)
    {
        try
        {
            _logger.Information("开始安装更新: {InstallerPath}", installerPath);
            
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Installing,
                Message = "正在安装更新..."
            });

            if (!File.Exists(installerPath))
            {
                throw new FileNotFoundException("安装包文件不存在", installerPath);
            }

            var fileExtension = Path.GetExtension(installerPath).ToLowerInvariant();
            
            if (fileExtension == ".zip")
            {
                return await InstallFromZipAsync(installerPath);
            }
            else if (fileExtension == ".exe" || fileExtension == ".msi")
            {
                return await InstallFromInstallerAsync(installerPath);
            }
            else
            {
                throw new NotSupportedException($"不支持的安装包格式: {fileExtension}");
            }
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "安装更新时发生错误");
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Error,
                Message = "安装失败",
                ErrorMessage = ex.Message
            });
            return false;
        }
    }

    /// <summary>
    /// 从ZIP文件安装更新
    /// </summary>
    private async Task<bool> InstallFromZipAsync(string zipPath)
    {
        try
        {
            // 获取当前应用程序路径
            var currentExePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
            if (string.IsNullOrEmpty(currentExePath))
            {
                throw new InvalidOperationException("无法获取当前应用程序路径");
            }

            var currentDir = Path.GetDirectoryName(currentExePath);
            if (string.IsNullOrEmpty(currentDir))
            {
                throw new InvalidOperationException("无法获取当前应用程序目录");
            }
            
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Installing,
                Message = "正在准备更新文件..."
            });

            // ZIP 包应该已经在应用程序目录（update.zip）
            _logger.Information("更新包位置: {Path}", zipPath);
            
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Installing,
                Message = "正在创建更新脚本..."
            });

            // 创建更新脚本（放在应用程序目录）
            var updateScriptPath = Path.Combine(currentDir, "update.bat");
            
            // 简化的更新脚本：
            // 1. 等待当前进程退出
            // 2. 解压 ZIP 包覆盖当前文件
            // 3. 删除 ZIP 包
            // 4. 启动新版本
            // 5. 删除自身
            
            // 简单的更新脚本
            var updateScript = @"@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title V2rayZ 更新程序

echo ========================================
echo V2rayZ 自动更新程序
echo ========================================
echo.

REM 切换到应用程序目录
cd /d ""%~dp0""

REM 强制终止所有 V2rayZ 和 sing-box 进程
echo 正在终止进程...
taskkill /F /IM V2rayZ.exe >nul 2>&1
taskkill /F /IM sing-box.exe >nul 2>&1
timeout /t 2 /nobreak > nul

REM 等待进程完全退出
:wait_process
echo [1/3] 等待进程退出...
tasklist /FI ""IMAGENAME eq V2rayZ.exe"" 2>nul | find /I ""V2rayZ.exe"" >nul 2>&1
if !errorlevel! equ 0 (
    timeout /t 1 /nobreak > nul
    goto wait_process
)
echo 进程已退出
echo.

REM 解压更新包
echo [2/3] 解压更新文件...
if not exist ""update.zip"" (
    echo 错误: 找不到更新包 update.zip
    timeout /t 3 /nobreak > nul
    exit /b 1
)

echo 正在覆盖文件...
powershell -NoProfile -Command ""Expand-Archive -Path 'update.zip' -DestinationPath '.' -Force"" 2>nul

if !errorlevel! neq 0 (
    echo.
    echo ========================================
    echo 错误: 解压失败！
    echo ========================================
    echo.
    echo 可能的原因:
    echo 1. 文件被占用
    echo 2. 磁盘空间不足
    echo 3. ZIP 包损坏
    echo.
    echo 如果更新失败，请重新下载完整安装包
    echo.
    timeout /t 5 /nobreak > nul
    exit /b 1
)
echo 文件覆盖完成
echo.

REM 删除更新包
echo 清理更新包...
del /f /q ""update.zip"" 2>nul

REM 启动新版本
echo [3/3] 启动新版本...
start """" ""V2rayZ.exe""
echo.

echo ========================================
echo 更新完成！窗口将自动关闭...
echo ========================================
timeout /t 1 /nobreak > nul

REM 删除自身
del /f /q ""%~f0"" > nul 2>&1
exit
";

            File.WriteAllText(updateScriptPath, updateScript, System.Text.Encoding.Default);
            _logger.Information("更新脚本已创建: {Path}", updateScriptPath);

            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Installing,
                Message = "正在启动更新程序..."
            });

            // 使用 cmd.exe /c start 启动脚本，确保脚本作为独立进程运行
            var startInfo = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c start \"V2rayZ Update\" \"{updateScriptPath}\"",
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true,
                WorkingDirectory = currentDir
            };
            
            _logger.Information("启动更新脚本: {Path}", updateScriptPath);

            try
            {
                Process.Start(startInfo);
                _logger.Information("更新脚本已启动，准备退出当前应用");
            }
            catch (Exception ex)
            {
                _logger.Error(ex, "启动更新脚本失败");
                
                // 清理文件
                try
                {
                    if (File.Exists(zipPath)) File.Delete(zipPath);
                    if (File.Exists(updateScriptPath)) File.Delete(updateScriptPath);
                }
                catch { }
                
                throw new InvalidOperationException("启动更新脚本失败", ex);
            }
            
            // 延迟一下确保更新脚本已经启动
            await Task.Delay(1000);
            
            // 禁用系统代理
            _logger.Information("禁用系统代理");
            try
            {
                var proxyManager = new SystemProxyManager();
                proxyManager.DisableProxy();
                _logger.Information("系统代理已禁用");
            }
            catch (Exception ex)
            {
                _logger.Warning(ex, "禁用系统代理失败");
            }
            
            // 强制终止所有 v2ray 进程，避免退出时卡住
            _logger.Information("强制终止 v2ray 进程以确保更新顺利进行");
            try
            {
                var v2rayProcesses = System.Diagnostics.Process.GetProcessesByName("v2ray");
                foreach (var process in v2rayProcesses)
                {
                    try
                    {
                        process.Kill(true);
                        process.Dispose();
                    }
                    catch (Exception ex)
                    {
                        _logger.Warning(ex, "无法终止 v2ray 进程 {ProcessId}", process.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.Warning(ex, "清理 v2ray 进程时发生错误");
            }
            
            // 退出当前应用程序，让更新脚本接管
            await System.Windows.Application.Current.Dispatcher.InvokeAsync(() =>
            {
                // 使用 Environment.Exit 强制退出，避免 OnExit 中的清理逻辑阻塞
                _logger.Information("强制退出应用程序");
                Environment.Exit(0);
            });

            return true;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "从ZIP安装更新时发生错误");
            throw;
        }
    }

    /// <summary>
    /// 从安装程序安装更新
    /// </summary>
    private async Task<bool> InstallFromInstallerAsync(string installerPath)
    {
        try
        {
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Installing,
                Message = "正在启动安装程序..."
            });

            var fileExtension = Path.GetExtension(installerPath).ToLowerInvariant();
            
            // 启动安装程序
            var startInfo = new ProcessStartInfo
            {
                FileName = installerPath,
                UseShellExecute = true,
                Verb = "runas" // 请求管理员权限
            };

            // 如果是Inno Setup安装程序，添加静默安装参数
            if (fileExtension == ".exe")
            {
                // Inno Setup支持的静默安装参数
                // /VERYSILENT - 完全静默安装
                // /SUPPRESSMSGBOXES - 抑制消息框
                // /NORESTART - 不自动重启
                // /CLOSEAPPLICATIONS - 自动关闭正在运行的应用
                startInfo.Arguments = "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS";
            }
            else if (fileExtension == ".msi")
            {
                // MSI安装程序使用msiexec
                startInfo.FileName = "msiexec.exe";
                startInfo.Arguments = $"/i \"{installerPath}\" /quiet /norestart";
            }

            try
            {
                Process.Start(startInfo);
                _logger.Information("安装程序已启动（{Extension}），准备退出当前应用", fileExtension);
            }
            catch (Exception ex)
            {
                _logger.Error(ex, "启动安装程序失败");
                throw new InvalidOperationException("启动安装程序失败，可能是用户取消了 UAC 提示", ex);
            }
            
            // 立即退出当前应用程序，让安装程序接管
            // 使用 Dispatcher 确保在 UI 线程上执行
            await System.Windows.Application.Current.Dispatcher.InvokeAsync(() =>
            {
                System.Windows.Application.Current.Shutdown();
            });

            return true;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "从安装程序安装更新时发生错误");
            throw;
        }
    }

    /// <summary>
    /// 清理临时文件
    /// </summary>
    public void CleanupTempFiles()
    {
        try
        {
            if (Directory.Exists(_tempDir))
            {
                Directory.Delete(_tempDir, true);
                _logger.Information("临时文件清理完成");
            }
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "清理临时文件时发生错误");
        }
    }

    /// <summary>
    /// 检查目录是否可写
    /// </summary>
    private bool IsDirectoryWritable(string? dirPath)
    {
        if (string.IsNullOrEmpty(dirPath) || !Directory.Exists(dirPath))
            return false;

        try
        {
            var testFile = Path.Combine(dirPath, $".write_test_{Guid.NewGuid()}.tmp");
            File.WriteAllText(testFile, "test");
            File.Delete(testFile);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private void OnProgressChanged(UpdateProgress progress)
    {
        ProgressChanged?.Invoke(this, progress);
    }

    public void Dispose()
    {
        _httpClient?.Dispose();
        CleanupTempFiles();
    }
}