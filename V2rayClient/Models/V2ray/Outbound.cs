using System.Text.Json.Serialization;

namespace V2rayClient.Models.V2ray;

/// <summary>
/// V2ray outbound configuration
/// </summary>
public class Outbound
{
    /// <summary>
    /// Outbound tag identifier
    /// </summary>
    [JsonPropertyName("tag")]
    public string Tag { get; set; } = string.Empty;

    /// <summary>
    /// Protocol: vless, freedom, blackhole, etc.
    /// </summary>
    [JsonPropertyName("protocol")]
    public string Protocol { get; set; } = string.Empty;

    /// <summary>
    /// Protocol-specific settings
    /// </summary>
    [JsonPropertyName("settings")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public OutboundSettings? Settings { get; set; }

    /// <summary>
    /// Stream settings (transport, security)
    /// </summary>
    [JsonPropertyName("streamSettings")]
    public StreamSettings? StreamSettings { get; set; }
}
