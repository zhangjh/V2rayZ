# V2rayZ

一个现代化的 Windows v2ray 客户端，支持 VLESS 和 Trojan 协议。

开发初衷：

<img width="722" height="150" alt="image" src="https://github.com/user-attachments/assets/3c8512af-04ed-4fad-ac4f-141101a0b453" />

为了解决当前Windows下没有好用的V2ray客户端的问题（也可能是我没发现，我之前在用V2rayN），去除掉市面上常见的客户端复杂的功能，仅保留核心的代理开关、自定义规则配置等，其他用户什么DNS、GFW List之类的不需要用户感知的一概屏蔽由系统自己集成。

V2rayZ的名称来源于两个方面：
1. 跟随当前V2ray客户端的起名大流，V2ray + 单字母
2. Z代表作者的姓氏缩写（Zhang）

软件截图：

主页面：
<img width="1233" height="829" alt="image" src="https://github.com/user-attachments/assets/01567b24-1126-4395-ad55-a7b5420974d4" />

自定义规则页面：
<img width="1233" height="829" alt="image" src="https://github.com/user-attachments/assets/e057cf80-3d2a-4063-bd8c-3cad00ed6520" />


## ✨ 功能特性

- ✅ 支持 VLESS 和 Trojan 协议
- ✅ 多种代理模式（全局、智能、直连）
- ✅ 自定义域名路由规则
- ✅ 系统托盘集成
- ✅ 开机自启动和自动连接
- ✅ 现代化的用户界面

## 📋 系统要求

- Windows 10 (1809+) 或 Windows 11
- WebView2 Runtime（Windows 11 已预装）

## 📥 安装

1. 从 [Releases](../../releases) 页面下载最新的安装程序
2. 运行 `V2rayZ.exe`
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
