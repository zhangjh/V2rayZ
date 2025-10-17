namespace V2rayClient.Models;

/// <summary>
/// Traffic statistics
/// </summary>
public class TrafficStats
{
    /// <summary>
    /// Total uploaded bytes
    /// </summary>
    public long UploadTotal { get; set; }

    /// <summary>
    /// Total downloaded bytes
    /// </summary>
    public long DownloadTotal { get; set; }

    /// <summary>
    /// Current upload speed (bytes per second)
    /// </summary>
    public long UploadSpeed { get; set; }

    /// <summary>
    /// Current download speed (bytes per second)
    /// </summary>
    public long DownloadSpeed { get; set; }
}
