# Windows 测试指南

本文档提供在 Windows 平台上测试 V2rayZ Electron 应用的完整流程。

## 前置条件

1. Windows 10 (1809+) 或 Windows 11
2. Node.js 20+ 已安装
3. Git Bash 或 PowerShell
4. 管理员权限（用于测试 TUN 模式和系统代理）

## 测试环境准备

### 1. 克隆并构建项目

```bash
# 克隆项目（如果还没有）
git clone <repository-url>
cd V2rayZ

# 安装依赖
npm install

# 构建项目
npm run build
```

### 2. 验证构建产物

```bash
# 检查主进程构建
ls dist/main/main/

# 检查渲染进程构建
ls dist/renderer/

# 检查资源文件
ls resources/win/
```

应该看到：
- `dist/main/main/index.js` - 主进程入口
- `dist/renderer/index.html` - 渲染进程入口
- `resources/win/sing-box.exe` - sing-box 可执行文件
- `resources/win/app.ico` - 应用图标

## 测试流程

### 测试 1: 应用启动

**目标**: 验证应用能够正常启动并显示主窗口

**步骤**:
1. 在项目根目录运行开发模式：
   ```bash
   npm run dev
   ```

2. 验证点：
   - [ ] 应用窗口成功打开
   - [ ] 窗口标题显示 "V2rayZ"
   - [ ] 系统托盘出现应用图标
   - [ ] 主界面正确渲染（显示服务器列表、连接状态等）
   - [ ] 控制台没有严重错误

**预期结果**: 应用正常启动，UI 完整显示

---

### 测试 2: 添加服务器

**目标**: 验证从 URL 导入服务器配置功能

**步骤**:
1. 准备测试 URL（VLESS 或 Trojan）：
   ```
   vless://uuid@example.com:443?encryption=none&security=tls&type=ws&path=/path#TestServer
   ```

2. 在应用中：
   - 点击"添加服务器"或"从 URL 导入"
   - 粘贴测试 URL
   - 点击"确认"

3. 验证点：
   - [ ] URL 解析成功
   - [ ] 服务器配置正确显示（地址、端口、协议等）
   - [ ] 服务器添加到列表
   - [ ] 配置保存到文件（检查 `%APPDATA%/v2rayz-electron/config.json`）

**预期结果**: 服务器成功添加并保存

---

### 测试 3: 启动/停止代理（系统代理模式）

**目标**: 验证代理启动、停止和状态监控

**步骤**:
1. 选择一个有效的服务器
2. 确保代理模式设置为"系统代理"
3. 点击"启动连接"按钮

4. 验证启动：
   - [ ] 连接状态变为"已连接"
   - [ ] sing-box 进程启动（任务管理器中可见）
   - [ ] 日志显示连接信息
   - [ ] 托盘图标状态更新

5. 验证运行：
   - [ ] 可以通过代理访问网络
   - [ ] 实时日志持续更新
   - [ ] 流量统计正常显示

6. 点击"停止连接"按钮

7. 验证停止：
   - [ ] 连接状态变为"未连接"
   - [ ] sing-box 进程终止
   - [ ] 系统代理设置被清理
   - [ ] 托盘图标状态更新

**预期结果**: 代理正常启动和停止，资源正确清理

---

### 测试 4: 系统代理设置

**目标**: 验证系统代理的启用和禁用

**步骤**:
1. 启动代理连接（系统代理模式）

2. 检查系统代理设置：
   - 打开 Windows 设置 → 网络和 Internet → 代理
   - 或运行 `reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings"`

3. 验证点：
   - [ ] "使用代理服务器" 已启用
   - [ ] 代理地址为 `127.0.0.1:65533`（HTTP）
   - [ ] 代理地址为 `127.0.0.1:65534`（SOCKS）

4. 停止代理连接

5. 再次检查系统代理设置：
   - [ ] "使用代理服务器" 已禁用
   - [ ] 代理设置恢复到原始状态

**预期结果**: 系统代理正确设置和清理

---

### 测试 5: 自启动设置

**目标**: 验证开机自启动功能

**步骤**:
1. 在应用设置中启用"开机自启动"

2. 验证注册表：
   ```powershell
   reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v V2rayZ
   ```

3. 验证点：
   - [ ] 注册表项存在
   - [ ] 路径指向应用可执行文件

4. 禁用"开机自启动"

5. 再次验证注册表：
   - [ ] 注册表项已删除

6. （可选）重启计算机验证：
   - 启用自启动
   - 重启计算机
   - [ ] 应用自动启动

**预期结果**: 自启动设置正确保存和清理

---

### 测试 6: 代理模式切换

**目标**: 验证全局代理、智能分流、直连模式切换

**步骤**:
1. 启动代理连接（全局模式）
2. 验证所有流量通过代理

3. 切换到智能分流模式：
   - [ ] 代理自动重启
   - [ ] 国内流量直连
   - [ ] 国外流量走代理

4. 切换到直连模式：
   - [ ] 代理自动重启
   - [ ] 所有流量直连

**预期结果**: 模式切换正常，路由规则生效

---

### 测试 7: 自定义路由规则

**目标**: 验证自定义域名规则功能

**步骤**:
1. 添加自定义规则：
   - 域名: `example.com`
   - 动作: 代理

2. 验证点：
   - [ ] 规则添加成功
   - [ ] 规则显示在列表中
   - [ ] 如果代理运行中，自动重启应用规则

3. 删除规则：
   - [ ] 规则删除成功
   - [ ] 如果代理运行中，自动重启

**预期结果**: 自定义规则正确应用

---

### 测试 8: 日志查看

**目标**: 验证日志记录和查看功能

**步骤**:
1. 启动代理连接
2. 打开日志页面

3. 验证点：
   - [ ] 实时日志显示
   - [ ] 日志包含时间戳
   - [ ] 日志包含级别（INFO/WARN/ERROR）
   - [ ] 日志包含来源（Main/ProxyManager/等）
   - [ ] 可以滚动查看历史日志

4. 检查日志文件：
   - 位置: `%APPDATA%/v2rayz-electron/logs/app.log`
   - [ ] 文件存在
   - [ ] 内容与界面显示一致

**预期结果**: 日志正确记录和显示

---

### 测试 9: 配置持久化

**目标**: 验证配置保存和加载

**步骤**:
1. 修改各种设置：
   - 添加服务器
   - 修改代理模式
   - 修改端口
   - 启用自启动
   - 添加自定义规则

2. 关闭应用

3. 检查配置文件：
   - 位置: `%APPDATA%/v2rayz-electron/config.json`
   - [ ] 文件存在
   - [ ] 包含所有设置

4. 重新启动应用

5. 验证点：
   - [ ] 所有设置正确恢复
   - [ ] 服务器列表完整
   - [ ] 自定义规则保留

**预期结果**: 配置正确保存和恢复

---

### 测试 10: 托盘功能

**目标**: 验证系统托盘集成

**步骤**:
1. 右键点击托盘图标

2. 验证菜单项：
   - [ ] "启动代理" / "停止代理"
   - [ ] "显示窗口"
   - [ ] "退出"

3. 测试菜单功能：
   - 点击"启动代理"
     - [ ] 代理启动
     - [ ] 菜单项变为"停止代理"
   
   - 点击"停止代理"
     - [ ] 代理停止
     - [ ] 菜单项变为"启动代理"
   
   - 关闭主窗口（启用"最小化到托盘"）
     - [ ] 窗口隐藏
     - [ ] 应用继续运行
   
   - 点击"显示窗口"
     - [ ] 窗口重新显示
   
   - 点击"退出"
     - [ ] 应用完全退出
     - [ ] 资源清理（代理停止、系统代理清理）

**预期结果**: 托盘功能完整可用

---

### 测试 11: 错误处理

**目标**: 验证错误处理和恢复机制

**测试场景**:

#### 11.1 配置文件损坏
1. 手动损坏配置文件（删除部分内容）
2. 启动应用
3. 验证点：
   - [ ] 显示错误提示
   - [ ] 使用默认配置
   - [ ] 应用正常运行

#### 11.2 sing-box 启动失败
1. 删除或重命名 `sing-box.exe`
2. 尝试启动代理
3. 验证点：
   - [ ] 显示明确的错误信息
   - [ ] 应用不崩溃

#### 11.3 端口被占用
1. 手动占用 65533 端口
2. 尝试启动代理
3. 验证点：
   - [ ] 显示端口占用错误
   - [ ] 提供解决建议

#### 11.4 无效的服务器配置
1. 添加无效的服务器 URL
2. 验证点：
   - [ ] 显示解析错误
   - [ ] 不添加到列表

**预期结果**: 错误被正确捕获和处理，应用保持稳定

---

### 测试 12: 资源清理

**目标**: 验证应用退出时的资源清理

**步骤**:
1. 启动代理连接
2. 启用系统代理
3. 退出应用（通过托盘菜单或窗口关闭）

4. 验证清理：
   - [ ] sing-box 进程终止（任务管理器）
   - [ ] 系统代理设置清理
   - [ ] 应用进程完全退出

5. 异常退出测试：
   - 启动代理
   - 通过任务管理器强制结束应用
   - 重新启动应用
   - [ ] 应用正常启动
   - [ ] 检测到上次异常退出
   - [ ] 清理残留的系统代理设置

**预期结果**: 资源正确清理，无残留

---

## 打包测试

### 测试 13: 构建安装包

**步骤**:
1. 构建 Windows 安装包：
   ```bash
   npm run package:win
   ```

2. 验证产物：
   - 位置: `dist-package/`
   - [ ] NSIS 安装程序 (`.exe`)
   - [ ] ZIP 便携版
   - [ ] 文件名包含版本号

3. 安装测试：
   - 运行 NSIS 安装程序
   - [ ] 安装向导正常
   - [ ] 可以选择安装目录
   - [ ] 创建桌面快捷方式
   - [ ] 创建开始菜单项

4. 运行已安装的应用：
   - [ ] 应用正常启动
   - [ ] 所有功能正常
   - [ ] 资源文件正确加载

5. 卸载测试：
   - 运行卸载程序
   - [ ] 卸载完成
   - [ ] 文件清理（可选保留用户数据）

**预期结果**: 安装包正确构建，安装和卸载流程正常

---

## 性能测试

### 测试 14: 性能和稳定性

**步骤**:
1. 长时间运行测试：
   - 启动代理
   - 持续运行 1 小时以上
   - [ ] 应用稳定运行
   - [ ] 内存使用正常（无明显泄漏）
   - [ ] CPU 使用合理

2. 频繁切换测试：
   - 快速启动/停止代理 10 次
   - [ ] 每次都正常响应
   - [ ] 无进程残留

3. 大量日志测试：
   - 启动代理并产生大量日志
   - [ ] 日志正常显示
   - [ ] 界面不卡顿
   - [ ] 日志文件大小合理（有轮转）

**预期结果**: 应用性能良好，稳定运行

---

## 测试报告模板

完成测试后，请填写以下报告：

```
测试日期: ____________________
测试人员: ____________________
Windows 版本: ____________________
Node.js 版本: ____________________
应用版本: ____________________

测试结果汇总:
- 应用启动: [ ] 通过 [ ] 失败
- 添加服务器: [ ] 通过 [ ] 失败
- 启动/停止代理: [ ] 通过 [ ] 失败
- 系统代理设置: [ ] 通过 [ ] 失败
- 自启动设置: [ ] 通过 [ ] 失败
- 代理模式切换: [ ] 通过 [ ] 失败
- 自定义路由规则: [ ] 通过 [ ] 失败
- 日志查看: [ ] 通过 [ ] 失败
- 配置持久化: [ ] 通过 [ ] 失败
- 托盘功能: [ ] 通过 [ ] 失败
- 错误处理: [ ] 通过 [ ] 失败
- 资源清理: [ ] 通过 [ ] 失败
- 打包安装: [ ] 通过 [ ] 失败
- 性能稳定性: [ ] 通过 [ ] 失败

发现的问题:
1. ____________________
2. ____________________
3. ____________________

建议改进:
1. ____________________
2. ____________________
3. ____________________

总体评价:
____________________
____________________
____________________
```

---

## 常见问题排查

### 问题 1: 应用无法启动
- 检查 Node.js 版本
- 检查依赖是否完整安装
- 查看控制台错误信息
- 检查 `%APPDATA%/v2rayz-electron/logs/app.log`

### 问题 2: sing-box 进程启动失败
- 检查 `resources/win/sing-box.exe` 是否存在
- 检查文件权限
- 检查端口是否被占用
- 查看 sing-box 日志

### 问题 3: 系统代理设置失败
- 检查是否有管理员权限
- 检查注册表访问权限
- 手动检查注册表项

### 问题 4: 配置文件问题
- 位置: `%APPDATA%/v2rayz-electron/config.json`
- 备份后删除，让应用重新生成
- 检查 JSON 格式是否正确

---

## 自动化测试脚本

以下是一个简单的 PowerShell 测试脚本示例：

```powershell
# test-windows.ps1
Write-Host "开始 Windows 测试流程..." -ForegroundColor Green

# 1. 检查构建产物
Write-Host "`n检查构建产物..." -ForegroundColor Yellow
if (Test-Path "dist/main/main/index.js") {
    Write-Host "✓ 主进程构建存在" -ForegroundColor Green
} else {
    Write-Host "✗ 主进程构建缺失" -ForegroundColor Red
    exit 1
}

if (Test-Path "dist/renderer/index.html") {
    Write-Host "✓ 渲染进程构建存在" -ForegroundColor Green
} else {
    Write-Host "✗ 渲染进程构建缺失" -ForegroundColor Red
    exit 1
}

if (Test-Path "resources/win/sing-box.exe") {
    Write-Host "✓ sing-box 可执行文件存在" -ForegroundColor Green
} else {
    Write-Host "✗ sing-box 可执行文件缺失" -ForegroundColor Red
    exit 1
}

# 2. 检查配置文件
$configPath = "$env:APPDATA\v2rayz-electron\config.json"
Write-Host "`n检查配置文件: $configPath" -ForegroundColor Yellow
if (Test-Path $configPath) {
    Write-Host "✓ 配置文件存在" -ForegroundColor Green
    $config = Get-Content $configPath | ConvertFrom-Json
    Write-Host "  服务器数量: $($config.servers.Count)" -ForegroundColor Cyan
} else {
    Write-Host "! 配置文件不存在（首次运行正常）" -ForegroundColor Yellow
}

# 3. 检查系统代理设置
Write-Host "`n检查系统代理设置..." -ForegroundColor Yellow
$proxyEnabled = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" -Name ProxyEnable
if ($proxyEnabled.ProxyEnable -eq 1) {
    Write-Host "! 系统代理已启用" -ForegroundColor Yellow
    $proxyServer = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" -Name ProxyServer
    Write-Host "  代理服务器: $($proxyServer.ProxyServer)" -ForegroundColor Cyan
} else {
    Write-Host "✓ 系统代理未启用" -ForegroundColor Green
}

# 4. 检查自启动设置
Write-Host "`n检查自启动设置..." -ForegroundColor Yellow
$autoStart = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "V2rayZ" -ErrorAction SilentlyContinue
if ($autoStart) {
    Write-Host "! 自启动已启用" -ForegroundColor Yellow
    Write-Host "  路径: $($autoStart.V2rayZ)" -ForegroundColor Cyan
} else {
    Write-Host "✓ 自启动未启用" -ForegroundColor Green
}

# 5. 检查进程
Write-Host "`n检查相关进程..." -ForegroundColor Yellow
$electronProcess = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if ($electronProcess) {
    Write-Host "! Electron 进程运行中 (PID: $($electronProcess.Id))" -ForegroundColor Yellow
} else {
    Write-Host "✓ Electron 进程未运行" -ForegroundColor Green
}

$singboxProcess = Get-Process -Name "sing-box" -ErrorAction SilentlyContinue
if ($singboxProcess) {
    Write-Host "! sing-box 进程运行中 (PID: $($singboxProcess.Id))" -ForegroundColor Yellow
} else {
    Write-Host "✓ sing-box 进程未运行" -ForegroundColor Green
}

Write-Host "`n测试检查完成！" -ForegroundColor Green
Write-Host "请参考 WINDOWS_TEST_GUIDE.md 进行完整的手动测试。" -ForegroundColor Cyan
```

使用方法：
```powershell
.\test-windows.ps1
```

---

## 注意事项

1. **管理员权限**: 某些功能（如 TUN 模式、系统代理设置）可能需要管理员权限
2. **防火墙**: 首次运行可能需要允许防火墙访问
3. **杀毒软件**: 某些杀毒软件可能误报，需要添加白名单
4. **端口占用**: 确保 65533 和 65534 端口未被占用
5. **网络环境**: 测试代理功能需要有效的服务器配置

---

## 测试完成标准

所有测试项目通过，且：
- 无严重错误或崩溃
- 资源正确清理
- 配置正确保存和恢复
- 性能表现良好
- 用户体验流畅

测试通过后，可以进行下一步的 macOS 测试或发布准备。
