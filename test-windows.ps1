# Windows 测试脚本
# 用于检查 V2rayZ Electron 应用的基本状态和配置

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "V2rayZ Windows 测试脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testsPassed = 0
$testsFailed = 0

function Test-Item-Exists {
    param(
        [string]$Path,
        [string]$Description
    )
    
    if (Test-Path $Path) {
        Write-Host "✓ $Description" -ForegroundColor Green
        return $true
    } else {
        Write-Host "✗ $Description" -ForegroundColor Red
        return $false
    }
}

# 1. 检查构建产物
Write-Host "1. 检查构建产物" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

if (Test-Item-Exists "dist/main/main/index.js" "主进程构建存在") { $testsPassed++ } else { $testsFailed++ }
if (Test-Item-Exists "dist/renderer/index.html" "渲染进程构建存在") { $testsPassed++ } else { $testsFailed++ }
if (Test-Item-Exists "resources/win/sing-box.exe" "sing-box 可执行文件存在") { $testsPassed++ } else { $testsFailed++ }
if (Test-Item-Exists "resources/win/app.ico" "应用图标存在") { $testsPassed++ } else { $testsFailed++ }
if (Test-Item-Exists "resources/data/geoip-cn.srs" "GeoIP 数据文件存在") { $testsPassed++ } else { $testsFailed++ }
if (Test-Item-Exists "resources/data/geosite-cn.srs" "GeoSite 数据文件存在") { $testsPassed++ } else { $testsFailed++ }

Write-Host ""

# 2. 检查配置文件
Write-Host "2. 检查配置文件" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$configPath = "$env:APPDATA\v2rayz-electron\config.json"
Write-Host "配置文件路径: $configPath" -ForegroundColor Cyan

if (Test-Path $configPath) {
    Write-Host "✓ 配置文件存在" -ForegroundColor Green
    $testsPassed++
    
    try {
        $config = Get-Content $configPath | ConvertFrom-Json
        Write-Host "  - 服务器数量: $($config.servers.Count)" -ForegroundColor Gray
        Write-Host "  - 代理模式: $($config.proxyMode)" -ForegroundColor Gray
        Write-Host "  - HTTP 端口: $($config.httpPort)" -ForegroundColor Gray
        Write-Host "  - SOCKS 端口: $($config.socksPort)" -ForegroundColor Gray
        Write-Host "  - 自启动: $($config.autoStart)" -ForegroundColor Gray
        Write-Host "  - 最小化到托盘: $($config.minimizeToTray)" -ForegroundColor Gray
    } catch {
        Write-Host "✗ 配置文件格式错误" -ForegroundColor Red
        $testsFailed++
    }
} else {
    Write-Host "! 配置文件不存在（首次运行正常）" -ForegroundColor Yellow
}

Write-Host ""

# 3. 检查日志文件
Write-Host "3. 检查日志文件" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$logPath = "$env:APPDATA\v2rayz-electron\logs\app.log"
Write-Host "日志文件路径: $logPath" -ForegroundColor Cyan

if (Test-Path $logPath) {
    Write-Host "✓ 日志文件存在" -ForegroundColor Green
    $logSize = (Get-Item $logPath).Length
    Write-Host "  - 文件大小: $([math]::Round($logSize/1KB, 2)) KB" -ForegroundColor Gray
    
    # 显示最后几行日志
    Write-Host "  - 最后 5 行日志:" -ForegroundColor Gray
    Get-Content $logPath -Tail 5 | ForEach-Object {
        Write-Host "    $_" -ForegroundColor DarkGray
    }
} else {
    Write-Host "! 日志文件不存在（首次运行正常）" -ForegroundColor Yellow
}

Write-Host ""

# 4. 检查系统代理设置
Write-Host "4. 检查系统代理设置" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $proxyEnabled = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" -Name ProxyEnable -ErrorAction Stop
    
    if ($proxyEnabled.ProxyEnable -eq 1) {
        Write-Host "! 系统代理已启用" -ForegroundColor Yellow
        $proxyServer = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" -Name ProxyServer -ErrorAction SilentlyContinue
        if ($proxyServer) {
            Write-Host "  - 代理服务器: $($proxyServer.ProxyServer)" -ForegroundColor Gray
        }
    } else {
        Write-Host "✓ 系统代理未启用" -ForegroundColor Green
        $testsPassed++
    }
} catch {
    Write-Host "✗ 无法读取系统代理设置" -ForegroundColor Red
    $testsFailed++
}

Write-Host ""

# 5. 检查自启动设置
Write-Host "5. 检查自启动设置" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $autoStart = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "V2rayZ" -ErrorAction SilentlyContinue
    
    if ($autoStart) {
        Write-Host "! 自启动已启用" -ForegroundColor Yellow
        Write-Host "  - 路径: $($autoStart.V2rayZ)" -ForegroundColor Gray
    } else {
        Write-Host "✓ 自启动未启用" -ForegroundColor Green
        $testsPassed++
    }
} catch {
    Write-Host "✗ 无法读取自启动设置" -ForegroundColor Red
    $testsFailed++
}

Write-Host ""

# 6. 检查进程
Write-Host "6. 检查相关进程" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$electronProcess = Get-Process -Name "electron" -ErrorAction SilentlyContinue
if ($electronProcess) {
    Write-Host "! Electron 进程运行中" -ForegroundColor Yellow
    $electronProcess | ForEach-Object {
        Write-Host "  - PID: $($_.Id), 内存: $([math]::Round($_.WorkingSet64/1MB, 2)) MB" -ForegroundColor Gray
    }
} else {
    Write-Host "✓ Electron 进程未运行" -ForegroundColor Green
    $testsPassed++
}

$singboxProcess = Get-Process -Name "sing-box" -ErrorAction SilentlyContinue
if ($singboxProcess) {
    Write-Host "! sing-box 进程运行中" -ForegroundColor Yellow
    $singboxProcess | ForEach-Object {
        Write-Host "  - PID: $($_.Id), 内存: $([math]::Round($_.WorkingSet64/1MB, 2)) MB" -ForegroundColor Gray
    }
} else {
    Write-Host "✓ sing-box 进程未运行" -ForegroundColor Green
    $testsPassed++
}

Write-Host ""

# 7. 检查端口占用
Write-Host "7. 检查端口占用" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$httpPort = 65533
$socksPort = 65534

$httpPortInUse = Get-NetTCPConnection -LocalPort $httpPort -ErrorAction SilentlyContinue
if ($httpPortInUse) {
    Write-Host "! HTTP 端口 $httpPort 被占用" -ForegroundColor Yellow
    Write-Host "  - 进程 ID: $($httpPortInUse.OwningProcess)" -ForegroundColor Gray
} else {
    Write-Host "✓ HTTP 端口 $httpPort 可用" -ForegroundColor Green
    $testsPassed++
}

$socksPortInUse = Get-NetTCPConnection -LocalPort $socksPort -ErrorAction SilentlyContinue
if ($socksPortInUse) {
    Write-Host "! SOCKS 端口 $socksPort 被占用" -ForegroundColor Yellow
    Write-Host "  - 进程 ID: $($socksPortInUse.OwningProcess)" -ForegroundColor Gray
} else {
    Write-Host "✓ SOCKS 端口 $socksPort 可用" -ForegroundColor Green
    $testsPassed++
}

Write-Host ""

# 8. 检查 Node.js 和 npm
Write-Host "8. 检查开发环境" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js 版本: $nodeVersion" -ForegroundColor Green
    $testsPassed++
} catch {
    Write-Host "✗ Node.js 未安装" -ForegroundColor Red
    $testsFailed++
}

try {
    $npmVersion = npm --version
    Write-Host "✓ npm 版本: $npmVersion" -ForegroundColor Green
    $testsPassed++
} catch {
    Write-Host "✗ npm 未安装" -ForegroundColor Red
    $testsFailed++
}

Write-Host ""

# 9. 检查打包产物
Write-Host "9. 检查打包产物" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

if (Test-Path "dist-package") {
    Write-Host "✓ 打包输出目录存在" -ForegroundColor Green
    
    $packages = Get-ChildItem "dist-package" -Filter "*.exe" -ErrorAction SilentlyContinue
    if ($packages) {
        Write-Host "  找到以下安装包:" -ForegroundColor Gray
        $packages | ForEach-Object {
            $size = [math]::Round($_.Length/1MB, 2)
            Write-Host "  - $($_.Name) ($size MB)" -ForegroundColor Gray
        }
        $testsPassed++
    } else {
        Write-Host "  ! 未找到 .exe 安装包" -ForegroundColor Yellow
    }
    
    $zipPackages = Get-ChildItem "dist-package" -Filter "*.zip" -ErrorAction SilentlyContinue
    if ($zipPackages) {
        Write-Host "  找到以下便携版:" -ForegroundColor Gray
        $zipPackages | ForEach-Object {
            $size = [math]::Round($_.Length/1MB, 2)
            Write-Host "  - $($_.Name) ($size MB)" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "! 打包输出目录不存在（未执行打包）" -ForegroundColor Yellow
}

Write-Host ""

# 总结
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试总结" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "通过: $testsPassed" -ForegroundColor Green
Write-Host "失败: $testsFailed" -ForegroundColor Red
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "✓ 所有基础检查通过！" -ForegroundColor Green
    Write-Host "请参考 WINDOWS_TEST_GUIDE.md 进行完整的手动测试。" -ForegroundColor Cyan
} else {
    Write-Host "! 部分检查失败，请检查上述错误。" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "提示: 运行 'npm run dev' 启动开发模式进行测试" -ForegroundColor Cyan
Write-Host "提示: 运行 'npm run package:win' 构建 Windows 安装包" -ForegroundColor Cyan
Write-Host ""
