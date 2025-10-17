using System.IO;
using Serilog;
using Serilog.Events;

namespace V2rayClient.Services;

/// <summary>
/// 日志配置助手类
/// </summary>
public static class LoggerConfiguration
{
    /// <summary>
    /// 创建并配置 Serilog Logger
    /// </summary>
    public static ILogger CreateLogger(LogEventLevel minimumLevel = LogEventLevel.Information)
    {
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var logDirectory = Path.Combine(appDataPath, "V2rayZ", "logs");
        
        // 确保日志目录存在
        Directory.CreateDirectory(logDirectory);
        
        var logFilePath = Path.Combine(logDirectory, "v2ray-client-.log");
        
        return new Serilog.LoggerConfiguration()
            .MinimumLevel.Is(minimumLevel)
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("System", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithThreadId()
            .Enrich.WithMachineName()
            .WriteTo.File(
                logFilePath,
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] [{ThreadId}] {Message:lj}{NewLine}{Exception}"
            )
            .CreateLogger();
    }
    
    /// <summary>
    /// 获取日志文件目录
    /// </summary>
    public static string GetLogDirectory()
    {
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appDataPath, "V2rayZ", "logs");
    }
    
    /// <summary>
    /// 获取所有日志文件
    /// </summary>
    public static string[] GetLogFiles()
    {
        var logDirectory = GetLogDirectory();
        
        if (!Directory.Exists(logDirectory))
        {
            return Array.Empty<string>();
        }
        
        return Directory.GetFiles(logDirectory, "v2ray-client-*.log")
            .OrderByDescending(f => File.GetLastWriteTime(f))
            .ToArray();
    }
    
    /// <summary>
    /// 清除所有日志文件
    /// </summary>
    public static void ClearLogs()
    {
        var logFiles = GetLogFiles();
        
        foreach (var file in logFiles)
        {
            try
            {
                File.Delete(file);
            }
            catch
            {
                // 忽略删除失败的文件（可能正在使用）
            }
        }
    }
    
    /// <summary>
    /// 读取最新的日志文件内容
    /// </summary>
    public static string ReadLatestLog(int maxLines = 1000)
    {
        var logFiles = GetLogFiles();
        
        if (logFiles.Length == 0)
        {
            return "No log files found.";
        }
        
        try
        {
            var lines = File.ReadAllLines(logFiles[0]);
            var recentLines = lines.TakeLast(maxLines);
            return string.Join(Environment.NewLine, recentLines);
        }
        catch (Exception ex)
        {
            return $"Error reading log file: {ex.Message}";
        }
    }
}
