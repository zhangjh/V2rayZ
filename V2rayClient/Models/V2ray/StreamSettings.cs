using System.Text.Json.Serialization;

namespace V2rayClient.Models.V2ray;

/// <summary>
/// V2ray stream settings for transport and security
/// </summary>
public class StreamSettings
{
    /// <summary>
    /// Network transport: tcp, ws, h2, etc.
    /// </summary>
    [JsonPropertyName("network")]
    public string Network { get; set; } = "tcp";

    /// <summary>
    /// Security type: none, tls
    /// </summary>
    [JsonPropertyName("security")]
    public string Security { get; set; } = "none";

    /// <summary>
    /// TLS settings
    /// </summary>
    [JsonPropertyName("tlsSettings")]
    public TlsStreamSettings? TlsSettings { get; set; }

    /// <summary>
    /// WebSocket settings
    /// </summary>
    [JsonPropertyName("wsSettings")]
    public WsStreamSettings? WsSettings { get; set; }
}

/// <summary>
/// TLS settings for stream
/// </summary>
public class TlsStreamSettings
{
    /// <summary>
    /// Server name indication
    /// </summary>
    [JsonPropertyName("serverName")]
    public string? ServerName { get; set; }

    /// <summary>
    /// Allow insecure connections
    /// </summary>
    [JsonPropertyName("allowInsecure")]
    public bool AllowInsecure { get; set; }

    /// <summary>
    /// ALPN protocols
    /// </summary>
    [JsonPropertyName("alpn")]
    public List<string>? Alpn { get; set; }
}

/// <summary>
/// WebSocket settings for stream
/// </summary>
public class WsStreamSettings
{
    /// <summary>
    /// WebSocket path
    /// </summary>
    [JsonPropertyName("path")]
    public string Path { get; set; } = "/";

    /// <summary>
    /// WebSocket headers
    /// </summary>
    [JsonPropertyName("headers")]
    public Dictionary<string, string>? Headers { get; set; }
}
