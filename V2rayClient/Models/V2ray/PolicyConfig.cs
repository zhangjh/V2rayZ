using System.Text.Json.Serialization;

namespace V2rayClient.Models.V2ray;

/// <summary>
/// V2ray policy configuration
/// </summary>
public class PolicyConfig
{
    /// <summary>
    /// System-level policy
    /// </summary>
    [JsonPropertyName("system")]
    public SystemPolicy? System { get; set; }
}

/// <summary>
/// System-level policy settings
/// </summary>
public class SystemPolicy
{
    /// <summary>
    /// Enable statistics for inbound connections
    /// </summary>
    [JsonPropertyName("statsInboundUplink")]
    public bool StatsInboundUplink { get; set; } = true;

    /// <summary>
    /// Enable statistics for inbound connections
    /// </summary>
    [JsonPropertyName("statsInboundDownlink")]
    public bool StatsInboundDownlink { get; set; } = true;

    /// <summary>
    /// Enable statistics for outbound connections
    /// </summary>
    [JsonPropertyName("statsOutboundUplink")]
    public bool StatsOutboundUplink { get; set; } = true;

    /// <summary>
    /// Enable statistics for outbound connections
    /// </summary>
    [JsonPropertyName("statsOutboundDownlink")]
    public bool StatsOutboundDownlink { get; set; } = true;
}
