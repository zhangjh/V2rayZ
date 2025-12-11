using System.Text.Json.Serialization;

namespace V2rayClient.Models.SingBox;

/// <summary>
/// sing-box configuration root
/// </summary>
public class SingBoxConfig
{
    [JsonPropertyName("log")]
    public LogConfig? Log { get; set; }

    [JsonPropertyName("dns")]
    public DnsConfig? Dns { get; set; }

    [JsonPropertyName("inbounds")]
    public List<Inbound> Inbounds { get; set; } = new();

    [JsonPropertyName("outbounds")]
    public List<Outbound> Outbounds { get; set; } = new();

    [JsonPropertyName("route")]
    public RouteConfig? Route { get; set; }

    [JsonPropertyName("experimental")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ExperimentalConfig? Experimental { get; set; }
}

public class ExperimentalConfig
{
    [JsonPropertyName("cache_file")]
    public CacheFileConfig CacheFile { get; set; } = new();
}

public class CacheFileConfig
{
    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;

    [JsonPropertyName("path")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Path { get; set; }
}

public class LogConfig
{
    [JsonPropertyName("level")]
    public string Level { get; set; } = "info";

    [JsonPropertyName("timestamp")]
    public bool Timestamp { get; set; } = true;
}

public class DnsConfig
{
    [JsonPropertyName("servers")]
    public List<object> Servers { get; set; } = new();

    [JsonPropertyName("rules")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<object>? Rules { get; set; }

    [JsonPropertyName("final")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Final { get; set; }

    [JsonPropertyName("strategy")]
    public string Strategy { get; set; } = "prefer_ipv4";
}
