using System.Diagnostics;
using System.Threading;
using V2rayClient.Models;

namespace V2rayClient.Services;

/// <summary>
/// Manages traffic statistics from v2ray-core
/// </summary>
public class StatisticsManager : IStatisticsManager
{
    private readonly object _statsLock = new();
    private System.Threading.Timer? _monitoringTimer;
    private bool _disposed;
    private bool _isMonitoring;

    // Accumulated statistics
    private long _totalUpload;
    private long _totalDownload;
    
    // For speed calculation
    private long _lastUpload;
    private long _lastDownload;
    private DateTime _lastUpdateTime;

    // V2ray stats client
    private V2rayStatsClient? _statsClient;
    private readonly string _apiAddress = "http://127.0.0.1:10085";

    public event EventHandler<TrafficStats>? StatsUpdated;

    public StatisticsManager()
    {
        _lastUpdateTime = DateTime.Now;
    }

    /// <inheritdoc/>
    public TrafficStats GetStats()
    {
        lock (_statsLock)
        {
            return new TrafficStats
            {
                UploadTotal = _totalUpload,
                DownloadTotal = _totalDownload,
                UploadSpeed = CalculateSpeed(_totalUpload, _lastUpload),
                DownloadSpeed = CalculateSpeed(_totalDownload, _lastDownload)
            };
        }
    }

    /// <inheritdoc/>
    public void ResetStats()
    {
        lock (_statsLock)
        {
            Debug.WriteLine("Resetting traffic statistics");
            
            _totalUpload = 0;
            _totalDownload = 0;
            _lastUpload = 0;
            _lastDownload = 0;
            _lastUpdateTime = DateTime.Now;

            // Notify listeners
            StatsUpdated?.Invoke(this, GetStats());
        }
    }

    /// <inheritdoc/>
    public Task StartMonitoringAsync()
    {
        if (_isMonitoring)
        {
            Debug.WriteLine("Statistics monitoring is already running");
            return Task.CompletedTask;
        }

        Debug.WriteLine("Starting statistics monitoring");

        try
        {
            // Create stats client
            _statsClient = new V2rayStatsClient(_apiAddress);

            _isMonitoring = true;

            // Start periodic monitoring (every 1 second)
            _monitoringTimer = new System.Threading.Timer(
                async _ => await QueryStatsAsync(),
                null,
                TimeSpan.Zero,
                TimeSpan.FromSeconds(1)
            );

            Debug.WriteLine("Statistics monitoring started");
            return Task.CompletedTask;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to start statistics monitoring: {ex.Message}");
            _isMonitoring = false;
            throw;
        }
    }

    /// <inheritdoc/>
    public void StopMonitoring()
    {
        if (!_isMonitoring)
        {
            Debug.WriteLine("Statistics monitoring is not running");
            return;
        }

        Debug.WriteLine("Stopping statistics monitoring");

        _monitoringTimer?.Dispose();
        _monitoringTimer = null;

        _statsClient?.Dispose();
        _statsClient = null;

        _isMonitoring = false;

        Debug.WriteLine("Statistics monitoring stopped");
    }

    private async Task QueryStatsAsync()
    {
        if (!_isMonitoring || _statsClient == null)
            return;

        try
        {
            // Query stats from v2ray API
            // In v2ray, stats are tracked per inbound/outbound with tags like:
            // - inbound>>>socks-in>>>traffic>>>uplink
            // - inbound>>>socks-in>>>traffic>>>downlink
            // - outbound>>>proxy>>>traffic>>>uplink
            // - outbound>>>proxy>>>traffic>>>downlink

            var (upload, download) = await _statsClient.GetTotalTrafficAsync();

            lock (_statsLock)
            {
                var now = DateTime.Now;
                var timeDelta = (now - _lastUpdateTime).TotalSeconds;

                if (timeDelta > 0)
                {
                    // Store previous values for speed calculation
                    _lastUpload = _totalUpload;
                    _lastDownload = _totalDownload;

                    // Update totals
                    _totalUpload = upload;
                    _totalDownload = download;

                    _lastUpdateTime = now;

                    // Notify listeners
                    StatsUpdated?.Invoke(this, GetStats());
                }
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Error querying statistics: {ex.Message}");
            // Don't throw - just log and continue monitoring
        }
    }

    private long CalculateSpeed(long current, long previous)
    {
        if (current <= previous)
            return 0;

        var delta = current - previous;
        
        // Speed is bytes per second
        // Since we query every second, delta is approximately the speed
        return delta;
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        StopMonitoring();
        
        _disposed = true;
        GC.SuppressFinalize(this);
    }
}
