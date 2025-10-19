using System.Windows;
using Serilog;
using V2rayClient.Services;

namespace V2rayClient;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : System.Windows.Application
{
    public static ILogger Logger { get; private set; } = null!;
    public static IErrorHandler ErrorHandler { get; private set; } = null!;
    public static ResourceManager ResourceManager { get; private set; } = null!;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        
        // Initialize logger
        InitializeLogger();
        
        // Initialize error handler
        ErrorHandler = new ErrorHandler(Logger);
        
        // Set up global exception handlers
        SetupExceptionHandlers();
        
        Logger.Information("Application starting...");
        
        // Check for minimized startup argument
        var isMinimizedStart = e.Args.Contains("--minimized");
        Logger.Information("Minimized start: {IsMinimized}", isMinimizedStart);
        
        // Initialize resources
        InitializeResources();
        
        // Initialize WebView2 environment
        InitializeWebView2Environment();
        
        // Handle minimized startup
        if (isMinimizedStart)
        {
            // Set a flag that MainWindow can check
            Properties["MinimizedStart"] = true;
        }
    }

    protected override void OnExit(ExitEventArgs e)
    {
        Logger.Information("Application exiting...");
        
        try
        {
            // Ensure all V2ray processes are terminated
            Logger.Information("Cleaning up V2ray processes...");
            var v2rayProcesses = System.Diagnostics.Process.GetProcessesByName("v2ray");
            foreach (var process in v2rayProcesses)
            {
                try
                {
                    Logger.Information($"Terminating V2ray process PID: {process.Id}");
                    process.Kill(true);
                    process.WaitForExit(2000);
                }
                catch (Exception ex)
                {
                    Logger.Warning(ex, $"Failed to terminate V2ray process {process.Id}");
                }
                finally
                {
                    process.Dispose();
                }
            }
            
            // Dispose ResourceManager
            ResourceManager?.Dispose();
            
            Logger.Information("Application cleanup completed");
        }
        catch (Exception ex)
        {
            Logger.Error(ex, "Error during application exit cleanup");
        }
        
        Log.CloseAndFlush();
        base.OnExit(e);
    }

    private void InitializeLogger()
    {
        Logger = Services.LoggerConfiguration.CreateLogger();
        Log.Logger = Logger;
    }

    private void SetupExceptionHandlers()
    {
        // Handle unhandled exceptions in UI thread
        DispatcherUnhandledException += (sender, args) =>
        {
            Logger.Error(args.Exception, "Unhandled exception in UI thread");
            ErrorHandler.Handle(
                args.Exception,
                Models.ErrorCategory.System,
                "应用程序遇到未处理的错误",
                false
            );
            args.Handled = true;
        };

        // Handle unhandled exceptions in background threads
        AppDomain.CurrentDomain.UnhandledException += (sender, args) =>
        {
            var exception = args.ExceptionObject as Exception;
            Logger.Fatal(exception, "Unhandled exception in background thread");
            
            if (exception != null)
            {
                ErrorHandler.Handle(
                    exception,
                    Models.ErrorCategory.System,
                    "应用程序遇到严重错误",
                    false
                );
            }
        };

        // Handle unhandled exceptions in async tasks
        TaskScheduler.UnobservedTaskException += (sender, args) =>
        {
            Logger.Error(args.Exception, "Unobserved task exception");
            ErrorHandler.Handle(
                args.Exception,
                Models.ErrorCategory.System,
                "后台任务遇到错误",
                false
            );
            args.SetObserved();
        };
    }

    private void InitializeResources()
    {
        try
        {
            Logger.Information("Initializing application resources...");
            ResourceManager = new ResourceManager(Logger);
            ResourceManager.InitializeResources();
            
            // Validate resources
            if (!ResourceManager.ValidateResources())
            {
                throw new InvalidOperationException("Required resources are missing");
            }
            
            Logger.Information("Resources initialized successfully");
        }
        catch (Exception ex)
        {
            Logger.Fatal(ex, "Failed to initialize resources");
            System.Windows.MessageBox.Show(
                $"无法初始化应用程序资源。请确保所有必需的文件都已正确安装。\n\n错误: {ex.Message}",
                "初始化错误",
                System.Windows.MessageBoxButton.OK,
                System.Windows.MessageBoxImage.Error
            );
            Shutdown(1);
        }
    }

    private async void InitializeWebView2Environment()
    {
        try
        {
            // WebView2 environment will be initialized when MainWindow loads
            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            Logger.Error(ex, "Failed to initialize WebView2");
            System.Windows.MessageBox.Show($"Failed to initialize WebView2: {ex.Message}", "Error", 
                System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
        }
    }
}
