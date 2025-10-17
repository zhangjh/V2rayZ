using System.ComponentModel.DataAnnotations;

namespace V2rayClient.Models;

/// <summary>
/// Server configuration supporting multiple protocols (VLESS, Trojan)
/// This unified model contains fields for all supported protocols.
/// Only protocol-specific fields are validated and used based on the Protocol property.
/// </summary>
public class ServerConfig
{
    /// <summary>
    /// Protocol type (VLESS or Trojan)
    /// </summary>
    [Required]
    public ProtocolType Protocol { get; set; } = ProtocolType.Vless;

    /// <summary>
    /// Server address (domain or IP)
    /// </summary>
    [Required(ErrorMessage = "服务器地址不能为空")]
    [MaxLength(255)]
    public string Address { get; set; } = string.Empty;

    /// <summary>
    /// Server port
    /// </summary>
    [Required(ErrorMessage = "端口不能为空")]
    [Range(1, 65535, ErrorMessage = "端口必须在 1-65535 之间")]
    public int Port { get; set; }

    // VLESS specific fields (only used when Protocol = Vless)

    /// <summary>
    /// User UUID (for VLESS protocol only)
    /// Required when Protocol is Vless, ignored for other protocols
    /// </summary>
    [RequiredIf(nameof(Protocol), ProtocolType.Vless, ErrorMessage = "UUID 不能为空")]
    public string? Uuid { get; set; }

    /// <summary>
    /// Encryption method (for VLESS protocol only, typically "none")
    /// Only used when Protocol is Vless
    /// </summary>
    public string? Encryption { get; set; } = "none";

    // Trojan specific fields (only used when Protocol = Trojan)

    /// <summary>
    /// Password (for Trojan protocol only)
    /// Required when Protocol is Trojan, ignored for other protocols
    /// </summary>
    [RequiredIf(nameof(Protocol), ProtocolType.Trojan, ErrorMessage = "密码不能为空")]
    public string? Password { get; set; }

    // Common fields

    /// <summary>
    /// Network transport protocol
    /// </summary>
    public NetworkType Network { get; set; } = NetworkType.Tcp;

    /// <summary>
    /// Security/encryption type
    /// </summary>
    public SecurityType Security { get; set; } = SecurityType.None;

    /// <summary>
    /// TLS settings (when Security is Tls)
    /// </summary>
    public TlsSettings? TlsSettings { get; set; }

    /// <summary>
    /// WebSocket settings (when Network is Ws)
    /// </summary>
    public WsSettings? WsSettings { get; set; }
}
