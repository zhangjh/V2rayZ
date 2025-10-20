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
    /// List of domain names or patterns (supports wildcards like *.example.com)
    /// </summary>
    [Required(ErrorMessage = "域名列表不能为空")]
    [MinLength(1, ErrorMessage = "至少需要一个域名")]
    public List<string> Domains { get; set; } = new();

    /// <summary>
    /// Routing strategy (Proxy or Direct)
    /// </summary>
    public RuleStrategy Strategy { get; set; } = RuleStrategy.Proxy;

    /// <summary>
    /// Whether this rule is enabled
    /// </summary>
    public bool Enabled { get; set; } = true;
}
