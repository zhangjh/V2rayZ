using Microsoft.Win32;
using Serilog;
using V2rayClient.Models;

namespace V2rayClient.Services;

/// <summary>
/// Manages application startup behavior including auto-start and auto-connect
/// </summary>
public class StartupManager : IStartupManager
{
    private readonly ILogger _logger;
    private readonly IV2rayManager _v2rayManager;
    private readonly ISystemProxyManager _proxyManager;
    private const string REGISTRY_KEY = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
    private const string APP_NAME = "V2rayZ";

    public StartupManager(ILogger logger, IV2rayManager v2rayManager, ISystemProxyManager proxyManager)
    {
        _logger = logger;
        _v2rayManager = v2rayManager;
        _proxyManager = proxyManager;
    }

    /// <summary>
    /// Enable or disable auto-start on system boot
    /// </summary>
    public bool SetAutoStart(bool enable)
    {
        try
        {
            _logger.Information("[StartupManager] Setting auto-start to: {Enable}", enable);

            using var key = Registry.CurrentUser.OpenSubKey(REGISTRY_KEY, true);
            if (key == null)
            {
                _logger.Error("[StartupManager] Failed to open registry key: {RegistryKey}", REGISTRY_KEY);
                return false;
            }

            if (enable)
            {
                // Add to startup
                var exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
                if (string.IsNullOrEmpty(exePath))
                {
                    _logger.Error("[StartupManager] Failed to get current executable path");
                    return false;
                }

                // Add --minimized argument for startup
                var startupCommand = $"\"{exePath}\" --minimized";
                key.SetValue(APP_NAME, startupCommand);
                _logger.Information("[StartupManager] Auto-start enabled with command: {Command}", startupCommand);
            }
            else
            {
                // Remove from startup
                key.DeleteValue(APP_NAME, false);
                _logger.Information("[StartupManager] Auto-start disabled");
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "[StartupManager] Failed to set auto-start: {Error}", ex.Message);
            return false;
        }
    }

    /// <summary>
    /// Check if auto-start is currently enabled
    /// </summary>
    public bool IsAutoStartEnabled()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(REGISTRY_KEY, false);
            if (key == null)
            {
                return false;
            }

            var value = key.GetValue(APP_NAME);
            var isEnabled = value != null;
            
            _logger.Debug("[StartupManager] Auto-start status: {IsEnabled}", isEnabled);
            return isEnabled;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "[StartupManager] Failed to check auto-start status: {Error}", ex.Message);
            return false;
        }
    }

    /// <summary>
    /// Handle auto-connect functionality on application startup
    /// </summary>
    public async Task HandleAutoConnectAsync(UserConfig config)
    {
        try
        {
            _logger.Information("[StartupManager] Handling auto-connect, enabled: {AutoConnect}", config.AutoConnect);

            if (!config.AutoConnect)
            {
                _logger.Information("[StartupManager] Auto-connect is disabled");
                return;
            }

            // Check if we have a selected server
            var selectedServer = config.GetSelectedServer();
            if (selectedServer == null)
            {
                _logger.Warning("[StartupManager] Auto-connect enabled but no server selected");
                return;
            }

            _logger.Information("[StartupManager] Auto-connecting to server: {ServerName}", selectedServer.Name);

            // Wait a bit for the application to fully initialize
            await Task.Delay(2000);

            // Generate sing-box configuration based on proxy mode type
            var singBoxConfig = _v2rayManager.GenerateSingBoxConfig(config, config.ProxyModeType);
            
            // Start sing-box with the configuration
            await _v2rayManager.StartAsync(singBoxConfig, config);
            
            // Wait a bit for V2ray to start
            await Task.Delay(1000);
            
            // Check if V2ray started successfully
            var status = _v2rayManager.GetStatus();
            if (!status.Running)
            {
                _logger.Error("[StartupManager] Failed to start V2ray for auto-connect");
                return;
            }

            // Enable system proxy based on proxy mode
            if (config.ProxyMode != ProxyMode.Direct)
            {
                try
                {
                    _proxyManager.EnableProxy("127.0.0.1", config.HttpPort);
                    _logger.Information("[StartupManager] Auto-connect completed successfully");
                }
                catch (Exception ex)
                {
                    _logger.Error(ex, "[StartupManager] Failed to enable system proxy for auto-connect: {Error}", ex.Message);
                    // Don't return here, V2ray is still running
                }
            }
            else
            {
                _logger.Information("[StartupManager] Auto-connect completed (Direct mode, no system proxy)");
            }
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "[StartupManager] Error during auto-connect: {Error}", ex.Message);
        }
    }
}