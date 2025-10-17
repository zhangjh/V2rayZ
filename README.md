# V2rayZ

一个现代化的 Windows v2ray 客户端，支持 VLESS 和 Trojan 协议。

## ✨ 功能特性

- ✅ 支持 VLESS 和 Trojan 协议
- ✅ 多种代理模式（全局、智能、直连）
- ✅ 自定义域名路由规则
- ✅ 实时流量统计
- ✅ 系统托盘集成
- ✅ 开机自启动和自动连接
- ✅ 现代化的用户界面

## 📋 系统要求

- Windows 10 (1809+) 或 Windows 11
- WebView2 Runtime（Windows 11 已预装）

## 📥 安装

1. 从 [Releases](../../releases) 页面下载最新的安装程序
2. 运行 `V2rayZ-Setup-x.x.x.exe`
3. 按照安装向导完成安装

## 🚀 快速开始

### 1. 配置服务器
- 打开应用 → "服务器"标签
- 选择协议（VLESS 或 Trojan）
- 填写服务器信息
- 点击"保存配置"

### 2. 连接代理
- 返回"首页"
- 点击"启用代理"
- 等待连接成功

### 3. 选择代理模式
- **全局模式**：所有流量通过代理
- **智能模式**：自动分流（推荐）
- **直连模式**：不使用代理

## 🛠️ 从源码构建

### 快速构建
```powershell
# 完全清理重建（推荐）
.\clean-rebuild.ps1
```

### 构建安装程序
```powershell
# 1. 构建应用
.\clean-rebuild.ps1

# 2. 构建安装程序（需要 Inno Setup）
.\build-installer.ps1
```

详细说明请查看 [BUILD_GUIDE.md](BUILD_GUIDE.md)

## 📚 文档

- [BUILD_GUIDE.md](BUILD_GUIDE.md) - 构建指南
- [check-config.ps1](check-config.ps1) - 配置验证
- [diagnose-connection.ps1](diagnose-connection.ps1) - 连接诊断

## 🔧 技术栈

- .NET 8 WPF
- React 18 + TypeScript
- WebView2
- Tailwind CSS + shadcn/ui

## 📄 开源协议

本项目采用 MIT 协议开源。

## 💬 反馈与支持

如遇到问题或有功能建议，请在 [Issues](../../issues) 页面提交。

## ⚠️ 免责声明

本软件仅供学习和研究使用，请遵守当地法律法规。使用本软件所产生的任何后果由使用者自行承担。
