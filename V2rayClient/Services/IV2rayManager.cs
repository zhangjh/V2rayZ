using V2rayClient.Models;
using V2rayClient.Models.V2ray;

namespace V2rayClient.Services;

/// <summary>
/// Interface for V2ray process management
/// </summary>
public interface IV2rayManager : IDisposable
{
    /// <summary>
    /// Start v2ray core with the specified configuration
    /// </summary>
    /// <param name="config">V2ray configuration</param>
    Task StartAsync(V2rayConfig config);

    /// <summary>
    /// Stop v2ray core
    /// </summary>
    Task StopAsync();

    /// <summary>
    /// Restart v2ray core with new configuration
    /// </summary>
    /// <param name="config">V2ray configuration</param>
    Task RestartAsync(V2rayConfig config);

    /// <summary>
    /// Get current v2ray process status
    /// </summary>
    V2rayStatus GetStatus();

    /// <summary>
    /// Generate v2ray configuration from user configuration
    /// </summary>
    /// <param name="userConfig">User configuration</param>
    V2rayConfig GenerateConfig(UserConfig userConfig);

    /// <summary>
    /// Event raised when v2ray process starts
    /// </summary>
    event EventHandler<V2rayEventArgs>? ProcessStarted;

    /// <summary>
    /// Event raised when v2ray process stops
    /// </summary>
    event EventHandler<V2rayEventArgs>? ProcessStopped;

    /// <summary>
    /// Event raised when v2ray process encounters an error
    /// </summary>
    event EventHandler<V2rayErrorEventArgs>? ProcessError;
}

/// <summary>
/// V2ray process status information
/// </summary>
public class V2rayStatus
{
    /// <summary>
    /// Whether v2ray is currently running
    /// </summary>
    public bool Running { get; set; }

    /// <summary>
    /// Process ID (null if not running)
    /// </summary>
    public int? Pid { get; set; }

    /// <summary>
    /// Process uptime (null if not running)
    /// </summary>
    public TimeSpan? Uptime { get; set; }

    /// <summary>
    /// Error message (if status is error)
    /// </summary>
    public string? Error { get; set; }
}

/// <summary>
/// Event arguments for v2ray process events
/// </summary>
public class V2rayEventArgs : EventArgs
{
    public int ProcessId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.Now;
}

/// <summary>
/// Event arguments for v2ray process errors
/// </summary>
public class V2rayErrorEventArgs : V2rayEventArgs
{
    public string ErrorMessage { get; set; } = string.Empty;
    public Exception? Exception { get; set; }
}
