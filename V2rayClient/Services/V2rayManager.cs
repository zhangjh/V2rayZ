using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using V2rayClient.Models;
using V2rayClient.Models.V2ray;

namespace V2rayClient.Services;

/// <summary>
/// Manages v2ray-core process lifecycle and configuration
/// </summary>
public class V2rayManager : IV2rayManager
{
    private Process? _v2rayProcess;
    private DateTime? _startTime;
    private readonly object _processLock = new();
    private bool _disposed;
    private string? _lastError;
    private ILogManager? _logManager;

    public event EventHandler<V2rayEventArgs>? ProcessStarted;
    public event EventHandler<V2rayEventArgs>? ProcessStopped;
    public event EventHandler<V2rayErrorEventArgs>? ProcessError;

    public V2rayManager(ILogManager? logManager = null, IRoutingRuleManager? routingManager = null)
    {
        _logManager = logManager;
        _routingManager = routingManager ?? new RoutingRuleManager();
    }

    /// <inheritdoc/>
    public async Task StartAsync(V2rayConfig config)
    {
        Debug.WriteLine("[V2rayManager] ========== StartAsync CALLED ==========");
        _logManager?.AddLog(LogLevel.Info, "V2rayManager.StartAsync 被调用", "v2ray");
        
        lock (_processLock)
        {
            if (_v2rayProcess != null && !_v2rayProcess.HasExited)
            {
                Debug.WriteLine("V2ray process is already running");
                _logManager?.AddLog(LogLevel.Warning, "V2ray进程已在运行", "v2ray");
                return;
            }
            
            // Clear previous error
            _lastError = null;
        }
        
        // Additional check: see if any V2ray process is already listening on our ports
        try
        {
            var socksPort = config.Inbounds?.FirstOrDefault(i => i.Protocol == "socks")?.Port ?? 65534;
            var httpPort = config.Inbounds?.FirstOrDefault(i => i.Protocol == "http")?.Port ?? 65535;
            
            // Quick port check to see if V2ray might already be running
            using (var tcpClient = new System.Net.Sockets.TcpClient())
            {
                var connectTask = tcpClient.ConnectAsync("127.0.0.1", socksPort);
                if (connectTask.Wait(1000) && tcpClient.Connected)
                {
                    Debug.WriteLine("[V2rayManager] V2ray appears to be already running (port check)");
                    _logManager?.AddLog(LogLevel.Info, "检测到V2ray可能已在运行", "v2ray");
                    return;
                }
            }
        }
        catch
        {
            // Port check failed, continue with normal startup
        }

        try
        {
            // Write configuration to temp file
            var configPath = await WriteConfigFileAsync(config);
            Debug.WriteLine($"[V2rayManager] Configuration written to: {configPath}");

            // Start v2ray process
            var v2rayPath = GetV2rayExecutablePath();
            
            Debug.WriteLine($"[V2rayManager] Starting v2ray process:");
            Debug.WriteLine($"[V2rayManager] Executable: {v2rayPath}");
            Debug.WriteLine($"[V2rayManager] Config: {configPath}");
            Debug.WriteLine($"[V2rayManager] Working Directory: {Path.GetDirectoryName(v2rayPath)}");

            var processStartInfo = new ProcessStartInfo
            {
                FileName = v2rayPath,
                Arguments = $"run -c \"{configPath}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                WorkingDirectory = Path.GetDirectoryName(v2rayPath) ?? AppDomain.CurrentDomain.BaseDirectory
            };
            
            Debug.WriteLine($"[V2rayManager] Full command: {processStartInfo.FileName} {processStartInfo.Arguments}");

            // Set environment variables for GeoData files if using ResourceManager
            if (App.ResourceManager != null)
            {
                processStartInfo.Environment["V2RAY_LOCATION_ASSET"] = Path.GetDirectoryName(App.ResourceManager.GeoIpPath) ?? "";
            }

            _v2rayProcess = new Process
            {
                StartInfo = processStartInfo,
                EnableRaisingEvents = true
            };

            // Subscribe to process events
            _v2rayProcess.OutputDataReceived += OnOutputDataReceived;
            _v2rayProcess.ErrorDataReceived += OnErrorDataReceived;
            _v2rayProcess.Exited += OnProcessExited;

            // Start the process
            Debug.WriteLine("[V2rayManager] Attempting to start process...");
            
            if (!_v2rayProcess.Start())
            {
                var errorMessage = "Failed to start v2ray process - Process.Start() returned false";
                Debug.WriteLine($"[V2rayManager] {errorMessage}");
                throw new InvalidOperationException(errorMessage);
            }

            _startTime = DateTime.Now;

            // Begin async reading of output
            _v2rayProcess.BeginOutputReadLine();
            _v2rayProcess.BeginErrorReadLine();

            Debug.WriteLine($"[V2rayManager] V2ray process started with PID: {_v2rayProcess.Id}");
            _logManager?.AddLog(LogLevel.Info, $"V2ray进程已启动 (PID: {_v2rayProcess.Id})", "v2ray");

            // Raise event
            ProcessStarted?.Invoke(this, new V2rayEventArgs
            {
                ProcessId = _v2rayProcess.Id,
                Timestamp = DateTime.Now
            });

            // Wait a bit to ensure process started successfully
            Debug.WriteLine("[V2rayManager] Waiting for process to stabilize...");
            await Task.Delay(1000);

            if (_v2rayProcess.HasExited)
            {
                var exitCode = _v2rayProcess.ExitCode;
                var errorMessage = $"V2ray 进程启动失败 (退出码: {exitCode})";
                _lastError = errorMessage;
                
                Debug.WriteLine($"[V2rayManager] Process exited immediately: {errorMessage}");
                
                ProcessError?.Invoke(this, new V2rayErrorEventArgs
                {
                    ProcessId = _v2rayProcess.Id,
                    ErrorMessage = errorMessage,
                    Timestamp = DateTime.Now
                });
                
                throw new InvalidOperationException(errorMessage);
            }
            
            Debug.WriteLine("[V2rayManager] V2ray process started successfully and is running");
            _logManager?.AddLog(LogLevel.Info, "V2ray进程启动成功，代理服务已就绪", "v2ray");
        }
        catch (NotSupportedException ex)
        {
            // Handle unsupported protocol error
            var errorMessage = $"不支持的协议类型: {ex.Message}";
            Debug.WriteLine($"[Protocol Error] {errorMessage}");
            
            _lastError = errorMessage;
            
            ProcessError?.Invoke(this, new V2rayErrorEventArgs
            {
                ErrorMessage = errorMessage,
                Exception = ex
            });

            throw new InvalidOperationException(errorMessage, ex);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Failed to start v2ray process: {ex.Message}");
            
            _lastError = ex.Message;
            
            ProcessError?.Invoke(this, new V2rayErrorEventArgs
            {
                ErrorMessage = ex.Message,
                Exception = ex
            });

            throw;
        }
    }

    /// <inheritdoc/>
    public async Task StopAsync()
    {
        Process? processToStop;

        lock (_processLock)
        {
            processToStop = _v2rayProcess;
            _v2rayProcess = null;
            _startTime = null;
        }

        if (processToStop == null)
        {
            Debug.WriteLine("No v2ray process to stop");
            return;
        }

        try
        {
            if (!processToStop.HasExited)
            {
                Debug.WriteLine($"Stopping v2ray process (PID: {processToStop.Id})");

                // Unsubscribe from events before killing
                processToStop.OutputDataReceived -= OnOutputDataReceived;
                processToStop.ErrorDataReceived -= OnErrorDataReceived;
                processToStop.Exited -= OnProcessExited;

                // Try graceful shutdown first
                processToStop.Kill(entireProcessTree: true);

                // Wait for process to exit
                await Task.Run(() => processToStop.WaitForExit(5000));

                if (!processToStop.HasExited)
                {
                    Debug.WriteLine("V2ray process did not exit gracefully, forcing termination");
                    processToStop.Kill(entireProcessTree: true);
                }

                Debug.WriteLine("V2ray process stopped");
                _logManager?.AddLog(LogLevel.Info, "V2ray进程已停止", "v2ray");

                ProcessStopped?.Invoke(this, new V2rayEventArgs
                {
                    ProcessId = processToStop.Id,
                    Timestamp = DateTime.Now
                });
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Error stopping v2ray process: {ex.Message}");
            throw;
        }
        finally
        {
            processToStop.Dispose();
        }
    }

    /// <inheritdoc/>
    public async Task RestartAsync(V2rayConfig config)
    {
        Debug.WriteLine("Restarting v2ray process");
        _logManager?.AddLog(LogLevel.Info, "正在重启V2ray进程...", "v2ray");
        await StopAsync();
        await Task.Delay(1000); // Wait a bit before restarting
        await StartAsync(config);
        _logManager?.AddLog(LogLevel.Info, "V2ray进程重启完成", "v2ray");
    }

    /// <inheritdoc/>
    public V2rayStatus GetStatus()
    {
        lock (_processLock)
        {
            if (_v2rayProcess == null || _v2rayProcess.HasExited)
            {
                return new V2rayStatus
                {
                    Running = false,
                    Pid = null,
                    Uptime = null,
                    Error = _lastError
                };
            }

            return new V2rayStatus
            {
                Running = true,
                Pid = _v2rayProcess.Id,
                Uptime = _startTime.HasValue ? DateTime.Now - _startTime.Value : null,
                Error = null
            };
        }
    }

    private readonly IRoutingRuleManager _routingManager;

    /// <inheritdoc/>
    public V2rayConfig GenerateConfig(UserConfig userConfig)
    {
        Debug.WriteLine("Generating v2ray configuration");

        // Get the selected server configuration
        var selectedServer = userConfig.GetSelectedServer();
        if (selectedServer == null)
        {
            // Fallback to legacy server config for backward compatibility
            if (userConfig.Server != null)
            {
                selectedServer = new ServerConfigWithId
                {
                    Id = Guid.NewGuid().ToString(),
                    Name = "Legacy Server",
                    Protocol = userConfig.Server.Protocol,
                    Address = userConfig.Server.Address,
                    Port = userConfig.Server.Port,
                    Uuid = userConfig.Server.Uuid,
                    Encryption = userConfig.Server.Encryption,
                    Password = userConfig.Server.Password,
                    Network = userConfig.Server.Network,
                    Security = userConfig.Server.Security,
                    TlsSettings = userConfig.Server.TlsSettings,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
            }
            else
            {
                throw new InvalidOperationException("没有选择服务器配置。请先在服务器页面选择一个服务器。");
            }
        }

        var config = new V2rayConfig
        {
            Log = new LogConfig
            {
                LogLevel = "warning"
            }
        };

        // Configure inbounds (SOCKS and HTTP proxy)
        config.Inbounds.Add(new Inbound
        {
            Tag = "socks-in",
            Protocol = "socks",
            Listen = "127.0.0.1",
            Port = userConfig.SocksPort,
            Settings = new InboundSettings
            {
                Udp = true
            }
        });

        config.Inbounds.Add(new Inbound
        {
            Tag = "http-in",
            Protocol = "http",
            Listen = "127.0.0.1",
            Port = userConfig.HttpPort
        });

        // Configure API inbound for statistics
        config.Inbounds.Add(new Inbound
        {
            Tag = "api",
            Protocol = "dokodemo-door",
            Listen = "127.0.0.1",
            Port = 10085,
            Settings = new InboundSettings
            {
                Address = "127.0.0.1"
            }
        });

        // Configure outbounds
        // 1. Proxy outbound using selected server
        config.Outbounds.Add(CreateProxyOutbound(selectedServer));

        // 2. Direct outbound
        config.Outbounds.Add(new Outbound
        {
            Tag = "direct",
            Protocol = "freedom"
        });

        // 3. Block outbound
        config.Outbounds.Add(new Outbound
        {
            Tag = "block",
            Protocol = "blackhole"
        });

        // Configure routing with actual rules from RoutingRuleManager
        var routingRules = _routingManager.GenerateRoutingRules(userConfig.ProxyMode, userConfig.CustomRules);
        config.Routing = new Routing
        {
            DomainStrategy = "IPIfNonMatch",
            Rules = routingRules
        };

        Debug.WriteLine($"Generated {routingRules.Count} routing rules for mode: {userConfig.ProxyMode}");

        // Enable statistics
        config.Stats = new StatsConfig();
        
        // Configure API for statistics
        config.Api = new ApiConfig
        {
            Tag = "api",
            Services = new List<string> { "StatsService" }
        };

        // Configure policy for statistics
        config.Policy = new PolicyConfig
        {
            System = new SystemPolicy
            {
                StatsInboundUplink = true,
                StatsInboundDownlink = true,
                StatsOutboundUplink = true,
                StatsOutboundDownlink = true
            }
        };

        return config;
    }

    private Outbound CreateProxyOutbound(ServerConfig server)
    {
        try
        {
            return server.Protocol switch
            {
                ProtocolType.Vless => CreateVlessOutbound(server),
                ProtocolType.Trojan => CreateTrojanOutbound(server),
                _ => throw new NotSupportedException($"协议 '{server.Protocol}' 暂不支持。当前仅支持 VLESS 和 Trojan 协议。")
            };
        }
        catch (NotSupportedException ex)
        {
            Debug.WriteLine($"[Protocol Error] Unsupported protocol: {server.Protocol}");
            throw;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[Config Error] Failed to create {server.Protocol} outbound: {ex.Message}");
            throw new InvalidOperationException($"创建 {server.Protocol} 协议配置失败: {ex.Message}", ex);
        }
    }

    private Outbound CreateVlessOutbound(ServerConfig server)
    {
        var outbound = new Outbound
        {
            Tag = "proxy",
            Protocol = "vless",
            Settings = new OutboundSettings
            {
                Vnext = new List<VnextServer>
                {
                    new VnextServer
                    {
                        Address = server.Address,
                        Port = server.Port,
                        Users = new List<VlessUser>
                        {
                            new VlessUser
                            {
                                Id = server.Uuid!,
                                Encryption = server.Encryption ?? "none"
                            }
                        }
                    }
                }
            }
        };

        // Configure stream settings
        ConfigureStreamSettings(outbound, server);

        return outbound;
    }

    private Outbound CreateTrojanOutbound(ServerConfig server)
    {
        var outbound = new Outbound
        {
            Tag = "proxy",
            Protocol = "trojan",
            Settings = new OutboundSettings
            {
                Servers = new List<TrojanServer>
                {
                    new TrojanServer
                    {
                        Address = server.Address,
                        Port = server.Port,
                        Password = server.Password!
                    }
                }
            }
        };

        // Configure stream settings
        ConfigureStreamSettings(outbound, server);

        return outbound;
    }

    private void ConfigureStreamSettings(Outbound outbound, ServerConfig server)
    {
        outbound.StreamSettings = new StreamSettings
        {
            Network = server.Network.ToString().ToLower()
        };

        // Configure TLS if enabled
        if (server.Security == SecurityType.Tls)
        {
            outbound.StreamSettings.Security = "tls";
            
            if (server.TlsSettings != null)
            {
                outbound.StreamSettings.TlsSettings = new TlsStreamSettings
                {
                    ServerName = server.TlsSettings.ServerName,
                    AllowInsecure = server.TlsSettings.AllowInsecure
                };
            }
        }

        // Configure WebSocket if enabled
        if (server.Network == NetworkType.Ws)
        {
            outbound.StreamSettings.WsSettings = new WsStreamSettings
            {
                Path = server.WsSettings?.Path ?? "/",
                Headers = !string.IsNullOrEmpty(server.WsSettings?.Host) 
                    ? new Dictionary<string, string> { { "Host", server.WsSettings.Host } }
                    : null
            };
        }
    }

    private async Task<string> WriteConfigFileAsync(V2rayConfig config)
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "V2rayZ"
        );

        Directory.CreateDirectory(appDataPath);

        var configPath = Path.Combine(appDataPath, "v2ray_config.json");

        var options = new JsonSerializerOptions
        {
            WriteIndented = true,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        var json = JsonSerializer.Serialize(config, options);
        
        Debug.WriteLine($"[V2rayManager] Generated V2ray config:");
        Debug.WriteLine($"[V2rayManager] {json}");
        
        // Use UTF8 without BOM to avoid V2ray parsing issues
        var utf8WithoutBom = new UTF8Encoding(false);
        await File.WriteAllTextAsync(configPath, json, utf8WithoutBom);

        Debug.WriteLine($"[V2rayManager] V2ray configuration written to: {configPath}");

        return configPath;
    }

    private string GetV2rayExecutablePath()
    {
        Debug.WriteLine("[V2rayManager] Looking for v2ray executable...");
        
        // Use ResourceManager to get the v2ray executable path
        if (App.ResourceManager != null)
        {
            var v2rayPath = App.ResourceManager.V2rayExePath;
            Debug.WriteLine($"[V2rayManager] ResourceManager path: {v2rayPath}");
            
            if (File.Exists(v2rayPath))
            {
                Debug.WriteLine($"[V2rayManager] Found v2ray at ResourceManager path: {v2rayPath}");
                return v2rayPath;
            }
            else
            {
                Debug.WriteLine($"[V2rayManager] v2ray not found at ResourceManager path: {v2rayPath}");
            }
        }
        else
        {
            Debug.WriteLine("[V2rayManager] ResourceManager is null");
        }

        // Fallback: check in Resources folder relative to application
        var appDirectory = AppDomain.CurrentDomain.BaseDirectory;
        var resourcePath = Path.Combine(appDirectory, "Resources", "v2ray.exe");
        Debug.WriteLine($"[V2rayManager] Checking fallback path: {resourcePath}");

        if (File.Exists(resourcePath))
        {
            Debug.WriteLine($"[V2rayManager] Found v2ray at fallback path: {resourcePath}");
            return resourcePath;
        }

        // Fallback: check in application directory
        var appPath = Path.Combine(appDirectory, "v2ray.exe");
        Debug.WriteLine($"[V2rayManager] Checking app directory path: {appPath}");
        
        if (File.Exists(appPath))
        {
            Debug.WriteLine($"[V2rayManager] Found v2ray at app directory: {appPath}");
            return appPath;
        }

        var errorMessage = $"V2ray executable not found. Searched paths:\n" +
                          $"1. ResourceManager: {App.ResourceManager?.V2rayExePath ?? "null"}\n" +
                          $"2. Resources folder: {resourcePath}\n" +
                          $"3. App directory: {appPath}";
        
        Debug.WriteLine($"[V2rayManager] {errorMessage}");
        throw new FileNotFoundException(errorMessage);
    }

    private void OnOutputDataReceived(object sender, DataReceivedEventArgs e)
    {
        if (!string.IsNullOrEmpty(e.Data))
        {
            Debug.WriteLine($"[V2ray] {e.Data}");
            _logManager?.AddLog(LogLevel.Info, e.Data, "v2ray");
        }
    }

    private void OnErrorDataReceived(object sender, DataReceivedEventArgs e)
    {
        if (!string.IsNullOrEmpty(e.Data))
        {
            Debug.WriteLine($"[V2ray Error] {e.Data}");
            _logManager?.AddLog(LogLevel.Error, e.Data, "v2ray");
            
            // Parse and categorize V2Ray errors
            var parsedError = ParseV2rayError(e.Data);
            if (!string.IsNullOrEmpty(parsedError))
            {
                ProcessError?.Invoke(this, new V2rayErrorEventArgs
                {
                    ErrorMessage = parsedError,
                    Timestamp = DateTime.Now
                });
            }
        }
    }

    /// <summary>
    /// Parse V2Ray error output and convert to user-friendly Chinese messages
    /// </summary>
    private string ParseV2rayError(string errorOutput)
    {
        if (string.IsNullOrEmpty(errorOutput))
            return string.Empty;

        var lowerError = errorOutput.ToLower();

        // Trojan-specific errors
        if (lowerError.Contains("trojan"))
        {
            if (lowerError.Contains("authentication failed") || 
                lowerError.Contains("invalid password") ||
                lowerError.Contains("auth fail"))
            {
                return "Trojan 认证失败：密码错误，请检查服务器密码配置";
            }
            
            if (lowerError.Contains("connection refused") || 
                lowerError.Contains("connect: connection refused"))
            {
                return "Trojan 连接被拒绝：无法连接到服务器，请检查服务器地址和端口";
            }
            
            if (lowerError.Contains("timeout") || 
                lowerError.Contains("i/o timeout"))
            {
                return "Trojan 连接超时：服务器响应超时，请检查网络连接或服务器状态";
            }
            
            if (lowerError.Contains("tls handshake") || 
                lowerError.Contains("certificate") ||
                lowerError.Contains("x509"))
            {
                return "Trojan TLS 握手失败：证书验证失败，请检查 TLS 设置或启用\"允许不安全连接\"";
            }
            
            if (lowerError.Contains("invalid config") || 
                lowerError.Contains("config error"))
            {
                return "Trojan 配置错误：配置格式不正确，请检查服务器配置";
            }
        }

        // VLESS-specific errors
        if (lowerError.Contains("vless"))
        {
            if (lowerError.Contains("invalid user") || 
                lowerError.Contains("uuid"))
            {
                return "VLESS 认证失败：UUID 错误，请检查用户 UUID 配置";
            }
            
            if (lowerError.Contains("connection refused"))
            {
                return "VLESS 连接被拒绝：无法连接到服务器，请检查服务器地址和端口";
            }
        }

        // General connection errors
        if (lowerError.Contains("connection refused"))
        {
            return "连接被拒绝：无法连接到服务器，请检查服务器地址和端口";
        }
        
        if (lowerError.Contains("timeout") || lowerError.Contains("i/o timeout"))
        {
            return "连接超时：服务器响应超时，请检查网络连接";
        }
        
        if (lowerError.Contains("network is unreachable") || 
            lowerError.Contains("no route to host"))
        {
            return "网络不可达：无法访问目标服务器，请检查网络连接";
        }
        
        if (lowerError.Contains("tls") || 
            lowerError.Contains("certificate") ||
            lowerError.Contains("x509"))
        {
            return "TLS 连接失败：证书验证失败，请检查 TLS 配置";
        }
        
        if (lowerError.Contains("dns") || 
            lowerError.Contains("no such host"))
        {
            return "DNS 解析失败：无法解析服务器域名，请检查域名是否正确";
        }

        // Config errors
        if (lowerError.Contains("failed to parse") || 
            lowerError.Contains("json") ||
            lowerError.Contains("invalid config"))
        {
            return "配置解析失败：配置文件格式错误";
        }

        // Only return parsed error for critical errors
        if (lowerError.Contains("error") || 
            lowerError.Contains("failed") || 
            lowerError.Contains("fatal"))
        {
            return string.Empty; // Let the raw error be logged, but don't show to user
        }

        return string.Empty;
    }

    private void OnProcessExited(object? sender, EventArgs e)
    {
        var process = sender as Process;
        var exitCode = process?.ExitCode ?? -1;

        Debug.WriteLine($"V2ray process exited unexpectedly with code: {exitCode}");

        var errorMessage = $"V2ray 进程意外退出 (退出码: {exitCode})";
        _lastError = errorMessage;

        ProcessError?.Invoke(this, new V2rayErrorEventArgs
        {
            ProcessId = process?.Id ?? 0,
            ErrorMessage = errorMessage,
            Timestamp = DateTime.Now
        });

        lock (_processLock)
        {
            _v2rayProcess = null;
            _startTime = null;
        }
    }

    public void Dispose()
    {
        if (_disposed)
            return;

        try
        {
            StopAsync().GetAwaiter().GetResult();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Error disposing V2rayManager: {ex.Message}");
        }

        _disposed = true;
        GC.SuppressFinalize(this);
    }
}
