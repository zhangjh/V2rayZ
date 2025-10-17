using System.Collections.Concurrent;
using V2rayClient.Models;

namespace V2rayClient.Services;

/// <summary>
/// Manages application and V2ray logs
/// </summary>
public class LogManager : ILogManager
{
    private readonly ConcurrentQueue<LogEntry> _logs = new();
    private readonly object _lockObject = new();
    private bool _isCapturing = false;
    private bool _disposed = false;

    /// <summary>
    /// Event fired when a new log entry is received
    /// </summary>
    public event EventHandler<LogEntry>? LogReceived;

    public LogManager()
    {
        // Add initial system logs
        AddLog(LogLevel.Info, "日志管理器已启动", "system");
        AddLog(LogLevel.Info, "准备接收V2ray日志输出", "system");
    }

    /// <summary>
    /// Add a log entry
    /// </summary>
    public void AddLog(LogLevel level, string message, string? source = null)
    {
        if (_disposed) return;

        var logEntry = new LogEntry
        {
            Timestamp = DateTime.Now.ToString("HH:mm:ss.fff"),
            Level = level,
            Message = message,
            Source = source ?? "app"
        };

        _logs.Enqueue(logEntry);

        // Keep only the last 1000 logs to prevent memory issues
        while (_logs.Count > 1000)
        {
            _logs.TryDequeue(out _);
        }

        // Fire event
        LogReceived?.Invoke(this, logEntry);
    }

    /// <summary>
    /// Get recent log entries
    /// </summary>
    public List<LogEntry> GetLogs(int count = 100)
    {
        if (_disposed) return new List<LogEntry>();

        lock (_lockObject)
        {
            var logs = _logs.ToArray();
            return logs.TakeLast(count).ToList();
        }
    }

    /// <summary>
    /// Clear all log entries
    /// </summary>
    public void ClearLogs()
    {
        if (_disposed) return;

        lock (_lockObject)
        {
            _logs.Clear();
        }

        AddLog(LogLevel.Info, "Logs cleared", "system");
    }

    /// <summary>
    /// Start capturing V2ray logs
    /// </summary>
    public void StartCapturing()
    {
        if (_disposed || _isCapturing) return;

        _isCapturing = true;
        AddLog(LogLevel.Info, "Log capturing started", "system");
    }

    /// <summary>
    /// Stop capturing V2ray logs
    /// </summary>
    public void StopCapturing()
    {
        if (_disposed || !_isCapturing) return;

        _isCapturing = false;
        AddLog(LogLevel.Info, "Log capturing stopped", "system");
    }

    /// <summary>
    /// Dispose resources
    /// </summary>
    public void Dispose()
    {
        if (_disposed) return;

        _disposed = true;
        StopCapturing();
        _logs.Clear();
    }
}