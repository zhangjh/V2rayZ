using V2rayClient.Models;

namespace V2rayClient.Services;

/// <summary>
/// 错误处理服务接口
/// </summary>
public interface IErrorHandler
{
    /// <summary>
    /// 处理应用程序异常
    /// </summary>
    void Handle(AppException error);
    
    /// <summary>
    /// 处理一般异常并转换为 AppException
    /// </summary>
    void Handle(Exception exception, ErrorCategory category, string userMessage, bool canRetry = false);
    
    /// <summary>
    /// 记录信息日志
    /// </summary>
    void LogInfo(string message);
    
    /// <summary>
    /// 记录警告日志
    /// </summary>
    void LogWarning(string message);
    
    /// <summary>
    /// 记录错误日志
    /// </summary>
    void LogError(string message, Exception? exception = null);
    
    /// <summary>
    /// 错误发生事件（用于通知 UI）
    /// </summary>
    event EventHandler<ErrorEventArgs>? ErrorOccurred;
}

/// <summary>
/// 错误事件参数
/// </summary>
public class ErrorEventArgs : EventArgs
{
    public AppException Exception { get; }
    
    public ErrorEventArgs(AppException exception)
    {
        Exception = exception;
    }
}
