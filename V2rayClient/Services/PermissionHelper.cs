using System.Security.Principal;

namespace V2rayClient.Services;

/// <summary>
/// 权限检查辅助类
/// </summary>
public static class PermissionHelper
{
    /// <summary>
    /// 检查当前进程是否具有管理员权限
    /// </summary>
    /// <returns>如果具有管理员权限返回true，否则返回false</returns>
    public static bool IsAdministrator()
    {
        try
        {
            using var identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            return principal.IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch
        {
            // 如果无法确定权限，假设没有管理员权限
            return false;
        }
    }

    /// <summary>
    /// 检查是否需要管理员权限
    /// </summary>
    /// <param name="throwIfNotAdmin">如果为true且没有管理员权限，则抛出异常</param>
    /// <returns>如果具有管理员权限返回true，否则返回false</returns>
    public static bool RequireAdministrator(bool throwIfNotAdmin = false)
    {
        var isAdmin = IsAdministrator();
        
        if (!isAdmin && throwIfNotAdmin)
        {
            throw new UnauthorizedAccessException("此操作需要管理员权限。请以管理员身份运行应用程序。");
        }
        
        return isAdmin;
    }
}
