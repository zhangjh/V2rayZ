using System.ComponentModel.DataAnnotations;
using System.IO;
using System.Text.Json;
using V2rayClient.Models;
using Serilog;

namespace V2rayClient.Services;

/// <summary>
/// Configuration manager implementation
/// </summary>
public class ConfigurationManager : IConfigurationManager
{
    private readonly string _configFilePath;
    private UserConfig? _currentConfig;
    private readonly JsonSerializerOptions _jsonOptions;

    public event EventHandler<ConfigChangedEventArgs>? ConfigChanged;

    public ConfigurationManager()
    {
        // Get config file path in %APPDATA%\V2rayZ\config.json
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var appFolder = Path.Combine(appDataPath, "V2rayZ");
        
        // Ensure directory exists
        if (!Directory.Exists(appFolder))
        {
            Directory.CreateDirectory(appFolder);
        }

        _configFilePath = Path.Combine(appFolder, "config.json");

        // Configure JSON serialization options
        _jsonOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
        };
    }

    /// <summary>
    /// Load configuration from file or return cached config
    /// </summary>
    public UserConfig LoadConfig()
    {
        Log.Debug("[ConfigManager] Loading configuration from {ConfigFilePath}", _configFilePath);
        
        // If we have a cached config, return it
        if (_currentConfig != null)
        {
            Log.Debug("[ConfigManager] Found cached configuration with {ServersCount} servers", _currentConfig.Servers?.Count ?? 0);
            return _currentConfig;
        }
        
        try
        {
            if (File.Exists(_configFilePath))
            {
                var json = File.ReadAllText(_configFilePath);
                Log.Debug("[ConfigManager] Configuration file loaded, size: {ContentLength} bytes", json.Length);
                
                var config = JsonSerializer.Deserialize<UserConfig>(json, _jsonOptions);

                if (config != null)
                {
                    Log.Information("[ConfigManager] Configuration loaded successfully - {ServersCount} servers, selected: {SelectedServerId}", 
                        config.Servers?.Count ?? 0, config.SelectedServerId ?? "none");
                    
                    // Validate configuration
                    try
                    {
                        ValidateConfigForLoad(config);
                        Log.Debug("[ConfigManager] Configuration validation passed");
                    }
                    catch (Exception validationEx)
                    {
                        Log.Warning("[ConfigManager] Warning: Configuration validation failed during load: {ValidationError}", validationEx.Message);
                        Log.Information("[ConfigManager] Using configuration anyway, validation will be enforced on save.");
                    }
                    
                    _currentConfig = config;
                    return config;
                }
                else
                {
                    Log.Error("[ConfigManager] Failed to deserialize configuration - config is null");
                }
            }
            else
            {
                Log.Information("[ConfigManager] Configuration file does not exist, creating default configuration");
            }
        }
        catch (Exception ex)
        {
            // Log error and return default config
            Log.Error(ex, "[ConfigManager] Error loading config: {ErrorMessage}", ex.Message);
            Log.Error("[ConfigManager] Exception type: {ExceptionType}", ex.GetType().Name);
        }

        // Return default configuration if file doesn't exist or error occurred
        Log.Information("[ConfigManager] Using default configuration");
        _currentConfig = CreateDefaultConfig();
        return _currentConfig;
    }

    /// <summary>
    /// Save configuration to file with localStorage fallback
    /// </summary>
    public void SaveConfig(UserConfig config)
    {
        try
        {
            Log.Information("[ConfigManager] ========== SAVE CONFIG START ==========");
            Log.Information("[ConfigManager] Config path: {ConfigPath}", _configFilePath);
            Log.Information("[ConfigManager] Servers count: {ServersCount}", config.Servers?.Count ?? 0);
            Log.Information("[ConfigManager] Selected server ID: {SelectedServerId}", config.SelectedServerId);
            
            // Validate configuration before saving
            Log.Information("[ConfigManager] Validating configuration...");
            ValidateConfig(config);
            Log.Information("[ConfigManager] Configuration validation passed");

            var json = JsonSerializer.Serialize(config, _jsonOptions);
            Log.Information("[ConfigManager] Serialized JSON length: {JsonLength}", json.Length);
            
            // Try to save to file first
            try
            {
                File.WriteAllText(_configFilePath, json);
                Log.Information("[ConfigManager] Configuration written to file successfully");
            }
            catch (Exception fileEx)
            {
                Log.Warning(fileEx, "[ConfigManager] Failed to write to file: {FileError}", fileEx.Message);
                Log.Information("[ConfigManager] Configuration will be stored in memory only");
                // Don't throw here, just log the error and continue with in-memory storage
            }
            
            Log.Information("Configuration processed for: {ConfigFilePath}", _configFilePath);
            
            var selectedServer = config.GetSelectedServer();
            if (selectedServer != null)
            {
                Log.Information("Selected Server: {ServerName} ({Protocol}) - {Address}:{Port}", selectedServer.Name, selectedServer.Protocol, selectedServer.Address, selectedServer.Port);
            }
            else
            {
                Log.Information("No server selected");
            }
            
            Log.Information("[ConfigManager] ========== SAVE CONFIG SUCCESS ==========");

            var oldConfig = _currentConfig;
            _currentConfig = config;

            // Raise config changed event
            ConfigChanged?.Invoke(this, new ConfigChangedEventArgs
            {
                OldValue = oldConfig,
                NewValue = config
            });
        }
        catch (ValidationException)
        {
            // Re-throw validation exceptions as-is so they can be handled properly by the API
            throw;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Failed to save configuration: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Get a specific configuration value
    /// </summary>
    public T? Get<T>(string key)
    {
        if (_currentConfig == null)
        {
            LoadConfig();
        }

        if (_currentConfig == null)
        {
            return default;
        }

        // Use reflection to get property value
        var property = typeof(UserConfig).GetProperty(key);
        if (property != null)
        {
            var value = property.GetValue(_currentConfig);
            if (value is T typedValue)
            {
                return typedValue;
            }
        }

        return default;
    }

    /// <summary>
    /// Set a specific configuration value
    /// </summary>
    public void Set(string key, object value)
    {
        if (_currentConfig == null)
        {
            LoadConfig();
        }

        if (_currentConfig == null)
        {
            return;
        }

        var property = typeof(UserConfig).GetProperty(key);
        if (property != null && property.CanWrite)
        {
            var oldValue = property.GetValue(_currentConfig);
            property.SetValue(_currentConfig, value);

            // Save configuration
            SaveConfig(_currentConfig);

            // Raise specific property changed event
            ConfigChanged?.Invoke(this, new ConfigChangedEventArgs
            {
                Key = key,
                OldValue = oldValue,
                NewValue = value
            });
        }
    }

    /// <summary>
    /// Validate configuration for loading (less strict)
    /// </summary>
    private void ValidateConfigForLoad(UserConfig config)
    {
        // Only validate that the basic structure is present
        // Servers list can be empty for new installations
        if (config.Servers == null)
        {
            config.Servers = new List<ServerConfigWithId>();
        }
        
        if (config.CustomRules == null)
        {
            config.CustomRules = new List<DomainRule>();
        }
    }

    /// <summary>
    /// Validate configuration using DataAnnotations (strict validation for saving)
    /// </summary>
    private void ValidateConfig(UserConfig config)
    {
        var validationContext = new ValidationContext(config);
        var validationResults = new List<ValidationResult>();

        if (!Validator.TryValidateObject(config, validationContext, validationResults, true))
        {
            var errors = string.Join(", ", validationResults.Select(r => r.ErrorMessage));
            throw new ValidationException($"Configuration validation failed: {errors}");
        }

        // Validate servers
        if (config.Servers != null && config.Servers.Count > 0)
        {
            foreach (var server in config.Servers)
            {
                ValidateServerConfig(server);
            }
        }
        // Allow empty servers list - this is valid for new installations

        // Validate custom rules
        foreach (var rule in config.CustomRules)
        {
            var ruleContext = new ValidationContext(rule);
            var ruleResults = new List<ValidationResult>();

            if (!Validator.TryValidateObject(rule, ruleContext, ruleResults, true))
            {
                var errors = string.Join(", ", ruleResults.Select(r => r.ErrorMessage));
                throw new ValidationException($"Domain rule validation failed: {errors}");
            }
        }
    }

    /// <summary>
    /// Validate a server configuration
    /// </summary>
    private void ValidateServerConfig(ServerConfig server)
    {
        var serverContext = new ValidationContext(server);
        var serverResults = new List<ValidationResult>();

        if (!Validator.TryValidateObject(server, serverContext, serverResults, true))
        {
            var errors = string.Join(", ", serverResults.Select(r => r.ErrorMessage));
            Log.Error("[ConfigManager] Server validation failed: {ValidationErrors}", errors);
            throw new ValidationException($"Server configuration validation failed: {errors}");
        }

        // Additional protocol-specific validation
        if (server.Protocol == ProtocolType.Vless)
        {
            if (string.IsNullOrWhiteSpace(server.Uuid))
            {
                throw new ValidationException("VLESS protocol requires a valid UUID");
            }
            
            // Validate UUID format
            if (!System.Text.RegularExpressions.Regex.IsMatch(server.Uuid, 
                @"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", 
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            {
                throw new ValidationException("UUID format is invalid");
            }
        }
        else if (server.Protocol == ProtocolType.Trojan)
        {
            if (string.IsNullOrWhiteSpace(server.Password))
            {
                throw new ValidationException("Trojan protocol requires a password");
            }
        }
    }

    /// <summary>
    /// Create default configuration
    /// </summary>
    private UserConfig CreateDefaultConfig()
    {
        return new UserConfig
        {
            Servers = new List<ServerConfigWithId>(),
            SelectedServerId = null,
            ProxyMode = ProxyMode.Smart,
            CustomRules = new List<DomainRule>(),
            AutoStart = false,
            AutoConnect = false,
            MinimizeToTray = true,
            SocksPort = 65534,
            HttpPort = 65533
        };
    }

    /// <summary>
    /// Sync auto-start setting with actual registry state
    /// </summary>
    public void SyncAutoStartSetting(IStartupManager startupManager)
    {
        if (_currentConfig == null) return;

        try
        {
            var actualAutoStart = startupManager.IsAutoStartEnabled();
            if (_currentConfig.AutoStart != actualAutoStart)
            {
                Log.Information("[ConfigManager] Syncing auto-start setting: config={ConfigAutoStart}, registry={RegistryAutoStart}", 
                    _currentConfig.AutoStart, actualAutoStart);
                
                _currentConfig.AutoStart = actualAutoStart;
                SaveConfig(_currentConfig);
            }
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "[ConfigManager] Failed to sync auto-start setting: {Error}", ex.Message);
        }
    }
}
