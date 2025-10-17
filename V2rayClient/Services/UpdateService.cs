using System.Diagnostics;
using System.IO;
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

            // 查找Windows安装包
            var asset = latestRelease.Assets
                .FirstOrDefault(a => a.Name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ||
                                   a.Name.EndsWith(".msi", StringComparison.OrdinalIgnoreCase));

            if (asset != null)
            {
                updateInfo.DownloadUrl = asset.BrowserDownloadUrl;
                updateInfo.FileSize = asset.Size;
            }
            else
            {
                _logger.Warning("未找到Windows安装包");
                OnProgressChanged(new UpdateProgress
                {
                    Status = UpdateStatus.Error,
                    Message = "未找到Windows安装包",
                    ErrorMessage = "发布版本中没有找到.exe或.msi文件"
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
                Message = "正在启动安装程序..."
            });

            if (!File.Exists(installerPath))
            {
                throw new FileNotFoundException("安装包文件不存在", installerPath);
            }

            // 启动安装程序
            var startInfo = new ProcessStartInfo
            {
                FileName = installerPath,
                UseShellExecute = true,
                Verb = "runas" // 请求管理员权限
            };

            Process.Start(startInfo);

            _logger.Information("安装程序已启动，准备退出当前应用");
            
            // 延迟一下让安装程序启动
            await Task.Delay(2000);

            // 退出当前应用程序
            System.Windows.Application.Current.Shutdown();

            return true;
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