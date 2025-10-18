using System;
using System.Collections.Specialized;
using System.Text;
using V2rayClient.Models;
using Serilog;

namespace V2rayClient.Services;

/// <summary>
/// Protocol parser for vless:// and trojan:// URLs
/// </summary>
public class ProtocolParser : IProtocolParser
{
    /// <summary>
    /// Parse a protocol URL and return server configuration
    /// </summary>
    public ServerConfig ParseUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            throw new ArgumentException("URL不能为空", nameof(url));
        }

        Log.Debug("[ProtocolParser] 开始解析协议URL: {Url}", url);

        try
        {
            var uri = new Uri(url);
            var protocol = GetProtocolType(url);

            Log.Debug("[ProtocolParser] 协议类型: {Protocol}", protocol);

            var config = new ServerConfig
            {
                Protocol = protocol,
                Address = uri.Host,
                Port = uri.Port
            };

            // 解析查询参数
            var query = ParseQueryString(uri.Query);

            // 根据协议类型解析特定字段
            switch (protocol)
            {
                case ProtocolType.Vless:
                    ParseVlessUrl(uri, query, config);
                    break;
                case ProtocolType.Trojan:
                    ParseTrojanUrl(uri, query, config);
                    break;
                default:
                    throw new NotSupportedException($"不支持的协议类型: {protocol}");
            }

            Log.Information("[ProtocolParser] 协议解析成功: {Protocol}://{Address}:{Port}", 
                protocol, config.Address, config.Port);

            return config;
        }
        catch (UriFormatException ex)
        {
            Log.Error(ex, "[ProtocolParser] URL格式错误: {Url}", url);
            throw new ArgumentException($"URL格式错误: {ex.Message}", nameof(url));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "[ProtocolParser] 解析协议URL失败: {Url}", url);
            throw;
        }
    }

    /// <summary>
    /// Check if the URL is a supported protocol
    /// </summary>
    public bool IsSupported(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return false;
        }

        try
        {
            var uri = new Uri(url);
            return uri.Scheme.Equals("vless", StringComparison.OrdinalIgnoreCase) ||
                   uri.Scheme.Equals("trojan", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Get the protocol type from URL
    /// </summary>
    public ProtocolType GetProtocolType(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            throw new ArgumentException("URL不能为空", nameof(url));
        }

        var uri = new Uri(url);
        return uri.Scheme.ToLowerInvariant() switch
        {
            "vless" => ProtocolType.Vless,
            "trojan" => ProtocolType.Trojan,
            _ => throw new NotSupportedException($"不支持的协议: {uri.Scheme}")
        };
    }

    /// <summary>
    /// Parse VLESS protocol URL
    /// </summary>
    private void ParseVlessUrl(Uri uri, NameValueCollection query, ServerConfig config)
    {
        // VLESS URL格式: vless://uuid@address:port?encryption=none&security=tls&type=ws&host=example.com&path=/path#name
        
        // UUID从用户信息部分获取
        if (string.IsNullOrEmpty(uri.UserInfo))
        {
            throw new ArgumentException("VLESS协议缺少UUID");
        }

        config.Uuid = uri.UserInfo;
        config.Encryption = query["encryption"] ?? "none";

        // 解析传输层安全
        var security = query["security"];
        if (!string.IsNullOrEmpty(security))
        {
            config.Security = security.ToLowerInvariant() switch
            {
                "tls" => SecurityType.Tls,
                "none" => SecurityType.None,
                _ => SecurityType.None
            };
        }

        // 解析网络类型
        var type = query["type"];
        if (!string.IsNullOrEmpty(type))
        {
            config.Network = type.ToLowerInvariant() switch
            {
                "tcp" => NetworkType.Tcp,
                "ws" => NetworkType.Ws,
                "h2" => NetworkType.H2,
                _ => NetworkType.Tcp
            };
        }

        // 解析TLS设置
        if (config.Security == SecurityType.Tls)
        {
            config.TlsSettings = new TlsSettings
            {
                ServerName = query["sni"] ?? query["host"] ?? config.Address,
                AllowInsecure = query["allowInsecure"] == "1"
            };

            // 解析ALPN
            var alpn = query["alpn"];
            if (!string.IsNullOrEmpty(alpn))
            {
                config.TlsSettings.Alpn = alpn.Split(',').ToList();
            }
        }

        // 解析WebSocket设置
        if (config.Network == NetworkType.Ws)
        {
            config.WsSettings = new WsSettings
            {
                Path = query["path"] ?? "/",
                Host = query["host"]
            };
        }

        Log.Debug("[ProtocolParser] VLESS解析完成 - UUID: {Uuid}, Security: {Security}, Network: {Network}", 
            config.Uuid, config.Security, config.Network);
    }

    /// <summary>
    /// Parse Trojan protocol URL
    /// </summary>
    private void ParseTrojanUrl(Uri uri, NameValueCollection query, ServerConfig config)
    {
        // Trojan URL格式: trojan://password@address:port?security=tls&type=ws&host=example.com&path=/path#name
        
        // 密码从用户信息部分获取
        if (string.IsNullOrEmpty(uri.UserInfo))
        {
            throw new ArgumentException("Trojan协议缺少密码");
        }

        config.Password = Uri.UnescapeDataString(uri.UserInfo);

        // 解析传输层安全
        var security = query["security"];
        if (!string.IsNullOrEmpty(security))
        {
            config.Security = security.ToLowerInvariant() switch
            {
                "tls" => SecurityType.Tls,
                "none" => SecurityType.None,
                _ => SecurityType.Tls // Trojan默认使用TLS
            };
        }
        else
        {
            config.Security = SecurityType.Tls; // Trojan默认使用TLS
        }

        // 解析网络类型
        var type = query["type"];
        if (!string.IsNullOrEmpty(type))
        {
            config.Network = type.ToLowerInvariant() switch
            {
                "tcp" => NetworkType.Tcp,
                "ws" => NetworkType.Ws,
                "h2" => NetworkType.H2,
                _ => NetworkType.Tcp
            };
        }

        // 解析TLS设置
        if (config.Security == SecurityType.Tls)
        {
            config.TlsSettings = new TlsSettings
            {
                ServerName = query["sni"] ?? query["host"] ?? config.Address,
                AllowInsecure = query["allowInsecure"] == "1"
            };

            // 解析ALPN
            var alpn = query["alpn"];
            if (!string.IsNullOrEmpty(alpn))
            {
                config.TlsSettings.Alpn = alpn.Split(',').ToList();
            }
        }

        // 解析WebSocket设置
        if (config.Network == NetworkType.Ws)
        {
            config.WsSettings = new WsSettings
            {
                Path = query["path"] ?? "/",
                Host = query["host"]
            };
        }

        Log.Debug("[ProtocolParser] Trojan解析完成 - Security: {Security}, Network: {Network}", 
            config.Security, config.Network);
    }

    /// <summary>
    /// Parse query string without System.Web dependency
    /// </summary>
    private NameValueCollection ParseQueryString(string query)
    {
        var result = new NameValueCollection();
        
        if (string.IsNullOrEmpty(query))
            return result;

        // Remove leading '?' if present
        if (query.StartsWith("?"))
            query = query.Substring(1);

        var pairs = query.Split('&');
        foreach (var pair in pairs)
        {
            var keyValue = pair.Split('=');
            if (keyValue.Length >= 2)
            {
                var key = Uri.UnescapeDataString(keyValue[0]);
                var value = Uri.UnescapeDataString(keyValue[1]);
                result[key] = value;
            }
            else if (keyValue.Length == 1)
            {
                var key = Uri.UnescapeDataString(keyValue[0]);
                result[key] = "";
            }
        }

        return result;
    }
}