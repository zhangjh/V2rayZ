using System.Text.Json.Serialization;

namespace V2rayClient.Models.V2ray;

/// <summary>
/// V2ray routing configuration
/// </summary>
public class Routing
{
    /// <summary>
    /// Domain resolution strategy
    /// </summary>
    [JsonPropertyName("domainStrategy")]
    public string DomainStrategy { get; set; } = "IPIfNonMatch";

    /// <summary>
    /// Routing rules
    /// </summary>
    [JsonPropertyName("rules")]
    public List<RoutingRule> Rules { get; set; } = new();
}

/// <summary>
/// Individual routing rule
/// </summary>
public class RoutingRule
{
    /// <summary>
    /// Rule type (typically "field")
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = "field";

    /// <summary>
    /// Domain matching rules
    /// </summary>
    [JsonPropertyName("domain")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Domain { get; set; }

    /// <summary>
    /// IP matching rules
    /// </summary>
    [JsonPropertyName("ip")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Ip { get; set; }

    /// <summary>
    /// Target outbound tag
    /// </summary>
    [JsonPropertyName("outboundTag")]
    public string OutboundTag { get; set; } = string.Empty;
}
