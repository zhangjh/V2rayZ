namespace V2rayClient.Models;

/// <summary>
/// 应用程序自定义异常类
/// </summary>
public class AppException : Exception
{
    /// <summary>
    /// 错误类别
    /// </summary>
    public ErrorCategory Category { get; }
    
    /// <summary>
    /// 用户友好的错误消息
    /// </summary>
    public string UserMessage { get; }
    
    /// <summary>
    /// 是否可以重试
    /// </summary>
    public bool CanRetry { get; }

    public AppException(
        ErrorCategory category,
        string userMessage,
        string? technicalMessage = null,
        bool canRetry = false,
        Exception? innerException = null)
        : base(technicalMessage ?? userMessage, innerException)
    {
        Category = category;
        UserMessage = userMessage;
        CanRetry = canRetry;
    }

    public override string ToString()
    {
        return $"[{Category}] {UserMessage} - {Message}";
    }
}
