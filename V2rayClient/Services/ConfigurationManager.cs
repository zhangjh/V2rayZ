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
    /// Load configuration from file
    /// </summary>
    public UserConfig LoadConfig()
    {
        try
        {
            if (File.Exists(_configFilePath))
            {
                var json = File.ReadAllText(_configFilePath);
                var config = JsonSerializer.Deserialize<UserConfig>(json, _jsonOptions);

                if (config != null)
                {
                    // Configuration migration: detect and migrate old configs without Protocol field
                    bool needsMigration = false;

                    // Check if this is an old configuration by examining the JSON
                    // If the Protocol field is missing from JSON, it will be default (Vless)
                    // but we need to detect if it was explicitly set or defaulted
                    using (var jsonDoc = JsonDocument.Parse(json))
                    {
                        if (jsonDoc.RootElement.TryGetProperty("server", out var serverElement))
                        {
                            // If the protocol property doesn't exist in the JSON, this is an old config
                            if (!serverElement.TryGetProperty("protocol", out _))
                            {
                                needsMigration = true;
                                // Explicitly set protocol to Vless for old configurations
                                config.Server.Protocol = ProtocolType.Vless;
                                Console.WriteLine("Detected old configuration format. Migrating to include Protocol field (defaulting to Vless).");
                            }
                        }
                    }

                    // Perform basic validation during load (less strict than save validation)
                    try
                    {
                        ValidateConfigForLoad(config);
                    }
                    catch (Exception validationEx)
                    {
                        Console.WriteLine($"Warning: Configuration validation failed during load: {validationEx.Message}");
                        Console.WriteLine("Using configuration anyway, validation will be enforced on save.");
                    }
                    
                    _currentConfig = config;

                    // Save migrated configuration back to file
                    if (needsMigration)
                    {
                        try
                        {
                            var migratedJson = JsonSerializer.Serialize(config, _jsonOptions);
                            File.WriteAllText(_configFilePath, migratedJson);
                            Console.WriteLine("Configuration migration completed and saved.");
                        }
                        catch (Exception migrationEx)
                        {
                            Console.WriteLine($"Warning: Failed to save migrated configuration: {migrationEx.Message}");
                            // Continue with the migrated config in memory even if save fails
                        }
                    }

                    return config;
                }
            }
        }
        catch (Exception ex)
        {
            // Log error and return default config
            Console.WriteLine($"Error loading config: {ex.Message}");
        }

        // Return default configuration if file doesn't exist or error occurred
        _currentConfig = CreateDefaultConfig();
        return _currentConfig;
    }

    /// <summary>
    /// Save configuration to file
    /// </summary>
    public void SaveConfig(UserConfig config)
    {
        try
        {
            // Validate configuration before saving
            ValidateConfig(config);

            var json = JsonSerializer.Serialize(config, _jsonOptions);
            File.WriteAllText(_configFilePath, json);
            
            Console.WriteLine($"Configuration saved to: {_configFilePath}");
            Console.WriteLine($"Server: {config.Server.Protocol} - {config.Server.Address}:{config.Server.Port}");

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
        // Only perform basic validation during load
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

        // Validate server config with detailed error reporting
        var serverContext = new ValidationContext(config.Server);
        var serverResults = new List<ValidationResult>();

        if (!Validator.TryValidateObject(config.Server, serverContext, serverResults, true))
        {
            var errors = string.Join(", ", serverResults.Select(r => r.ErrorMessage));
            Console.WriteLine($"[ConfigManager] Server validation failed: {errors}");
            throw new ValidationException($"Server configuration validation failed: {errors}");
        }

        // Additional protocol-specific validation
        if (config.Server.Protocol == ProtocolType.Vless)
        {
            if (string.IsNullOrWhiteSpace(config.Server.Uuid))
            {
                throw new ValidationException("VLESS protocol requires a valid UUID");
            }
            
            // Validate UUID format
            if (!System.Text.RegularExpressions.Regex.IsMatch(config.Server.Uuid, 
                @"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", 
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            {
                throw new ValidationException("UUID format is invalid");
            }
        }
        else if (config.Server.Protocol == ProtocolType.Trojan)
        {
            if (string.IsNullOrWhiteSpace(config.Server.Password))
            {
                throw new ValidationException("Trojan protocol requires a password");
            }
        }

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
    /// Create default configuration
    /// </summary>
    private UserConfig CreateDefaultConfig()
    {
        return new UserConfig
        {
            Server = new ServerConfig
            {
                Protocol = ProtocolType.Vless,
                Address = "",
                Port = 443,
                Uuid = null,
                Encryption = "none",
                Password = null,
                Network = NetworkType.Tcp,
                Security = SecurityType.None
            },
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
