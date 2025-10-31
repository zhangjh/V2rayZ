# V2rayZ 更新机制说明

## 更新流程

### 1. 检查更新
- 从 GitHub Releases 获取最新版本信息
- 比较版本号，判断是否有新版本
- 支持预发布版本（可选）

### 2. 下载更新
- 下载更新文件到临时目录：`%TEMP%\V2rayZ_Update\`
- 支持三种格式：
  - `.exe` - Inno Setup 安装程序（推荐）
  - `.msi` - Windows Installer 包
  - `.zip` - 压缩包（手动更新）

### 3. 安装更新

#### EXE 安装程序（推荐方式）
1. 使用静默安装参数启动安装程序：
   - `/VERYSILENT` - 完全静默安装
   - `/SUPPRESSMSGBOXES` - 抑制消息框
   - `/NORESTART` - 不自动重启
   - `/CLOSEAPPLICATIONS` - 自动关闭正在运行的应用

2. 安装程序会：
   - 自动关闭正在运行的 V2rayZ
   - 覆盖安装到原目录
   - 保留用户配置文件（位于 `%APPDATA%\V2rayZ`）

3. 当前应用退出，安装程序接管

#### MSI 安装程序
1. 使用 msiexec 静默安装：
   ```
   msiexec.exe /i "安装包路径" /quiet /norestart
   ```

2. 安装流程与 EXE 类似

#### ZIP 压缩包（当前使用方式）
1. 解压文件到临时目录：`%TEMP%\V2rayZ_Update\extracted\`
2. 自动检测 ZIP 包结构：
   - 如果 ZIP 包含单个根文件夹，自动使用该文件夹内容
   - 如果 ZIP 直接包含文件，使用解压根目录
3. 创建更新脚本（update.bat）并显示更新窗口
4. 脚本执行流程：
   - 等待当前进程完全退出（循环检测）
   - 备份当前版本（V2rayZ.exe.backup）
   - 使用 `xcopy /E /Y /I /Q /H /R` 覆盖所有文件
   - 如果复制失败，自动恢复备份
   - 启动新版本
   - 清理临时文件
5. 权限处理：
   - 自动检测目标目录是否可写
   - 如需管理员权限，自动请求 UAC 提升

## 更新文件位置

### 临时文件
- 下载位置：`%TEMP%\V2rayZ_Update\`
- 解压位置：`%TEMP%\V2rayZ_Update\extracted\`
- 更新脚本：`%TEMP%\V2rayZ_Update\update.bat`

### 安装位置
- 默认安装目录：`C:\Program Files\V2rayZ\`
- 用户配置目录：`%APPDATA%\V2rayZ\`
- 备份文件：`C:\Program Files\V2rayZ\V2rayZ.exe.backup`

## 配置文件保留

更新过程中会保留以下用户数据：
- 代理配置
- 路由规则
- 应用设置
- 日志文件

这些文件位于 `%APPDATA%\V2rayZ\`，不会被更新覆盖。

## 故障恢复

### 更新失败
如果更新过程中出现错误：
1. ZIP 方式：会尝试恢复备份文件
2. 安装程序方式：原程序保持不变

### 手动恢复
如果需要手动恢复到旧版本：
1. 找到备份文件：`C:\Program Files\V2rayZ\V2rayZ.exe.backup`
2. 删除当前的 `V2rayZ.exe`
3. 将 `.backup` 文件重命名为 `V2rayZ.exe`

## 发布新版本

### 使用自动发布脚本（推荐）

项目已包含 `auto-release.sh` 脚本，可自动完成构建、打包和发布：

```bash
# 基本用法（从 VersionInfo.cs 读取版本号）
./auto-release.sh

# 指定版本号
./auto-release.sh -v 1.0.1

# 创建预发布版本
./auto-release.sh -p

# 创建草稿版本
./auto-release.sh -d -n "测试版本"
```

**前提条件**：
1. 已运行 `.\clean-rebuild.ps1` 构建项目
2. `publish` 目录存在且包含完整文件
3. 设置 GitHub Token：`export GITHUB_TOKEN=your_token`

脚本会自动：
- 验证 publish 目录
- 创建 ZIP 包（`V2rayZ-x.x.x-win-x64.zip`）
- 创建 Git 标签并推送
- 创建 GitHub Release
- 上传 ZIP 文件

### 手动发布

如果需要手动发布：

```bash
# 1. 构建项目
.\clean-rebuild.ps1

# 2. 打包 ZIP（在 Git Bash 中）
cd publish
zip -r ../V2rayZ-1.0.0-win-x64.zip . -x "*.log" "*.tmp"
cd ..

# 或使用 PowerShell
Compress-Archive -Path .\publish\* -DestinationPath .\V2rayZ-1.0.0-win-x64.zip -Force
```

**重要**：ZIP 包结构应该是：
```
V2rayZ-1.0.0-win-x64.zip
├── V2rayZ.exe
├── wwwroot/
├── Resources/
└── ...其他文件
```

而不是：
```
V2rayZ-1.0.0-win-x64.zip
└── publish/
    ├── V2rayZ.exe
    └── ...
```

### 发布到 GitHub
1. 创建新的 Release
2. 上传 ZIP 包：`V2rayZ-x.x.x-win-x64.zip`
3. 填写版本说明
4. 发布

### 版本号格式
- 正式版本：`v1.0.0`
- 预发布版本：`v1.0.0-beta.1`

## 静默安装参数

### Inno Setup (EXE)
```
V2rayZ-Setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CLOSEAPPLICATIONS
```

### MSI
```
msiexec.exe /i V2rayZ-Setup.msi /quiet /norestart
```

## 常见问题

### 1. 更新后软件没有变化
**原因**：
- ZIP 包结构不正确（包含了额外的文件夹层级）
- 权限不足，文件没有被覆盖
- 更新脚本执行失败

**解决方法**：
- 检查 ZIP 包结构，确保解压后直接是程序文件
- 以管理员身份运行软件再更新
- 查看更新脚本窗口的错误信息

### 2. 更新失败提示权限不足
**原因**：软件安装在 Program Files 目录，需要管理员权限

**解决方法**：
- 更新时会自动请求 UAC 提升
- 或者以管理员身份运行软件

### 3. 更新后无法启动
**原因**：文件损坏或覆盖不完整

**解决方法**：
- 找到备份文件 `V2rayZ.exe.backup`
- 删除当前的 `V2rayZ.exe`
- 将备份文件重命名为 `V2rayZ.exe`

### 4. 更新下载后找不到文件
**位置**：`%TEMP%\V2rayZ_Update\`

可以手动查看：
```
C:\Users\你的用户名\AppData\Local\Temp\V2rayZ_Update\
```

## 注意事项

1. **管理员权限**：如果软件安装在 Program Files，更新需要管理员权限
2. **防火墙/杀毒软件**：可能会拦截更新脚本，需要添加信任
3. **进程关闭**：更新脚本会自动等待进程退出
4. **磁盘空间**：确保有足够的临时空间（约 100MB）
5. **ZIP 包结构**：发布时确保 ZIP 包直接包含程序文件，不要有额外的文件夹层级
