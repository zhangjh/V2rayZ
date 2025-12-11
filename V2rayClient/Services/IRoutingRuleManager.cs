using V2rayClient.Models;
using V2rayClient.Models.SingBox;

namespace V2rayClient.Services;

/// <summary>
/// Interface for managing sing-box routing rules
/// </summary>
public interface IRoutingRuleManager
{
    /// <summary>
    /// Event raised when routing rules are updated and require restart
    /// </summary>
    event EventHandler<RoutingRulesChangedEventArgs>? RoutingRulesChanged;

    /// <summary>
    /// Generate sing-box format routing configuration based on proxy mode and custom rules.
    /// This is the primary method for generating routing rules for sing-box core.
    /// </summary>
    /// <param name="mode">Proxy mode (Global, Smart, Direct)</param>
    /// <param name="customRules">List of custom domain rules</param>
    /// <returns>RouteConfig for sing-box configuration</returns>
    RouteConfig GenerateSingBoxRouting(ProxyMode mode, List<DomainRule> customRules);

    /// <summary>
    /// [Obsolete] Generate v2ray-core format routing rules.
    /// This method is deprecated and kept only for backward compatibility.
    /// Use GenerateSingBoxRouting instead for all new code.
    /// </summary>
    /// <param name="mode">Proxy mode (Global, Smart, Direct)</param>
    /// <param name="customRules">List of custom domain rules</param>
    /// <returns>Empty list (v2ray-core support has been removed)</returns>
    [Obsolete("This method is deprecated. Use GenerateSingBoxRouting instead. V2ray-core support has been removed in favor of sing-box.")]
    List<object> GenerateRoutingRules(ProxyMode mode, List<DomainRule> customRules);

    /// <summary>
    /// Notify that routing rules have been updated
    /// </summary>
    /// <param name="changeType">Type of change that occurred</param>
    void NotifyRulesChanged(RuleChangeType changeType);
}

/// <summary>
/// Event arguments for routing rules changed event
/// </summary>
public class RoutingRulesChangedEventArgs : EventArgs
{
    /// <summary>
    /// Type of change that occurred
    /// </summary>
    public RuleChangeType ChangeType { get; set; }

    /// <summary>
    /// Timestamp of the change
    /// </summary>
    public DateTime Timestamp { get; set; } = DateTime.Now;
}

/// <summary>
/// Type of routing rule change
/// </summary>
public enum RuleChangeType
{
    /// <summary>
    /// Rule was added
    /// </summary>
    Added,

    /// <summary>
    /// Rule was updated
    /// </summary>
    Updated,

    /// <summary>
    /// Rule was deleted
    /// </summary>
    Deleted,

    /// <summary>
    /// Multiple rules were added in batch
    /// </summary>
    BatchAdded
}
