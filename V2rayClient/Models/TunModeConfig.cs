namespace V2rayClient.Models;

/// <summary>
/// TUN mode configuration
/// </summary>
public class TunModeConfig
{
    /// <summary>
    /// TUN interface name
    /// </summary>
    public string InterfaceName { get; set; } = "V2rayZ-TUN";
    
    /// <summary>
    /// TUN interface IPv4 address
    /// </summary>
    public string Ipv4Address { get; set; } = "10.0.85.1/24";
    
    /// <summary>
    /// TUN interface IPv6 address
    /// </summary>
    public string? Ipv6Address { get; set; } = "fdfe:dcba:9876::1/126";
    
    /// <summary>
    /// Enable IPv6 support
    /// </summary>
    public bool EnableIpv6 { get; set; } = true;
    
    /// <summary>
    /// DNS server list
    /// </summary>
    public List<string> DnsServers { get; set; } = new() { "8.8.8.8", "8.8.4.4" };
    
    /// <summary>
    /// MTU size
    /// </summary>
    public int Mtu { get; set; } = 9000;
    
    /// <summary>
    /// Enable DNS hijacking
    /// </summary>
    public bool EnableDnsHijack { get; set; } = true;
}
