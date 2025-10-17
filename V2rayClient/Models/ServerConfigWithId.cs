using System.ComponentModel.DataAnnotations;

namespace V2rayClient.Models;

/// <summary>
/// Server configuration with unique identifier and metadata
/// </summary>
public class ServerConfigWithId : ServerConfig
{
    /// <summary>
    /// Unique identifier for the server configuration
    /// </summary>
    [Required]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// User-friendly name for the server
    /// </summary>
    [Required(ErrorMessage = "服务器名称不能为空")]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Creation timestamp
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Last update timestamp
    /// </summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}