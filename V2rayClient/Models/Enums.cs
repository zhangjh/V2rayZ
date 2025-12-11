namespace V2rayClient.Models;

/// <summary>
/// Supported proxy protocol types
/// </summary>
public enum ProtocolType
{
    Vless,
    Trojan
}

/// <summary>
/// Network transport protocol types
/// </summary>
public enum NetworkType
{
    Tcp,
    Ws,
    H2
}

/// <summary>
/// Security/encryption types
/// </summary>
public enum SecurityType
{
    None,
    Tls
}

/// <summary>
/// Proxy mode options
/// </summary>
public enum ProxyMode
{
    Global,
    Smart,
    Direct
}

/// <summary>
/// Routing rule strategy
/// </summary>
public enum RuleStrategy
{
    Proxy,
    Direct,
    Block
}

/// <summary>
/// Connection status
/// </summary>
public enum ConnectionStatus
{
    Disconnected,
    Connecting,
    Connected,
    Error
}

/// <summary>
/// Error categories for error handling
/// </summary>
public enum ErrorCategory
{
    Config,
    Connection,
    System,
    Process
}

/// <summary>
/// Log levels
/// </summary>
public enum LogLevel
{
    Debug,
    Info,
    Warning,
    Error
}

/// <summary>
/// Proxy implementation mode
/// </summary>
public enum ProxyModeType
{
    /// <summary>
    /// System proxy mode (SOCKS/HTTP)
    /// </summary>
    SystemProxy,
    
    /// <summary>
    /// TUN transparent proxy mode
    /// </summary>
    Tun
}
