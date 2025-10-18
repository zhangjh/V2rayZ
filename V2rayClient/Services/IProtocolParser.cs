using V2rayClient.Models;

namespace V2rayClient.Services;

/// <summary>
/// Interface for parsing protocol URLs (vless://, trojan://)
/// </summary>
public interface IProtocolParser
{
    /// <summary>
    /// Parse a protocol URL and return server configuration
    /// </summary>
    /// <param name="url">Protocol URL (vless:// or trojan://)</param>
    /// <returns>Parsed server configuration</returns>
    ServerConfig ParseUrl(string url);

    /// <summary>
    /// Check if the URL is a supported protocol
    /// </summary>
    /// <param name="url">URL to check</param>
    /// <returns>True if supported, false otherwise</returns>
    bool IsSupported(string url);

    /// <summary>
    /// Get the protocol type from URL
    /// </summary>
    /// <param name="url">Protocol URL</param>
    /// <returns>Protocol type</returns>
    ProtocolType GetProtocolType(string url);
}