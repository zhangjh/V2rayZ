using System.ComponentModel;
using System.Runtime.CompilerServices;
using V2rayClient.Models;
using V2rayClient.Services;

namespace V2rayClient.ViewModels;

/// <summary>
/// Main application view model
/// </summary>
public class AppViewModel : INotifyPropertyChanged
{
    private readonly IV2rayManager _v2rayManager;
    private readonly IConfigurationManager _configManager;
    private readonly ISystemProxyManager _proxyManager;
    private readonly IStatisticsManager _statsManager;
    private readonly IRoutingRuleManager _routingManager;

    private ConnectionState _connection = new();
    private UserConfig _config = new();
    private TrafficStats _stats = new();

    public AppViewModel(
        IV2rayManager v2rayManager,
        IConfigurationManager configManager,
        ISystemProxyManager proxyManager,
        IStatisticsManager statsManager,
        IRoutingRuleManager routingManager)
    {
        _v2rayManager = v2rayManager;
        _configManager = configManager;
        _proxyManager = proxyManager;
        _statsManager = statsManager;
        _routingManager = routingManager;

        // Load initial configuration
        _config = _configManager.LoadConfig();

        // Subscribe to events
        _v2rayManager.ProcessStarted += OnProcessStarted;
        _v2rayManager.ProcessStopped += OnProcessStopped;
        _v2rayManager.ProcessError += OnProcessError;
        _statsManager.StatsUpdated += OnStatsUpdated;
    }

    public ConnectionState Connection
    {
        get => _connection;
        set
        {
            _connection = value;
            OnPropertyChanged();
        }
    }

    public UserConfig Config
    {
        get => _config;
        set
        {
            _config = value;
            OnPropertyChanged();
        }
    }

    public TrafficStats Stats
    {
        get => _stats;
        set
        {
            _stats = value;
            OnPropertyChanged();
        }
    }

    private void OnProcessStarted(object? sender, V2rayEventArgs e)
    {
        Connection = new ConnectionState
        {
            Status = ConnectionStatus.Connected,
            ConnectedAt = DateTime.Now
        };
    }

    private void OnProcessStopped(object? sender, V2rayEventArgs e)
    {
        Connection = new ConnectionState
        {
            Status = ConnectionStatus.Disconnected
        };
    }

    private void OnProcessError(object? sender, V2rayErrorEventArgs e)
    {
        Connection = new ConnectionState
        {
            Status = ConnectionStatus.Error,
            Error = e.ErrorMessage
        };
    }

    private void OnStatsUpdated(object? sender, TrafficStats e)
    {
        Stats = e;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected virtual void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
