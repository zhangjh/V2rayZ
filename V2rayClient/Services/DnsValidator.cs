using System.Net;
using System.Net.Sockets;

namespace V2rayClient.Services;

/// <summary>
/// DNS address validator
/// </summary>
public class DnsValidator
{
    /// <summary>
    /// Validate DNS server address format
    /// </summary>
    /// <param name="address">DNS server address to validate</param>
    /// <returns>Tuple containing validation result and error message if invalid</returns>
    public static (bool IsValid, string? ErrorMessage) ValidateDnsAddress(string address)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            return (false, "DNS地址不能为空");
        }

        // Trim whitespace
        address = address.Trim();

        // Try to parse as IP address
        if (!IPAddress.TryParse(address, out var ipAddress))
        {
            return (false, $"无效的IP地址格式: {address}");
        }

        // Check if it's IPv4 or IPv6
        if (ipAddress.AddressFamily != AddressFamily.InterNetwork && 
            ipAddress.AddressFamily != AddressFamily.InterNetworkV6)
        {
            return (false, $"不支持的地址类型: {address}");
        }

        // Additional validation: reject loopback addresses for DNS
        if (IPAddress.IsLoopback(ipAddress))
        {
            return (false, $"不能使用回环地址作为DNS服务器: {address}");
        }

        return (true, null);
    }

    /// <summary>
    /// Validate a list of DNS server addresses
    /// </summary>
    /// <param name="addresses">List of DNS server addresses to validate</param>
    /// <returns>Tuple containing validation result and error message if invalid</returns>
    public static (bool IsValid, string? ErrorMessage) ValidateDnsAddresses(IEnumerable<string> addresses)
    {
        if (addresses == null || !addresses.Any())
        {
            return (false, "DNS服务器列表不能为空");
        }

        var addressList = addresses.ToList();
        for (int i = 0; i < addressList.Count; i++)
        {
            var (isValid, errorMessage) = ValidateDnsAddress(addressList[i]);
            if (!isValid)
            {
                return (false, $"DNS服务器 #{i + 1} 验证失败: {errorMessage}");
            }
        }

        return (true, null);
    }

    /// <summary>
    /// Check if an address is a valid IPv4 address
    /// </summary>
    /// <param name="address">Address to check</param>
    /// <returns>True if valid IPv4, false otherwise</returns>
    public static bool IsValidIPv4(string address)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            return false;
        }

        if (IPAddress.TryParse(address.Trim(), out var ipAddress))
        {
            return ipAddress.AddressFamily == AddressFamily.InterNetwork;
        }

        return false;
    }

    /// <summary>
    /// Check if an address is a valid IPv6 address
    /// </summary>
    /// <param name="address">Address to check</param>
    /// <returns>True if valid IPv6, false otherwise</returns>
    public static bool IsValidIPv6(string address)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            return false;
        }

        if (IPAddress.TryParse(address.Trim(), out var ipAddress))
        {
            return ipAddress.AddressFamily == AddressFamily.InterNetworkV6;
        }

        return false;
    }
}
