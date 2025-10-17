using System.Text.Json.Serialization;

namespace V2rayClient.Models.V2ray;

/// <summary>
/// V2ray API configuration
/// </summary>
public class ApiConfig
{
    /// <summary>
    /// API tag (must match an inbound tag)
    /// </summary>
    [JsonPropertyName("tag")]
    public string Tag { get; set; } = "api";

    /// <summary>
    /// Enabled services
    /// </summary>
    [JsonPropertyName("services")]
    public List<string> Services { get; set; } = new() { "StatsService" };
}
