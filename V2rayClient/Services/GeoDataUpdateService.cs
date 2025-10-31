using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using Serilog;

namespace V2rayClient.Services;

/// <summary>
/// Service for updating GeoData files (geoip.dat and geosite.dat)
/// </summary>
public class GeoDataUpdateService : IGeoDataUpdateService
{
    private readonly ILogger _logger;
    private readonly ResourceManager _resourceManager;
    private readonly HttpClient _httpClient;

    // GitHub release URLs for v2ray geodata
    private const string GeoIpUrl = "https://github.com/v2fly/geoip/releases/latest/download/geoip.dat";
    private const string GeoSiteUrl = "https://github.com/v2fly/domain-list-community/releases/latest/download/dlc.dat";

    public GeoDataUpdateService(ILogger logger, ResourceManager resourceManager)
    {
        _logger = logger;
        _resourceManager = resourceManager;
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromMinutes(5)
        };
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "V2rayZ/1.0");
    }

    /// <summary>
    /// Check if GeoData files need updates by comparing file dates
    /// </summary>
    public async Task<GeoDataUpdateInfo> CheckForUpdatesAsync()
    {
        try
        {
            _logger.Information("Checking for GeoData updates...");

            var info = new GeoDataUpdateInfo();
            var currentInfo = GetGeoDataInfo();

            // Check GeoIP
            if (currentInfo.GeoIpExists)
            {
                var remoteDate = await GetRemoteFileDateAsync(GeoIpUrl);
                info.GeoIpLastModified = currentInfo.GeoIpLastModified;
                info.GeoIpCurrentVersion = currentInfo.GeoIpLastModified?.ToString("yyyy-MM-dd");
                info.GeoIpLatestVersion = remoteDate?.ToString("yyyy-MM-dd");
                
                if (remoteDate.HasValue && currentInfo.GeoIpLastModified.HasValue)
                {
                    info.GeoIpNeedsUpdate = remoteDate.Value > currentInfo.GeoIpLastModified.Value;
                }
                else
                {
                    info.GeoIpNeedsUpdate = false;
                }
            }
            else
            {
                info.GeoIpNeedsUpdate = true;
            }

            // Check GeoSite
            if (currentInfo.GeoSiteExists)
            {
                var remoteDate = await GetRemoteFileDateAsync(GeoSiteUrl);
                info.GeoSiteLastModified = currentInfo.GeoSiteLastModified;
                info.GeoSiteCurrentVersion = currentInfo.GeoSiteLastModified?.ToString("yyyy-MM-dd");
                info.GeoSiteLatestVersion = remoteDate?.ToString("yyyy-MM-dd");
                
                if (remoteDate.HasValue && currentInfo.GeoSiteLastModified.HasValue)
                {
                    info.GeoSiteNeedsUpdate = remoteDate.Value > currentInfo.GeoSiteLastModified.Value;
                }
                else
                {
                    info.GeoSiteNeedsUpdate = false;
                }
            }
            else
            {
                info.GeoSiteNeedsUpdate = true;
            }

            _logger.Information("GeoData update check completed. GeoIP needs update: {GeoIpUpdate}, GeoSite needs update: {GeoSiteUpdate}",
                info.GeoIpNeedsUpdate, info.GeoSiteNeedsUpdate);

            return info;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to check for GeoData updates");
            throw;
        }
    }

    /// <summary>
    /// Download and update GeoData files
    /// </summary>
    public async Task<bool> UpdateGeoDataAsync(bool updateGeoIp = true, bool updateGeoSite = true)
    {
        try
        {
            _logger.Information("Starting GeoData update. GeoIP: {UpdateGeoIp}, GeoSite: {UpdateGeoSite}",
                updateGeoIp, updateGeoSite);

            var success = true;

            if (updateGeoIp)
            {
                _logger.Information("Downloading geoip.dat...");
                var geoIpSuccess = await DownloadFileAsync(GeoIpUrl, _resourceManager.GeoIpPath);
                if (geoIpSuccess)
                {
                    _logger.Information("geoip.dat updated successfully");
                }
                else
                {
                    _logger.Warning("Failed to update geoip.dat");
                    success = false;
                }
            }

            if (updateGeoSite)
            {
                _logger.Information("Downloading geosite.dat...");
                var geoSiteSuccess = await DownloadFileAsync(GeoSiteUrl, _resourceManager.GeoSitePath);
                if (geoSiteSuccess)
                {
                    _logger.Information("geosite.dat updated successfully");
                }
                else
                {
                    _logger.Warning("Failed to update geosite.dat");
                    success = false;
                }
            }

            return success;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to update GeoData files");
            return false;
        }
    }

    /// <summary>
    /// Get current GeoData file information
    /// </summary>
    public GeoDataInfo GetGeoDataInfo()
    {
        var info = new GeoDataInfo();

        try
        {
            var geoIpPath = _resourceManager.GeoIpPath;
            if (File.Exists(geoIpPath))
            {
                var fileInfo = new FileInfo(geoIpPath);
                info.GeoIpExists = true;
                info.GeoIpSize = fileInfo.Length;
                info.GeoIpLastModified = fileInfo.LastWriteTimeUtc;
            }

            var geoSitePath = _resourceManager.GeoSitePath;
            if (File.Exists(geoSitePath))
            {
                var fileInfo = new FileInfo(geoSitePath);
                info.GeoSiteExists = true;
                info.GeoSiteSize = fileInfo.Length;
                info.GeoSiteLastModified = fileInfo.LastWriteTimeUtc;
            }
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to get GeoData file information");
        }

        return info;
    }

    /// <summary>
    /// Get remote file last modified date
    /// </summary>
    private async Task<DateTime?> GetRemoteFileDateAsync(string url)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Head, url);
            using var response = await _httpClient.SendAsync(request);
            
            if (response.IsSuccessStatusCode && response.Content.Headers.LastModified.HasValue)
            {
                return response.Content.Headers.LastModified.Value.UtcDateTime;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "Failed to get remote file date for {Url}", url);
            return null;
        }
    }

    /// <summary>
    /// Download file from URL to local path
    /// </summary>
    private async Task<bool> DownloadFileAsync(string url, string targetPath)
    {
        var backupPath = targetPath + ".backup";
        
        try
        {
            // Create backup of existing file
            if (File.Exists(targetPath))
            {
                File.Copy(targetPath, backupPath, overwrite: true);
                _logger.Debug("Created backup at {BackupPath}", backupPath);
            }

            // Download to temporary file first
            var tempPath = targetPath + ".tmp";
            
            using (var response = await _httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead))
            {
                response.EnsureSuccessStatusCode();

                using var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None);
                await response.Content.CopyToAsync(fileStream);
            }

            // Replace original file with downloaded file
            File.Move(tempPath, targetPath, overwrite: true);
            
            // Delete backup if successful
            if (File.Exists(backupPath))
            {
                File.Delete(backupPath);
            }

            _logger.Information("Successfully downloaded {Url} to {TargetPath}", url, targetPath);
            return true;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to download file from {Url}", url);

            // Restore from backup if download failed
            if (File.Exists(backupPath))
            {
                try
                {
                    File.Copy(backupPath, targetPath, overwrite: true);
                    File.Delete(backupPath);
                    _logger.Information("Restored from backup");
                }
                catch (Exception restoreEx)
                {
                    _logger.Error(restoreEx, "Failed to restore from backup");
                }
            }

            return false;
        }
    }

    public void Dispose()
    {
        _httpClient?.Dispose();
    }
}
