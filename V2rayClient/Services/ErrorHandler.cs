using Serilog;
using V2rayClient.Models;

namespace V2rayClient.Services;

/// <summary>
/// 错误处理服务实现
/// </summary>
public class ErrorHandler : IErrorHandler
{
    private readonly ILogger _logger;
    
    public event EventHandler<ErrorEventArgs>? ErrorOccurred;

    public ErrorHandler(ILogger logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public void Handle(AppException error)
    {
        // 记录错误日志
        _logger.Error(error, "[{Category}] {UserMessage}", error.Category, error.UserMessage);
        
        // 触发错误事件通知 UI
        ErrorOccurred?.Invoke(this, new ErrorEventArgs(error));
        
        // 根据错误类型执行特定处理
        switch (error.Category)
        {
            case ErrorCategory.Config:
                HandleConfigError(error);
                break;
            case ErrorCategory.Connection:
                HandleConnectionError(error);
                break;
            case ErrorCategory.System:
                HandleSystemError(error);
                break;
            case ErrorCategory.Process:
                HandleProcessError(error);
                break;
        }
    }

    public void Handle(Exception exception, ErrorCategory category, string userMessage, bool canRetry = false)
    {
        var appException = new AppException(
            category,
            userMessage,
            exception.Message,
            canRetry,
            exception
        );
        
        Handle(appException);
    }

    public void LogInfo(string message)
    {
        _logger.Information(message);
    }

    public void LogWarning(string message)
    {
        _logger.Warning(message);
    }

    public void LogError(string message, Exception? exception = null)
    {
        if (exception != null)
        {
            _logger.Error(exception, message);
        }
        else
        {
            _logger.Error(message);
        }
    }

    private void HandleConfigError(AppException error)
    {
        // 配置错误：记录详细信息，不需要额外处理
        _logger.Debug("Configuration error details: {Details}", error.Message);
    }

    private void HandleConnectionError(AppException error)
    {
        // 连接错误：记录连接失败信息
        _logger.Warning("Connection failed: {Message}. CanRetry: {CanRetry}", 
            error.UserMessage, error.CanRetry);
        
        if (error.CanRetry)
        {
            _logger.Information("Connection error is retryable");
        }
    }

    private void HandleSystemError(AppException error)
    {
        // 系统错误：记录系统级错误
        _logger.Error("System error occurred: {Message}", error.UserMessage);
        
        // 系统错误可能需要特殊处理，如回滚操作
        if (error.InnerException != null)
        {
            _logger.Error("Inner exception: {InnerException}", error.InnerException.Message);
        }
    }

    private void HandleProcessError(AppException error)
    {
        // 进程错误：记录进程异常信息
        _logger.Error("Process error: {Message}", error.UserMessage);
        
        // 进程错误可能需要自动重启
        if (error.CanRetry)
        {
            _logger.Information("Process error is retryable, consider automatic restart");
        }
    }
}
