using System;
using System.IO;
using System.Reflection;
using Serilog;

namespace V2rayClient.Services;

/// <summary>
/// Manages application resources including sing-box and GeoData files
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
            "V2rayZ"
        );
        _resourcesPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources");
    }

    /// <summary>
    /// Gets the path to the sing-box executable
    /// </summary>
    public string SingBoxExePath => Path.Combine(_resourcesPath, "sing-box.exe");

    /// <summary>
    /// Gets the path to the geosite directory for sing-box rule sets
    /// </summary>
    public string GeositeDir => Path.Combine(_resourcesPath, "geosite");

    /// <summary>
    /// Initializes resources by creating necessary directories
    /// </summary>
    public void InitializeResources()
    {
        try
        {
            _logger.Information("Initializing application resources...");

            // Create user data directory for configuration files
            Directory.CreateDirectory(_appDataPath);

            _logger.Information("Resources initialized successfully");
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to initialize resources");
            throw new InvalidOperationException("Failed to initialize application resources", ex);
        }
    }



    /// <summary>
    /// Validates that all required resources are available
    /// </summary>
    public bool ValidateResources()
    {
        try
        {
            var requiredFiles = new[] 
            { 
                SingBoxExePath,
                Path.Combine(GeositeDir, "geosite-cn.srs"),
                Path.Combine(GeositeDir, "geosite-geolocation-!cn.srs"),
                Path.Combine(GeositeDir, "geoip-cn.srs")
            };

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
    /// Gets the version of sing-box
    /// </summary>
    public string GetSingBoxVersion()
    {
        try
        {
            if (!File.Exists(SingBoxExePath))
            {
                return "Unknown";
            }

            // Execute sing-box with version command to get version information
            using var process = new System.Diagnostics.Process();
            process.StartInfo.FileName = SingBoxExePath;
            process.StartInfo.Arguments = "version";
            process.StartInfo.UseShellExecute = false;
            process.StartInfo.RedirectStandardOutput = true;
            process.StartInfo.RedirectStandardError = true;
            process.StartInfo.CreateNoWindow = true;
            process.StartInfo.WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden;

            process.Start();
            var output = process.StandardOutput.ReadToEnd();
            process.WaitForExit(5000); // Wait up to 5 seconds

            if (process.ExitCode == 0 && !string.IsNullOrEmpty(output))
            {
                // Parse version from output like "sing-box version 1.8.0"
                var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                if (lines.Length > 0)
                {
                    var versionLine = lines[0].Trim();
                    return versionLine;
                }
            }

            return "Unknown";
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to get sing-box version");
            return "Unknown";
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
