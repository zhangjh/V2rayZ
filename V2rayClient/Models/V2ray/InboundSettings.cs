using System.Text.Json.Serialization;

namespace V2rayClient.Models.V2ray;

/// <summary>
/// Inbound protocol settings
/// </summary>
public class InboundSettings
{
    /// <summary>
    /// Enable UDP support (for SOCKS)
    /// </summary>
    [JsonPropertyName("udp")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? Udp { get; set; }

    /// <summary>
    /// Authentication settings
    /// </summary>
    [JsonPropertyName("auth")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Auth { get; set; }

    /// <summary>
    /// Accounts for authentication
    /// </summary>
    [JsonPropertyName("accounts")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<Account>? Accounts { get; set; }

    /// <summary>
    /// Address (for dokodemo-door)
    /// </summary>
    [JsonPropertyName("address")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Address { get; set; }
}

/// <summary>
/// Account for inbound authentication
/// </summary>
public class Account
{
    /// <summary>
    /// Username
    /// </summary>
    [JsonPropertyName("user")]
    public string User { get; set; } = string.Empty;

    /// <summary>
    /// Password
    /// </summary>
    [JsonPropertyName("pass")]
    public string Pass { get; set; } = string.Empty;
}
