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
    private UpdateService? _updateService;

    public MainWindow()
    {
        InitializeComponent();
        InitializeServices();
        InitializeSystemTray();
        InitializeAsync();
        
        // 启动时检查更新（延迟5秒）
        _ = Task.Delay(5000).ContinueWith(_ => CheckForUpdatesAsync());
        
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
        _updateService = new UpdateService();

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
                    startProxy: () => chrome.webview.hostObjects.nativeApi.StartProxy(),
                    stopProxy: () => chrome.webview.hostObjects.nativeApi.StopProxy(),
                    getConfig: () => chrome.webview.hostObjects.nativeApi.GetConfig(),
                    saveConfig: (configJson) => chrome.webview.hostObjects.nativeApi.SaveConfig(configJson),
                    updateProxyMode: (mode) => chrome.webview.hostObjects.nativeApi.UpdateProxyMode(mode),
                    switchServer: (serverId) => chrome.webview.hostObjects.nativeApi.SwitchServer(serverId),
                    getConnectionStatus: () => chrome.webview.hostObjects.nativeApi.GetConnectionStatus(),
                    getStatistics: () => chrome.webview.hostObjects.nativeApi.GetStatistics(),
                    resetStatistics: () => chrome.webview.hostObjects.nativeApi.ResetStatistics(),
                    addCustomRule: (ruleJson) => chrome.webview.hostObjects.nativeApi.AddCustomRule(ruleJson),
                    addCustomRulesBatch: (rulesJson) => chrome.webview.hostObjects.nativeApi.AddCustomRulesBatch(rulesJson),
                    updateCustomRule: (ruleJson) => chrome.webview.hostObjects.nativeApi.UpdateCustomRule(ruleJson),
                    deleteCustomRule: (ruleId) => chrome.webview.hostObjects.nativeApi.DeleteCustomRule(ruleId),
                    getLogs: (count) => chrome.webview.hostObjects.nativeApi.GetLogs(count),
                    clearLogs: () => chrome.webview.hostObjects.nativeApi.ClearLogs(),
                    getVersionInfo: () => chrome.webview.hostObjects.nativeApi.GetVersionInfo(),
                    checkForUpdates: () => chrome.webview.hostObjects.nativeApi.CheckForUpdates()
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
                // Handle special events
                if (eventName == "checkForUpdates")
                {
                    // Trigger update check from main window
                    _ = Task.Run(() => CheckForUpdatesAsync(true));
                    return;
                }

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
        // Create system tray icon (initially disconnected/gray)
        _notifyIcon = new NotifyIcon
        {
            Icon = LoadIcon(false), // Start with disconnected (gray) icon
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
        
        // Subscribe to configuration changes to update tray menu
        if (_configManager != null)
        {
            _configManager.ConfigChanged += OnConfigManagerConfigChanged;
        }
    }

    private void CreateTrayContextMenu()
    {
        var contextMenu = new ContextMenuStrip();

        // Status item (shows current status, enabled to allow color display)
        var statusItem = new ToolStripMenuItem("● 已断开")
        {
            Enabled = true, // Enable to allow custom colors to show
            Font = new Font(contextMenu.Font, System.Drawing.FontStyle.Bold),
            ForeColor = Color.Gray // Initial color for disconnected state
        };
        // Prevent clicking by not adding a click handler
        contextMenu.Items.Add(statusItem);
        contextMenu.Items.Add(new ToolStripSeparator());

        // Enable/Disable proxy toggle
        var toggleProxyItem = new ToolStripMenuItem("启用代理");
        toggleProxyItem.Click += OnToggleProxyClick;
        contextMenu.Items.Add(toggleProxyItem);
        contextMenu.Items.Add(new ToolStripSeparator());

        // Server selection submenu
        var serverSelectionItem = new ToolStripMenuItem("选择服务器");
        contextMenu.Items.Add(serverSelectionItem);
        
        // Initialize server selection submenu immediately
        UpdateServerSelectionMenu(serverSelectionItem);

        // Proxy mode submenu
        var proxyModeItem = new ToolStripMenuItem("代理模式");
        
        var globalModeItem = new ToolStripMenuItem("全局代理");
        globalModeItem.Click += (s, e) => OnProxyModeClick("Global");
        proxyModeItem.DropDownItems.Add(globalModeItem);

        var smartModeItem = new ToolStripMenuItem("智能分流");
        smartModeItem.Click += (s, e) => OnProxyModeClick("Smart");
        smartModeItem.Checked = true; // Default mode
        proxyModeItem.DropDownItems.Add(smartModeItem);

        var directModeItem = new ToolStripMenuItem("直连模式");
        directModeItem.Click += (s, e) => OnProxyModeClick("Direct");
        proxyModeItem.DropDownItems.Add(directModeItem);

        contextMenu.Items.Add(proxyModeItem);
        contextMenu.Items.Add(new ToolStripSeparator());

        // Open main window
        var openItem = new ToolStripMenuItem("打开主窗口");
        openItem.Click += (s, e) => ShowMainWindow();
        contextMenu.Items.Add(openItem);

        // Settings (opens main window to settings page)
        var settingsItem = new ToolStripMenuItem("打开设置");
        settingsItem.Click += (s, e) => ShowSettingsPage();
        contextMenu.Items.Add(settingsItem);

        // Check for updates
        var checkUpdateItem = new ToolStripMenuItem("检查更新");
        checkUpdateItem.Click += (s, e) => CheckForUpdatesAsync(true);
        contextMenu.Items.Add(checkUpdateItem);

        contextMenu.Items.Add(new ToolStripSeparator());

        // Exit
        var exitItem = new ToolStripMenuItem("退出");
        exitItem.Click += (s, e) => ExitApplication();
        contextMenu.Items.Add(exitItem);

        _notifyIcon!.ContextMenuStrip = contextMenu;

        // Store references for dynamic updates
        _notifyIcon.Tag = new
        {
            StatusItem = statusItem,
            ToggleProxyItem = toggleProxyItem,
            ServerSelectionItem = serverSelectionItem,
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
            MessageBox.Show($"切换代理失败: {ex.Message}", "错误", 
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
            MessageBox.Show($"更改代理模式失败: {ex.Message}", "错误", 
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

    private void OnConfigManagerConfigChanged(object? sender, Services.ConfigChangedEventArgs e)
    {
        // Update tray menu when configuration changes
        Dispatcher.Invoke(() =>
        {
            UpdateTrayMenu();
        });
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
                Models.ConnectionStatus.Connected => "已连接",
                Models.ConnectionStatus.Connecting => "连接中",
                Models.ConnectionStatus.Disconnected => "已断开",
                Models.ConnectionStatus.Error => "错误",
                _ => "未知"
            };

            var modeText = mode switch
            {
                Models.ProxyMode.Global => "全局代理",
                Models.ProxyMode.Smart => "智能分流",
                Models.ProxyMode.Direct => "直连模式",
                _ => ""
            };

            _notifyIcon.Text = $"V2rayZ - {statusText}" + 
                (status == Models.ConnectionStatus.Connected ? $" - {modeText}" : "");

            // Update icon based on connection status
            var isConnected = status == Models.ConnectionStatus.Connected;
            _notifyIcon.Icon = LoadIcon(isConnected);
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

            // Update status item with color
            ToolStripMenuItem statusItem = tag.StatusItem;
            statusItem.Text = status switch
            {
                Models.ConnectionStatus.Connected => "● 已连接",
                Models.ConnectionStatus.Connecting => "● 连接中...",
                Models.ConnectionStatus.Disconnected => "● 已断开",
                Models.ConnectionStatus.Error => "● 错误",
                _ => "● 未知"
            };
            
            // Set status item color based on connection state
            statusItem.ForeColor = status switch
            {
                Models.ConnectionStatus.Connected => Color.Green,
                Models.ConnectionStatus.Connecting => Color.Orange,
                Models.ConnectionStatus.Disconnected => Color.Gray,
                Models.ConnectionStatus.Error => Color.Red,
                _ => Color.Black
            };

            // Update toggle proxy item (no color change)
            ToolStripMenuItem toggleItem = tag.ToggleProxyItem;
            toggleItem.Text = isConnected ? "禁用代理" : "启用代理";

            // Update server selection submenu
            ToolStripMenuItem serverSelectionItem = tag.ServerSelectionItem;
            UpdateServerSelectionMenu(serverSelectionItem);

            // Update proxy mode checkmarks
            ToolStripMenuItem globalItem = tag.GlobalModeItem;
            ToolStripMenuItem smartItem = tag.SmartModeItem;
            ToolStripMenuItem directItem = tag.DirectModeItem;

            globalItem.Checked = mode == Models.ProxyMode.Global;
            smartItem.Checked = mode == Models.ProxyMode.Smart;
            directItem.Checked = mode == Models.ProxyMode.Direct;
        });
    }

    private void UpdateServerSelectionMenu(ToolStripMenuItem serverSelectionItem)
    {
        // Clear existing server items
        serverSelectionItem.DropDownItems.Clear();

        var config = _configManager?.LoadConfig();
        var isConnected = _viewModel?.Connection.Status == Models.ConnectionStatus.Connected;
        
        if (config?.Servers == null || config.Servers.Count == 0)
        {
            // No servers configured - show placeholder
            var noServersItem = new ToolStripMenuItem("未配置服务器")
            {
                Enabled = false
            };
            serverSelectionItem.DropDownItems.Add(noServersItem);
        }
        else
        {
            // Add server items
            foreach (var server in config.Servers)
            {
                var isSelected = server.Id == config.SelectedServerId;
                var serverItem = new ToolStripMenuItem($"{server.Name} ({server.Protocol})")
                {
                    Checked = isSelected,
                    Tag = server.Id
                };
                serverItem.Click += OnServerSelectionClick;
                serverSelectionItem.DropDownItems.Add(serverItem);
            }
            
            // Add separator before manage option
            serverSelectionItem.DropDownItems.Add(new ToolStripSeparator());
        }

        // Always add manage servers option at the bottom
        var manageServersItem = new ToolStripMenuItem("管理服务器...");
        manageServersItem.Click += (s, e) => ShowServersPage();
        serverSelectionItem.DropDownItems.Add(manageServersItem);
    }

    private void OnServerSelectionClick(object? sender, EventArgs e)
    {
        if (sender is not ToolStripMenuItem menuItem || menuItem.Tag is not string serverId)
            return;

        if (_nativeApi == null) return;

        try
        {
            // Use NativeApi to switch server (handles all the logic)
            var result = _nativeApi.SwitchServer(serverId);
            
            // Parse JSON response properly
            using var document = JsonDocument.Parse(result);
            var root = document.RootElement;
            
            if (!root.TryGetProperty("success", out var successElement) || !successElement.GetBoolean())
            {
                var error = "未知错误";
                if (root.TryGetProperty("error", out var errorElement))
                {
                    error = errorElement.GetString() ?? "未知错误";
                }
                
                MessageBox.Show($"切换服务器失败: {error}", "错误", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }

            // Update tray menu to reflect changes
            UpdateTrayMenu();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"选择服务器失败: {ex.Message}", "错误", 
                MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void ShowServersPage()
    {
        ShowMainWindow();
        
        // Send event to frontend to navigate to servers page
        SendEventToJavaScript("navigateToPage", "\"server\"");
    }

    private Icon LoadIcon(bool isConnected = false)
    {
        try
        {
            // Use different icons based on connection status
            var iconFileName = isConnected ? "app.ico" : "app-gray.ico";
            var iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", iconFileName);
            
            if (File.Exists(iconPath))
            {
                return new Icon(iconPath);
            }
            
            // Fallback to main icon if gray icon doesn't exist
            if (!isConnected)
            {
                var mainIconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", "app.ico");
                if (File.Exists(mainIconPath))
                {
                    // Create a grayscale version programmatically if gray icon doesn't exist
                    return CreateGrayscaleIcon(mainIconPath);
                }
            }
        }
        catch
        {
            // Ignore errors loading icon
        }

        // Return default icon if custom icon not found
        return SystemIcons.Application;
    }

    private Icon CreateGrayscaleIcon(string originalIconPath)
    {
        try
        {
            using var originalIcon = new Icon(originalIconPath);
            using var bitmap = originalIcon.ToBitmap();
            using var grayBitmap = new Bitmap(bitmap.Width, bitmap.Height);
            
            // Convert to grayscale using a more efficient method
            for (int x = 0; x < bitmap.Width; x++)
            {
                for (int y = 0; y < bitmap.Height; y++)
                {
                    var pixel = bitmap.GetPixel(x, y);
                    // Use standard grayscale conversion formula
                    var gray = (int)(pixel.R * 0.299 + pixel.G * 0.587 + pixel.B * 0.114);
                    var grayColor = Color.FromArgb(pixel.A, gray, gray, gray);
                    grayBitmap.SetPixel(x, y, grayColor);
                }
            }
            
            // Convert bitmap to icon
            var iconHandle = grayBitmap.GetHicon();
            var grayIcon = System.Drawing.Icon.FromHandle(iconHandle);
            
            return grayIcon;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to create grayscale icon: {ex.Message}");
            // If grayscale conversion fails, return original icon
            return new Icon(originalIconPath);
        }
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

    private void ShowSettingsPage()
    {
        ShowMainWindow();
        
        // Send event to frontend to navigate to settings page
        SendEventToJavaScript("navigateToPage", "\"settings\"");
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
        
        // 6. Unsubscribe from events
        try
        {
            if (_viewModel != null)
            {
                _viewModel.PropertyChanged -= OnViewModelPropertyChanged;
            }
            if (_configManager != null)
            {
                _configManager.ConfigChanged -= OnConfigManagerConfigChanged;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error unsubscribing from events: {ex.Message}");
        }
        
        // 7. Dispose system tray icon
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
            _updateService?.Dispose();
            
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

    /// <summary>
    /// 检查更新
    /// </summary>
    /// <param name="showNoUpdateMessage">是否显示无更新消息</param>
    private async Task CheckForUpdatesAsync(bool showNoUpdateMessage = false)
    {
        if (_updateService == null) return;

        try
        {
            // 检查是否跳过了某个版本
            var skippedVersion = GetSkippedVersion();
            
            var updateInfo = await _updateService.CheckForUpdateAsync(false);
            
            if (updateInfo == null)
            {
                if (showNoUpdateMessage)
                {
                    Dispatcher.Invoke(() =>
                    {
                        MessageBox.Show("当前已是最新版本！", "检查更新", 
                            MessageBoxButton.OK, MessageBoxImage.Information);
                    });
                }
                return;
            }

            // 如果用户跳过了这个版本，不显示更新提示
            if (!string.IsNullOrEmpty(skippedVersion) && skippedVersion == updateInfo.Version)
            {
                if (showNoUpdateMessage)
                {
                    Dispatcher.Invoke(() =>
                    {
                        MessageBox.Show($"发现新版本 {updateInfo.Version}，但您已选择跳过此版本。", "检查更新", 
                            MessageBoxButton.OK, MessageBoxImage.Information);
                    });
                }
                return;
            }

            // 显示更新窗口
            Dispatcher.Invoke(() =>
            {
                var updateWindow = new UpdateWindow(_updateService, updateInfo)
                {
                    Owner = this
                };
                updateWindow.ShowDialog();
            });
        }
        catch (Exception ex)
        {
            if (showNoUpdateMessage)
            {
                Dispatcher.Invoke(() =>
                {
                    MessageBox.Show($"检查更新失败: {ex.Message}", "错误", 
                        MessageBoxButton.OK, MessageBoxImage.Error);
                });
            }
        }
    }

    /// <summary>
    /// 获取跳过的版本
    /// </summary>
    private string? GetSkippedVersion()
    {
        try
        {
            var configDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "V2rayZ");
            var skippedVersionFile = Path.Combine(configDir, "skipped_version.txt");
            
            if (File.Exists(skippedVersionFile))
            {
                return File.ReadAllText(skippedVersionFile).Trim();
            }
        }
        catch
        {
            // 忽略错误
        }
        
        return null;
    }
}
