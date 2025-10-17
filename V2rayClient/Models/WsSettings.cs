namespace V2rayClient.Models;

/// <summary>
/// WebSocket transport settings
/// </summary>
public class WsSettings
{
    /// <summary>
    /// WebSocket path (e.g., "/?ed=2048")
    /// </summary>
    public string? Path { get; set; } = "/";

    /// <summary>
    /// WebSocket host header for masquerading
    /// </summary>
    public string? Host { get; set; }
}