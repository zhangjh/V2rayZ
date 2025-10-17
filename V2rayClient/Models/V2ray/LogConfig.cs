using System.Text.Json.Serialization;

namespace V2rayClient.Models.V2ray;

/// <summary>
/// V2ray log configuration
/// </summary>
public class LogConfig
{
    /// <summary>
    /// Log level: debug, info, warning, error, none
    /// </summary>
    [JsonPropertyName("loglevel")]
    public string LogLevel { get; set; } = "warning";

    /// <summary>
    /// Access log file path
    /// </summary>
    [JsonPropertyName("access")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Access { get; set; }

    /// <summary>
    /// Error log file path
    /// </summary>
    [JsonPropertyName("error")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Error { get; set; }
}
