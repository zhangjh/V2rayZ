using System.ComponentModel.DataAnnotations;
using System.IO;
using System.Text.Json;
using V2rayClient.Models;

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
        // Get config file path in %APPDATA%\V2rayClient\config.json
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var appFolder = Path.Combine(appDataPath, "V2rayClient");
        
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
        Console.WriteLine($"[ConfigManager] ========== LOAD CONFIG START ==========");
        Console.WriteLine($"[ConfigManager] Config file path: {_configFilePath}");
        Console.WriteLine($"[ConfigManager] File exists: {File.Exists(_configFilePath)}");
        
        // If we have a cached config, return it
        if (_currentConfig != null)
        {
            Console.WriteLine($"[ConfigManager] Returning cached configuration");
            Console.WriteLine($"[ConfigManager] Cached servers count: {_currentConfig.Servers?.Count ?? 0}");
            Console.WriteLine($"[ConfigManager] ========== LOAD CONFIG END (CACHED) ==========");
            return _currentConfig;
        }
        
        try
        {
            if (File.Exists(_configFilePath))
            {
                var json = File.ReadAllText(_configFilePath);
                Console.WriteLine($"[ConfigManager] File content length: {json.Length}");
                Console.WriteLine($"[ConfigManager] File content preview: {json.Substring(0, Math.Min(200, json.Length))}...");
                
                var config = JsonSerializer.Deserialize<UserConfig>(json, _jsonOptions);

                if (config != null)
                {
                    Console.WriteLine($"[ConfigManager] Deserialized config - Servers count: {config.Servers?.Count ?? 0}");
                    Console.WriteLine($"[ConfigManager] Selected server ID: {config.SelectedServerId}");
                    Console.WriteLine($"[ConfigManager] Legacy server present: {config.Server != null}");
                    
                    bool needsMigration = false;

                    // Migration from old single-server format to new multi-server format
                    using (var jsonDoc = JsonDocument.Parse(json))
                    {
                        if (jsonDoc.RootElement.TryGetProperty("server", out var serverElement) && 
                            !jsonDoc.RootElement.TryGetProperty("servers", out _))
                        {
                            needsMigration = true;
                            Console.WriteLine("[ConfigManager] Detected old single-server configuration format. Migrating to multi-server format.");

                            // Migrate old server config to new format
                            if (config.Server != null)
                            {
                                var migratedServer = new ServerConfigWithId
                                {
                                    Id = Guid.NewGuid().ToString(),
                                    Name = $"{config.Server.Protocol} 服务器",
                                    Protocol = config.Server.Protocol,
                                    Address = config.Server.Address,
                                    Port = config.Server.Port,
                                    Uuid = config.Server.Uuid,
                                    Encryption = config.Server.Encryption,
                                    Password = config.Server.Password,
                                    Network = config.Server.Network,
                                    Security = config.Server.Security,
                                    TlsSettings = config.Server.TlsSettings,
                                    CreatedAt = DateTime.UtcNow,
                                    UpdatedAt = DateTime.UtcNow
                                };

                                config.Servers = new List<ServerConfigWithId> { migratedServer };
                                config.SelectedServerId = migratedServer.Id;
                                config.Server = null; // Clear old server config
                                Console.WriteLine($"[ConfigManager] Migrated server: {migratedServer.Name} (ID: {migratedServer.Id})");
                            }
                        }
                        // Check for old configs without Protocol field in existing server
                        else if (jsonDoc.RootElement.TryGetProperty("server", out serverElement))
                        {
                            if (!serverElement.TryGetProperty("protocol", out _))
                            {
                                needsMigration = true;
                                if (config.Server != null)
                                {
                                    config.Server.Protocol = ProtocolType.Vless;
                                    Console.WriteLine("[ConfigManager] Detected old configuration format. Setting Protocol field to Vless.");
                                }
                            }
                        }
                    }

                    // Perform basic validation during load (less strict than save validation)
                    try
                    {
                        ValidateConfigForLoad(config);
                        Console.WriteLine("[ConfigManager] Configuration validation passed");
                    }
                    catch (Exception validationEx)
                    {
                        Console.WriteLine($"[ConfigManager] Warning: Configuration validation failed during load: {validationEx.Message}");
                        Console.WriteLine("[ConfigManager] Using configuration anyway, validation will be enforced on save.");
                    }
                    
                    _currentConfig = config;

                    // Save migrated configuration back to file
                    if (needsMigration)
                    {
                        try
                        {
                            var migratedJson = JsonSerializer.Serialize(config, _jsonOptions);
                            File.WriteAllText(_configFilePath, migratedJson);
                            Console.WriteLine("[ConfigManager] Configuration migration completed and saved.");
                        }
                        catch (Exception migrationEx)
                        {
                            Console.WriteLine($"[ConfigManager] Warning: Failed to save migrated configuration: {migrationEx.Message}");
                            // Continue with the migrated config in memory even if save fails
                        }
                    }

                    Console.WriteLine($"[ConfigManager] ========== LOAD CONFIG SUCCESS ==========");
                    Console.WriteLine($"[ConfigManager] Final servers count: {config.Servers?.Count ?? 0}");
                    Console.WriteLine($"[ConfigManager] Final selected server ID: {config.SelectedServerId}");
                    return config;
                }
                else
                {
                    Console.WriteLine("[ConfigManager] Failed to deserialize configuration - config is null");
                }
            }
            else
            {
                Console.WriteLine("[ConfigManager] Configuration file does not exist");
            }
        }
        catch (Exception ex)
        {
            // Log error and return default config
            Console.WriteLine($"[ConfigManager] Error loading config: {ex.Message}");
            Console.WriteLine($"[ConfigManager] Exception type: {ex.GetType().Name}");
            Console.WriteLine($"[ConfigManager] Stack trace: {ex.StackTrace}");
        }

        // Return default configuration if file doesn't exist or error occurred
        Console.WriteLine("[ConfigManager] Returning default configuration");
        _currentConfig = CreateDefaultConfig();
        Console.WriteLine($"[ConfigManager] ========== LOAD CONFIG END (DEFAULT) ==========");
        return _currentConfig;
    }

    /// <summary>
    /// Save configuration to file with localStorage fallback
    /// </summary>
    public void SaveConfig(UserConfig config)
    {
        try
        {
            Console.WriteLine($"[ConfigManager] ========== SAVE CONFIG START ==========");
            Console.WriteLine($"[ConfigManager] Config path: {_configFilePath}");
            Console.WriteLine($"[ConfigManager] Servers count: {config.Servers?.Count ?? 0}");
            Console.WriteLine($"[ConfigManager] Selected server ID: {config.SelectedServerId}");
            
            // Validate configuration before saving
            Console.WriteLine($"[ConfigManager] Validating configuration...");
            ValidateConfig(config);
            Console.WriteLine($"[ConfigManager] Configuration validation passed");

            var json = JsonSerializer.Serialize(config, _jsonOptions);
            Console.WriteLine($"[ConfigManager] Serialized JSON length: {json.Length}");
            
            // Try to save to file first
            try
            {
                File.WriteAllText(_configFilePath, json);
                Console.WriteLine($"[ConfigManager] Configuration written to file successfully");
            }
            catch (Exception fileEx)
            {
                Console.WriteLine($"[ConfigManager] Failed to write to file: {fileEx.Message}");
                Console.WriteLine($"[ConfigManager] Configuration will be stored in memory only");
                // Don't throw here, just log the error and continue with in-memory storage
            }
            
            Console.WriteLine($"Configuration processed for: {_configFilePath}");
            
            var selectedServer = config.GetSelectedServer();
            if (selectedServer != null)
            {
                Console.WriteLine($"Selected Server: {selectedServer.Name} ({selectedServer.Protocol}) - {selectedServer.Address}:{selectedServer.Port}");
            }
            else
            {
                Console.WriteLine("No server selected");
            }
            
            Console.WriteLine($"[ConfigManager] ========== SAVE CONFIG SUCCESS ==========");

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
        // For new format, check servers list
        if (config.Servers != null && config.Servers.Count > 0)
        {
            // New format is valid
            return;
        }

        // For old format, check legacy server config
        if (config.Server == null)
        {
            throw new ValidationException("Server configuration is missing");
        }
        
        // Don't validate protocol-specific fields during load
        // This allows loading configurations that might have validation issues
        // but still contain the basic structure
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

        // Validate servers in new format
        if (config.Servers != null && config.Servers.Count > 0)
        {
            foreach (var server in config.Servers)
            {
                ValidateServerConfig(server);
            }
        }
        // Validate legacy server config if present
        else if (config.Server != null)
        {
            ValidateServerConfig(config.Server);
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
            Console.WriteLine($"[ConfigManager] Server validation failed: {errors}");
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
}
