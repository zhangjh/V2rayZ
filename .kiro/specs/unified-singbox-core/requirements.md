# Requirements Document

## Introduction

本需求文档描述了将 V2rayZ 客户端的代理核心统一迁移到 sing-box 的功能需求。当前系统使用双核心架构：系统代理模式使用 v2ray-core，TUN 模式使用 sing-box。为了简化维护、减少分发体积、提升性能并统一配置格式，需要将所有代理模式统一使用 sing-box 核心。

## Glossary

- **System**: V2rayZ 客户端应用程序
- **sing-box**: 新一代代理核心，支持多种协议和传输方式
- **v2ray-core**: 原有的 V2Ray 代理核心（将被移除）
- **SystemProxyMode**: 系统代理模式，通过设置系统 HTTP/SOCKS 代理实现流量转发
- **TunMode**: TUN 模式，通过虚拟网卡实现透明代理
- **ProxyCore**: 代理核心进程，负责实际的流量转发
- **Inbound**: 入站配置，定义本地监听端口和协议
- **Outbound**: 出站配置，定义远程服务器连接
- **RoutingRule**: 路由规则，决定流量走向（代理/直连/阻止）
- **GeoIP**: 基于 IP 地址的地理位置数据库
- **GeoSite**: 基于域名的分类数据库

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望扩展 sing-box 配置模型以支持系统代理模式所需的所有配置项，以便能够生成完整的 sing-box 配置文件。

#### Acceptance Criteria

1. WHEN 系统需要生成 HTTP inbound 配置 THEN THE System SHALL 创建包含 type、tag、listen 和 listen_port 字段的 Inbound 对象
2. WHEN 系统需要生成 SOCKS inbound 配置 THEN THE System SHALL 创建包含 type、tag、listen 和 listen_port 字段的 Inbound 对象
3. WHEN 系统需要配置路由规则 THEN THE System SHALL 支持 RouteConfig 对象包含 rules 列表和 final 默认出站
4. WHEN 系统需要配置路由规则项 THEN THE System SHALL 支持 RouteRule 对象包含 domain、domain_suffix、ip_cidr 和 outbound 字段
5. WHEN 系统序列化 sing-box 配置 THEN THE System SHALL 使用正确的 JSON 属性名称（snake_case 格式）

### Requirement 2

**User Story:** 作为开发者，我希望 V2rayManager 能够为系统代理模式生成 sing-box 配置，以便统一使用 sing-box 核心。

#### Acceptance Criteria

1. WHEN 用户启动系统代理模式 THEN THE System SHALL 生成包含 HTTP 和 SOCKS inbound 的 sing-box 配置
2. WHEN 生成系统代理配置 THEN THE System SHALL 使用用户配置的端口（HttpPort 和 SocksPort）
3. WHEN 生成系统代理配置 THEN THE System SHALL 根据选中的服务器创建对应的 outbound（VLESS 或 Trojan）
4. WHEN 生成系统代理配置 THEN THE System SHALL 包含 direct 和 block 两个基础 outbound
5. WHEN 生成系统代理配置 THEN THE System SHALL 根据 ProxyMode 生成对应的路由规则

### Requirement 3

**User Story:** 作为开发者，我希望路由规则管理器能够生成 sing-box 格式的路由规则，以便在系统代理模式下正确分流流量。

#### Acceptance Criteria

1. WHEN ProxyMode 为 Global THEN THE System SHALL 生成将所有流量路由到 proxy outbound 的规则
2. WHEN ProxyMode 为 Smart THEN THE System SHALL 生成国内流量直连、国外流量代理的规则
3. WHEN ProxyMode 为 Direct THEN THE System SHALL 生成将所有流量路由到 direct outbound 的规则
4. WHEN 存在自定义域名规则 THEN THE System SHALL 将自定义规则放在最高优先级
5. WHEN 生成智能路由规则 THEN THE System SHALL 包含私有 IP 地址段直连规则

### Requirement 4

**User Story:** 作为开发者，我希望 V2rayManager 在系统代理模式下启动 sing-box 进程，以便替代原有的 v2ray-core 进程。

#### Acceptance Criteria

1. WHEN 用户启动系统代理模式 THEN THE System SHALL 启动 sing-box 进程而非 v2ray-core 进程
2. WHEN 启动 sing-box 进程 THEN THE System SHALL 使用生成的 sing-box 配置文件路径作为参数
3. WHEN sing-box 进程启动成功 THEN THE System SHALL 记录进程 ID 和启动时间
4. WHEN sing-box 进程输出日志 THEN THE System SHALL 捕获并解析日志级别
5. WHEN sing-box 进程异常退出 THEN THE System SHALL 触发 ProcessError 事件并记录错误信息

### Requirement 5

**User Story:** 作为开发者，我希望移除所有 v2ray-core 相关的代码和资源引用，以便简化代码库并减少维护成本。

#### Acceptance Criteria

1. WHEN 系统启动 THEN THE System SHALL 不再引用 v2ray.exe 文件路径
2. WHEN 生成配置 THEN THE System SHALL 不再生成 v2ray 格式的配置文件
3. WHEN 管理进程 THEN THE System SHALL 不再包含 v2ray-core 特定的进程管理逻辑
4. WHEN 解析错误 THEN THE System SHALL 不再包含 v2ray-core 特定的错误解析逻辑
5. WHEN 系统运行 THEN THE System SHALL 不再依赖 V2RAY_LOCATION_ASSET 环境变量

### Requirement 6

**User Story:** 作为开发者，我希望更新 ResourceManager 以移除 v2ray-core 资源管理，以便只维护 sing-box 相关资源。

#### Acceptance Criteria

1. WHEN ResourceManager 初始化 THEN THE System SHALL 不再设置 V2rayExePath 属性
2. WHEN ResourceManager 初始化 THEN THE System SHALL 不再验证 v2ray.exe 文件存在性
3. WHEN 获取资源路径 THEN THE System SHALL 只返回 sing-box 和 geo 数据文件路径
4. WHEN 验证资源完整性 THEN THE System SHALL 只检查 sing-box.exe 和 geo 数据文件
5. WHEN 系统启动 THEN THE System SHALL 确保 sing-box.exe 具有执行权限

### Requirement 7

**User Story:** 作为用户，我希望系统代理模式切换到 sing-box 后功能保持一致，以便无缝迁移而不影响使用体验。

#### Acceptance Criteria

1. WHEN 用户启动系统代理模式 THEN THE System SHALL 在配置的端口上提供 HTTP 和 SOCKS 代理服务
2. WHEN 用户切换代理模式 THEN THE System SHALL 正确应用新的路由规则
3. WHEN 用户添加自定义域名规则 THEN THE System SHALL 在路由中正确应用自定义规则
4. WHEN 用户停止代理 THEN THE System SHALL 完全停止 sing-box 进程并清理资源
5. WHEN 系统代理模式运行 THEN THE System SHALL 提供与原 v2ray-core 相同的连接稳定性

### Requirement 8

**User Story:** 作为开发者，我希望清理不再使用的 v2ray 模型和配置类，以便保持代码库整洁。

#### Acceptance Criteria

1. WHEN 代码编译 THEN THE System SHALL 不再包含 V2rayConfig 类的引用
2. WHEN 代码编译 THEN THE System SHALL 不再包含 v2ray 特定的 Inbound/Outbound 模型
3. WHEN 代码编译 THEN THE System SHALL 不再包含 v2ray 特定的 StreamSettings 配置
4. WHEN 代码编译 THEN THE System SHALL 不再包含 v2ray 特定的 RoutingRule 模型
5. WHEN 系统运行 THEN THE System SHALL 所有功能正常工作且不依赖已删除的 v2ray 模型

### Requirement 9

**User Story:** 作为开发者，我希望更新接口定义以反映统一使用 sing-box 的架构，以便接口契约清晰明确。

#### Acceptance Criteria

1. WHEN IV2rayManager 接口定义方法 THEN THE System SHALL 移除 GenerateConfig 方法（v2ray 格式）
2. WHEN IV2rayManager 接口定义方法 THEN THE System SHALL 移除 GenerateTunConfig 方法（v2ray 格式）
3. WHEN IV2rayManager 接口定义方法 THEN THE System SHALL 添加 GenerateSingBoxConfig 方法接受 ProxyModeType 参数
4. WHEN StartAsync 方法被调用 THEN THE System SHALL 接受 SingBoxConfig 参数而非 V2rayConfig
5. WHEN RestartAsync 方法被调用 THEN THE System SHALL 接受 SingBoxConfig 参数而非 V2rayConfig

### Requirement 10

**User Story:** 作为开发者，我希望验证迁移后的系统代理模式功能正常，以便确保迁移质量。

#### Acceptance Criteria

1. WHEN 启动系统代理模式 THEN THE System SHALL 成功启动 sing-box 进程并监听配置的端口
2. WHEN 使用 HTTP 代理访问网站 THEN THE System SHALL 正确转发流量并返回响应
3. WHEN 使用 SOCKS 代理访问网站 THEN THE System SHALL 正确转发流量并返回响应
4. WHEN 切换到全局模式 THEN THE System SHALL 所有流量通过代理服务器
5. WHEN 切换到智能模式 THEN THE System SHALL 国内流量直连、国外流量代理
6. WHEN 切换到直连模式 THEN THE System SHALL 所有流量直连不经过代理
7. WHEN 添加自定义规则 THEN THE System SHALL 自定义规则优先级高于默认规则
8. WHEN 停止代理 THEN THE System SHALL sing-box 进程完全退出且端口释放
