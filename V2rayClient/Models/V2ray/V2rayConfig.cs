using System.Text.Json.Serialization;

namespace V2rayClient.Models.V2ray;

/// <summary>
/// Complete V2ray configuration
/// </summary>
public class V2rayConfig
{
    /// <summary>
    /// Log configuration
    /// </summary>
    [JsonPropertyName("log")]
    public LogConfig Log { get; set; } = new();

    /// <summary>
    /// Inbound connections
    /// </summary>
    [JsonPropertyName("inbounds")]
    public List<Inbound> Inbounds { get; set; } = new();

    /// <summary>
    /// Outbound connections
    /// </summary>
    [JsonPropertyName("outbounds")]
    public List<Outbound> Outbounds { get; set; } = new();

    /// <summary>
    /// Routing rules
    /// </summary>
    [JsonPropertyName("routing")]
    public Routing Routing { get; set; } = new();

    /// <summary>
    /// Statistics configuration
    /// </summary>
    [JsonPropertyName("stats")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public StatsConfig? Stats { get; set; }

    /// <summary>
    /// API configuration
    /// </summary>
    [JsonPropertyName("api")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ApiConfig? Api { get; set; }

    /// <summary>
    /// Policy configuration
    /// </summary>
    [JsonPropertyName("policy")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public PolicyConfig? Policy { get; set; }
}
