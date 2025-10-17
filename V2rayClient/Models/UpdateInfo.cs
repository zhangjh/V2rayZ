namespace V2rayClient.Models;

/// <summary>
/// 更新信息模型
/// </summary>
public class UpdateInfo
{
    /// <summary>
    /// 版本号
    /// </summary>
    public string Version { get; set; } = string.Empty;

    /// <summary>
    /// 发布标题
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// 更新说明
    /// </summary>
    public string ReleaseNotes { get; set; } = string.Empty;

    /// <summary>
    /// 下载链接
    /// </summary>
    public string DownloadUrl { get; set; } = string.Empty;

    /// <summary>
    /// 文件大小（字节）
    /// </summary>
    public long FileSize { get; set; }

    /// <summary>
    /// 发布时间
    /// </summary>
    public DateTime PublishedAt { get; set; }

    /// <summary>
    /// 是否为预发布版本
    /// </summary>
    public bool IsPrerelease { get; set; }

    /// <summary>
    /// 检查是否有新版本
    /// </summary>
    /// <param name="currentVersion">当前版本</param>
    /// <returns>是否有新版本</returns>
    public bool IsNewerThan(string currentVersion)
    {
        try
        {
            // 标准化版本号格式，确保至少有两个部分
            var normalizedCurrent = NormalizeVersion(currentVersion);
            var normalizedLatest = NormalizeVersion(Version.TrimStart('v'));
            
            var current = new Version(normalizedCurrent);
            var latest = new Version(normalizedLatest);
            return latest > current;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// 标准化版本号格式
    /// </summary>
    /// <param name="version">原始版本号</param>
    /// <returns>标准化后的版本号</returns>
    private static string NormalizeVersion(string version)
    {
        if (string.IsNullOrEmpty(version))
            return "0.0.0.0";

        var parts = version.Split('.');
        
        // 确保至少有4个部分 (Major.Minor.Build.Revision)
        var normalizedParts = new string[4];
        for (int i = 0; i < 4; i++)
        {
            if (i < parts.Length && int.TryParse(parts[i], out _))
            {
                normalizedParts[i] = parts[i];
            }
            else
            {
                normalizedParts[i] = "0";
            }
        }
        
        return string.Join(".", normalizedParts);
    }
}

/// <summary>
/// 更新状态枚举
/// </summary>
public enum UpdateStatus
{
    /// <summary>
    /// 检查中
    /// </summary>
    Checking,

    /// <summary>
    /// 无更新
    /// </summary>
    NoUpdate,

    /// <summary>
    /// 有可用更新
    /// </summary>
    UpdateAvailable,

    /// <summary>
    /// 下载中
    /// </summary>
    Downloading,

    /// <summary>
    /// 下载完成
    /// </summary>
    Downloaded,

    /// <summary>
    /// 安装中
    /// </summary>
    Installing,

    /// <summary>
    /// 错误
    /// </summary>
    Error
}

/// <summary>
/// 更新进度信息
/// </summary>
public class UpdateProgress
{
    /// <summary>
    /// 状态
    /// </summary>
    public UpdateStatus Status { get; set; }

    /// <summary>
    /// 进度百分比 (0-100)
    /// </summary>
    public int Percentage { get; set; }

    /// <summary>
    /// 状态消息
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// 错误信息
    /// </summary>
    public string? ErrorMessage { get; set; }
}