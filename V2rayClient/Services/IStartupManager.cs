namespace V2rayClient.Services;

/// <summary>
/// Interface for managing application startup behavior
/// </summary>
public interface IStartupManager
{
    /// <summary>
    /// Enable or disable auto-start on system boot
    /// </summary>
    /// <param name="enable">True to enable auto-start, false to disable</param>
    /// <returns>True if operation succeeded</returns>
    bool SetAutoStart(bool enable);

    /// <summary>
    /// Check if auto-start is currently enabled
    /// </summary>
    /// <returns>True if auto-start is enabled</returns>
    bool IsAutoStartEnabled();

    /// <summary>
    /// Handle auto-connect functionality on application startup
    /// </summary>
    /// <param name="config">User configuration</param>
    Task HandleAutoConnectAsync(Models.UserConfig config);
}