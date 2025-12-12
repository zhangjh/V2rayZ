# Requirements Document

## Introduction

本需求文档定义了为V2rayZ添加TUN模式支持并将底层核心从v2ray迁移到xray的功能。TUN模式是一种透明代理模式,通过虚拟网络接口实现全局流量代理,无需配置系统代理。xray是v2ray的超集,提供更好的性能和更多功能支持。

## Glossary

- **TUN模式**: 透明代理模式,通过创建虚拟网络接口(TUN设备)来捕获和转发系统流量
- **xray-core**: v2ray-core的超集,提供更好的性能和额外功能
- **wintun.dll**: Windows平台的TUN设备驱动库
- **系统代理模式**: 通过配置系统HTTP/SOCKS代理来转发流量的传统模式
- **透明代理**: 无需应用程序配置即可自动代理流量的模式
- **Inbound**: xray的入站连接配置,定义如何接收流量
- **Outbound**: xray的出站连接配置,定义如何转发流量
- **ProxyMode**: 代理模式枚举,包括Global(全局)、Smart(智能分流)、Direct(直连)
- **V2rayManager**: 管理xray进程生命周期的服务类
- **UserConfig**: 用户配置模型,存储代理设置和服务器配置

## Requirements

### Requirement 1

**User Story:** 作为用户,我希望能够选择使用TUN模式或系统代理模式,以便根据不同场景选择最合适的代理方式。

#### Acceptance Criteria

1. WHEN 用户在设置界面查看代理模式选项 THEN 系统 SHALL 显示TUN模式和系统代理模式两个选项
2. WHEN 用户选择TUN模式 THEN 系统 SHALL 保存该选择到用户配置中
3. WHEN 用户选择系统代理模式 THEN 系统 SHALL 保存该选择到用户配置中
4. WHEN 应用启动时 THEN 系统 SHALL 从用户配置中读取上次选择的代理模式
5. WHEN 用户切换代理模式 THEN 系统 SHALL 在下次连接时应用新的模式设置

### Requirement 2

**User Story:** 作为用户,我希望在TUN模式下能够透明代理所有应用的流量,而无需为每个应用单独配置代理。

#### Acceptance Criteria

1. WHEN 用户启用TUN模式并连接代理 THEN 系统 SHALL 创建虚拟TUN网络接口
2. WHEN TUN接口创建成功 THEN 系统 SHALL 配置路由规则将流量导向TUN接口
3. WHEN 应用程序发起网络请求 THEN 系统 SHALL 通过TUN接口捕获该流量
4. WHEN TUN接口捕获到流量 THEN xray-core SHALL 根据路由规则处理该流量
5. WHEN 用户断开代理连接 THEN 系统 SHALL 清理TUN接口和路由规则

### Requirement 3

**User Story:** 作为用户,我希望系统能够正确加载wintun.dll驱动,以便TUN模式能够正常工作。

#### Acceptance Criteria

1. WHEN 应用启动时 THEN 系统 SHALL 验证wintun.dll文件存在于Resources目录
2. WHEN 启用TUN模式时 THEN xray-core SHALL 能够加载wintun.dll驱动
3. IF wintun.dll文件不存在或损坏 THEN 系统 SHALL 显示明确的错误提示信息
4. WHEN wintun.dll加载失败 THEN 系统 SHALL 记录详细的错误日志
5. WHEN wintun.dll加载成功 THEN 系统 SHALL 记录成功日志

### Requirement 4

**User Story:** 作为用户,我希望系统使用xray-core替代v2ray-core,以获得更好的性能和功能支持。

#### Acceptance Criteria

1. WHEN 系统启动代理服务时 THEN V2rayManager SHALL 启动xray.exe进程而非v2ray.exe
2. WHEN 生成配置文件时 THEN 系统 SHALL 生成与xray-core兼容的JSON配置
3. WHEN xray进程启动 THEN 系统 SHALL 验证进程成功运行
4. WHEN xray进程输出日志 THEN 系统 SHALL 捕获并显示日志信息
5. WHEN xray进程异常退出 THEN 系统 SHALL 捕获错误并通知用户

### Requirement 5

**User Story:** 作为用户,我希望在TUN模式下能够配置DNS服务器,以确保域名解析的正确性和安全性。

#### Acceptance Criteria

1. WHEN 用户在TUN模式设置中配置DNS服务器 THEN 系统 SHALL 保存DNS配置到用户配置
2. WHEN 生成TUN模式的xray配置时 THEN 系统 SHALL 包含用户配置的DNS服务器
3. WHEN 未配置自定义DNS时 THEN 系统 SHALL 使用默认的安全DNS服务器(如8.8.8.8)
4. WHEN TUN模式启用时 THEN xray-core SHALL 使用配置的DNS服务器进行域名解析
5. WHEN DNS配置无效时 THEN 系统 SHALL 显示验证错误提示

### Requirement 6

**User Story:** 作为用户,我希望在TUN模式和系统代理模式之间切换时,系统能够自动处理配置变更,无需手动干预。

#### Acceptance Criteria

1. WHEN 用户从系统代理模式切换到TUN模式 THEN 系统 SHALL 停止当前连接并清理系统代理设置
2. WHEN 用户从TUN模式切换到系统代理模式 THEN 系统 SHALL 停止当前连接并清理TUN接口
3. WHEN 模式切换完成后用户重新连接 THEN 系统 SHALL 使用新模式的配置启动xray
4. WHEN 模式切换过程中发生错误 THEN 系统 SHALL 回滚到切换前的状态
5. WHEN 模式切换成功 THEN 系统 SHALL 显示成功提示信息

### Requirement 7

**User Story:** 作为用户,我希望在TUN模式下能够看到清晰的连接状态和错误信息,以便了解代理是否正常工作。

#### Acceptance Criteria

1. WHEN TUN模式连接成功 THEN 系统 SHALL 在状态栏显示"TUN模式已连接"
2. WHEN TUN接口创建失败 THEN 系统 SHALL 显示具体的失败原因(如权限不足、驱动加载失败)
3. WHEN TUN模式运行中 THEN 系统 SHALL 实时显示流量统计信息
4. WHEN xray进程在TUN模式下异常退出 THEN 系统 SHALL 显示详细的错误信息
5. WHEN 用户查看日志 THEN 系统 SHALL 显示TUN模式相关的所有操作日志

### Requirement 8

**User Story:** 作为用户,我希望TUN模式能够与现有的路由规则(Global/Smart/Direct)兼容,以便灵活控制流量分流。

#### Acceptance Criteria

1. WHEN 用户在TUN模式下选择Global模式 THEN xray-core SHALL 代理所有流量
2. WHEN 用户在TUN模式下选择Smart模式 THEN xray-core SHALL 根据域名规则智能分流
3. WHEN 用户在TUN模式下选择Direct模式 THEN xray-core SHALL 直连所有流量
4. WHEN 用户在TUN模式下添加自定义路由规则 THEN xray-core SHALL 应用这些规则
5. WHEN 路由规则更新时 THEN 系统 SHALL 重新生成配置并重启xray进程

### Requirement 9

**User Story:** 作为开发者,我希望系统能够平滑地从v2ray.exe迁移到xray.exe,保持向后兼容性。

#### Acceptance Criteria

1. WHEN 系统检测到xray.exe存在 THEN V2rayManager SHALL 优先使用xray.exe
2. IF xray.exe不存在但v2ray.exe存在 THEN V2rayManager SHALL 回退使用v2ray.exe
3. WHEN 使用xray.exe时 THEN 系统 SHALL 在日志中记录使用的核心版本
4. WHEN 生成配置文件时 THEN 系统 SHALL 生成与两者兼容的配置格式
5. WHEN 核心切换时 THEN 现有的服务器配置和用户设置 SHALL 保持不变

### Requirement 10

**User Story:** 作为用户,我希望在TUN模式下能够正确处理IPv4和IPv6流量,确保双栈网络环境下的正常使用。

#### Acceptance Criteria

1. WHEN TUN接口创建时 THEN 系统 SHALL 配置IPv4地址
2. WHERE 系统支持IPv6 THEN 系统 SHALL 同时配置IPv6地址
3. WHEN 捕获到IPv4流量 THEN xray-core SHALL 正确处理该流量
4. WHEN 捕获到IPv6流量 THEN xray-core SHALL 正确处理该流量
5. WHEN 用户禁用IPv6时 THEN 系统 SHALL 仅配置IPv4地址
