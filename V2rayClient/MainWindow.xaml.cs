using System.ComponentModel;
using System.Drawing;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using V2rayClient.Bridge;
using V2rayClient.Services;
using V2rayClient.ViewModels;
using MessageBox = System.Windows.MessageBox;

namespace V2rayClient;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window
{
    private NotifyIcon? _notifyIcon;
    private bool _isClosing = false;
    private NativeApi? _nativeApi;
    private AppViewModel? _viewModel;

    // Services (will be injected via DI in the future)
    private IV2rayManager? _v2rayManager;
    private IConfigurationManager? _configManager;
    private ISystemProxyManager? _proxyManager;
    private IStatisticsManager? _statsManager;
    private IRoutingRuleManager? _routingManager;
    private ILogManager? _logManager;

    public MainWindow()
    {
        InitializeComponent();
        InitializeServices();
        InitializeSystemTray();
        InitializeAsync();
        
        // Handle window state changes
        StateChanged += OnWindowStateChanged;
        Closing += OnWindowClosing;
        
        // Add keyboard shortcuts
        KeyDown += (s, e) =>
        {
            if (e.Key == System.Windows.Input.Key.F12)
            {
                webView.CoreWebView2?.OpenDevToolsWindow();
            }
            // Force exit with Ctrl+Alt+Q
            else if (e.Key == System.Windows.Input.Key.Q && 
                     System.Windows.Input.Keyboard.Modifiers == (System.Windows.Input.ModifierKeys.Control | System.Windows.Input.ModifierKeys.Alt))
            {
                System.Diagnostics.Debug.WriteLine("Force exit requested by user");
                ExitApplication();
            }
        };
    }

    private void InitializeServices()
    {
        // Initialize services
        // TODO: Replace with proper dependency injection
        _configManager = new ConfigurationManager();
        _proxyManager = new SystemProxyManager();
        _routingManager = new RoutingRuleManager();
        _logManager = new LogManager();
        _v2rayManager = new V2rayManager(_logManager, _routingManager);
        _statsManager = new StatisticsManager();

        // Create view model
        _viewModel = new AppViewModel(
            _v2rayManager,
            _configManager,
            _proxyManager,
            _statsManager,
            _routingManager
        );

        DataContext = _viewModel;
    }

    private async void InitializeAsync()
    {
        try
        {
            // Initialize WebView2
            await webView.EnsureCoreWebView2Async(null);

            // Set up WebView2 settings
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true; // Enable for debugging
            webView.CoreWebView2.Settings.AreDevToolsEnabled = true;
            webView.CoreWebView2.Settings.IsStatusBarEnabled = false;

            // Enable console message logging
            webView.CoreWebView2.WebMessageReceived += (s, e) =>
            {
                System.Diagnostics.Debug.WriteLine($"WebView Message: {e.WebMessageAsJson}");
            };

            // Log navigation events
            webView.CoreWebView2.NavigationStarting += (s, e) =>
            {
                System.Diagnostics.Debug.WriteLine($"Navigation Starting: {e.Uri}");
            };

            webView.CoreWebView2.NavigationCompleted += (s, e) =>
            {
                System.Diagnostics.Debug.WriteLine($"Navigation Completed: Success={e.IsSuccess}");
                // Temporarily disabled error dialog to prevent false positives
                // The app may work fine even if some resources fail to load
                /*
                if (!e.IsSuccess)
                {
                    MessageBox.Show($"Navigation failed!\nError: {e.WebErrorStatus}\n\nTry pressing F12 to open DevTools for more details.", 
                        "Navigation Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
                */
            };

            // Capture console messages
            webView.CoreWebView2.WebResourceResponseReceived += (s, e) =>
            {
                System.Diagnostics.Debug.WriteLine($"Resource Loaded: {e.Request.Uri} - Status: {e.Response.StatusCode}");
            };

            // Log resource loading for debugging
            webView.CoreWebView2.WebResourceRequested += (s, e) =>
            {
                System.Diagnostics.Debug.WriteLine($"Resource Requested: {e.Request.Uri}");
            };

            // Set up virtual host mapping for local files
            var wwwrootFolder = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
            System.Diagnostics.Debug.WriteLine($"wwwroot folder: {wwwrootFolder}");
            System.Diagnostics.Debug.WriteLine($"Folder exists: {Directory.Exists(wwwrootFolder)}");

            if (Directory.Exists(wwwrootFolder))
            {
                // Map the wwwroot folder to a virtual host
                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "app.local",
                    wwwrootFolder,
                    CoreWebView2HostResourceAccessKind.Allow
                );

                System.Diagnostics.Debug.WriteLine("Virtual host mapping set up successfully");

                // Set up JavaScript bridge
                SetupJavaScriptBridge();

                // Add DOM content loaded handler
                webView.CoreWebView2.DOMContentLoaded += (s, e) =>
                {
                    System.Diagnostics.Debug.WriteLine("DOM Content Loaded successfully");
                };

                // Navigate to the virtual host
                var url = "https://app.local/index.html";
                System.Diagnostics.Debug.WriteLine($"Navigating to: {url}");
                webView.CoreWebView2.Navigate(url);
            }
            else
            {
                // Show placeholder if React app is not built yet
                MessageBox.Show($"wwwroot folder not found at:\n{wwwrootFolder}\n\nPlease build the frontend first.", 
                    "Folder Not Found", MessageBoxButton.OK, MessageBoxImage.Warning);
                
                webView.NavigateToString(@"
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>V2rayZ</title>
                        <style>
                            body {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                                background: #f5f5f5;
                            }
                            .container {
                                text-align: center;
                                padding: 40px;
                                background: white;
                                border-radius: 8px;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                            }
                            h1 { color: #333; margin-bottom: 16px; }
                            p { color: #666; }
                        </style>
                    </head>
                    <body>
                        <div class='container'>
                            <h1>V2rayZ</h1>
                            <p>React UI is not built yet. Please build the frontend project.</p>
                            <p><code>cd V2rayClient.UI && npm run build</code></p>
                        </div>
                    </body>
                    </html>
                ");
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to initialize WebView2: {ex.Message}\n\nPlease ensure WebView2 Runtime is installed.", 
                "Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void SetupJavaScriptBridge()
    {
        if (_v2rayManager == null || _configManager == null || _proxyManager == null || 
            _statsManager == null || _routingManager == null || _logManager == null)
        {
            return;
        }

        // Create NativeApi instance with event callback
        _nativeApi = new NativeApi(
            _v2rayManager,
            _configManager,
            _proxyManager,
            _statsManager,
            _routingManager,
            _logManager,
            SendEventToJavaScript
        );

        // Add host object to script
        webView.CoreWebView2.AddHostObjectToScript("nativeApi", _nativeApi);

        // Add initialization script
        webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
            (function() {
                // Create a promise-based wrapper for the native API
                window.nativeApi = {
                    testBridge: () => chrome.webview.hostObjects.nativeApi.TestBridge(),
                    startProxy: () => chrome.webview.hostObjects.nativeApi.StartProxy(),
                    stopProxy: () => chrome.webview.hostObjects.nativeApi.StopProxy(),
                    getConfig: () => chrome.webview.hostObjects.nativeApi.GetConfig(),
                    saveConfig: (configJson) => chrome.webview.hostObjects.nativeApi.SaveConfig(configJson),
                    updateProxyMode: (mode) => chrome.webview.hostObjects.nativeApi.UpdateProxyMode(mode),
                    getConnectionStatus: () => chrome.webview.hostObjects.nativeApi.GetConnectionStatus(),
                    getStatistics: () => chrome.webview.hostObjects.nativeApi.GetStatistics(),
                    resetStatistics: () => chrome.webview.hostObjects.nativeApi.ResetStatistics(),
                    addCustomRule: (ruleJson) => chrome.webview.hostObjects.nativeApi.AddCustomRule(ruleJson),
                    addCustomRulesBatch: (rulesJson) => chrome.webview.hostObjects.nativeApi.AddCustomRulesBatch(rulesJson),
                    updateCustomRule: (ruleJson) => chrome.webview.hostObjects.nativeApi.UpdateCustomRule(ruleJson),
                    deleteCustomRule: (ruleId) => chrome.webview.hostObjects.nativeApi.DeleteCustomRule(ruleId),
                    getLogs: (count) => chrome.webview.hostObjects.nativeApi.GetLogs(count),
                    clearLogs: () => chrome.webview.hostObjects.nativeApi.ClearLogs(),
                    getVersionInfo: () => chrome.webview.hostObjects.nativeApi.GetVersionInfo()
                };

                // Event listener system
                window.nativeEventListeners = {};
                window.addEventListener('native-event', (e) => {
                    const { eventName, data } = e.detail;
                    if (window.nativeEventListeners[eventName]) {
                        window.nativeEventListeners[eventName].forEach(callback => {
                            try {
                                callback(JSON.parse(data));
                            } catch (err) {
                                console.error('Error in event listener:', err);
                            }
                        });
                    }
                });

                window.addNativeEventListener = (eventName, callback) => {
                    if (!window.nativeEventListeners[eventName]) {
                        window.nativeEventListeners[eventName] = [];
                    }
                    window.nativeEventListeners[eventName].push(callback);
                };

                window.removeNativeEventListener = (eventName, callback) => {
                    if (window.nativeEventListeners[eventName]) {
                        window.nativeEventListeners[eventName] = 
                            window.nativeEventListeners[eventName].filter(cb => cb !== callback);
                    }
                };

                console.log('Native API bridge initialized');
            })();
        ");
    }

    private void SendEventToJavaScript(string eventName, string data)
    {
        Dispatcher.Invoke(async () =>
        {
            try
            {
                var script = $@"
                    window.dispatchEvent(new CustomEvent('native-event', {{
                        detail: {{
                            eventName: '{eventName}',
                            data: {JsonSerializer.Serialize(data)}
                        }}
                    }}));
                ";
                await webView.CoreWebView2.ExecuteScriptAsync(script);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to send event to JavaScript: {ex.Message}");
            }
        });
    }

    private void InitializeSystemTray()
    {
        // Create system tray icon
        _notifyIcon = new NotifyIcon
        {
            Icon = LoadIcon(),
            Visible = true,
            Text = "V2rayZ - Disconnected"
        };

        // Double-click to show window
        _notifyIcon.DoubleClick += (s, e) => ShowMainWindow();

        // Create context menu
        CreateTrayContextMenu();

        // Subscribe to connection state changes to update tray icon
        if (_viewModel != null)
        {
            _viewModel.PropertyChanged += OnViewModelPropertyChanged;
        }
    }

    private void CreateTrayContextMenu()
    {
        var contextMenu = new ContextMenuStrip();

        // Status item (disabled, shows current status)
        var statusItem = new ToolStripMenuItem("● Disconnected")
        {
            Enabled = false,
            Font = new Font(contextMenu.Font, System.Drawing.FontStyle.Bold)
        };
        contextMenu.Items.Add(statusItem);
        contextMenu.Items.Add(new ToolStripSeparator());

        // Enable/Disable proxy toggle
        var toggleProxyItem = new ToolStripMenuItem("Enable Proxy");
        toggleProxyItem.Click += OnToggleProxyClick;
        contextMenu.Items.Add(toggleProxyItem);
        contextMenu.Items.Add(new ToolStripSeparator());

        // Proxy mode submenu
        var proxyModeItem = new ToolStripMenuItem("Proxy Mode");
        
        var globalModeItem = new ToolStripMenuItem("Global Proxy");
        globalModeItem.Click += (s, e) => OnProxyModeClick("Global");
        proxyModeItem.DropDownItems.Add(globalModeItem);

        var smartModeItem = new ToolStripMenuItem("Smart Routing");
        smartModeItem.Click += (s, e) => OnProxyModeClick("Smart");
        smartModeItem.Checked = true; // Default mode
        proxyModeItem.DropDownItems.Add(smartModeItem);

        var directModeItem = new ToolStripMenuItem("Direct Connection");
        directModeItem.Click += (s, e) => OnProxyModeClick("Direct");
        proxyModeItem.DropDownItems.Add(directModeItem);

        contextMenu.Items.Add(proxyModeItem);
        contextMenu.Items.Add(new ToolStripSeparator());

        // Open main window
        var openItem = new ToolStripMenuItem("Open Main Window");
        openItem.Click += (s, e) => ShowMainWindow();
        contextMenu.Items.Add(openItem);

        // Settings (opens main window to settings page)
        var settingsItem = new ToolStripMenuItem("Settings");
        settingsItem.Click += (s, e) => ShowMainWindow();
        contextMenu.Items.Add(settingsItem);

        contextMenu.Items.Add(new ToolStripSeparator());

        // Exit
        var exitItem = new ToolStripMenuItem("Exit");
        exitItem.Click += (s, e) => ExitApplication();
        contextMenu.Items.Add(exitItem);

        _notifyIcon!.ContextMenuStrip = contextMenu;

        // Store references for dynamic updates
        _notifyIcon.Tag = new
        {
            StatusItem = statusItem,
            ToggleProxyItem = toggleProxyItem,
            GlobalModeItem = globalModeItem,
            SmartModeItem = smartModeItem,
            DirectModeItem = directModeItem
        };
    }

    private void OnToggleProxyClick(object? sender, EventArgs e)
    {
        if (_nativeApi == null) return;

        try
        {
            var status = _v2rayManager?.GetStatus();
            if (status?.Running == true)
            {
                _nativeApi.StopProxy();
            }
            else
            {
                _nativeApi.StartProxy();
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to toggle proxy: {ex.Message}", "Error", 
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void OnProxyModeClick(string mode)
    {
        if (_nativeApi == null) return;

        try
        {
            _nativeApi.UpdateProxyMode(mode);
            UpdateTrayMenu();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to change proxy mode: {ex.Message}", "Error", 
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(AppViewModel.Connection))
        {
            UpdateTrayIcon();
            UpdateTrayMenu();
        }
        else if (e.PropertyName == nameof(AppViewModel.Config))
        {
            UpdateTrayMenu();
        }
    }

    private void UpdateTrayIcon()
    {
        if (_notifyIcon == null || _viewModel == null) return;

        Dispatcher.Invoke(() =>
        {
            var status = _viewModel.Connection.Status;
            var mode = _viewModel.Config.ProxyMode;

            // Update tooltip text
            var statusText = status switch
            {
                Models.ConnectionStatus.Connected => "Connected",
                Models.ConnectionStatus.Connecting => "Connecting",
                Models.ConnectionStatus.Disconnected => "Disconnected",
                Models.ConnectionStatus.Error => "Error",
                _ => "Unknown"
            };

            var modeText = mode switch
            {
                Models.ProxyMode.Global => "Global Proxy",
                Models.ProxyMode.Smart => "Smart Routing",
                Models.ProxyMode.Direct => "Direct Connection",
                _ => ""
            };

            _notifyIcon.Text = $"V2rayZ - {statusText}" + 
                (status == Models.ConnectionStatus.Connected ? $" - {modeText}" : "");

            // Update icon (you can add different icons for different states)
            // For now, we'll keep the same icon
        });
    }

    private void UpdateTrayMenu()
    {
        if (_notifyIcon?.ContextMenuStrip == null || _viewModel == null) return;

        Dispatcher.Invoke(() =>
        {
            var menu = _notifyIcon.ContextMenuStrip;
            var tag = _notifyIcon.Tag as dynamic;
            if (tag == null) return;

            var status = _viewModel.Connection.Status;
            var mode = _viewModel.Config.ProxyMode;
            var isConnected = status == Models.ConnectionStatus.Connected;

            // Update status item
            ToolStripMenuItem statusItem = tag.StatusItem;
            statusItem.Text = status switch
            {
                Models.ConnectionStatus.Connected => "● Connected",
                Models.ConnectionStatus.Connecting => "● Connecting...",
                Models.ConnectionStatus.Disconnected => "● Disconnected",
                Models.ConnectionStatus.Error => "● Error",
                _ => "● Unknown"
            };

            // Update toggle proxy item
            ToolStripMenuItem toggleItem = tag.ToggleProxyItem;
            toggleItem.Text = isConnected ? "Disable Proxy" : "Enable Proxy";

            // Update proxy mode checkmarks
            ToolStripMenuItem globalItem = tag.GlobalModeItem;
            ToolStripMenuItem smartItem = tag.SmartModeItem;
            ToolStripMenuItem directItem = tag.DirectModeItem;

            globalItem.Checked = mode == Models.ProxyMode.Global;
            smartItem.Checked = mode == Models.ProxyMode.Smart;
            directItem.Checked = mode == Models.ProxyMode.Direct;
        });
    }

    private Icon LoadIcon()
    {
        try
        {
            var iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", "app.ico");
            if (File.Exists(iconPath))
            {
                return new Icon(iconPath);
            }
        }
        catch
        {
            // Ignore errors loading icon
        }

        // Return default icon if custom icon not found
        return SystemIcons.Application;
    }

    private void OnWindowStateChanged(object? sender, EventArgs e)
    {
        // Minimize to tray when window is minimized
        if (WindowState == WindowState.Minimized)
        {
            Hide();
        }
    }

    private void OnWindowClosing(object? sender, CancelEventArgs e)
    {
        if (!_isClosing)
        {
            // Minimize to tray instead of closing
            e.Cancel = true;
            WindowState = WindowState.Minimized;
        }
    }

    private void ShowMainWindow()
    {
        Show();
        WindowState = WindowState.Normal;
        Activate();
    }

    public void ExitApplication()
    {
        _isClosing = true;
        
        System.Diagnostics.Debug.WriteLine("=== Starting application exit cleanup ===");
        
        try
        {
            // 1. Stop V2ray process first
            if (_v2rayManager != null)
            {
                var status = _v2rayManager.GetStatus();
                if (status.Running)
                {
                    System.Diagnostics.Debug.WriteLine("Stopping V2ray process...");
                    var stopTask = _v2rayManager.StopAsync();
                    if (!stopTask.Wait(TimeSpan.FromSeconds(10)))
                    {
                        System.Diagnostics.Debug.WriteLine("V2ray stop timeout, forcing termination");
                    }
                }
            }
            
            // 2. Disable system proxy
            if (_proxyManager != null)
            {
                var proxyStatus = _proxyManager.GetProxyStatus();
                if (proxyStatus.Enabled)
                {
                    System.Diagnostics.Debug.WriteLine("Disabling system proxy...");
                    _proxyManager.DisableProxy();
                }
            }
            
            // 3. Stop statistics monitoring
            if (_statsManager != null)
            {
                System.Diagnostics.Debug.WriteLine("Stopping statistics monitoring...");
                _statsManager.StopMonitoring();
            }
            
            // 4. Clean up WebView2
            if (webView?.CoreWebView2 != null)
            {
                System.Diagnostics.Debug.WriteLine("Cleaning up WebView2...");
                try
                {
                    // Remove host objects
                    webView.CoreWebView2.RemoveHostObjectFromScript("nativeApi");
                    
                    // Unsubscribe from events
                    webView.CoreWebView2.NavigationStarting -= null;
                    webView.CoreWebView2.NavigationCompleted -= null;
                    webView.CoreWebView2.WebResourceResponseReceived -= null;
                    
                    // Navigate to about:blank to release resources
                    webView.CoreWebView2.Navigate("about:blank");
                }
                catch (Exception webViewEx)
                {
                    System.Diagnostics.Debug.WriteLine($"WebView2 cleanup error: {webViewEx.Message}");
                }
            }
            
            // 5. Kill any remaining V2ray processes
            KillRemainingV2rayProcesses();
            
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error during cleanup: {ex.Message}");
            // Continue with exit even if cleanup fails
        }
        
        // 6. Dispose system tray icon
        try
        {
            if (_notifyIcon != null)
            {
                _notifyIcon.Visible = false;
                _notifyIcon.Dispose();
                _notifyIcon = null;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error disposing tray icon: {ex.Message}");
        }
        
        System.Diagnostics.Debug.WriteLine("=== Application exit cleanup completed ===");
        
        // Force application shutdown
        System.Windows.Application.Current.Shutdown();
    }
    
    private void KillRemainingV2rayProcesses()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("Checking for remaining V2ray processes...");
            
            var processes = System.Diagnostics.Process.GetProcessesByName("v2ray");
            foreach (var process in processes)
            {
                try
                {
                    System.Diagnostics.Debug.WriteLine($"Killing V2ray process PID: {process.Id}");
                    process.Kill(true); // Kill entire process tree
                    process.WaitForExit(3000); // Wait up to 3 seconds
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Failed to kill V2ray process {process.Id}: {ex.Message}");
                }
                finally
                {
                    process.Dispose();
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error killing V2ray processes: {ex.Message}");
        }
    }

    protected override void OnClosed(EventArgs e)
    {
        System.Diagnostics.Debug.WriteLine("=== MainWindow OnClosed cleanup ===");
        
        try
        {
            // Dispose services in proper order
            System.Diagnostics.Debug.WriteLine("Disposing services...");
            
            // Stop monitoring first
            _statsManager?.StopMonitoring();
            
            // Dispose services
            _v2rayManager?.Dispose();
            _statsManager?.Dispose();
            _logManager?.Dispose();
            
            // Clear references
            _nativeApi = null;
            _viewModel = null;
            
            System.Diagnostics.Debug.WriteLine("Services disposed successfully");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error during window cleanup: {ex.Message}");
        }
        
        try
        {
            // Dispose WebView2
            if (webView != null)
            {
                System.Diagnostics.Debug.WriteLine("Disposing WebView2...");
                webView.Dispose();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error disposing WebView2: {ex.Message}");
        }
        
        try
        {
            // Final tray icon cleanup
            if (_notifyIcon != null)
            {
                _notifyIcon.Visible = false;
                _notifyIcon.Dispose();
                _notifyIcon = null;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error disposing tray icon in OnClosed: {ex.Message}");
        }
        
        System.Diagnostics.Debug.WriteLine("=== MainWindow OnClosed cleanup completed ===");
        base.OnClosed(e);
    }
}
