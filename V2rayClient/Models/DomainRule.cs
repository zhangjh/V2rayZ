using System.ComponentModel.DataAnnotations;

namespace V2rayClient.Models;

/// <summary>
/// Custom domain routing rule
/// </summary>
public class DomainRule
{
    /// <summary>
    /// Unique identifier for the rule
    /// </summary>
    [Required]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    /// <summary>
    /// Domain name or pattern (supports wildcards like *.example.com)
    /// </summary>
    [Required(ErrorMessage = "域名不能为空")]
    [MaxLength(255)]
    [RegularExpression(@"^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$",
        ErrorMessage = "域名格式无效")]
    public string Domain { get; set; } = string.Empty;

    /// <summary>
    /// Routing strategy (Proxy or Direct)
    /// </summary>
    public RuleStrategy Strategy { get; set; } = RuleStrategy.Proxy;

    /// <summary>
    /// Whether this rule is enabled
    /// </summary>
    public bool Enabled { get; set; } = true;
}
