# V2rayZ

A modern Windows desktop client for v2ray proxy with VLESS and Trojan protocol support.

## Core Features
- VLESS and Trojan protocol support
- Multiple proxy modes (Global, Smart routing, Direct connection)
- Custom domain routing rules
- Real-time traffic statistics
- System tray integration with context menu
- Auto-start and auto-connect capabilities
- Modern React-based user interface embedded in WPF

## Target Platform
- Windows 10 (1809+) or Windows 11
- Requires WebView2 Runtime (pre-installed on Windows 11)
- .NET 8 runtime dependency

## Architecture
Hybrid desktop application combining:
- WPF (.NET 8) for native Windows integration and system services
- React 18 + TypeScript frontend embedded via WebView2
- JavaScript bridge for communication between frontend and backend
- System tray functionality for background operation