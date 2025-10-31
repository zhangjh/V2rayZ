using System.IO;
using System.Windows;
using Serilog;
using V2rayClient.Models;
using V2rayClient.Services;
using MessageBox = System.Windows.MessageBox;

namespace V2rayClient;

/// <summary>
/// 更新窗口
/// </summary>
public partial class UpdateWindow : Window
{
    private readonly UpdateService _updateService;
    private readonly UpdateInfo _updateInfo;
    private readonly ILogger _logger;
    private string? _downloadedFilePath;

    public UpdateWindow(UpdateService updateService, UpdateInfo updateInfo)
    {
        InitializeComponent();
        _updateService = updateService;
        _updateInfo = updateInfo;
        _logger = Log.ForContext<UpdateWindow>();

        InitializeWindow();
        SubscribeToEvents();
    }

    private void InitializeWindow()
    {
        // 设置版本信息
        VersionTextBlock.Text = $"{VersionInfo.GetDisplayVersion()} → {_updateInfo.Version}";
        
        // 设置更新说明
        ReleaseNotesTextBlock.Text = string.IsNullOrWhiteSpace(_updateInfo.ReleaseNotes) 
            ? "暂无更新说明" 
            : _updateInfo.ReleaseNotes;

        // 设置文件信息
        FileSizeTextBlock.Text = FormatFileSize(_updateInfo.FileSize);
        PublishDateTextBlock.Text = _updateInfo.PublishedAt.ToString("yyyy-MM-dd HH:mm");

        // 如果是预发布版本，显示警告
        if (_updateInfo.IsPrerelease)
        {
            TitleTextBlock.Text = "发现新的预发布版本";
            var warningText = "⚠️ 这是一个预发布版本，可能包含未完全测试的功能。\n\n" + ReleaseNotesTextBlock.Text;
            ReleaseNotesTextBlock.Text = warningText;
        }
    }

    private void SubscribeToEvents()
    {
        _updateService.ProgressChanged += OnProgressChanged;
    }

    private void OnProgressChanged(object? sender, UpdateProgress progress)
    {
        Dispatcher.Invoke(() =>
        {
            ProgressTextBlock.Text = progress.Message;
            ProgressBar.Value = progress.Percentage;

            switch (progress.Status)
            {
                case UpdateStatus.Downloading:
                    ProgressPanel.Visibility = Visibility.Visible;
                    UpdateButton.IsEnabled = false;
                    UpdateButton.Content = "下载中...";
                    break;

                case UpdateStatus.Downloaded:
                    ProgressPanel.Visibility = Visibility.Visible;
                    UpdateButton.IsEnabled = true;
                    UpdateButton.Content = "安装更新";
                    break;

                case UpdateStatus.Installing:
                    ProgressPanel.Visibility = Visibility.Visible;
                    UpdateButton.IsEnabled = false;
                    UpdateButton.Content = "安装中...";
                    RemindLaterButton.IsEnabled = false;
                    SkipButton.IsEnabled = false;
                    break;

                case UpdateStatus.Error:
                    ProgressPanel.Visibility = Visibility.Visible;
                    UpdateButton.IsEnabled = true;
                    UpdateButton.Content = "重试";
                    MessageBox.Show(this, 
                        $"更新失败: {progress.ErrorMessage}", 
                        "错误", 
                        MessageBoxButton.OK, 
                        MessageBoxImage.Error);
                    break;
            }
        });
    }

    private async void UpdateButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (_downloadedFilePath == null)
            {
                // 开始下载
                _downloadedFilePath = await _updateService.DownloadUpdateAsync(_updateInfo);
                if (_downloadedFilePath == null)
                {
                    return; // 下载失败，错误已在事件中处理
                }
            }

            // 开始安装（此方法会自动退出应用程序）
            // 注意：InstallUpdateAsync 会在启动更新程序后立即关闭应用
            // 所以这个方法调用后，应用会直接退出，不会返回
            await _updateService.InstallUpdateAsync(_downloadedFilePath);
            
            // 注意：正常情况下不会执行到这里，因为应用已经退出
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "更新过程中发生错误");
            
            // 如果是用户取消 UAC 提示，显示友好的错误信息
            if (ex.Message.Contains("用户取消"))
            {
                MessageBox.Show(this, 
                    "更新需要管理员权限才能继续。\n\n如果您取消了 UAC 提示，请重新点击\"安装更新\"按钮。", 
                    "需要管理员权限", 
                    MessageBoxButton.OK, 
                    MessageBoxImage.Warning);
            }
            else
            {
                MessageBox.Show(this, 
                    $"更新失败: {ex.Message}", 
                    "错误", 
                    MessageBoxButton.OK, 
                    MessageBoxImage.Error);
            }
        }
    }

    private void RemindLaterButton_Click(object sender, RoutedEventArgs e)
    {
        _logger.Information("用户选择稍后提醒更新");
        DialogResult = false;
        Close();
    }

    private void SkipButton_Click(object sender, RoutedEventArgs e)
    {
        var result = MessageBox.Show(this,
            $"确定要跳过版本 {_updateInfo.Version} 吗？\n\n跳过后将不再提醒此版本的更新。",
            "跳过版本",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question);

        if (result == MessageBoxResult.Yes)
        {
            _logger.Information("用户选择跳过版本: {Version}", _updateInfo.Version);
            
            // 保存跳过的版本到配置
            SaveSkippedVersion(_updateInfo.Version);
            
            DialogResult = false;
            Close();
        }
    }

    private void SaveSkippedVersion(string version)
    {
        try
        {
            // 这里可以保存到配置文件或注册表
            // 暂时使用简单的文件存储
            var configDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "V2rayZ");
            Directory.CreateDirectory(configDir);
            
            var skippedVersionFile = Path.Combine(configDir, "skipped_version.txt");
            File.WriteAllText(skippedVersionFile, version);
            
            _logger.Information("已保存跳过的版本: {Version}", version);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "保存跳过版本时发生错误");
        }
    }

    private static string FormatFileSize(long bytes)
    {
        if (bytes == 0) return "未知";

        string[] sizes = { "B", "KB", "MB", "GB" };
        int order = 0;
        double size = bytes;

        while (size >= 1024 && order < sizes.Length - 1)
        {
            order++;
            size /= 1024;
        }

        return $"{size:0.##} {sizes[order]}";
    }

    protected override void OnClosed(EventArgs e)
    {
        _updateService.ProgressChanged -= OnProgressChanged;
        base.OnClosed(e);
    }
}