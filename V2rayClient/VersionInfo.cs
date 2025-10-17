namespace V2rayClient;

/// <summary>
/// Contains version and build information for the application
/// </summary>
public static class VersionInfo
{
    /// <summary>
    /// Application version (Major.Minor.Patch)
    /// </summary>
    public const string Version = "1.0.0";

    /// <summary>
    /// Application version with build number (Major.Minor.Patch.Build)
    /// </summary>
    public const string FullVersion = "1.0.0.0";

    /// <summary>
    /// Application name
    /// </summary>
    public const string ApplicationName = "V2rayZ";

    /// <summary>
    /// Application description
    /// </summary>
    public const string Description = "A modern Windows client for v2ray with VLESS protocol support";

    /// <summary>
    /// Copyright information
    /// </summary>
    public const string Copyright = "Copyright © 2025 V2rayZ Project";

    /// <summary>
    /// Company name
    /// </summary>
    public const string Company = "V2rayZ Project";

    /// <summary>
    /// GitHub repository URL
    /// </summary>
    public const string RepositoryUrl = "https://github.com/v2rayz/v2rayz";

    /// <summary>
    /// Build date (set during build process)
    /// </summary>
    public static readonly string BuildDate = GetBuildDate();

    /// <summary>
    /// Gets the build date from the assembly
    /// </summary>
    private static string GetBuildDate()
    {
        var assembly = typeof(VersionInfo).Assembly;
        var buildDate = System.IO.File.GetLastWriteTime(assembly.Location);
        return buildDate.ToString("yyyy-MM-dd HH:mm:ss");
    }

    /// <summary>
    /// Gets the full version string with build date
    /// </summary>
    public static string GetFullVersionString()
    {
        return $"{ApplicationName} v{Version} (Build: {BuildDate})";
    }

    /// <summary>
    /// Gets the version string for display in UI
    /// </summary>
    public static string GetDisplayVersion()
    {
        return $"v{Version}";
    }
}
