using V2rayClient.Models;
using V2rayClient.Models.SingBox;

namespace V2rayClient.Services;

/// <summary>
/// Interface for sing-box process management
/// </summary>
public interface IV2rayManager : IDisposable
{
    /// <summary>
    /// Start sing-box with the specified configuration
    /// </summary>
    /// <param name="config">sing-box configuration</param>
    /// <param name="userConfig">User configuration (required for mode determination)</param>
    Task StartAsync(SingBoxConfig config, UserConfig? userConfig = null);

    /// <summary>
    /// Stop sing-box
    /// </summary>
    Task StopAsync();

    /// <summary>
    /// Restart sing-box with new configuration
    /// </summary>
    /// <param name="config">sing-box configuration</param>
    Task RestartAsync(SingBoxConfig config);

    /// <summary>
    /// Get current sing-box process status
    /// </summary>
    V2rayStatus GetStatus();

    /// <summary>
    /// Generate sing-box configuration based on proxy mode
    /// </summary>
    /// <param name="userConfig">User configuration</param>
    /// <param name="proxyMode">Proxy mode type (SystemProxy or TUN)</param>
    SingBoxConfig GenerateSingBoxConfig(UserConfig userConfig, ProxyModeType proxyMode);

    /// <summary>
    /// Switch proxy mode between SystemProxy and TUN
    /// </summary>
    /// <param name="targetMode">Target proxy mode type</param>
    /// <param name="userConfig">User configuration</param>
    /// <param name="configManager">Configuration manager for saving config</param>
    /// <param name="proxyManager">System proxy manager for cleanup</param>
    /// <returns>True if switch was successful, false otherwise</returns>
    Task<bool> SwitchProxyModeAsync(
        ProxyModeType targetMode, 
        UserConfig userConfig, 
        IConfigurationManager configManager,
        ISystemProxyManager? proxyManager = null);

    /// <summary>
    /// Validate TUN mode availability and requirements
    /// </summary>
    /// <returns>Tuple containing validation result and error message if validation failed</returns>
    Task<(bool IsAvailable, string? ErrorMessage)> ValidateTunModeAsync();

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
