using V2rayClient.Models;
using V2rayClient.Models.V2ray;

namespace V2rayClient.Services;

/// <summary>
/// Interface for managing V2ray routing rules
/// </summary>
public interface IRoutingRuleManager
{
    /// <summary>
    /// Generate routing rules based on proxy mode and custom rules
    /// </summary>
    /// <param name="mode">Proxy mode (Global, Smart, Direct)</param>
    /// <param name="customRules">List of custom domain rules</param>
    /// <returns>List of routing rules for V2ray configuration</returns>
    List<RoutingRule> GenerateRoutingRules(ProxyMode mode, List<DomainRule> customRules);
}
