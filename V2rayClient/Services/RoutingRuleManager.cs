using V2rayClient.Models;
using V2rayClient.Models.V2ray;

namespace V2rayClient.Services;

/// <summary>
/// Service for managing V2ray routing rules
/// </summary>
public class RoutingRuleManager : IRoutingRuleManager
{
    /// <summary>
    /// Generate routing rules based on proxy mode and custom rules
    /// </summary>
    /// <param name="mode">Proxy mode (Global, Smart, Direct)</param>
    /// <param name="customRules">List of custom domain rules</param>
    /// <returns>List of routing rules for V2ray configuration</returns>
    public List<RoutingRule> GenerateRoutingRules(ProxyMode mode, List<DomainRule> customRules)
    {
        var rules = new List<RoutingRule>();

        // Priority 1: Custom domain rules (highest priority)
        rules.AddRange(GenerateCustomRules(customRules));

        // Priority 2: Mode-specific rules
        switch (mode)
        {
            case ProxyMode.Global:
                rules.AddRange(GenerateGlobalModeRules());
                break;
            case ProxyMode.Smart:
                rules.AddRange(GenerateSmartModeRules());
                break;
            case ProxyMode.Direct:
                rules.AddRange(GenerateDirectModeRules());
                break;
        }

        return rules;
    }

    /// <summary>
    /// Generate routing rules from custom domain rules
    /// </summary>
    private List<RoutingRule> GenerateCustomRules(List<DomainRule> customRules)
    {
        var rules = new List<RoutingRule>();

        if (customRules == null || customRules.Count == 0)
        {
            return rules;
        }

        // Group enabled rules by strategy
        var proxyDomains = customRules
            .Where(r => r.Enabled && r.Strategy == RuleStrategy.Proxy)
            .SelectMany(r => r.Domains.Select(ConvertDomainPattern))
            .ToList();

        var directDomains = customRules
            .Where(r => r.Enabled && r.Strategy == RuleStrategy.Direct)
            .SelectMany(r => r.Domains.Select(ConvertDomainPattern))
            .ToList();

        // Add proxy rule for custom domains
        if (proxyDomains.Count > 0)
        {
            rules.Add(new RoutingRule
            {
                Type = "field",
                Domain = proxyDomains,
                OutboundTag = "proxy"
            });
        }

        // Add direct rule for custom domains
        if (directDomains.Count > 0)
        {
            rules.Add(new RoutingRule
            {
                Type = "field",
                Domain = directDomains,
                OutboundTag = "direct"
            });
        }

        return rules;
    }

    /// <summary>
    /// Generate routing rules for Global proxy mode
    /// All traffic goes through proxy
    /// </summary>
    private List<RoutingRule> GenerateGlobalModeRules()
    {
        return new List<RoutingRule>
        {
            // Route all traffic to proxy
            new RoutingRule
            {
                Type = "field",
                Ip = new List<string> { "0.0.0.0/0", "::/0" },
                OutboundTag = "proxy"
            }
        };
    }

    /// <summary>
    /// Generate routing rules for Smart mode (China direct, others proxy)
    /// Uses geoip:cn for Chinese IP addresses
    /// </summary>
    private List<RoutingRule> GenerateSmartModeRules()
    {
        return new List<RoutingRule>
        {
            // Chinese domains go direct
            new RoutingRule
            {
                Type = "field",
                Domain = new List<string> { "geosite:cn" },
                OutboundTag = "direct"
            },
            // Chinese IPs go direct
            new RoutingRule
            {
                Type = "field",
                Ip = new List<string> { "geoip:cn", "geoip:private" },
                OutboundTag = "direct"
            },
            // Everything else goes through proxy
            new RoutingRule
            {
                Type = "field",
                Ip = new List<string> { "0.0.0.0/0", "::/0" },
                OutboundTag = "proxy"
            }
        };
    }

    /// <summary>
    /// Generate routing rules for Direct mode
    /// All traffic goes direct (no proxy)
    /// </summary>
    private List<RoutingRule> GenerateDirectModeRules()
    {
        return new List<RoutingRule>
        {
            // Route all traffic directly
            new RoutingRule
            {
                Type = "field",
                Ip = new List<string> { "0.0.0.0/0", "::/0" },
                OutboundTag = "direct"
            }
        };
    }

    /// <summary>
    /// Convert domain pattern to V2ray format
    /// Supports wildcards like *.example.com
    /// </summary>
    /// <param name="domain">Domain pattern</param>
    /// <returns>V2ray formatted domain pattern</returns>
    private string ConvertDomainPattern(string domain)
    {
        if (string.IsNullOrWhiteSpace(domain))
        {
            return string.Empty;
        }

        domain = domain.Trim().ToLowerInvariant();

        // If domain starts with *., convert to V2ray's domain: prefix
        // *.example.com -> domain:example.com (matches example.com and all subdomains)
        if (domain.StartsWith("*."))
        {
            return $"domain:{domain.Substring(2)}";
        }

        // Exact domain match
        // example.com -> full:example.com (matches only example.com)
        return $"full:{domain}";
    }
}
