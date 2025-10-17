using System.ComponentModel.DataAnnotations;

namespace V2rayClient.Models;

/// <summary>
/// TLS configuration settings
/// </summary>
public class TlsSettings
{
    /// <summary>
    /// Server name indication
    /// </summary>
    [MaxLength(255)]
    public string? ServerName { get; set; }

    /// <summary>
    /// Allow insecure connections (skip certificate verification)
    /// </summary>
    public bool AllowInsecure { get; set; }

    /// <summary>
    /// ALPN protocols
    /// </summary>
    public List<string>? Alpn { get; set; }
}
