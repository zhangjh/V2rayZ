using System.ComponentModel.DataAnnotations;

namespace V2rayClient.Models;

/// <summary>
/// User application configuration
/// </summary>
public class UserConfig
{
    /// <summary>
    /// Server configuration
    /// </summary>
    [Required(ErrorMessage = "服务器配置不能为空")]
    public ServerConfig Server { get; set; } = new();

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
}
