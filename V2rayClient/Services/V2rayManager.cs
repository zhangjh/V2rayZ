using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using V2rayClient.Models;
using V2rayClient.Models.SingBox;

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
    private string? _lastLogMessage;
    private int _repeatedLogCount = 0;
    private readonly object _logLock = new();

    public event EventHandler<V2rayEventArgs>? ProcessStarted;
    public event EventHandler<V2rayEventArgs>? ProcessStopped;
    public event EventHandler<V2rayErrorEventArgs>? ProcessError;
    public event EventHandler<V2rayErrorEventArgs>? ProcessFatalError;

    public V2rayManager(ILogManager? logManager = null, IRoutingRuleManager? routingManager = null)
    {
        _logManager = logManager;
        _routingManager = routingManager ?? new RoutingRuleManager();
    }

    /// <inheritdoc/>
    public async Task StartAsync(SingBoxConfig config, UserConfig? userConfig = null)
    {
        Debug.WriteLine("[V2rayManager] ========== StartAsync CALLED ==========");
        _logManager?.AddLog(LogLevel.Info, "V2rayManager.StartAsync 被调用", "sing-box");
        
        // UserConfig is required for unified sing-box approach
        if (userConfig == null)
        {
            throw new InvalidOperationException("UserConfig is required");
        }
        
        // Determine mode from UserConfig.ProxyModeType
        var modeType = userConfig.ProxyModeType == ProxyModeType.Tun ? "TUN模式" : "系统代理模式";
        Debug.WriteLine($"[V2rayManager] Starting in {modeType}");
        _logManager?.AddLog(LogLevel.Info, $"正在以{modeType}启动", "sing-box");
        
        // Always use sing-box for both TUN and System Proxy modes
        await StartSingBoxAsync(userConfig);
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
            Debug.WriteLine("[sing-box] No process to stop");
            return;
        }

        try
        {
            if (!processToStop.HasExited)
            {
                Debug.WriteLine($"[sing-box] Stopping process (PID: {processToStop.Id})");
                _logManager?.AddLog(LogLevel.Info, $"正在停止 sing-box 进程 (PID: {processToStop.Id})", "sing-box");

                // Unsubscribe from sing-box events before killing
                processToStop.OutputDataReceived -= OnSingBoxOutputDataReceived;
                processToStop.ErrorDataReceived -= OnSingBoxErrorDataReceived;
                processToStop.Exited -= OnSingBoxProcessExited;

                // Try graceful shutdown first
                processToStop.Kill(entireProcessTree: true);

                // Wait for process to exit
                await Task.Run(() => processToStop.WaitForExit(5000));

                if (!processToStop.HasExited)
                {
                    Debug.WriteLine("[sing-box] Process did not exit gracefully, forcing termination");
                    _logManager?.AddLog(LogLevel.Warning, "sing-box 进程未正常退出，强制终止", "sing-box");
                    processToStop.Kill(entireProcessTree: true);
                }

                Debug.WriteLine("[sing-box] Process stopped");
                _logManager?.AddLog(LogLevel.Info, "sing-box 进程已停止", "sing-box");

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
    public async Task RestartAsync(SingBoxConfig config)
    {
        Debug.WriteLine("[sing-box] Restarting process");
        _logManager?.AddLog(LogLevel.Info, "正在重启 sing-box 进程...", "sing-box");
        await StopAsync();
        await Task.Delay(1000); // Wait a bit before restarting
        await StartAsync(config);
        _logManager?.AddLog(LogLevel.Info, "sing-box 进程重启完成", "sing-box");
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
    public SingBoxConfig GenerateSingBoxConfig(UserConfig userConfig, ProxyModeType proxyMode)
    {
        Debug.WriteLine($"Generating sing-box configuration for {proxyMode} mode");
        _logManager?.AddLog(LogLevel.Info, $"正在生成 sing-box {proxyMode} 模式配置", "sing-box");

        return proxyMode == ProxyModeType.Tun
            ? GenerateSingBoxTunConfig(userConfig)
            : GenerateSingBoxSystemProxyConfig(userConfig);
    }



    private void OnSingBoxOutputDataReceived(object sender, DataReceivedEventArgs e)
    {
        if (!string.IsNullOrEmpty(e.Data))
        {
            Debug.WriteLine($"[sing-box] {e.Data}");
            _logManager?.AddLog(LogLevel.Info, e.Data, "v2ray");
        }
    }

    private void OnSingBoxErrorDataReceived(object sender, DataReceivedEventArgs e)
    {
        if (!string.IsNullOrEmpty(e.Data))
        {
            // sing-box outputs all logs to stderr, parse the actual log level
            var logLevel = LogLevel.Info;
            var logData = e.Data;
            
            // Remove ANSI color codes
            logData = System.Text.RegularExpressions.Regex.Replace(logData, @"\x1B\[[0-9;]*[mK]", "");
            
            // Filter out repetitive connection logs
            var normalizedLog = System.Text.RegularExpressions.Regex.Replace(
                logData, 
                @"\[\d+\s+\d+ms\]", 
                "[X Xms]"
            );
            
            lock (_logLock)
            {
                if (normalizedLog == _lastLogMessage)
                {
                    _repeatedLogCount++;
                    if (_repeatedLogCount == 10)
                    {
                        Debug.WriteLine($"[sing-box] (重复日志已省略 10 次)");
                        _logManager?.AddLog(LogLevel.Warning, "(重复日志已省略，连接可能存在问题)", "v2ray");
                    }
                    else if (_repeatedLogCount > 10 && _repeatedLogCount % 100 == 0)
                    {
                        Debug.WriteLine($"[sing-box] (重复日志已省略 {_repeatedLogCount} 次)");
                    }
                    return;
                }
                
                if (_repeatedLogCount > 0)
                {
                    Debug.WriteLine($"[sing-box] (上一条日志重复了 {_repeatedLogCount} 次)");
                    if (_repeatedLogCount >= 10)
                    {
                        _logManager?.AddLog(LogLevel.Warning, $"上一条日志重复了 {_repeatedLogCount} 次", "v2ray");
                    }
                }
                
                _lastLogMessage = normalizedLog;
                _repeatedLogCount = 0;
            }
            
            // Parse log level from sing-box output
            if (logData.Contains("FATAL") || logData.Contains("PANIC"))
            {
                logLevel = LogLevel.Error;
                var friendlyError = ParseSingBoxError(logData);
                _lastError = friendlyError;
                
                // FATAL/PANIC are critical errors that should affect connection state
                ProcessFatalError?.Invoke(this, new V2rayErrorEventArgs
                {
                    ErrorMessage = friendlyError,
                    Timestamp = DateTime.Now
                });
                
                // Also fire ProcessError for logging
                ProcessError?.Invoke(this, new V2rayErrorEventArgs
                {
                    ErrorMessage = friendlyError,
                    Timestamp = DateTime.Now
                });
            }
            else if (logData.Contains("ERROR"))
            {
                logLevel = LogLevel.Error;
                
                // Check if this is a runtime network error (normal during proxy operation)
                var isRuntimeNetworkError = IsRuntimeNetworkError(logData);
                
                if (!isRuntimeNetworkError)
                {
                    // Only report errors that affect user experience
                    var friendlyError = ParseSingBoxError(logData);
                    _lastError = friendlyError;
                    
                    ProcessError?.Invoke(this, new V2rayErrorEventArgs
                    {
                        ErrorMessage = friendlyError,
                        Timestamp = DateTime.Now
                    });
                }
            }
            else if (logData.Contains("WARN"))
            {
                logLevel = LogLevel.Warning;
            }
            else if (logData.Contains("DEBUG") || logData.Contains("TRACE"))
            {
                logLevel = LogLevel.Debug;
            }
            
            Debug.WriteLine($"[sing-box] {logData}");
            _logManager?.AddLog(logLevel, logData, "v2ray");
        }
    }

    /// <summary>
    /// Check if the error is a runtime network error that should not be reported to user
    /// </summary>
    /// <param name="logData">Log message from sing-box</param>
    /// <returns>True if this is a normal runtime network error</returns>
    private bool IsRuntimeNetworkError(string logData)
    {
        var lowerLog = logData.ToLower();
        
        // Connection timeouts during proxy operation are normal
        if (lowerLog.Contains("i/o timeout") && lowerLog.Contains("dial tcp"))
        {
            return true;
        }
        
        // Individual connection refused errors are normal
        if (lowerLog.Contains("connection refused") && lowerLog.Contains("dial"))
        {
            return true;
        }
        
        // DNS resolution failures for individual domains are normal
        if (lowerLog.Contains("no such host") && !lowerLog.Contains("dns server"))
        {
            return true;
        }
        
        // Network unreachable for individual connections
        if (lowerLog.Contains("network unreachable") && lowerLog.Contains("dial"))
        {
            return true;
        }
        
        // TLS handshake failures for individual connections
        if (lowerLog.Contains("tls") && lowerLog.Contains("handshake") && lowerLog.Contains("dial"))
        {
            return true;
        }
        
        return false;
    }
    
    /// <summary>
    /// Parse sing-box error messages and return user-friendly Chinese error messages
    /// </summary>
    /// <param name="errorOutput">Raw error output from sing-box</param>
    /// <returns>User-friendly error message in Chinese</returns>
    private string ParseSingBoxError(string errorOutput)
    {
        if (string.IsNullOrEmpty(errorOutput))
        {
            return "未知错误";
        }

        // Remove ANSI color codes if not already removed
        var cleanError = System.Text.RegularExpressions.Regex.Replace(errorOutput, @"\x1B\[[0-9;]*[mK]", "");
        
        // Convert to lowercase for case-insensitive matching
        var lowerError = cleanError.ToLower();

        // Configuration errors
        if (lowerError.Contains("parse config") || lowerError.Contains("decode config") || 
            lowerError.Contains("unmarshal") || lowerError.Contains("invalid config"))
        {
            return "配置文件格式错误，请检查配置是否正确";
        }

        if (lowerError.Contains("missing") && (lowerError.Contains("field") || lowerError.Contains("required")))
        {
            return "配置文件缺少必需字段，请检查配置完整性";
        }

        // Port binding errors
        if (lowerError.Contains("address already in use") || lowerError.Contains("bind") && lowerError.Contains("failed"))
        {
            // Try to extract port number
            var portMatch = System.Text.RegularExpressions.Regex.Match(cleanError, @":(\d+)");
            if (portMatch.Success)
            {
                return $"端口 {portMatch.Groups[1].Value} 已被占用，请更改端口设置或关闭占用端口的程序";
            }
            return "端口已被占用，请更改端口设置或关闭占用端口的程序";
        }

        if (lowerError.Contains("listen") && lowerError.Contains("failed"))
        {
            return "无法监听指定端口，请检查端口是否被占用或权限是否足够";
        }

        // Connection errors
        if (lowerError.Contains("connection refused") || lowerError.Contains("connect: connection refused"))
        {
            return "无法连接到代理服务器，请检查服务器地址和端口是否正确";
        }

        if (lowerError.Contains("connection timeout") || lowerError.Contains("i/o timeout"))
        {
            return "连接服务器超时，请检查网络连接或服务器是否可用";
        }

        if (lowerError.Contains("no route to host") || lowerError.Contains("network unreachable"))
        {
            return "网络不可达，请检查网络连接";
        }

        if (lowerError.Contains("dial") && lowerError.Contains("failed"))
        {
            return "连接服务器失败，请检查服务器配置是否正确";
        }

        // Authentication errors
        if (lowerError.Contains("authentication failed") || lowerError.Contains("auth failed"))
        {
            return "服务器认证失败，请检查密码或 UUID 是否正确";
        }

        if (lowerError.Contains("invalid uuid") || lowerError.Contains("invalid password"))
        {
            return "UUID 或密码格式不正确，请检查服务器配置";
        }

        // TLS/SSL errors
        if (lowerError.Contains("tls") || lowerError.Contains("ssl"))
        {
            if (lowerError.Contains("certificate") || lowerError.Contains("cert"))
            {
                if (lowerError.Contains("verify") || lowerError.Contains("validation"))
                {
                    return "TLS 证书验证失败，请检查服务器证书或尝试允许不安全连接";
                }
                return "TLS 证书错误，请检查证书配置";
            }
            if (lowerError.Contains("handshake"))
            {
                return "TLS 握手失败，请检查 TLS 配置或服务器名称";
            }
            return "TLS 连接失败，请检查 TLS 设置";
        }

        // DNS errors
        if (lowerError.Contains("dns") || lowerError.Contains("resolve"))
        {
            if (lowerError.Contains("no such host") || lowerError.Contains("not found"))
            {
                return "无法解析域名，请检查域名是否正确或 DNS 设置";
            }
            return "DNS 解析失败，请检查 DNS 配置";
        }

        // Protocol errors
        if (lowerError.Contains("protocol") && lowerError.Contains("error"))
        {
            return "协议错误，请检查服务器协议配置是否正确";
        }

        if (lowerError.Contains("invalid protocol") || lowerError.Contains("unsupported protocol"))
        {
            return "不支持的协议类型，请检查服务器配置";
        }

        // Transport errors
        if (lowerError.Contains("websocket") || lowerError.Contains("ws"))
        {
            if (lowerError.Contains("handshake"))
            {
                return "WebSocket 握手失败，请检查 WebSocket 路径和 Host 配置";
            }
            return "WebSocket 连接失败，请检查 WebSocket 配置";
        }

        // TUN mode specific errors
        if (lowerError.Contains("tun") || lowerError.Contains("wintun"))
        {
            if (lowerError.Contains("permission") || lowerError.Contains("access denied"))
            {
                return "TUN 模式需要管理员权限，请以管理员身份运行程序";
            }
            if (lowerError.Contains("create") && lowerError.Contains("failed"))
            {
                return "创建 TUN 虚拟网卡失败，请检查 wintun.dll 是否存在或重启程序";
            }
            if (lowerError.Contains("interface"))
            {
                return "TUN 网络接口错误，请检查网络适配器设置";
            }
            return "TUN 模式启动失败，请检查系统权限和网络配置";
        }

        // Permission errors
        if (lowerError.Contains("permission denied") || lowerError.Contains("access denied"))
        {
            return "权限不足，某些功能可能需要管理员权限";
        }

        // File errors
        if (lowerError.Contains("no such file") || lowerError.Contains("file not found"))
        {
            return "找不到必需的文件，请检查程序完整性";
        }

        // Routing errors
        if (lowerError.Contains("route") || lowerError.Contains("routing"))
        {
            if (lowerError.Contains("rule"))
            {
                return "路由规则配置错误，请检查路由规则设置";
            }
            return "路由配置错误，请检查路由设置";
        }

        // Inbound/Outbound errors
        if (lowerError.Contains("inbound") && lowerError.Contains("failed"))
        {
            return "入站配置错误，请检查监听端口和协议设置";
        }

        if (lowerError.Contains("outbound") && lowerError.Contains("failed"))
        {
            return "出站配置错误，请检查服务器配置";
        }

        // Generic errors
        if (lowerError.Contains("failed to start") || lowerError.Contains("start failed"))
        {
            return "sing-box 启动失败，请查看详细日志";
        }

        if (lowerError.Contains("panic") || lowerError.Contains("fatal"))
        {
            return "sing-box 遇到严重错误，请重启程序或查看详细日志";
        }

        // If no specific error pattern matched, return a cleaned version of the original error
        // but limit the length to avoid overwhelming the user
        if (cleanError.Length > 200)
        {
            return cleanError.Substring(0, 200) + "...";
        }

        return cleanError;
    }

    private void OnSingBoxProcessExited(object? sender, EventArgs e)
    {
        var process = sender as Process;
        var exitCode = process?.ExitCode ?? -1;

        Debug.WriteLine($"[sing-box] Process exited unexpectedly with code: {exitCode}");

        var errorMessage = $"sing-box 进程意外退出 (退出码: {exitCode})";
        _lastError = errorMessage;
        
        _logManager?.AddLog(LogLevel.Error, errorMessage, "v2ray");
        _logManager?.AddLog(LogLevel.Info, "TUN虚拟网络接口已自动清理 (如果使用TUN模式)", "sing-box");

        // Process unexpected exit is a fatal error
        var errorArgs = new V2rayErrorEventArgs
        {
            ProcessId = process?.Id ?? 0,
            ErrorMessage = errorMessage,
            Timestamp = DateTime.Now
        };
        
        ProcessFatalError?.Invoke(this, errorArgs);
        ProcessError?.Invoke(this, errorArgs);

        lock (_processLock)
        {
            _v2rayProcess = null;
            _startTime = null;
        }
    }



    /// <summary>
    /// Start sing-box process for both TUN and System Proxy modes
    /// </summary>
    private async Task StartSingBoxAsync(UserConfig userConfig)
    {
        var modeType = userConfig.ProxyModeType == ProxyModeType.Tun ? "TUN模式" : "系统代理模式";
        Debug.WriteLine($"[V2rayManager] Starting sing-box for {modeType}");
        _logManager?.AddLog(LogLevel.Info, $"正在启动 sing-box ({modeType})", "sing-box");

        lock (_processLock)
        {
            if (_v2rayProcess != null && !_v2rayProcess.HasExited)
            {
                Debug.WriteLine("[sing-box] Process is already running");
                _logManager?.AddLog(LogLevel.Warning, "sing-box进程已在运行", "sing-box");
                return;
            }
            _lastError = null;
        }

        try
        {
            // Generate sing-box config based on mode
            var singBoxConfig = userConfig.ProxyModeType == ProxyModeType.Tun
                ? GenerateSingBoxTunConfig(userConfig)
                : GenerateSingBoxSystemProxyConfig(userConfig);

            // Write sing-box configuration (unified path: singbox_config.json)
            var appDataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "V2rayZ"
            );
            Directory.CreateDirectory(appDataPath);
            var configPath = Path.Combine(appDataPath, "singbox_config.json");

            var options = new JsonSerializerOptions
            {
                WriteIndented = true,
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            };

            var json = JsonSerializer.Serialize(singBoxConfig, options);
            Debug.WriteLine($"[sing-box] Generated configuration:");
            Debug.WriteLine(json);

            var utf8WithoutBom = new UTF8Encoding(false);
            await File.WriteAllTextAsync(configPath, json, utf8WithoutBom);
            Debug.WriteLine($"[sing-box] Configuration written to: {configPath}");

            // Get sing-box executable path
            var singBoxPath = App.ResourceManager?.SingBoxExePath 
                ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", "sing-box.exe");
            
            if (!File.Exists(singBoxPath))
            {
                throw new FileNotFoundException($"sing-box.exe not found at: {singBoxPath}");
            }

            var workingDir = Path.GetDirectoryName(singBoxPath) ?? AppDomain.CurrentDomain.BaseDirectory;
            
            Debug.WriteLine($"[sing-box] Executable: {singBoxPath}");
            Debug.WriteLine($"[sing-box] Config: {configPath}");
            Debug.WriteLine($"[sing-box] Working Directory: {workingDir}");
            Debug.WriteLine($"[sing-box] Mode: {modeType}");
            
            _logManager?.AddLog(LogLevel.Info, $"正在启动 sing-box 核心进程 ({modeType})...", "sing-box");

            var processStartInfo = new ProcessStartInfo
            {
                FileName = singBoxPath,
                Arguments = $"run -c \"{configPath}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                WorkingDirectory = workingDir
            };

            _v2rayProcess = new Process
            {
                StartInfo = processStartInfo,
                EnableRaisingEvents = true
            };

            // Subscribe to sing-box specific process events
            _v2rayProcess.OutputDataReceived += OnSingBoxOutputDataReceived;
            _v2rayProcess.ErrorDataReceived += OnSingBoxErrorDataReceived;
            _v2rayProcess.Exited += OnSingBoxProcessExited;

            // Start the process
            Debug.WriteLine("[sing-box] Attempting to start process...");
            
            if (!_v2rayProcess.Start())
            {
                var errorMessage = "Failed to start sing-box process - Process.Start() returned false";
                Debug.WriteLine($"[sing-box] {errorMessage}");
                throw new InvalidOperationException(errorMessage);
            }

            _startTime = DateTime.Now;

            // Begin async reading of output
            _v2rayProcess.BeginOutputReadLine();
            _v2rayProcess.BeginErrorReadLine();

            Debug.WriteLine($"[sing-box] Process started with PID: {_v2rayProcess.Id}");
            _logManager?.AddLog(LogLevel.Info, $"sing-box 核心进程已启动 (PID: {_v2rayProcess.Id}, 模式: {modeType})", "sing-box");

            // Raise event
            ProcessStarted?.Invoke(this, new V2rayEventArgs
            {
                ProcessId = _v2rayProcess.Id,
                Timestamp = DateTime.Now
            });

            // Wait a bit to ensure process started successfully
            Debug.WriteLine("[sing-box] Waiting for process to stabilize...");
            await Task.Delay(1000);

            if (_v2rayProcess.HasExited)
            {
                var exitCode = _v2rayProcess.ExitCode;
                var errorMessage = $"sing-box 进程启动失败 (退出码: {exitCode}, 模式: {modeType})";
                _lastError = errorMessage;
                
                Debug.WriteLine($"[sing-box] Process exited immediately: {errorMessage}");
                _logManager?.AddLog(LogLevel.Error, errorMessage, "v2ray");
                
                // Startup failure is a fatal error
                var errorArgs = new V2rayErrorEventArgs
                {
                    ProcessId = _v2rayProcess.Id,
                    ErrorMessage = errorMessage,
                    Timestamp = DateTime.Now
                };
                
                ProcessFatalError?.Invoke(this, errorArgs);
                ProcessError?.Invoke(this, errorArgs);
                
                throw new InvalidOperationException(errorMessage);
            }
            
            Debug.WriteLine($"[sing-box] Process started successfully and is running");
            _logManager?.AddLog(LogLevel.Info, $"sing-box 核心进程启动成功，{modeType}代理服务已就绪", "sing-box");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[sing-box] Failed to start: {ex.Message}");
            _logManager?.AddLog(LogLevel.Error, $"sing-box启动失败: {ex.Message}", "sing-box");
            _lastError = ex.Message;
            
            lock (_processLock)
            {
                _v2rayProcess = null;
            }
            
            // Startup exception is a fatal error
            var errorArgs = new V2rayErrorEventArgs
            {
                ErrorMessage = ex.Message,
                Exception = ex
            };
            
            ProcessFatalError?.Invoke(this, errorArgs);
            ProcessError?.Invoke(this, errorArgs);
            
            throw;
        }
    }

    /// <summary>
    /// Generate sing-box configuration for System Proxy mode
    /// </summary>
    private SingBoxConfig GenerateSingBoxSystemProxyConfig(UserConfig userConfig)
    {
        Debug.WriteLine("Generating sing-box System Proxy mode configuration");
        _logManager?.AddLog(LogLevel.Info, "正在生成sing-box系统代理模式配置", "sing-box");

        var selectedServer = userConfig.GetSelectedServer();
        if (selectedServer == null)
        {
            throw new InvalidOperationException("没有选择服务器配置。请先在服务器页面选择一个服务器。");
        }

        var config = new SingBoxConfig
        {
            Log = new LogConfig
            {
                Level = "warn",
                Timestamp = true
            }
        };

        // Configure DNS
        config.Dns = new DnsConfig
        {
            Servers = new List<object>
            {
                new Dictionary<string, object> { { "address", "8.8.8.8" } },
                new Dictionary<string, object> { { "address", "8.8.4.4" } }
            },
            Strategy = "prefer_ipv4"
        };

        // Configure HTTP inbound
        var httpInbound = new Inbound
        {
            Type = "http",
            Tag = "http-in",
            Listen = "127.0.0.1",
            ListenPort = userConfig.HttpPort
        };
        config.Inbounds.Add(httpInbound);
        _logManager?.AddLog(LogLevel.Info, $"HTTP入站配置: 端口={userConfig.HttpPort}", "sing-box");

        // Configure SOCKS inbound
        var socksInbound = new Inbound
        {
            Type = "socks",
            Tag = "socks-in",
            Listen = "127.0.0.1",
            ListenPort = userConfig.SocksPort
        };
        config.Inbounds.Add(socksInbound);
        _logManager?.AddLog(LogLevel.Info, $"SOCKS入站配置: 端口={userConfig.SocksPort}", "sing-box");

        // Configure proxy outbound
        config.Outbounds.Add(CreateSingBoxProxyOutbound(selectedServer));
        _logManager?.AddLog(LogLevel.Info, $"代理出站配置: 协议={selectedServer.Protocol}, 服务器={selectedServer.Address}:{selectedServer.Port}", "sing-box");

        // Configure direct outbound
        config.Outbounds.Add(new Outbound
        {
            Type = "direct",
            Tag = "direct"
        });

        // Configure block outbound
        config.Outbounds.Add(new Outbound
        {
            Type = "block",
            Tag = "block"
        });

        // Configure routing
        config.Route = _routingManager.GenerateSingBoxRouting(userConfig.ProxyMode, userConfig.CustomRules);
        _logManager?.AddLog(LogLevel.Info, $"路由配置: 模式={userConfig.ProxyMode}", "sing-box");

        // Enable cache file for rule sets
        if (config.Route?.RuleSet?.Count > 0)
        {
            config.Experimental = new ExperimentalConfig
            {
                CacheFile = new CacheFileConfig 
                { 
                    Enabled = true,
                    Path = "cache.db"
                }
            };
        }

        _logManager?.AddLog(LogLevel.Info, "sing-box系统代理配置生成完成", "sing-box");
        return config;
    }

    /// <summary>
    /// Generate sing-box configuration for TUN mode
    /// </summary>
    private SingBoxConfig GenerateSingBoxTunConfig(UserConfig userConfig)
    {
        Debug.WriteLine("Generating sing-box TUN mode configuration");
        _logManager?.AddLog(LogLevel.Info, "正在生成sing-box TUN模式配置", "sing-box");

        var selectedServer = userConfig.GetSelectedServer();
        if (selectedServer == null)
        {
            throw new InvalidOperationException("没有选择服务器配置");
        }

        var tunConfig = userConfig.TunConfig;
        var config = new SingBoxConfig
        {
            Log = new LogConfig
            {
                Level = "error",
                Timestamp = true
            }
        };

        // Configure DNS - use UDP for better compatibility
        config.Dns = new DnsConfig
        {
            Servers = new List<object>
            {
                // Remote DNS through proxy
                new Dictionary<string, object>
                {
                    { "tag", "dns-remote" },
                    { "type", "udp" },
                    { "server", "8.8.8.8" },
                    { "detour", "proxy" }
                },
                // Local DNS for direct connections
                new Dictionary<string, object>
                {
                    { "tag", "dns-local" },
                    { "type", "udp" },
                    { "server", "223.5.5.5" }
                }
            },
            Rules = new List<object>
            {
                new Dictionary<string, object>
                {
                    { "rule_set", "geosite-cn" },
                    { "server", "dns-local" }
                },
                new Dictionary<string, object>
                {
                    { "rule_set", "geosite-geolocation-!cn" },
                    { "server", "dns-remote" }
                }
            },
            Final = "dns-remote",
            Strategy = "ipv4_only"
        };

        // Configure TUN inbound
        var tunInbound = new Inbound
        {
            Type = "tun",
            Tag = "tun-in",
            InterfaceName = "tun0",
            Address = new List<string> { "172.19.0.1/30" },
            Mtu = 1400,
            AutoRoute = true,
            StrictRoute = true,
            Stack = "gvisor",
            Sniff = true,
            Platform = new Dictionary<string, object>
            {
                {
                    "http_proxy", new Dictionary<string, object>
                    {
                        { "enabled", true },
                        { "server", "127.0.0.1" },
                        { "server_port", 2080 }
                    }
                }
            }
        };

        config.Inbounds.Add(tunInbound);
        _logManager?.AddLog(LogLevel.Info, "TUN入站配置: 地址=172.19.0.1/30, MTU=1400", "sing-box");

        // Configure proxy outbound
        config.Outbounds.Add(CreateSingBoxProxyOutbound(selectedServer));

        // Configure direct outbound
        config.Outbounds.Add(new Outbound
        {
            Type = "direct",
            Tag = "direct"
        });

        // Configure block outbound
        config.Outbounds.Add(new Outbound
        {
            Type = "block",
            Tag = "block"
        });

        // Configure routing
        config.Route = _routingManager.GenerateSingBoxRouting(userConfig.ProxyMode, userConfig.CustomRules);
        config.Route.DefaultDomainResolver = "dns-local";
        config.Route.AutoDetectInterface = true;

        // Enable cache file for rule sets
        config.Experimental = new ExperimentalConfig
        {
            CacheFile = new CacheFileConfig 
            { 
                Enabled = true,
                Path = "cache.db"
            }
        };

        _logManager?.AddLog(LogLevel.Info, "sing-box TUN配置生成完成", "sing-box");
        return config;
    }

    private Outbound CreateSingBoxProxyOutbound(ServerConfig server)
    {
        var outbound = new Outbound
        {
            Tag = "proxy",
            Server = server.Address,
            ServerPort = server.Port
        };

        if (server.Protocol == ProtocolType.Vless)
        {
            outbound.Type = "vless";
            outbound.Uuid = server.Uuid;
            outbound.Flow = "xtls-rprx-vision";
            outbound.PacketEncoding = "xudp";
        }
        else if (server.Protocol == ProtocolType.Trojan)
        {
            outbound.Type = "trojan";
            outbound.Password = server.Password;
        }

        // Configure TLS
        if (server.Security == SecurityType.Tls)
        {
            outbound.Tls = new TlsConfig
            {
                Enabled = true,
                ServerName = server.TlsSettings?.ServerName ?? server.Address,
                Insecure = server.TlsSettings?.AllowInsecure ?? false,
                Utls = new UtlsConfig
                {
                    Enabled = true,
                    Fingerprint = "chrome"
                }
            };
        }

        // Configure transport
        if (server.Network == NetworkType.Ws && server.WsSettings != null)
        {
            outbound.Transport = new TransportConfig
            {
                Type = "ws",
                Path = server.WsSettings.Path ?? "/",
                Headers = string.IsNullOrEmpty(server.WsSettings.Host)
                    ? null
                    : new Dictionary<string, string> { { "Host", server.WsSettings.Host } }
            };
        }

        return outbound;
    }

    /// <inheritdoc/>
    public async Task<bool> SwitchProxyModeAsync(
        ProxyModeType targetMode, 
        UserConfig userConfig, 
        IConfigurationManager configManager,
        ISystemProxyManager? proxyManager = null)
    {
        // This method will be implemented in a future task
        throw new NotImplementedException("SwitchProxyModeAsync will be implemented in Task 5+");
    }

    /// <inheritdoc/>
    public async Task<(bool IsAvailable, string? ErrorMessage)> ValidateTunModeAsync()
    {
        // This method will be implemented in a future task
        throw new NotImplementedException("ValidateTunModeAsync will be implemented in Task 5+");
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
