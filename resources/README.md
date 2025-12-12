# Resources Directory

此目录用于存放平台特定的二进制文件和资源。

## 目录结构

- `win/` - Windows 平台资源
  - `sing-box.exe` - Windows 版本的 sing-box 可执行文件
  - 应用图标和托盘图标

- `mac-x64/` - macOS Intel (x64) 平台资源
  - `sing-box` - macOS x64 版本的 sing-box 可执行文件
  - 应用图标和托盘图标

- `mac-arm64/` - macOS Apple Silicon (arm64) 平台资源
  - `sing-box` - macOS arm64 版本的 sing-box 可执行文件
  - 应用图标和托盘图标

- `data/` - 共享数据文件
  - `geoip.dat` 或 `geoip.db` - GeoIP 数据库
  - `geosite.dat` 或 `geosite.db` - GeoSite 数据库

## 注意事项

1. sing-box 二进制文件需要从官方 GitHub Release 下载
2. macOS 版本的 sing-box 需要设置可执行权限：`chmod +x sing-box`
3. 图标文件格式：
   - Windows: .ico 格式
   - macOS: .icns 格式（应用图标）和 .png 格式（托盘图标）
