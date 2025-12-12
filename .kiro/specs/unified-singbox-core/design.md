# Design Document

## Overview

本设计文档描述了将 V2rayZ 客户端统一迁移到 sing-box 核心的技术方案。迁移的核心目标是移除 v2ray-core 依赖，使所有代理模式（系统代理和 TUN）都使用 sing-box 核心，从而简化架构、减少维护成本、降低分发体积并提升性能。

### 迁移范围

**当前架构：**
- 系统代理模式：v2ray-core（HTTP/SOCKS inbound）
- TUN 模式：sing-box（TUN inbound）

**目标架构：**
- 系统代理模式：sing-box（HTTP/SOCKS inbound）
- TUN 模式：sing-box（TUN inbound）- 保持不变

### 关键变化

1. **配置格式统一**：所有模式使用 sing-box JSON 配置格式
2. **进程管理统一**：所有模式启动 sing-box 进程
3. **路由规则统一**：使用 sing-box 路由规则语法
4. **资源简化**：移除 v2ray-core.exe 及相关资源

## Architecture

### 组件架构

```
┌─────────────────────────────────────────────────────────────┐
│                        V2rayManager                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         GenerateSingBoxConfig(userConfig, mode)        │ │
│  │  - 根据 ProxyModeType 生成对应的 sing-box 配置        │ │
│  │  - SystemProxy: HTTP + SOCKS inbound                   │ │
│  │  - Tun: TUN inbound                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              StartSingBoxAsync(config)                 │ │
│  │  - 写入 sing-box 配置文件                              │ │
│  │  - 启动 sing-box 进程                                  │ │
│  │  - 监听进程输出和错误                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   RoutingRuleManager                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │      GenerateSingBoxRoutingRules(mode, customRules)    │ │
│  │  - Global: 所有流量 → proxy                            │ │
│  │  - Smart: CN流量 → direct, 其他 → proxy               │ │
│  │  - Direct: 所有流量 → direct                           │ │
│  │  - 自定义规则优先级最高                                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SingBox Models                            │
│  - SingBoxConfig (root)                                     │
│  - Inbound (http/socks/tun)                                 │
│  - Outbound (vless/trojan/direct/block)                     │
│  - RouteConfig + RouteRule                                  │
│  - DnsConfig                                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      sing-box Process                        │
│  - 监听 HTTP/SOCKS 端口（系统代理模式）                     │
│  - 创建 TUN 虚拟网卡（TUN 模式）                            │
│  - 执行路由规则分流                                         │
│  - 连接远程代理服务器                                       │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

**系统代理模式启动流程：**
```
用户点击连接
    ↓
NativeApi.ConnectAsync()
    ↓
V2rayManager.GenerateSingBoxConfig(userConfig, SystemProxy)
    ↓
创建 SingBoxConfig:
  - Inbounds: [HTTP(65533), SOCKS(65534)]
  - Outbounds: [proxy, direct, block]
  - Route: 根据 ProxyMode 生成规则
    ↓
V2rayManager.StartSingBoxAsync(config)
    ↓
写入配置文件: %APPDATA%/V2rayZ/singbox_config.json
    ↓
启动进程: sing-box.exe run -c "singbox_config.json"
    ↓
SystemProxyManager.EnableProxy("127.0.0.1", 65533)
    ↓
用户流量 → 系统代理 → sing-box → 路由规则 → proxy/direct
```

## Components and Interfaces

### 1. SingBox Configuration Models

#### SingBoxConfig (扩展)
```csharp
public class SingBoxConfig
{
    [JsonPropertyName("log")]
    public LogConfig? Log { get; set; }

    [JsonPropertyName("dns")]
    public DnsConfig? Dns { get; set; }

    [JsonPropertyName("inbounds")]
    public List<Inbound> Inbounds { get; set; } = new();

    [JsonPropertyName("outbounds")]
    public List<Outbound> Outbounds { get; set; } = new();

    [JsonPropertyName("route")]
    public RouteConfig? Route { get; set; }
}
```

#### Inbound (扩展)
```csharp
public class Inbound
{
    // 现有字段...
    
    // 新增：系统代理模式所需字段
    [JsonPropertyName("listen")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Listen { get; set; }

    [JsonPropertyName("listen_port")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? ListenPort { get; set; }
}
```

#### RouteConfig (新增)
```csharp
public class RouteConfig
{
    [JsonPropertyName("rules")]
    public List<RouteRule> Rules { get; set; } = new();

    [JsonPropertyName("final")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Final { get; set; }

    [JsonPropertyName("auto_detect_interface")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? AutoDetectInterface { get; set; }
}
```

#### RouteRule (新增)
```csharp
public class RouteRule
{
    [JsonPropertyName("domain")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Domain { get; set; }

    [JsonPropertyName("domain_suffix")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? DomainSuffix { get; set; }

    [JsonPropertyName("ip_cidr")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? IpCidr { get; set; }

    [JsonPropertyName("geosite")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Geosite { get; set; }

    [JsonPropertyName("geoip")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<string>? Geoip { get; set; }

    [JsonPropertyName("outbound")]
    public string Outbound { get; set; } = string.Empty;
}
```

### 2. IV2rayManager Interface (更新)

```csharp
public interface IV2rayManager : IDisposable
{
    // 事件
    event EventHandler<V2rayEventArgs>? ProcessStarted;
    event EventHandler<V2rayEventArgs>? ProcessStopped;
    event EventHandler<V2rayErrorEventArgs>? ProcessError;

    // 统一的配置生成方法
    SingBoxConfig GenerateSingBoxConfig(UserConfig userConfig, ProxyModeType modeType);

    // 统一的启动方法
    Task StartAsync(SingBoxConfig config);

    // 其他方法保持不变
    Task StopAsync();
    Task RestartAsync(SingBoxConfig config);
    V2rayStatus GetStatus();
    Task<bool> SwitchProxyModeAsync(ProxyModeType targetMode, UserConfig userConfig, IConfigurationManager configManager, ISystemProxyManager? proxyManager = null);
    Task<(bool IsAvailable, string? ErrorMessage)> ValidateTunModeAsync();
}
```

### 3. IRoutingRuleManager Interface (扩展)

```csharp
public interface IRoutingRuleManager
{
    event EventHandler<RoutingRulesChangedEventArgs>? RoutingRulesChanged;
    
    void NotifyRulesChanged(RuleChangeType changeType);
    
    // 保留原有方法（用于向后兼容）
    List<RoutingRule> GenerateRoutingRules(ProxyMode mode, List<DomainRule> customRules);
    
    // 新增：生成 sing-box 格式的路由规则
    RouteConfig GenerateSingBoxRouting(ProxyMode mode, List<DomainRule> customRules);
}
```

## Data Models

### Configuration Generation Flow

**系统代理模式配置生成：**

```csharp
// Input: UserConfig
{
    SelectedServerId: "server-123",
    ProxyMode: Smart,
    ProxyModeType: SystemProxy,
    HttpPort: 65533,
    SocksPort: 65534,
    CustomRules: [...]
}

// Output: SingBoxConfig
{
    "log": { "level": "info" },
    "dns": {
        "servers": [{ "address": "8.8.8.8" }],
        "strategy": "prefer_ipv4"
    },
    "inbounds": [
        {
            "type": "http",
            "tag": "http-in",
            "listen": "127.0.0.1",
            "listen_port": 65533
        },
        {
            "type": "socks",
            "tag": "socks-in",
            "listen": "127.0.0.1",
            "listen_port": 65534
        }
    ],
    "outbounds": [
        {
            "type": "vless",
            "tag": "proxy",
            "server": "example.com",
            "server_port": 443,
            "uuid": "...",
            "tls": { "enabled": true, "server_name": "example.com" }
        },
        { "type": "direct", "tag": "direct" },
        { "type": "block", "tag": "block" }
    ],
    "route": {
        "rules": [
            {
                "ip_cidr": ["10.0.0.0/8", "192.168.0.0/16"],
                "outbound": "direct"
            },
            {
                "domain_suffix": ["cn", "baidu.com"],
                "outbound": "direct"
            }
        ],
        "final": "proxy"
    }
}
```

### Routing Rules Mapping

| ProxyMode | v2ray-core 规则 | sing-box 规则 |
|-----------|----------------|---------------|
| Global | `ip: ["0.0.0.0/0"] → proxy` | `final: "proxy"` |
| Smart | `geosite:cn → direct`<br>`geoip:cn → direct`<br>`default → proxy` | `domain_suffix: ["cn", ...] → direct`<br>`ip_cidr: [private] → direct`<br>`final: "proxy"` |
| Direct | `ip: ["0.0.0.0/0"] → direct` | `final: "direct"` |

### Protocol Outbound Mapping

| Protocol | v2ray-core | sing-box |
|----------|-----------|----------|
| VLESS | `protocol: "vless"`<br>`vnext: [...]` | `type: "vless"`<br>`server: "..."`<br>`uuid: "..."` |
| Trojan | `protocol: "trojan"`<br>`servers: [...]` | `type: "trojan"`<br>`server: "..."`<br>`password: "..."` |
| TLS | `streamSettings.security: "tls"` | `tls: { enabled: true }` |
| WebSocket | `streamSettings.wsSettings` | `transport: { type: "ws" }` |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 配置生成完整性
*For any* UserConfig with a selected server and ProxyModeType, generating a SingBoxConfig should produce a valid configuration containing all required inbounds, outbounds, and routing rules for that mode.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 2: 端口配置一致性
*For any* UserConfig with HttpPort and SocksPort values, the generated SingBoxConfig should contain inbounds with listen_port values matching those configured ports.
**Validates: Requirements 2.2**

### Property 3: 路由规则优先级
*For any* set of custom domain rules and a ProxyMode, custom rules should appear before mode-specific rules in the generated route configuration.
**Validates: Requirements 3.4**

### Property 4: 全局模式路由正确性
*For any* configuration with ProxyMode.Global, the generated route should have final="proxy" and no rules that route to "direct".
**Validates: Requirements 3.1**

### Property 5: 智能模式路由正确性
*For any* configuration with ProxyMode.Smart, the generated route should contain rules routing private IPs and CN domains to "direct", with final="proxy".
**Validates: Requirements 3.2**

### Property 6: 直连模式路由正确性
*For any* configuration with ProxyMode.Direct, the generated route should have final="direct" and no rules that route to "proxy".
**Validates: Requirements 3.3**

### Property 7: 进程启动幂等性
*For any* valid SingBoxConfig, calling StartAsync multiple times without calling StopAsync should not create multiple sing-box processes.
**Validates: Requirements 4.1**

### Property 8: 配置序列化正确性
*For any* SingBoxConfig object, serializing to JSON and deserializing back should produce an equivalent configuration object.
**Validates: Requirements 1.5**

### Property 9: Outbound 协议映射正确性
*For any* ServerConfig with protocol VLESS or Trojan, the generated sing-box outbound should have the correct type field and all required protocol-specific fields populated.
**Validates: Requirements 2.3**

### Property 10: 资源清理完整性
*For any* running sing-box process, calling StopAsync should terminate the process and release all listening ports.
**Validates: Requirements 7.4**

## Error Handling

### 错误分类

1. **配置错误**
   - 无效的服务器配置（缺少必需字段）
   - 端口冲突（端口已被占用）
   - 无效的路由规则

2. **进程错误**
   - sing-box 进程启动失败
   - sing-box 进程异常退出
   - 配置文件解析失败

3. **资源错误**
   - sing-box.exe 不存在
   - 配置文件写入失败
   - 权限不足（TUN 模式）

### 错误处理策略

```csharp
// 配置生成错误
try
{
    var config = GenerateSingBoxConfig(userConfig, modeType);
}
catch (InvalidOperationException ex) when (ex.Message.Contains("没有选择服务器"))
{
    // 用户友好提示：请先选择服务器
    throw new InvalidOperationException("请先在服务器页面选择一个服务器", ex);
}

// 进程启动错误
try
{
    await StartSingBoxAsync(config);
}
catch (FileNotFoundException ex)
{
    // sing-box.exe 不存在
    throw new InvalidOperationException($"sing-box 核心文件未找到: {ex.Message}", ex);
}
catch (InvalidOperationException ex) when (process.HasExited)
{
    // 进程立即退出，解析 sing-box 错误日志
    var errorMessage = ParseSingBoxError(_lastError);
    throw new InvalidOperationException($"sing-box 启动失败: {errorMessage}", ex);
}

// 端口占用错误
catch (Exception ex) when (ex.Message.Contains("address already in use"))
{
    throw new InvalidOperationException($"端口 {port} 已被占用，请更改端口设置或关闭占用端口的程序", ex);
}
```

### sing-box 错误解析

```csharp
private string ParseSingBoxError(string errorOutput)
{
    if (string.IsNullOrEmpty(errorOutput)) return "未知错误";
    
    // 移除 ANSI 颜色代码
    var cleanError = Regex.Replace(errorOutput, @"\x1B\[[0-9;]*[mK]", "");
    
    // 解析常见错误
    if (cleanError.Contains("parse config"))
        return "配置文件格式错误";
    if (cleanError.Contains("address already in use"))
        return "端口已被占用";
    if (cleanError.Contains("connection refused"))
        return "无法连接到服务器";
    if (cleanError.Contains("authentication failed"))
        return "服务器认证失败，请检查密码或 UUID";
    if (cleanError.Contains("tls"))
        return "TLS 连接失败，请检查证书设置";
        
    return cleanError;
}
```

## Testing Strategy

### Unit Testing

**测试范围：**
1. 配置生成逻辑
   - `GenerateSingBoxConfig` 针对不同 ProxyModeType 生成正确配置
   - `GenerateSingBoxRouting` 针对不同 ProxyMode 生成正确路由规则
   - Outbound 创建逻辑（VLESS/Trojan）

2. 模型序列化
   - SingBoxConfig 序列化为正确的 JSON 格式
   - JSON 属性名使用 snake_case

3. 错误处理
   - 无效配置抛出正确异常
   - 错误消息解析正确

**示例测试：**
```csharp
[Fact]
public void GenerateSingBoxConfig_SystemProxyMode_ContainsHttpAndSocksInbounds()
{
    // Arrange
    var userConfig = CreateTestUserConfig();
    var manager = new V2rayManager();
    
    // Act
    var config = manager.GenerateSingBoxConfig(userConfig, ProxyModeType.SystemProxy);
    
    // Assert
    Assert.Contains(config.Inbounds, i => i.Type == "http" && i.ListenPort == 65533);
    Assert.Contains(config.Inbounds, i => i.Type == "socks" && i.ListenPort == 65534);
}

[Fact]
public void GenerateSingBoxRouting_SmartMode_ContainsChinaDirectRules()
{
    // Arrange
    var routingManager = new RoutingRuleManager();
    
    // Act
    var route = routingManager.GenerateSingBoxRouting(ProxyMode.Smart, new List<DomainRule>());
    
    // Assert
    Assert.Contains(route.Rules, r => r.IpCidr?.Contains("192.168.0.0/16") == true);
    Assert.Contains(route.Rules, r => r.DomainSuffix?.Contains("cn") == true);
    Assert.Equal("proxy", route.Final);
}
```

### Integration Testing

**测试场景：**
1. 系统代理模式端到端测试
   - 启动系统代理模式
   - 验证 HTTP/SOCKS 端口可连接
   - 发送测试请求验证流量转发
   - 停止代理验证端口释放

2. 模式切换测试
   - 从系统代理切换到 TUN
   - 从 TUN 切换到系统代理
   - 验证进程正确切换

3. 路由规则测试
   - 全局模式：所有流量走代理
   - 智能模式：CN 流量直连
   - 直连模式：所有流量直连

### Manual Testing Checklist

- [ ] 系统代理模式启动成功，HTTP 端口可用
- [ ] 系统代理模式启动成功，SOCKS 端口可用
- [ ] 浏览器通过 HTTP 代理访问国外网站成功
- [ ] 浏览器通过 HTTP 代理访问国内网站成功（智能模式）
- [ ] 切换到全局模式，所有流量走代理
- [ ] 切换到直连模式，所有流量不走代理
- [ ] 添加自定义规则，规则生效
- [ ] 停止代理，端口释放
- [ ] 从系统代理切换到 TUN 模式成功
- [ ] 从 TUN 模式切换到系统代理成功
- [ ] 应用重启后配置保持

## Implementation Notes

### 迁移步骤

1. **Phase 1: 扩展模型**
   - 扩展 Inbound 支持 listen 和 listen_port
   - 新增 RouteConfig 和 RouteRule
   - 确保 JSON 序列化正确

2. **Phase 2: 配置生成**
   - 实现 `GenerateSingBoxConfig` 方法
   - 实现系统代理模式的 inbound 生成
   - 实现 outbound 生成（复用 TUN 模式逻辑）

3. **Phase 3: 路由规则**
   - 实现 `GenerateSingBoxRouting` 方法
   - 支持三种代理模式
   - 支持自定义规则

4. **Phase 4: 进程管理**
   - 修改 `StartAsync` 统一使用 sing-box
   - 移除 v2ray-core 启动逻辑
   - 统一错误处理

5. **Phase 5: 清理**
   - 移除 v2ray 模型类
   - 移除 ResourceManager 中的 v2ray 引用
   - 更新接口定义
   - 删除不再使用的代码

### 向后兼容性

**配置文件兼容：**
- UserConfig 格式不变，无需迁移用户配置
- 端口配置保持不变（65533/65534）
- 服务器配置格式不变

**API 兼容：**
- NativeApi 接口保持不变
- 前端无需修改

### 性能考虑

1. **内存占用**
   - sing-box 比 v2ray-core 内存占用更低（约 20-30MB vs 40-50MB）

2. **启动时间**
   - sing-box 启动速度更快（约 500ms vs 1000ms）

3. **配置文件大小**
   - sing-box 配置更简洁（约 2-3KB vs 5-6KB）

### 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| sing-box 路由规则与 v2ray 不完全兼容 | 中 | 详细测试智能模式，必要时调整规则 |
| 用户现有配置迁移问题 | 低 | UserConfig 格式不变，无需迁移 |
| sing-box 稳定性问题 | 低 | sing-box 已在 TUN 模式验证，稳定性良好 |
| 性能回退 | 低 | sing-box 性能通常优于 v2ray-core |

## Dependencies

### 外部依赖

- **sing-box.exe**: 1.8.0+ 版本
- **geoip.db**: IP 地理位置数据库
- **geosite.db**: 域名分类数据库

### 内部依赖

- `V2rayClient.Models.SingBox`: 配置模型
- `V2rayClient.Services.RoutingRuleManager`: 路由规则生成
- `V2rayClient.Services.ResourceManager`: 资源管理
- `V2rayClient.Services.SystemProxyManager`: 系统代理设置

### 移除的依赖

- ~~v2ray-core.exe~~
- ~~V2rayClient.Models.V2ray~~
- ~~V2RAY_LOCATION_ASSET 环境变量~~
