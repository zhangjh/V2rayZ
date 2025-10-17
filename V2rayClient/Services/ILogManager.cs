using V2rayClient.Models;

namespace V2rayClient.Services;

/// <summary>
/// Interface for managing application logs
/// </summary>
public interface ILogManager : IDisposable
{
    /// <summary>
    /// Event fired when a new log entry is received
    /// </summary>
    event EventHandler<LogEntry>? LogReceived;

    /// <summary>
    /// Add a log entry
    /// </summary>
    void AddLog(LogLevel level, string message, string? source = null);

    /// <summary>
    /// Get recent log entries
    /// </summary>
    List<LogEntry> GetLogs(int count = 100);

    /// <summary>
    /// Clear all log entries
    /// </summary>
    void ClearLogs();

    /// <summary>
    /// Start capturing V2ray logs
    /// </summary>
    void StartCapturing();

    /// <summary>
    /// Stop capturing V2ray logs
    /// </summary>
    void StopCapturing();
}