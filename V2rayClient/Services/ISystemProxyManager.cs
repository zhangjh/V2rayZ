namespace V2rayClient.Services;

/// <summary>
/// Interface for managing Windows system proxy settings
/// </summary>
public interface ISystemProxyManager
{
    /// <summary>
    /// Enable system proxy with specified address and port
    /// </summary>
    /// <param name="proxyAddress">Proxy server address (e.g., "127.0.0.1")</param>
    /// <param name="proxyPort">Proxy server port</param>
    void EnableProxy(string proxyAddress, int proxyPort);

    /// <summary>
    /// Disable system proxy
    /// </summary>
    void DisableProxy();

    /// <summary>
    /// Get current system proxy status
    /// </summary>
    /// <returns>Current proxy status</returns>
    ProxyStatus GetProxyStatus();

    /// <summary>
    /// Set proxy bypass list (domains that should not use proxy)
    /// </summary>
    /// <param name="domains">Array of domains to bypass</param>
    void SetBypassList(string[] domains);
}

/// <summary>
/// Represents the current system proxy status
/// </summary>
public class ProxyStatus
{
    /// <summary>
    /// Whether system proxy is enabled
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Proxy server address and port (e.g., "127.0.0.1:65534")
    /// </summary>
    public string? Server { get; set; }

    /// <summary>
    /// List of domains that bypass the proxy
    /// </summary>
    public string[]? Bypass { get; set; }
}
