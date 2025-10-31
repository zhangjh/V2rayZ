using System.Threading.Tasks;

namespace V2rayClient.Services;

/// <summary>
/// Interface for GeoData update service
/// </summary>
public interface IGeoDataUpdateService
{
    /// <summary>
    /// Check if GeoData files need updates
    /// </summary>
    Task<GeoDataUpdateInfo> CheckForUpdatesAsync();

    /// <summary>
    /// Download and update GeoData files
    /// </summary>
    Task<bool> UpdateGeoDataAsync(bool updateGeoIp = true, bool updateGeoSite = true);

    /// <summary>
    /// Get current GeoData file information
    /// </summary>
    GeoDataInfo GetGeoDataInfo();
}

/// <summary>
/// GeoData update information
/// </summary>
public class GeoDataUpdateInfo
{
    public bool GeoIpNeedsUpdate { get; set; }
    public bool GeoSiteNeedsUpdate { get; set; }
    public string? GeoIpCurrentVersion { get; set; }
    public string? GeoIpLatestVersion { get; set; }
    public string? GeoSiteCurrentVersion { get; set; }
    public string? GeoSiteLatestVersion { get; set; }
    public DateTime? GeoIpLastModified { get; set; }
    public DateTime? GeoSiteLastModified { get; set; }
}

/// <summary>
/// GeoData file information
/// </summary>
public class GeoDataInfo
{
    public bool GeoIpExists { get; set; }
    public bool GeoSiteExists { get; set; }
    public long GeoIpSize { get; set; }
    public long GeoSiteSize { get; set; }
    public DateTime? GeoIpLastModified { get; set; }
    public DateTime? GeoSiteLastModified { get; set; }
}
