namespace V2rayClient.Models;

/// <summary>
/// Represents a log entry
/// </summary>
public class LogEntry
{
    /// <summary>
    /// Timestamp of the log entry
    /// </summary>
    public string Timestamp { get; set; } = string.Empty;

    /// <summary>
    /// Log level
    /// </summary>
    public LogLevel Level { get; set; }

    /// <summary>
    /// Log message
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Source of the log entry (optional)
    /// </summary>
    public string? Source { get; set; }
}