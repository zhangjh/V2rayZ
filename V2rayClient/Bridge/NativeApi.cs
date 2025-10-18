using System.Runtime.InteropServices;
using System.Text.Json;
using System.ComponentModel.DataAnnotations;
using System.IO;
using V2rayClient.Models;
using V2rayClient.Services;

namespace V2rayClient.Bridge;

/// <summary>
/// Native API exposed to JavaScript through WebView2
/// This class provides the bridge between React UI and C# backend
/// </summary>
[ClassInterface(ClassInterfaceType.AutoDual)]
[ComVisible(true)]
public class NativeApi
{
    private readonly IV2rayManager _v2rayManager;
    private readonly IConfigurationManager _configManager;
    private readonly ISystemProxyManager _proxyManager;
    private readonly IStatisticsManager _statsManager;
    private readonly IRoutingRuleManager _routingManager;
    private readonly ILogManager _logManager;
    private readonly IProtocolParser _protocolParser;
    private readonly Action<string, string> _sendEvent;
    
    // JSON serialization options for consistent camelCase naming
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true,
        ReadCommentHandling = System.Text.Json.JsonCommentHandling.Skip,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    public NativeApi(
        IV2rayManager v2rayManager,
        IConfigurationManager configManager,
        ISystemProxyManager proxyManager,
        IStatisticsManager statsManager,
        IRoutingRuleManager routingManager,
        ILogManager logManager,
        IProtocolParser protocolParser,
        Action<string, string> sendEvent)
    {
        _v2rayManager = v2rayManager;
        _configManager = configManager;
        _proxyManager = proxyManager;
        _statsManager = statsManager;
        _routingManager = routingManager;
        _logManager = logManager;
        _protocolParser = protocolParser;
        _sendEvent = sendEvent;

        // Subscribe to events
        _v2rayManager.ProcessStarted += OnProcessStarted;
        _v2rayManager.ProcessStopped += OnProcessStopped;
        _v2rayManager.ProcessError += OnProcessError;
        _configManager.ConfigChanged += OnConfigChanged;
        _statsManager.StatsUpdated += OnStatsUpdated;
        _logManager.LogReceived += OnLogReceived;
    }

    #region Proxy Control



    /// <summary>
    /// Start the proxy connection
    /// </summary>
    public string StartProxy()
    {
        System.Diagnostics.Debug.WriteLine("[NativeApi] ========== StartProxy ENTRY ==========");
        
        try
        {
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 1: Method entered");
            
            // Step 1: Load configuration
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 2: Loading configuration...");
            var config = _configManager.LoadConfig();
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 2 COMPLETE: Configuration loaded");
            
            // Step 2: Add log entry
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 3: Adding log entry...");
            _logManager.AddLog(Models.LogLevel.Info, "正在启动代理连接...", "system");
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 3 COMPLETE: Log entry added");
            
            // Step 3: Generate V2ray configuration
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 4: Generating V2ray configuration...");
            var v2rayConfig = _v2rayManager.GenerateConfig(config);
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 4 COMPLETE: V2ray configuration generated");
            
            // Step 4: Start V2ray process (non-blocking)
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 5: Starting V2ray process...");
            
            // Start V2ray asynchronously without blocking
            _ = Task.Run(async () =>
            {
                try
                {
                    await _v2rayManager.StartAsync(v2rayConfig);
                    System.Diagnostics.Debug.WriteLine("[NativeApi] V2ray startup completed successfully");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[NativeApi] V2ray startup failed: {ex.Message}");
                }
            });
            
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 5 COMPLETE: V2ray startup initiated (non-blocking)");
            
            // Step 5: Enable system proxy
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 6: Enabling system proxy...");
            _proxyManager.EnableProxy("127.0.0.1", config.HttpPort);
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 6 COMPLETE: System proxy enabled");
            
            // Step 6: Add success log
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 7: Adding success log...");
            _logManager.AddLog(Models.LogLevel.Info, "代理启动流程完成，连接状态将通过事件更新", "system");
            System.Diagnostics.Debug.WriteLine("[NativeApi] Step 7 COMPLETE: Success log added");
            
            System.Diagnostics.Debug.WriteLine("[NativeApi] ========== StartProxy SUCCESS ==========");
            return JsonSerializer.Serialize(new { success = true }, JsonOptions);
        }
        catch (AggregateException aex) when (aex.InnerException is NotSupportedException)
        {
            // Handle unsupported protocol error
            var innerEx = aex.InnerException;
            System.Diagnostics.Debug.WriteLine($"[API Error] Protocol not supported: {innerEx.Message}");
            
            // Ensure cleanup on error
            try
            {
                _v2rayManager.StopAsync().Wait();
                _proxyManager.DisableProxy();
            }
            catch { /* Ignore cleanup errors */ }
            
            return JsonSerializer.Serialize(new { success = false, error = innerEx.Message }, JsonOptions);
        }
        catch (AggregateException aex) when (aex.InnerException is InvalidOperationException)
        {
            // Handle invalid operation errors (including wrapped NotSupportedException)
            var innerEx = aex.InnerException;
            System.Diagnostics.Debug.WriteLine($"[API Error] Invalid operation: {innerEx.Message}");
            
            // Ensure cleanup on error
            try
            {
                _v2rayManager.StopAsync().Wait();
                _proxyManager.DisableProxy();
            }
            catch { /* Ignore cleanup errors */ }
            
            return JsonSerializer.Serialize(new { success = false, error = innerEx.Message }, JsonOptions);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[API Error] Failed to start proxy: {ex.Message}");
            System.Diagnostics.Debug.WriteLine($"[API Error] Exception type: {ex.GetType().Name}");
            System.Diagnostics.Debug.WriteLine($"[API Error] Stack trace: {ex.StackTrace}");
            
            // Ensure cleanup on error
            try
            {
                _v2rayManager.StopAsync().Wait();
                _proxyManager.DisableProxy();
            }
            catch { /* Ignore cleanup errors */ }
            
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Stop the proxy connection
    /// </summary>
    public string StopProxy()
    {
        try
        {
            _logManager.AddLog(Models.LogLevel.Info, "正在停止代理连接...", "system");
            
            // Stop statistics monitoring if it was started
            try
            {
                _statsManager.StopMonitoring();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[StopProxy] Statistics monitoring stop failed (non-critical): {ex.Message}");
            }
            
            // Disable system proxy immediately
            _proxyManager.DisableProxy();
            _logManager.AddLog(Models.LogLevel.Info, "系统代理已禁用", "system");
            
            // Stop V2ray asynchronously without blocking
            _ = Task.Run(async () =>
            {
                try
                {
                    await _v2rayManager.StopAsync();
                    _logManager.AddLog(Models.LogLevel.Info, "V2ray进程已停止", "system");
                    System.Diagnostics.Debug.WriteLine("[StopProxy] V2ray process stopped successfully");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[StopProxy] V2ray stop failed: {ex.Message}");
                    _logManager.AddLog(Models.LogLevel.Warning, $"V2ray停止时出现问题: {ex.Message}", "system");
                }
            });
            
            _logManager.AddLog(Models.LogLevel.Info, "代理连接已断开", "system");

            return JsonSerializer.Serialize(new { success = true }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Start statistics monitoring
    /// </summary>
    public string StartStatisticsMonitoring()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("[NativeApi] Starting statistics monitoring...");
            _statsManager.StartMonitoringAsync().Wait(TimeSpan.FromSeconds(10));
            System.Diagnostics.Debug.WriteLine("[NativeApi] Statistics monitoring started successfully");
            return JsonSerializer.Serialize(new { success = true }, JsonOptions);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Failed to start statistics monitoring: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    #endregion

    #region Configuration Management

    /// <summary>
    /// Get current user configuration
    /// </summary>
    public string GetConfig()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("[NativeApi] ========== GET CONFIG START ==========");
            var config = _configManager.LoadConfig();
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Loaded config - Servers count: {config.Servers?.Count ?? 0}");
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Selected server ID: {config.SelectedServerId}");
            
            var result = JsonSerializer.Serialize(new { success = true, data = config }, JsonOptions);
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Returning config JSON length: {result.Length}");
            System.Diagnostics.Debug.WriteLine("[NativeApi] ========== GET CONFIG END ==========");
            return result;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Get config failed: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }



    /// <summary>
    /// Test ConfigurationManager.LoadConfig() directly for debugging
    /// </summary>
    public string TestLoadConfig()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("[NativeApi] ========== TEST LOAD CONFIG START ==========");
            
            // Call LoadConfig directly and capture detailed info
            var config = _configManager.LoadConfig();
            
            var result = new
            {
                success = true,
                data = new
                {
                    serversCount = config.Servers?.Count ?? 0,
                    selectedServerId = config.SelectedServerId,
                    proxyMode = config.ProxyMode.ToString(),
                    servers = config.Servers?.Select(s => new {
                        id = s.Id,
                        name = s.Name,
                        protocol = s.Protocol.ToString(),
                        address = s.Address,
                        port = s.Port
                    }).ToArray()
                }
            };
            
            System.Diagnostics.Debug.WriteLine($"[NativeApi] LoadConfig result - Servers: {result.data.serversCount}");
            System.Diagnostics.Debug.WriteLine("[NativeApi] ========== TEST LOAD CONFIG END ==========");
            
            return JsonSerializer.Serialize(result, JsonOptions);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Test LoadConfig failed: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message, stackTrace = ex.StackTrace }, JsonOptions);
        }
    }

    /// <summary>
    /// Save user configuration
    /// </summary>
    public string SaveConfig(string configJson)
    {
        try
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] ========== SAVE CONFIG START ==========");
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Received JSON: {configJson}");
            
            if (string.IsNullOrEmpty(configJson))
            {
                return JsonSerializer.Serialize(new { success = false, error = "Configuration JSON is empty" }, JsonOptions);
            }

            var config = JsonSerializer.Deserialize<UserConfig>(configJson, JsonOptions);
            
            if (config == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Failed to deserialize configuration" }, JsonOptions);
            }

            // Log configuration info
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Servers count: {config.Servers?.Count ?? 0}");
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Selected server ID: {config.SelectedServerId}");
            System.Diagnostics.Debug.WriteLine($"[NativeApi] ProxyMode: {config.ProxyMode}");
            
            // Validate and save configuration
            _configManager.SaveConfig(config);
            
            System.Diagnostics.Debug.WriteLine("[NativeApi] Config saved successfully");
            System.Diagnostics.Debug.WriteLine($"[NativeApi] ========== SAVE CONFIG END ==========");
            return JsonSerializer.Serialize(new { success = true }, JsonOptions);
        }
        catch (ValidationException vex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Validation failed: {vex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = vex.Message }, JsonOptions);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Failed to save config: {ex.Message}");
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Exception type: {ex.GetType().Name}");
            System.Diagnostics.Debug.WriteLine($"[NativeApi] Stack trace: {ex.StackTrace}");
            if (ex.InnerException != null)
            {
                System.Diagnostics.Debug.WriteLine($"[NativeApi] Inner exception: {ex.InnerException.Message}");
            }
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Update proxy mode
    /// </summary>
    public string UpdateProxyMode(string mode)
    {
        try
        {
            var config = _configManager.LoadConfig();
            var oldMode = config.ProxyMode;
            config.ProxyMode = Enum.Parse<ProxyMode>(mode, true);
            _configManager.SaveConfig(config);
            _logManager.AddLog(Models.LogLevel.Info, $"代理模式已从 {oldMode} 切换到 {mode}", "config");

            // Restart proxy if running
            var status = _v2rayManager.GetStatus();
            if (status.Running)
            {
                var v2rayConfig = _v2rayManager.GenerateConfig(config);
                _v2rayManager.RestartAsync(v2rayConfig).Wait();
            }

            return JsonSerializer.Serialize(new { success = true }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Switch to a different server
    /// </summary>
    public string SwitchServer(string serverId)
    {
        try
        {
            var config = _configManager.LoadConfig();
            
            // Find the server
            var server = config.Servers?.FirstOrDefault(s => s.Id == serverId);
            if (server == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Server not found" }, JsonOptions);
            }

            var oldServerId = config.SelectedServerId;
            config.SelectedServerId = serverId;
            _configManager.SaveConfig(config);
            
            _logManager.AddLog(Models.LogLevel.Info, $"已切换到服务器: {server.Name}", "config");

            // Restart proxy if running
            var status = _v2rayManager.GetStatus();
            if (status.Running)
            {
                // Stop current connection
                _v2rayManager.StopAsync().Wait(TimeSpan.FromSeconds(5));
                
                // Start with new server configuration
                var v2rayConfig = _v2rayManager.GenerateConfig(config);
                _v2rayManager.StartAsync(v2rayConfig).Wait(TimeSpan.FromSeconds(10));
            }

            return JsonSerializer.Serialize(new { success = true }, JsonOptions);
        }
        catch (Exception ex)
        {
            _logManager.AddLog(Models.LogLevel.Error, $"切换服务器失败: {ex.Message}", "config");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Parse protocol URL and return server configuration
    /// </summary>
    public string ParseProtocolUrl(string url)
    {
        try
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] 解析协议URL: {url}");
            
            if (string.IsNullOrWhiteSpace(url))
            {
                return JsonSerializer.Serialize(new { success = false, error = "URL不能为空" }, JsonOptions);
            }

            if (!_protocolParser.IsSupported(url))
            {
                return JsonSerializer.Serialize(new { success = false, error = "不支持的协议类型" }, JsonOptions);
            }

            var serverConfig = _protocolParser.ParseUrl(url);
            
            System.Diagnostics.Debug.WriteLine($"[NativeApi] 协议解析成功: {serverConfig.Protocol}://{serverConfig.Address}:{serverConfig.Port}");
            
            return JsonSerializer.Serialize(new { success = true, data = serverConfig }, JsonOptions);
        }
        catch (ArgumentException ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] 协议解析参数错误: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
        catch (NotSupportedException ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] 不支持的协议: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] 协议解析失败: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = $"解析失败: {ex.Message}" }, JsonOptions);
        }
    }

    /// <summary>
    /// Add server from protocol URL
    /// </summary>
    public string AddServerFromUrl(string url, string name)
    {
        try
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] 从URL添加服务器: {url}, 名称: {name}");
            
            if (string.IsNullOrWhiteSpace(url))
            {
                return JsonSerializer.Serialize(new { success = false, error = "URL不能为空" }, JsonOptions);
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                return JsonSerializer.Serialize(new { success = false, error = "服务器名称不能为空" }, JsonOptions);
            }

            if (!_protocolParser.IsSupported(url))
            {
                return JsonSerializer.Serialize(new { success = false, error = "不支持的协议类型" }, JsonOptions);
            }

            var serverConfig = _protocolParser.ParseUrl(url);
            
            // 创建带ID的服务器配置
            var serverWithId = new ServerConfigWithId
            {
                Id = Guid.NewGuid().ToString(),
                Name = name,
                Protocol = serverConfig.Protocol,
                Address = serverConfig.Address,
                Port = serverConfig.Port,
                Uuid = serverConfig.Uuid,
                Encryption = serverConfig.Encryption,
                Password = serverConfig.Password,
                Network = serverConfig.Network,
                Security = serverConfig.Security,
                TlsSettings = serverConfig.TlsSettings,
                WsSettings = serverConfig.WsSettings,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // 加载配置并添加服务器
            var config = _configManager.LoadConfig();
            config.Servers ??= new List<ServerConfigWithId>();
            config.Servers.Add(serverWithId);
            
            // 如果这是第一个服务器，自动选择它
            if (config.Servers.Count == 1)
            {
                config.SelectedServerId = serverWithId.Id;
            }
            
            _configManager.SaveConfig(config);
            
            _logManager.AddLog(Models.LogLevel.Info, $"已添加服务器: {name} ({serverConfig.Protocol})", "config");
            
            System.Diagnostics.Debug.WriteLine($"[NativeApi] 服务器添加成功: {serverWithId.Id}");
            
            return JsonSerializer.Serialize(new { success = true, data = serverWithId }, JsonOptions);
        }
        catch (ArgumentException ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] 添加服务器参数错误: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
        catch (NotSupportedException ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] 不支持的协议: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NativeApi] 添加服务器失败: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = $"添加服务器失败: {ex.Message}" }, JsonOptions);
        }
    }

    #endregion

    #region Status and Statistics

    /// <summary>
    /// Get current connection status
    /// </summary>
    public string GetConnectionStatus()
    {
        try
        {
            var v2rayStatus = _v2rayManager.GetStatus();
            var proxyStatus = _proxyManager.GetProxyStatus();

            var status = new
            {
                v2ray = new
                {
                    running = v2rayStatus.Running,
                    pid = v2rayStatus.Pid,
                    uptime = v2rayStatus.Uptime?.TotalSeconds,
                    error = v2rayStatus.Error
                },
                proxy = new
                {
                    enabled = proxyStatus.Enabled,
                    server = proxyStatus.Server
                }
            };

            // Debug logging
            System.Diagnostics.Debug.WriteLine($"[GetConnectionStatus] V2ray running: {v2rayStatus.Running}, Proxy enabled: {proxyStatus.Enabled}");
            if (!string.IsNullOrEmpty(v2rayStatus.Error))
            {
                System.Diagnostics.Debug.WriteLine($"[GetConnectionStatus] V2ray error: {v2rayStatus.Error}");
            }

            return JsonSerializer.Serialize(new { success = true, data = status }, JsonOptions);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[GetConnectionStatus] Exception: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Get traffic statistics
    /// </summary>
    public string GetStatistics()
    {
        try
        {
            var stats = _statsManager.GetStats();
            return JsonSerializer.Serialize(new { success = true, data = stats }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Reset traffic statistics
    /// </summary>
    public string ResetStatistics()
    {
        try
        {
            _statsManager.ResetStats();
            return JsonSerializer.Serialize(new { success = true }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    #endregion

    #region Custom Rules

    /// <summary>
    /// Add a custom domain rule
    /// </summary>
    public string AddCustomRule(string ruleJson)
    {
        try
        {
            var rule = JsonSerializer.Deserialize<DomainRule>(ruleJson, JsonOptions);
            if (rule == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid rule" }, JsonOptions);
            }

            var config = _configManager.LoadConfig();
            rule.Id = Guid.NewGuid().ToString();
            config.CustomRules.Add(rule);
            _configManager.SaveConfig(config);

            // Restart proxy if running (non-blocking)
            var status = _v2rayManager.GetStatus();
            if (status.Running)
            {
                var v2rayConfig = _v2rayManager.GenerateConfig(config);
                // Use Task.Run to avoid blocking the UI thread
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _v2rayManager.RestartAsync(v2rayConfig);
                        System.Diagnostics.Debug.WriteLine("[AddCustomRule] V2ray restarted successfully");
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[AddCustomRule] V2ray restart failed: {ex.Message}");
                    }
                });
            }

            return JsonSerializer.Serialize(new { success = true, data = rule }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Update a custom domain rule
    /// </summary>
    public string UpdateCustomRule(string ruleJson)
    {
        try
        {
            var rule = JsonSerializer.Deserialize<DomainRule>(ruleJson, JsonOptions);
            if (rule == null || string.IsNullOrEmpty(rule.Id))
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid rule" }, JsonOptions);
            }

            var config = _configManager.LoadConfig();
            var existingRule = config.CustomRules.FirstOrDefault(r => r.Id == rule.Id);
            if (existingRule == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Rule not found" }, JsonOptions);
            }

            existingRule.Domain = rule.Domain;
            existingRule.Strategy = rule.Strategy;
            existingRule.Enabled = rule.Enabled;
            _configManager.SaveConfig(config);

            // Restart proxy if running (non-blocking)
            var status = _v2rayManager.GetStatus();
            if (status.Running)
            {
                var v2rayConfig = _v2rayManager.GenerateConfig(config);
                // Use Task.Run to avoid blocking the UI thread
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _v2rayManager.RestartAsync(v2rayConfig);
                        System.Diagnostics.Debug.WriteLine("[UpdateCustomRule] V2ray restarted successfully");
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[UpdateCustomRule] V2ray restart failed: {ex.Message}");
                    }
                });
            }

            return JsonSerializer.Serialize(new { success = true }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Delete a custom domain rule
    /// </summary>
    public string DeleteCustomRule(string ruleId)
    {
        try
        {
            var config = _configManager.LoadConfig();
            var rule = config.CustomRules.FirstOrDefault(r => r.Id == ruleId);
            if (rule == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Rule not found" }, JsonOptions);
            }

            config.CustomRules.Remove(rule);
            _configManager.SaveConfig(config);

            // Restart proxy if running (non-blocking)
            var status = _v2rayManager.GetStatus();
            if (status.Running)
            {
                var v2rayConfig = _v2rayManager.GenerateConfig(config);
                // Use Task.Run to avoid blocking the UI thread
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _v2rayManager.RestartAsync(v2rayConfig);
                        System.Diagnostics.Debug.WriteLine("[DeleteCustomRule] V2ray restarted successfully");
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[DeleteCustomRule] V2ray restart failed: {ex.Message}");
                    }
                });
            }

            return JsonSerializer.Serialize(new { success = true }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Add multiple custom domain rules in batch
    /// </summary>
    public string AddCustomRulesBatch(string rulesJson)
    {
        try
        {
            var rules = JsonSerializer.Deserialize<DomainRule[]>(rulesJson, JsonOptions);
            if (rules == null || rules.Length == 0)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid rules" }, JsonOptions);
            }

            var config = _configManager.LoadConfig();
            var addedRules = new List<DomainRule>();

            // Add all rules with generated IDs
            foreach (var rule in rules)
            {
                rule.Id = Guid.NewGuid().ToString();
                config.CustomRules.Add(rule);
                addedRules.Add(rule);
            }

            // Save config once
            _configManager.SaveConfig(config);

            // Restart proxy only once if running (non-blocking)
            var status = _v2rayManager.GetStatus();
            if (status.Running)
            {
                var v2rayConfig = _v2rayManager.GenerateConfig(config);
                // Use Task.Run to avoid blocking the UI thread
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await _v2rayManager.RestartAsync(v2rayConfig);
                        System.Diagnostics.Debug.WriteLine("[AddCustomRulesBatch] V2ray restarted successfully");
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[AddCustomRulesBatch] V2ray restart failed: {ex.Message}");
                    }
                });
            }

            return JsonSerializer.Serialize(new { success = true, data = addedRules }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    #endregion

    #region Version Information

    /// <summary>
    /// Get application version information
    /// </summary>
    public string GetVersionInfo()
    {
        try
        {
            var versionInfo = new
            {
                appVersion = VersionInfo.Version,
                appName = VersionInfo.ApplicationName,
                v2rayVersion = App.ResourceManager?.GetV2rayVersion() ?? "Unknown",
                copyright = VersionInfo.Copyright,
                repositoryUrl = VersionInfo.RepositoryUrl
            };

            return JsonSerializer.Serialize(new { success = true, data = versionInfo }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    #endregion

    #region Update Management

    /// <summary>
    /// Check for application updates
    /// </summary>
    public string CheckForUpdates()
    {
        try
        {
            // This will be handled by the main window
            // Send event to trigger update check
            _sendEvent("checkForUpdates", "{}");
            return JsonSerializer.Serialize(new { success = true, message = "Update check initiated" }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    #endregion

    #region Logging

    /// <summary>
    /// Get recent log entries
    /// </summary>
    public string GetLogs(int count)
    {
        try
        {
            var logs = _logManager.GetLogs(count);
            return JsonSerializer.Serialize(new { success = true, data = logs }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    /// <summary>
    /// Clear all log entries
    /// </summary>
    public string ClearLogs()
    {
        try
        {
            _logManager.ClearLogs();
            return JsonSerializer.Serialize(new { success = true, data = true }, JsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, JsonOptions);
        }
    }

    #endregion

    #region Event Handlers

    private void OnProcessStarted(object? sender, V2rayEventArgs e)
    {
        var data = JsonSerializer.Serialize(new { processId = e.ProcessId, timestamp = e.Timestamp }, JsonOptions);
        _sendEvent("processStarted", data);
    }

    private void OnProcessStopped(object? sender, V2rayEventArgs e)
    {
        var data = JsonSerializer.Serialize(new { processId = e.ProcessId, timestamp = e.Timestamp }, JsonOptions);
        _sendEvent("processStopped", data);
    }

    private void OnProcessError(object? sender, V2rayErrorEventArgs e)
    {
        var data = JsonSerializer.Serialize(new 
        { 
            processId = e.ProcessId, 
            timestamp = e.Timestamp,
            error = e.ErrorMessage 
        }, JsonOptions);
        _sendEvent("processError", data);
    }

    private void OnConfigChanged(object? sender, ConfigChangedEventArgs e)
    {
        var data = JsonSerializer.Serialize(new 
        { 
            key = e.Key, 
            oldValue = e.OldValue, 
            newValue = e.NewValue 
        }, JsonOptions);
        _sendEvent("configChanged", data);
    }

    private void OnStatsUpdated(object? sender, TrafficStats e)
    {
        var data = JsonSerializer.Serialize(e, JsonOptions);
        _sendEvent("statsUpdated", data);
    }

    private void OnLogReceived(object? sender, LogEntry e)
    {
        var data = JsonSerializer.Serialize(e, JsonOptions);
        _sendEvent("logReceived", data);
    }

    #endregion
}