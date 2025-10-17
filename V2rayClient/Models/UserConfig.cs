using System.ComponentModel.DataAnnotations;

namespace V2rayClient.Models;

/// <summary>
/// User application configuration
/// </summary>
public class UserConfig
{
    /// <summary>
    /// List of server configurations
    /// </summary>
    public List<ServerConfigWithId> Servers { get; set; } = new();

    /// <summary>
    /// ID of the currently selected server
    /// </summary>
    public string? SelectedServerId { get; set; }

    /// <summary>
    /// Server configuration (legacy, for backward compatibility)
    /// </summary>
    [Obsolete("Use Servers and SelectedServerId instead")]
    public ServerConfig? Server { get; set; }

    /// <summary>
    /// Current proxy mode
    /// </summary>
    public ProxyMode ProxyMode { get; set; } = ProxyMode.Smart;

    /// <summary>
    /// Custom domain routing rules
    /// </summary>
    public List<DomainRule> CustomRules { get; set; } = new();

    /// <summary>
    /// Auto start on system boot
    /// </summary>
    public bool AutoStart { get; set; }

    /// <summary>
    /// Enable system proxy automatically on startup
    /// </summary>
    public bool AutoConnect { get; set; }

    /// <summary>
    /// Minimize to system tray on close
    /// </summary>
    public bool MinimizeToTray { get; set; } = true;

    /// <summary>
    /// Local SOCKS proxy port
    /// </summary>
    [Range(1024, 65535, ErrorMessage = "SOCKS 端口必须在 1024-65535 之间")]
    public int SocksPort { get; set; } = 65534;

    /// <summary>
    /// Local HTTP proxy port
    /// </summary>
    [Range(1024, 65535, ErrorMessage = "HTTP 端口必须在 1024-65535 之间")]
    public int HttpPort { get; set; } = 65533;

    /// <summary>
    /// Get the currently selected server configuration
    /// </summary>
    /// <returns>Selected server or null if none selected</returns>
    public ServerConfigWithId? GetSelectedServer()
    {
        if (string.IsNullOrEmpty(SelectedServerId))
            return null;

        return Servers.FirstOrDefault(s => s.Id == SelectedServerId);
    }
}
