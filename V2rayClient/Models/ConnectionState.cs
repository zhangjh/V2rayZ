namespace V2rayClient.Models;

/// <summary>
/// Current connection state
/// </summary>
public class ConnectionState
{
    /// <summary>
    /// Connection status
    /// </summary>
    public ConnectionStatus Status { get; set; } = ConnectionStatus.Disconnected;

    /// <summary>
    /// Error message if status is Error
    /// </summary>
    public string? Error { get; set; }

    /// <summary>
    /// Connection start time
    /// </summary>
    public DateTime? ConnectedAt { get; set; }

    /// <summary>
    /// Current proxy mode type (SystemProxy or Tun)
    /// </summary>
    public ProxyModeType ProxyModeType { get; set; } = ProxyModeType.SystemProxy;
}
