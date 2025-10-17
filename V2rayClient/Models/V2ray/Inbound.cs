using System.Text.Json.Serialization;

namespace V2rayClient.Models.V2ray;

/// <summary>
/// V2ray inbound configuration
/// </summary>
public class Inbound
{
    /// <summary>
    /// Inbound tag identifier
    /// </summary>
    [JsonPropertyName("tag")]
    public string Tag { get; set; } = string.Empty;

    /// <summary>
    /// Protocol: socks, http, etc.
    /// </summary>
    [JsonPropertyName("protocol")]
    public string Protocol { get; set; } = string.Empty;

    /// <summary>
    /// Listen address
    /// </summary>
    [JsonPropertyName("listen")]
    public string Listen { get; set; } = "127.0.0.1";

    /// <summary>
    /// Listen port
    /// </summary>
    [JsonPropertyName("port")]
    public int Port { get; set; }

    /// <summary>
    /// Protocol-specific settings
    /// </summary>
    [JsonPropertyName("settings")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public InboundSettings? Settings { get; set; }
}
