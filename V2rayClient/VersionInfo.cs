namespace V2rayClient;

/// <summary>
/// V2rayZ 版本信息 - 简化版本管理
/// 只保留一个应用版本号，用于更新检查和显示
/// </summary>
public static class VersionInfo
{
    /// <summary>
    /// V2rayZ 应用版本号 - 唯一的版本号，用于更新检查
    /// 修改版本时只需要更新这个值
    /// </summary>
    public const string Version = "1.5.2";

    /// <summary>
    /// 应用程序名称
    /// </summary>
    public const string ApplicationName = "V2rayZ";

    /// <summary>
    /// 应用程序描述
    /// </summary>
    public const string Description = "A modern Windows client for v2ray with VLESS protocol support";

    /// <summary>
    /// 版权信息
    /// </summary>
    public const string Copyright = "Copyright © 2025 V2rayZ Project";

    /// <summary>
    /// 公司名称
    /// </summary>
    public const string Company = "V2rayZ Project";

    /// <summary>
    /// GitHub仓库地址
    /// </summary>
    public const string RepositoryUrl = "https://github.com/zhangjh/V2rayZ";

    // ========== 显示用方法 ==========
    
    /// <summary>
    /// 获取完整版本字符串
    /// </summary>
    public static string GetFullVersionString()
    {
        return $"{ApplicationName} v{Version}";
    }

    /// <summary>
    /// 获取UI显示用的版本字符串
    /// </summary>
    public static string GetDisplayVersion()
    {
        return $"v{Version}";
    }
}