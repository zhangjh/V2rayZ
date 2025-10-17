using System.Text.Json.Serialization;

namespace V2rayClient.Models.V2ray;

/// <summary>
/// Outbound protocol settings
/// </summary>
public class OutboundSettings
{
    /// <summary>
    /// VLESS/VMess server list
    /// </summary>
    [JsonPropertyName("vnext")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<VnextServer>? Vnext { get; set; }

    /// <summary>
    /// Trojan server list
    /// </summary>
    [JsonPropertyName("servers")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<TrojanServer>? Servers { get; set; }

    /// <summary>
    /// Domain override settings
    /// </summary>
    [JsonPropertyName("domainStrategy")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? DomainStrategy { get; set; }
}

/// <summary>
/// VLESS/VMess server configuration
/// </summary>
public class VnextServer
{
    /// <summary>
    /// Server address
    /// </summary>
    [JsonPropertyName("address")]
    public string Address { get; set; } = string.Empty;

    /// <summary>
    /// Server port
    /// </summary>
    [JsonPropertyName("port")]
    public int Port { get; set; }

    /// <summary>
    /// User list
    /// </summary>
    [JsonPropertyName("users")]
    public List<VlessUser> Users { get; set; } = new();
}

/// <summary>
/// VLESS user configuration
/// </summary>
public class VlessUser
{
    /// <summary>
    /// User UUID
    /// </summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Encryption method (for VLESS, typically "none")
    /// </summary>
    [JsonPropertyName("encryption")]
    public string Encryption { get; set; } = "none";

    /// <summary>
    /// Flow control (for VLESS XTLS)
    /// </summary>
    [JsonPropertyName("flow")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Flow { get; set; }
}

/// <summary>
/// Trojan server configuration
/// </summary>
public class TrojanServer
{
    /// <summary>
    /// Server address
    /// </summary>
    [JsonPropertyName("address")]
    public string Address { get; set; } = string.Empty;

    /// <summary>
    /// Server port
    /// </summary>
    [JsonPropertyName("port")]
    public int Port { get; set; }

    /// <summary>
    /// Password for authentication
    /// </summary>
    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// Email (optional identifier)
    /// </summary>
    [JsonPropertyName("email")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Email { get; set; }
}
