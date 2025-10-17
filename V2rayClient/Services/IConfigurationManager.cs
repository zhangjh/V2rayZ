using V2rayClient.Models;

namespace V2rayClient.Services;

/// <summary>
/// Interface for configuration management
/// </summary>
public interface IConfigurationManager
{
    /// <summary>
    /// Load configuration from file
    /// </summary>
    /// <returns>User configuration</returns>
    UserConfig LoadConfig();

    /// <summary>
    /// Save configuration to file
    /// </summary>
    /// <param name="config">Configuration to save</param>
    void SaveConfig(UserConfig config);

    /// <summary>
    /// Get a specific configuration value
    /// </summary>
    /// <typeparam name="T">Type of value</typeparam>
    /// <param name="key">Configuration key</param>
    /// <returns>Configuration value</returns>
    T? Get<T>(string key);

    /// <summary>
    /// Set a specific configuration value
    /// </summary>
    /// <param name="key">Configuration key</param>
    /// <param name="value">Value to set</param>
    void Set(string key, object value);

    /// <summary>
    /// Event raised when configuration changes
    /// </summary>
    event EventHandler<ConfigChangedEventArgs>? ConfigChanged;
}

/// <summary>
/// Event arguments for configuration changes
/// </summary>
public class ConfigChangedEventArgs : EventArgs
{
    public string? Key { get; set; }
    public object? OldValue { get; set; }
    public object? NewValue { get; set; }
}
