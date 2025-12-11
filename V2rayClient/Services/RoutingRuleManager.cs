using System.IO;
using V2rayClient.Models;
using V2rayClient.Models.SingBox;

namespace V2rayClient.Services;

/// <summary>
/// Service for managing sing-box routing rules
/// </summary>
public class RoutingRuleManager : IRoutingRuleManager
{
    /// <summary>
    /// Event raised when routing rules are updated and require restart
    /// </summary>
    public event EventHandler<RoutingRulesChangedEventArgs>? RoutingRulesChanged;

    /// <summary>
    /// Notify that routing rules have been updated
    /// </summary>
    /// <param name="changeType">Type of change that occurred</param>
    public void NotifyRulesChanged(RuleChangeType changeType)
    {
        RoutingRulesChanged?.Invoke(this, new RoutingRulesChangedEventArgs
        {
            ChangeType = changeType,
            Timestamp = DateTime.Now
        });
    }

    /// <summary>
    /// Generate sing-box format routing configuration based on proxy mode and custom rules.
    /// This is the primary method for generating routing rules for sing-box core.
    /// </summary>
    /// <param name="mode">Proxy mode (Global, Smart, Direct)</param>
    /// <param name="customRules">List of custom domain rules</param>
    /// <returns>RouteConfig for sing-box configuration</returns>
    public RouteConfig GenerateSingBoxRouting(ProxyMode mode, List<DomainRule> customRules)
    {
        var routeConfig = new RouteConfig
        {
            Rules = new List<RouteRule>(),
            DefaultDomainResolver = "dns-local"
        };

        // Priority 1: Custom domain rules (highest priority)
        routeConfig.Rules.AddRange(GenerateSingBoxCustomRules(customRules));

        // Priority 2: Mode-specific rules
        switch (mode)
        {
            case ProxyMode.Global:
                routeConfig.Final = "proxy";
                break;
            case ProxyMode.Smart:
                routeConfig.RuleSet = GenerateSingBoxRuleSets();
                routeConfig.Rules.AddRange(GenerateSingBoxSmartModeRules());
                routeConfig.Final = "proxy";
                break;
            case ProxyMode.Direct:
                routeConfig.Final = "direct";
                break;
        }

        return routeConfig;
    }

    /// <summary>
    /// Generate sing-box routing rules from custom domain rules
    /// </summary>
    private List<RouteRule> GenerateSingBoxCustomRules(List<DomainRule> customRules)
    {
        var rules = new List<RouteRule>();

        if (customRules == null || customRules.Count == 0)
        {
            return rules;
        }

        // Process each custom rule individually to maintain order
        foreach (var customRule in customRules.Where(r => r.Enabled))
        {
            var (exactDomains, suffixDomains) = SplitDomainsBySingBoxFormat(customRule.Domains);
            
            var (action, outbound) = customRule.Strategy switch
            {
                RuleStrategy.Proxy => ("route", "proxy"),
                RuleStrategy.Direct => ("route", "direct"),
                RuleStrategy.Block => ("reject", null),
                _ => ("route", "direct")
            };
            
            var rule = new RouteRule { Action = action };
            if (outbound != null) rule.Outbound = outbound;
            if (exactDomains.Count > 0) rule.Domain = exactDomains;
            if (suffixDomains.Count > 0) rule.DomainSuffix = suffixDomains;
            
            rules.Add(rule);
        }

        return rules;
    }

    /// <summary>
    /// Generate sing-box rule sets for Smart mode
    /// </summary>
    private List<RuleSet> GenerateSingBoxRuleSets()
    {
        var geositeDir = App.ResourceManager?.GeositeDir 
            ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Resources", "geosite");
        
        return new List<RuleSet>
        {
            new RuleSet
            {
                Tag = "geosite-cn",
                Type = "local",
                Format = "binary",
                Path = Path.Combine(geositeDir, "geosite-cn.srs")
            },
            new RuleSet
            {
                Tag = "geosite-geolocation-!cn",
                Type = "local",
                Format = "binary",
                Path = Path.Combine(geositeDir, "geosite-geolocation-!cn.srs")
            },
            new RuleSet
            {
                Tag = "geoip-cn",
                Type = "local",
                Format = "binary",
                Path = Path.Combine(geositeDir, "geoip-cn.srs")
            }
        };
    }

    /// <summary>
    /// Generate sing-box routing rules for Smart mode (China direct, others proxy)
    /// </summary>
    private List<RouteRule> GenerateSingBoxSmartModeRules()
    {
        return new List<RouteRule>
        {
            // DNS hijacking
            new RouteRule
            {
                Protocol = "dns",
                Action = "hijack-dns"
            },
            // Block QUIC to prevent UDP-based protocols
            new RouteRule
            {
                Protocol = "quic",
                Action = "reject"
            },
            // Foreign domains go proxy
            new RouteRule
            {
                RuleSet = "geosite-geolocation-!cn",
                Action = "route",
                Outbound = "proxy"
            },
            // Chinese domains go direct
            new RouteRule
            {
                RuleSet = "geosite-cn",
                Action = "route",
                Outbound = "direct"
            },
            // Chinese IPs go direct
            new RouteRule
            {
                RuleSet = "geoip-cn",
                Action = "route",
                Outbound = "direct"
            }
        };
    }

    /// <summary>
    /// Split domains into exact match and suffix match for sing-box format
    /// </summary>
    /// <param name="domains">List of domain patterns</param>
    /// <returns>Tuple of (exact domains, suffix domains)</returns>
    private (List<string> exactDomains, List<string> suffixDomains) SplitDomainsBySingBoxFormat(List<string> domains)
    {
        var exactDomains = new List<string>();
        var suffixDomains = new List<string>();

        foreach (var domain in domains)
        {
            if (string.IsNullOrWhiteSpace(domain))
            {
                continue;
            }

            var trimmedDomain = domain.Trim().ToLowerInvariant();

            // If domain starts with *., it's a suffix match
            // *.example.com -> example.com (matches example.com and all subdomains)
            if (trimmedDomain.StartsWith("*."))
            {
                suffixDomains.Add(trimmedDomain.Substring(2));
            }
            else
            {
                // Exact domain match
                exactDomains.Add(trimmedDomain);
            }
        }

        return (exactDomains, suffixDomains);
    }

    /// <summary>
    /// [Obsolete] Generate v2ray-core format routing rules.
    /// This method is deprecated and kept only for backward compatibility.
    /// Use GenerateSingBoxRouting instead for all new code.
    /// </summary>
    /// <param name="mode">Proxy mode (Global, Smart, Direct)</param>
    /// <param name="customRules">List of custom domain rules</param>
    /// <returns>Empty list (v2ray-core support has been removed)</returns>
    [Obsolete("This method is deprecated. Use GenerateSingBoxRouting instead. V2ray-core support has been removed in favor of sing-box.")]
    public List<object> GenerateRoutingRules(ProxyMode mode, List<DomainRule> customRules)
    {
        // V2ray-core support has been removed. This method returns an empty list for backward compatibility.
        // All routing should now use GenerateSingBoxRouting which returns RouteConfig for sing-box.
        return new List<object>();
    }
}
