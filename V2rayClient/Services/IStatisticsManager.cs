using V2rayClient.Models;

namespace V2rayClient.Services;

/// <summary>
/// Interface for traffic statistics management
/// </summary>
public interface IStatisticsManager : IDisposable
{
    /// <summary>
    /// Get current traffic statistics
    /// </summary>
    TrafficStats GetStats();

    /// <summary>
    /// Reset all statistics
    /// </summary>
    void ResetStats();

    /// <summary>
    /// Start monitoring traffic statistics
    /// </summary>
    Task StartMonitoringAsync();

    /// <summary>
    /// Stop monitoring traffic statistics
    /// </summary>
    void StopMonitoring();

    /// <summary>
    /// Event raised when statistics are updated
    /// </summary>
    event EventHandler<TrafficStats>? StatsUpdated;
}
