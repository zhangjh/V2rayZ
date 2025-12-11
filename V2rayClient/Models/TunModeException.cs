namespace V2rayClient.Models;

/// <summary>
/// TUN模式相关错误类型
/// </summary>
public enum TunErrorType
{
    /// <summary>
    /// wintun.dll不存在
    /// </summary>
    WintunNotFound,
    
    /// <summary>
    /// wintun.dll加载失败
    /// </summary>
    WintunLoadFailed,
    
    /// <summary>
    /// TUN接口创建失败
    /// </summary>
    InterfaceCreationFailed,
    
    /// <summary>
    /// 权限不足
    /// </summary>
    InsufficientPermissions,
    
    /// <summary>
    /// sing-box.exe不存在
    /// </summary>
    SingBoxNotFound,
    
    /// <summary>
    /// sing-box启动失败
    /// </summary>
    SingBoxStartFailed,
    
    /// <summary>
    /// 配置错误
    /// </summary>
    ConfigurationError
}

/// <summary>
/// TUN模式异常类
/// </summary>
public class TunModeException : Exception
{
    /// <summary>
    /// 错误类型
    /// </summary>
    public TunErrorType ErrorType { get; }
    
    /// <summary>
    /// 用户友好的错误消息
    /// </summary>
    public string UserFriendlyMessage { get; }
    
    /// <summary>
    /// 是否可以重试
    /// </summary>
    public bool CanRetry { get; }

    public TunModeException(
        TunErrorType errorType,
        string technicalMessage,
        string? userFriendlyMessage = null,
        bool canRetry = false,
        Exception? innerException = null)
        : base(technicalMessage, innerException)
    {
        ErrorType = errorType;
        UserFriendlyMessage = userFriendlyMessage ?? GetDefaultUserMessage(errorType);
        CanRetry = canRetry;
    }

    /// <summary>
    /// 获取错误类型的默认用户友好消息
    /// </summary>
    private static string GetDefaultUserMessage(TunErrorType errorType)
    {
        return errorType switch
        {
            TunErrorType.WintunNotFound => 
                "TUN模式驱动文件(wintun.dll)未找到。请重新安装应用程序或联系技术支持。",
            
            TunErrorType.WintunLoadFailed => 
                "TUN模式驱动加载失败。可能是驱动文件损坏或系统不兼容。请尝试重新安装应用程序。",
            
            TunErrorType.InterfaceCreationFailed => 
                "创建TUN虚拟网络接口失败。请确保以管理员身份运行应用程序，并检查系统是否支持TUN模式。",
            
            TunErrorType.InsufficientPermissions => 
                "权限不足。TUN模式需要管理员权限才能创建虚拟网络接口。请以管理员身份重新运行应用程序。",
            
            TunErrorType.SingBoxNotFound => 
                "sing-box核心文件(sing-box.exe)未找到。TUN模式需要sing-box支持。请重新安装应用程序。",
            
            TunErrorType.SingBoxStartFailed => 
                "sing-box核心启动失败。请检查配置是否正确，或查看日志了解详细错误信息。",
            
            TunErrorType.ConfigurationError => 
                "TUN模式配置错误。请检查TUN配置参数(IP地址、DNS等)是否正确。",
            
            _ => "TUN模式发生未知错误。请查看日志了解详细信息。"
        };
    }

    public override string ToString()
    {
        return $"[TUN模式错误 - {ErrorType}] {UserFriendlyMessage}\n技术详情: {Message}";
    }
}
