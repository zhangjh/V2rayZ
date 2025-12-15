# 清除 Windows 图标缓存
Write-Host "正在清除 Windows 图标缓存..." -ForegroundColor Yellow

# 停止 Windows 资源管理器
Stop-Process -Name explorer -Force

# 删除图标缓存文件
$iconCachePath = "$env:LOCALAPPDATA\IconCache.db"
if (Test-Path $iconCachePath) {
    Remove-Item $iconCachePath -Force
    Write-Host "已删除 IconCache.db" -ForegroundColor Green
}

# 删除缩略图缓存
$thumbCachePath = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
Get-ChildItem -Path $thumbCachePath -Filter "thumbcache_*.db" -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path $thumbCachePath -Filter "iconcache_*.db" -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Host "图标缓存已清除，正在重启资源管理器..." -ForegroundColor Green

# 重启 Windows 资源管理器
Start-Process explorer

Write-Host "完成！请检查图标是否正常显示。" -ForegroundColor Cyan
