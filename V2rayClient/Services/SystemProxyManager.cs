using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace V2rayClient.Services;

/// <summary>
/// Manages Windows system proxy settings through registry manipulation
/// </summary>
public class SystemProxyManager : ISystemProxyManager
{
    private const string InternetSettingsKey = @"Software\Microsoft\Windows\CurrentVersion\Internet Settings";
    private const string ProxyEnableValueName = "ProxyEnable";
    private const string ProxyServerValueName = "ProxyServer";
    private const string ProxyOverrideValueName = "ProxyOverride";

    // P/Invoke constants for InternetSetOption
    private const int INTERNET_OPTION_SETTINGS_CHANGED = 39;
    private const int INTERNET_OPTION_REFRESH = 37;

    /// <summary>
    /// P/Invoke declaration for InternetSetOption to notify system of proxy changes
    /// </summary>
    [DllImport("wininet.dll", SetLastError = true)]
    private static extern bool InternetSetOption(
        IntPtr hInternet,
        int dwOption,
        IntPtr lpBuffer,
        int dwBufferLength);

    /// <inheritdoc/>
    public void EnableProxy(string proxyAddress, int proxyPort)
    {
        if (string.IsNullOrWhiteSpace(proxyAddress))
        {
            throw new ArgumentException("Proxy address cannot be null or empty", nameof(proxyAddress));
        }

        if (proxyPort <= 0 || proxyPort > 65535)
        {
            throw new ArgumentOutOfRangeException(nameof(proxyPort), "Port must be between 1 and 65535");
        }

        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(InternetSettingsKey, writable: true);
            
            if (key == null)
            {
                throw new InvalidOperationException("Unable to open Internet Settings registry key");
            }

            // Set proxy server address and port
            var proxyServer = $"{proxyAddress}:{proxyPort}";
            key.SetValue(ProxyServerValueName, proxyServer, RegistryValueKind.String);

            // Enable proxy
            key.SetValue(ProxyEnableValueName, 1, RegistryValueKind.DWord);

            Debug.WriteLine($"System proxy enabled: {proxyServer}");

            // Notify system of proxy settings change
            NotifyProxyChange();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to enable system proxy: {ex.Message}");
            throw new InvalidOperationException($"Failed to enable system proxy: {ex.Message}", ex);
        }
    }

    /// <inheritdoc/>
    public void DisableProxy()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(InternetSettingsKey, writable: true);
            
            if (key == null)
            {
                throw new InvalidOperationException("Unable to open Internet Settings registry key");
            }

            // Disable proxy
            key.SetValue(ProxyEnableValueName, 0, RegistryValueKind.DWord);

            Debug.WriteLine("System proxy disabled");

            // Notify system of proxy settings change
            NotifyProxyChange();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to disable system proxy: {ex.Message}");
            throw new InvalidOperationException($"Failed to disable system proxy: {ex.Message}", ex);
        }
    }

    /// <inheritdoc/>
    public ProxyStatus GetProxyStatus()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(InternetSettingsKey, writable: false);
            
            if (key == null)
            {
                return new ProxyStatus
                {
                    Enabled = false
                };
            }

            // Read proxy enable status
            var proxyEnable = key.GetValue(ProxyEnableValueName);
            var enabled = proxyEnable != null && Convert.ToInt32(proxyEnable) == 1;

            // Read proxy server
            var proxyServer = key.GetValue(ProxyServerValueName) as string;

            // Read proxy bypass list
            var proxyOverride = key.GetValue(ProxyOverrideValueName) as string;
            var bypass = string.IsNullOrWhiteSpace(proxyOverride)
                ? Array.Empty<string>()
                : proxyOverride.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);

            return new ProxyStatus
            {
                Enabled = enabled,
                Server = proxyServer,
                Bypass = bypass
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to get proxy status: {ex.Message}");
            throw new InvalidOperationException($"Failed to get proxy status: {ex.Message}", ex);
        }
    }

    /// <inheritdoc/>
    public void SetBypassList(string[] domains)
    {
        if (domains == null)
        {
            throw new ArgumentNullException(nameof(domains));
        }

        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(InternetSettingsKey, writable: true);
            
            if (key == null)
            {
                throw new InvalidOperationException("Unable to open Internet Settings registry key");
            }

            // Join domains with semicolon separator
            var bypassList = string.Join(";", domains);
            
            if (string.IsNullOrWhiteSpace(bypassList))
            {
                // If empty, remove the value
                key.DeleteValue(ProxyOverrideValueName, throwOnMissingValue: false);
            }
            else
            {
                key.SetValue(ProxyOverrideValueName, bypassList, RegistryValueKind.String);
            }

            Debug.WriteLine($"Proxy bypass list set: {bypassList}");

            // Notify system of proxy settings change
            NotifyProxyChange();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to set bypass list: {ex.Message}");
            throw new InvalidOperationException($"Failed to set bypass list: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Notify Windows that proxy settings have changed using InternetSetOption
    /// </summary>
    private void NotifyProxyChange()
    {
        try
        {
            // Notify that settings have changed
            InternetSetOption(IntPtr.Zero, INTERNET_OPTION_SETTINGS_CHANGED, IntPtr.Zero, 0);
            
            // Refresh settings
            InternetSetOption(IntPtr.Zero, INTERNET_OPTION_REFRESH, IntPtr.Zero, 0);

            Debug.WriteLine("System notified of proxy settings change");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to notify system of proxy change: {ex.Message}");
            // Don't throw here as the registry changes were successful
        }
    }
}
