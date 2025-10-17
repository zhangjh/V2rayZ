using System;
using System.IO;
using System.Reflection;
using Serilog;

namespace V2rayClient.Services;

/// <summary>
/// Manages application resources including v2ray-core and GeoData files
/// </summary>
public class ResourceManager : IDisposable
{
    private readonly ILogger _logger;
    private readonly string _appDataPath;
    private readonly string _resourcesPath;

    public ResourceManager(ILogger logger)
    {
        _logger = logger;
        _appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "V2rayClient"
        );
        _resourcesPath = Path.Combine(_appDataPath, "resources");
    }

    /// <summary>
    /// Gets the path to the v2ray executable
    /// </summary>
    public string V2rayExePath => Path.Combine(_resourcesPath, "v2ray.exe");

    /// <summary>
    /// Gets the path to the geoip.dat file
    /// </summary>
    public string GeoIpPath => Path.Combine(_resourcesPath, "geoip.dat");

    /// <summary>
    /// Gets the path to the geosite.dat file
    /// </summary>
    public string GeoSitePath => Path.Combine(_resourcesPath, "geosite.dat");

    /// <summary>
    /// Initializes resources by extracting them to AppData if needed
    /// </summary>
    public void InitializeResources()
    {
        try
        {
            _logger.Information("Initializing application resources...");

            // Create directories if they don't exist
            Directory.CreateDirectory(_appDataPath);
            Directory.CreateDirectory(_resourcesPath);

            // Extract resources if they don't exist or are outdated
            ExtractResourceIfNeeded("v2ray.exe");
            ExtractResourceIfNeeded("geoip.dat");
            ExtractResourceIfNeeded("geosite.dat");

            _logger.Information("Resources initialized successfully");
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to initialize resources");
            throw new InvalidOperationException("Failed to initialize application resources", ex);
        }
    }

    /// <summary>
    /// Extracts a resource file from the application directory to AppData
    /// </summary>
    private void ExtractResourceIfNeeded(string fileName)
    {
        var targetPath = Path.Combine(_resourcesPath, fileName);
        var sourcePath = GetSourceResourcePath(fileName);

        // Check if source file exists
        if (!File.Exists(sourcePath))
        {
            _logger.Warning("Resource file not found: {FileName}", fileName);
            return;
        }

        // Extract if target doesn't exist or source is newer
        if (!File.Exists(targetPath) || IsSourceNewer(sourcePath, targetPath))
        {
            _logger.Information("Extracting resource: {FileName}", fileName);
            File.Copy(sourcePath, targetPath, overwrite: true);
            _logger.Information("Extracted {FileName} to {TargetPath}", fileName, targetPath);
        }
        else
        {
            _logger.Debug("Resource {FileName} is up to date", fileName);
        }
    }

    /// <summary>
    /// Gets the source path for a resource file
    /// </summary>
    private string GetSourceResourcePath(string fileName)
    {
        // First try to get from application directory
        var appDir = AppDomain.CurrentDomain.BaseDirectory;
        var resourcesDir = Path.Combine(appDir, "Resources");
        var filePath = Path.Combine(resourcesDir, fileName);

        if (File.Exists(filePath))
        {
            return filePath;
        }

        // Fallback to direct path in app directory
        filePath = Path.Combine(appDir, fileName);
        if (File.Exists(filePath))
        {
            return filePath;
        }

        throw new FileNotFoundException($"Resource file not found: {fileName}");
    }

    /// <summary>
    /// Checks if the source file is newer than the target file
    /// </summary>
    private bool IsSourceNewer(string sourcePath, string targetPath)
    {
        var sourceTime = File.GetLastWriteTimeUtc(sourcePath);
        var targetTime = File.GetLastWriteTimeUtc(targetPath);
        return sourceTime > targetTime;
    }

    /// <summary>
    /// Validates that all required resources are available
    /// </summary>
    public bool ValidateResources()
    {
        try
        {
            var requiredFiles = new[] { V2rayExePath, GeoIpPath, GeoSitePath };

            foreach (var file in requiredFiles)
            {
                if (!File.Exists(file))
                {
                    _logger.Warning("Required resource missing: {File}", file);
                    return false;
                }
            }

            _logger.Information("All required resources are available");
            return true;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to validate resources");
            return false;
        }
    }

    /// <summary>
    /// Gets the version of v2ray-core
    /// </summary>
    public string GetV2rayVersion()
    {
        try
        {
            if (!File.Exists(V2rayExePath))
            {
                return "Unknown";
            }

            var versionInfo = System.Diagnostics.FileVersionInfo.GetVersionInfo(V2rayExePath);
            return versionInfo.FileVersion ?? "Unknown";
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to get v2ray version");
            return "Unknown";
        }
    }

    /// <summary>
    /// Cleans up old resource files
    /// </summary>
    public void CleanupResources()
    {
        try
        {
            _logger.Information("Cleaning up resources...");

            if (Directory.Exists(_resourcesPath))
            {
                // Only clean up if we can re-extract
                var sourcePath = GetSourceResourcePath("v2ray.exe");
                if (File.Exists(sourcePath))
                {
                    Directory.Delete(_resourcesPath, recursive: true);
                    _logger.Information("Resources cleaned up successfully");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to cleanup resources");
        }
    }

    /// <summary>
    /// Dispose resources
    /// </summary>
    public void Dispose()
    {
        // ResourceManager doesn't hold any unmanaged resources
        // This is mainly for interface compliance
        GC.SuppressFinalize(this);
    }
}
