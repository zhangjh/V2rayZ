# 跨平台测试指南

本文档提供 V2rayZ Electron 应用在 Windows 和 macOS 平台上的测试指南。

## 概述

V2rayZ 是一个跨平台的代理客户端应用，支持 Windows 和 macOS 双系统。为确保应用在不同平台上的功能一致性和稳定性，需要在各个目标平台上进行完整的测试。

## 测试文档结构

```
├── WINDOWS_TEST_GUIDE.md      # Windows 详细测试指南
├── WINDOWS_TEST_SUMMARY.md    # Windows 测试总结
├── test-windows.ps1           # Windows 自动化测试脚本
├── MACOS_TEST_GUIDE.md        # macOS 详细测试指南
├── MACOS_TEST_SUMMARY.md      # macOS 测试总结
├── test-macos.sh              # macOS 自动化测试脚本
└── TESTING_README.md          # 本文档
```

## 测试平台要求

### Windows 平台
- **操作系统**: Windows 10 (1809+) 或 Windows 11
- **架构**: x64
- **工具**: PowerShell 或 Git Bash
- **权限**: 管理员权限（部分测试需要）

### macOS 平台
- **操作系统**: macOS 10.15 (Catalina) 或更高版本
- **架构**: 
  - Intel (x64) - 用于测试 x64 版本
  - Apple Silicon (arm64) - 用于测试 arm64 版本
- **工具**: 终端 (Terminal)
- **权限**: 管理员权限（部分测试需要）

## 快速开始

### Windows 测试

1. **阅读测试指南**:
   ```bash
   # 查看详细指南
   cat WINDOWS_TEST_GUIDE.md
   
   # 或查看快速总结
   cat WINDOWS_TEST_SUMMARY.md
   ```

2. **运行自动检查**:
   ```powershell
   # PowerShell
   .\test-windows.ps1
   
   # 或 Git Bash
   ./test-windows.ps1
   ```

3. **启动应用进行手动测试**:
   ```bash
   npm run dev
   ```

4. **按照测试指南逐项测试**

### macOS 测试

1. **阅读测试指南**:
   ```bash
   # 查看详细指南
   cat MACOS_TEST_GUIDE.md
   
   # 或查看快速总结
   cat MACOS_TEST_SUMMARY.md
   ```

2. **运行自动检查**:
   ```bash
   chmod +x test-macos.sh
   ./test-macos.sh
   ```

3. **启动应用进行手动测试**:
   ```bash
   npm run dev
   ```

4. **按照测试指南逐项测试**

## 测试流程

### 阶段 1: 环境准备
1. 克隆项目代码
2. 安装依赖 (`npm install`)
3. 构建项目 (`npm run build`)
4. 验证构建产物

### 阶段 2: 自动化检查
1. 运行平台特定的测试脚本
2. 检查构建产物完整性
3. 验证资源文件存在
4. 检查系统状态

### 阶段 3: 功能测试
按照测试指南进行以下测试：
1. 应用启动
2. 服务器管理（添加、编辑、删除）
3. 代理连接（启动、停止）
4. 系统代理设置
5. 自启动设置
6. 代理模式切换
7. 自定义路由规则
8. 日志查看
9. 配置持久化
10. 托盘/菜单栏功能
11. 错误处理
12. 资源清理

### 阶段 4: 打包测试
1. 构建安装包
2. 安装测试
3. 运行已安装的应用
4. 卸载测试

### 阶段 5: 性能测试
1. 长时间运行测试
2. 频繁切换测试
3. 资源使用监控

## 测试重点

### 跨平台一致性
确保以下方面在 Windows 和 macOS 上保持一致：
- UI 布局和交互
- 功能可用性
- 配置文件格式
- 错误处理逻辑
- 性能表现

### 平台特定功能
验证平台特定的实现：

**Windows**:
- 注册表操作（系统代理、自启动）
- NSIS 安装程序
- 系统托盘集成

**macOS**:
- networksetup 命令（系统代理）
- Login Items（自启动）
- DMG 安装包
- 菜单栏集成
- 架构匹配（x64 vs arm64）
- Rosetta 2 兼容性（仅 Apple Silicon）

## 测试报告

完成测试后，请填写相应平台的测试报告：
- Windows: 参考 `WINDOWS_TEST_GUIDE.md` 中的报告模板
- macOS: 参考 `MACOS_TEST_GUIDE.md` 中的报告模板

## 常见问题

### Q: 我需要在所有平台上都进行测试吗？
A: 理想情况下，是的。但如果资源有限，至少需要在目标发布平台上进行完整测试。

### Q: 自动化测试脚本能替代手动测试吗？
A: 不能。自动化脚本只能检查基本的环境和构建状态，完整的功能测试仍需手动进行。

### Q: 测试失败了怎么办？
A: 
1. 查看测试指南中的"常见问题排查"部分
2. 检查日志文件
3. 记录问题详情
4. 提交 Issue 或联系开发团队

### Q: macOS 上需要测试两种架构吗？
A: 是的。如果可能，应该在 Intel (x64) 和 Apple Silicon (arm64) 设备上分别测试，以确保两种架构都能正常工作。

### Q: 如何验证架构匹配？
A: 
- 使用 `uname -m` 查看系统架构
- 使用 `file <path-to-binary>` 查看二进制文件架构
- 使用 `ps aux | grep <process>` 查看运行进程的架构

## 测试完成标准

所有平台的测试都应满足以下标准：
- [ ] 所有功能测试项通过
- [ ] 无严重错误或崩溃
- [ ] 资源正确清理
- [ ] 配置正确保存和恢复
- [ ] 性能表现良好
- [ ] 用户体验流畅
- [ ] 打包和安装流程正常

## 下一步

测试通过后：
1. 完成跨平台一致性验证
2. 准备发布说明
3. 创建 GitHub Release
4. 上传安装包
5. 更新文档

## 联系方式

如有测试相关问题，请：
- 提交 GitHub Issue
- 查看项目文档
- 联系开发团队

---

**注意**: 本测试指南基于 Electron 跨平台迁移项目（任务 18.2 和 18.2.1）。测试过程中发现的任何问题都应及时记录和报告。
