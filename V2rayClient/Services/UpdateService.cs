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
            
            // 创建临时目录
            if (Directory.Exists(_tempDir))
            {
                Directory.Delete(_tempDir, true);
            }
            Directory.CreateDirectory(_tempDir);

            var fileName = Path.GetFileName(new Uri(updateInfo.DownloadUrl).LocalPath);
            var filePath = Path.Combine(_tempDir, fileName);

            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Downloading,
                Message = "正在下载更新..."
            });

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
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Installing,
                Message = "正在提取更新文件..."
            });

            var extractPath = Path.Combine(_tempDir, "extracted");
            if (Directory.Exists(extractPath))
            {
                Directory.Delete(extractPath, true);
            }
            Directory.CreateDirectory(extractPath);

            // 提取ZIP文件
            System.IO.Compression.ZipFile.ExtractToDirectory(zipPath, extractPath);
            
            // 检查 ZIP 包结构，如果有单个根文件夹，使用该文件夹作为源
            var extractedItems = Directory.GetFileSystemEntries(extractPath);
            var actualSourcePath = extractPath;
            
            if (extractedItems.Length == 1 && Directory.Exists(extractedItems[0]))
            {
                // ZIP 包里只有一个文件夹，使用该文件夹作为源
                actualSourcePath = extractedItems[0];
                _logger.Information("检测到 ZIP 包含单个根文件夹: {Folder}", Path.GetFileName(actualSourcePath));
            }
            
            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Installing,
                Message = "正在创建更新脚本..."
            });

            // 创建更新脚本
            var currentExePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
            if (string.IsNullOrEmpty(currentExePath))
            {
                throw new InvalidOperationException("无法获取当前应用程序路径");
            }

            var currentDir = Path.GetDirectoryName(currentExePath);
            var updateScriptPath = Path.Combine(_tempDir, "update.bat");
            
            // 改进的更新脚本：
            // 1. 等待当前进程完全退出
            // 2. 备份当前版本
            // 3. 覆盖所有文件
            // 4. 启动新版本
            // 5. 清理临时文件
            var updateScript = $@"@echo off
chcp 65001 > nul
title V2rayZ 更新程序
echo ========================================
echo V2rayZ 自动更新程序
echo ========================================
echo.

:wait_process
echo [1/5] 等待当前进程退出...
tasklist /FI ""IMAGENAME eq V2rayZ.exe"" 2>NUL | find /I /N ""V2rayZ.exe"">NUL
if ""%ERRORLEVEL%""==""0"" (
    timeout /t 1 /nobreak > nul
    goto wait_process
)
echo 进程已退出
echo.

echo [2/5] 备份当前版本...
if exist ""{currentDir}\V2rayZ.exe.backup"" del /f /q ""{currentDir}\V2rayZ.exe.backup"" 2>nul
if exist ""{currentDir}\V2rayZ.exe"" (
    copy /y ""{currentDir}\V2rayZ.exe"" ""{currentDir}\V2rayZ.exe.backup"" > nul 2>&1
    if errorlevel 1 (
        echo 警告: 备份失败，但继续更新...
    ) else (
        echo 备份完成
    )
) else (
    echo 未找到旧版本文件
)
echo.

echo [3/5] 复制新版本文件...
echo 源目录: {actualSourcePath}
echo 目标目录: {currentDir}
xcopy ""{actualSourcePath}\*"" ""{currentDir}\"" /E /Y /I /Q /H /R

if errorlevel 1 (
    echo.
    echo ========================================
    echo 错误: 文件复制失败！
    echo ========================================
    echo.
    echo 可能的原因:
    echo 1. 权限不足（需要管理员权限）
    echo 2. 文件被占用
    echo 3. 磁盘空间不足
    echo.
    
    if exist ""{currentDir}\V2rayZ.exe.backup"" (
        echo 正在恢复备份...
        copy /y ""{currentDir}\V2rayZ.exe.backup"" ""{currentDir}\V2rayZ.exe"" > nul 2>&1
        echo 已恢复到旧版本
    )
    echo.
    echo 按任意键退出...
    pause > nul
    exit /b 1
)
echo 文件复制完成
echo.

echo [4/5] 启动新版本...
start """" ""{currentDir}\V2rayZ.exe""
echo 新版本已启动
echo.

echo [5/5] 清理临时文件...
timeout /t 2 /nobreak > nul
rd /s /q ""{_tempDir}"" > nul 2>&1
echo 清理完成
echo.

echo ========================================
echo 更新完成！
echo ========================================
timeout /t 2 /nobreak > nul
del /f /q ""%~f0"" > nul 2>&1
exit
";

            File.WriteAllText(updateScriptPath, updateScript, System.Text.Encoding.UTF8);

            OnProgressChanged(new UpdateProgress
            {
                Status = UpdateStatus.Installing,
                Message = "正在启动更新程序..."
            });

            // 启动更新脚本
            // 检查是否需要管理员权限
            var needsAdmin = IsDirectoryWritable(currentDir);
            
            var startInfo = new ProcessStartInfo
            {
                FileName = updateScriptPath,
                UseShellExecute = true,
                WorkingDirectory = _tempDir,
                WindowStyle = ProcessWindowStyle.Normal // 显示窗口以便用户看到进度
            };

            // 如果需要管理员权限，请求提升
            if (!needsAdmin)
            {
                startInfo.Verb = "runas";
                _logger.Information("请求管理员权限执行更新脚本");
            }

            Process.Start(startInfo);

            _logger.Information("更新脚本已启动，准备退出当前应用");
            
            // 延迟一下让更新脚本启动
            await Task.Delay(500);

            // 退出当前应用程序
            System.Windows.Application.Current.Shutdown();

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

            Process.Start(startInfo);

            _logger.Information("安装程序已启动（{Extension}），准备退出当前应用", fileExtension);
            
            // 延迟一下让安装程序启动
            await Task.Delay(1000);

            // 退出当前应用程序
            System.Windows.Application.Current.Shutdown();

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