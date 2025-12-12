# Design Document

## Overview

本设计文档描述了为V2rayZ添加TUN模式支持并将底层核心从v2ray迁移到xray的技术实现方案。TUN模式通过创建虚拟网络接口实现透明代理,相比传统系统代理模式具有更好的兼容性和用户体验。xray-core作为v2ray-core的超集,提供了更好的性能和TUN模式的原生支持。

主要目标:
1. 实现TUN模式和系统代理模式的双模式支持
2. 平滑迁移到xray-core,保持向后兼容
3. 提供清晰的用户界面和状态反馈
4. 确保配置的正确性和错误处理的完善性

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  设置页面     │  │  主页面       │  │  状态显示     │      │
│  │ (模式选择)    │  │ (连接控制)    │  │ (TUN状态)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      业务逻辑层                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              V2rayManager (核心管理器)                 │   │
│  │  ┌────────────────┐  ┌────────────────┐             │   │
│  │  │ 进程管理        │  │ 配置生成        │             │   │
│  │  │ - 启动xray     │  │ - TUN配置      │             │   │
│  │  │ - 停止xray     │  │ - 系统代理配置  │             │   │
│  │  │ - 监控状态     │  │ - 路由规则      │             │   │
│  │  └────────────────┘  └────────────────┘             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ ConfigMgr    │  │ ProxyMgr     │  │ ResourceMgr  │     │
│  │ (配置管理)    │  │ (代理管理)    │  │ (资源管理)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      核心层                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   xray-core                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │ TUN Inbound│  │ SOCKS/HTTP │  │ Outbound   │     │   │
│  │  │            │  │ Inbound    │  │ (VLESS/    │     │   │
│  │  │ (TUN模式)  │  │ (代理模式)  │  │  Trojan)   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  wintun.dll                           │   │
│  │            (Windows TUN驱动)                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    操作系统网络层                              │
│              (虚拟TUN接口 / 系统代理)                          │
└─────────────────────────────────────────────────────────────┘
```

### 模式切换流程

```
用户选择模式
    │
    ▼
保存到UserConfig
    │
    ▼
用户点击连接
    │
    ▼
读取模式配置
    │
    ├─→ TUN模式
    │   │
    │   ├─→ 生成TUN配置
    │   │   - TUN inbound
    │   │   - DNS配置
    │   │   - 路由规则
    │   │
    │   ├─→ 启动xray进程
    │   │
    │   ├─→ 验证TUN接口
    │   │
    │   └─→ 显示连接状态
    │
    └─→ 系统代理模式
        │
        ├─→ 生成代理配置
        │   - SOCKS/HTTP inbound
        │   - 路由规则
        │
        ├─→ 启动xray进程
        │
        ├─→ 设置系统代理
        │
        └─→ 显示连接状态
```

## Components and Interfaces

### 1. ProxyModeType 枚举扩展

```csharp
/// <summary>
/// 代理实现模式
/// </summary>
public enum ProxyModeType
{
    /// <summary>
    /// 系统代理模式 (SOCKS/HTTP)
    /// </summary>
    SystemProxy,
    
    /// <summary>
    /// TUN透明代理模式
    /// </summary>
    Tun
}
```

### 2. UserConfig 扩展

```csharp
public class UserConfig
{
    // ... 现有属性 ...
    
    /// <summary>
    /// 代理实现模式类型
    /// </summary>
    public ProxyModeType ProxyModeType { get; set; } = ProxyModeType.SystemProxy;
    
    /// <summary>
    /// TUN模式配置
    /// </summary>
    public TunModeConfig TunConfig { get; set; } = new();
}
```

### 3. TunModeConfig 配置模型

```csharp
/// <summary>
/// TUN模式配置
/// </summary>
public class TunModeConfig
{
    /// <summary>
    /// TUN接口名称
    /// </summary>
    public string InterfaceName { get; set; } = "V2rayZ-TUN";
    
    /// <summary>
    /// TUN接口IPv4地址
    /// </summary>
    public string Ipv4Address { get; set; } = "10.0.85.1/24";
    
    /// <summary>
    /// TUN接口IPv6地址
    /// </summary>
    public string? Ipv6Address { get; set; } = "fdfe:dcba:9876::1/126";
    
    /// <summary>
    /// 是否启用IPv6
    /// </summary>
    public bool EnableIpv6 { get; set; } = true;
    
    /// <summary>
    /// DNS服务器列表
    /// </summary>
    public List<string> DnsServers { get; set; } = new() { "8.8.8.8", "8.8.4.4" };
    
    /// <summary>
    /// MTU大小
    /// </summary>
    public int Mtu { get; set; } = 9000;
    
    /// <summary>
    /// 是否启用DNS劫持
    /// </summary>
    public bool EnableDnsHijack { get; set; } = true;
}
```

### 4. TunInboundSettings 模型

```csharp
/// <summary>
/// TUN inbound配置
/// </summary>
public class TunInboundSettings
{
    [JsonPropertyName("address")]
    public string Address { get; set; } = "10.0.85.1/24";
    
    [JsonPropertyName("mtu")]
    public int Mtu { get; set; } = 9000;
    
    [JsonPropertyName("stack")]
    public string Stack { get; set; } = "system";
    
    [JsonPropertyName("sniffing")]
    public SniffingSettings? Sniffing { get; set; }
}

/// <summary>
/// 流量嗅探配置
/// </summary>
public class SniffingSettings
{
    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;
    
    [JsonPropertyName("destOverride")]
    public List<string> DestOverride { get; set; } = new() { "http", "tls", "quic" };
    
    [JsonPropertyName("metadataOnly")]
    public bool MetadataOnly { get; set; } = false;
}
```

### 5. DnsConfig 模型

```csharp
/// <summary>
/// DNS配置
/// </summary>
public class DnsConfig
{
    [JsonPropertyName("servers")]
    public List<DnsServer> Servers { get; set; } = new();
    
    [JsonPropertyName("queryStrategy")]
    public string QueryStrategy { get; set; } = "UseIPv4";
    
    [JsonPropertyName("disableCache")]
    public bool DisableCache { get; set; } = false;
}

/// <summary>
/// DNS服务器配置
/// </summary>
public class DnsServer
{
    [JsonPropertyName("address")]
    public string Address { get; set; } = string.Empty;
    
    [JsonPropertyName("port")]
    public int? Port { get; set; }
    
    [JsonPropertyName("domains")]
    public List<string>? Domains { get; set; }
}
```

### 6. V2rayConfig 扩展

```csharp
public class V2rayConfig
{
    // ... 现有属性 ...
    
    /// <summary>
    /// DNS配置
    /// </summary>
    [JsonPropertyName("dns")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DnsConfig? Dns { get; set; }
}
```

### 7. ResourceManager 扩展

```csharp
public class ResourceManager
{
    // ... 现有属性和方法 ...
    
    /// <summary>
    /// 获取xray可执行文件路径
    /// </summary>
    public string XrayExePath => Path.Combine(_resourcesPath, "xray.exe");
    
    /// <summary>
    /// 获取wintun.dll路径
    /// </summary>
    public string WintunDllPath => Path.Combine(_resourcesPath, "wintun.dll");
    
    /// <summary>
    /// 获取核心可执行文件路径(优先xray,回退v2ray)
    /// </summary>
    public string GetCoreExecutablePath()
    {
        if (File.Exists(XrayExePath))
        {
            _logger.Information("Using xray-core");
            return XrayExePath;
        }
        
        if (File.Exists(V2rayExePath))
        {
            _logger.Warning("xray.exe not found, falling back to v2ray.exe");
            return V2rayExePath;
        }
        
        throw new FileNotFoundException("Neither xray.exe nor v2ray.exe found");
    }
    
    /// <summary>
    /// 验证TUN模式所需资源
    /// </summary>
    public bool ValidateTunResources()
    {
        var xrayExists = File.Exists(XrayExePath);
        var wintunExists = File.Exists(WintunDllPath);
        
        if (!xrayExists)
        {
            _logger.Warning("xray.exe not found, TUN mode requires xray-core");
        }
        
        if (!wintunExists)
        {
            _logger.Warning("wintun.dll not found, TUN mode requires wintun driver");
        }
        
        return xrayExists && wintunExists;
    }
}
```

### 8. V2rayManager 接口扩展

```csharp
public interface IV2rayManager
{
    // ... 现有方法 ...
    
    /// <summary>
    /// 生成TUN模式配置
    /// </summary>
    V2rayConfig GenerateTunConfig(UserConfig userConfig);
    
    /// <summary>
    /// 验证TUN模式是否可用
    /// </summary>
    Task<(bool IsAvailable, string? ErrorMessage)> ValidateTunModeAsync();
}
```

## Data Models

### 配置文件结构

#### TUN模式配置示例

```json
{
  "log": {
    "loglevel": "warning"
  },
  "dns": {
    "servers": [
      {
        "address": "8.8.8.8",
        "port": 53
      },
      {
        "address": "8.8.4.4",
        "port": 53
      }
    ],
    "queryStrategy": "UseIPv4"
  },
  "inbounds": [
    {
      "tag": "tun-in",
      "protocol": "tun",
      "settings": {
        "address": "10.0.85.1/24",
        "mtu": 9000,
        "stack": "system",
        "sniffing": {
          "enabled": true,
          "destOverride": ["http", "tls", "quic"],
          "metadataOnly": false
        }
      }
    },
    {
      "tag": "api",
      "protocol": "dokodemo-door",
      "listen": "127.0.0.1",
      "port": 10085,
      "settings": {
        "address": "127.0.0.1"
      }
    }
  ],
  "outbounds": [
    {
      "tag": "proxy",
      "protocol": "vless",
      "settings": {
        "vnext": [...]
      },
      "streamSettings": {...}
    },
    {
      "tag": "direct",
      "protocol": "freedom"
    },
    {
      "tag": "block",
      "protocol": "blackhole"
    }
  ],
  "routing": {
    "domainStrategy": "IPIfNonMatch",
    "rules": [...]
  },
  "stats": {},
  "api": {
    "tag": "api",
    "services": ["StatsService"]
  },
  "policy": {
    "system": {
      "statsInboundUplink": true,
      "statsInboundDownlink": true,
      "statsOutboundUplink": true,
      "statsOutboundDownlink": true
    }
  }
}
```

#### 系统代理模式配置示例

```json
{
  "log": {
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "tag": "socks-in",
      "protocol": "socks",
      "listen": "127.0.0.1",
      "port": 65534,
      "settings": {
        "udp": true
      }
    },
    {
      "tag": "http-in",
      "protocol": "http",
      "listen": "127.0.0.1",
      "port": 65533
    },
    {
      "tag": "api",
      "protocol": "dokodemo-door",
      "listen": "127.0.0.1",
      "port": 10085,
      "settings": {
        "address": "127.0.0.1"
      }
    }
  ],
  "outbounds": [...],
  "routing": {...},
  "stats": {},
  "api": {...},
  "policy": {...}
}
```

### 用户配置持久化

```json
{
  "servers": [...],
  "selectedServerId": "...",
  "proxyMode": "Smart",
  "proxyModeType": "Tun",
  "tunConfig": {
    "interfaceName": "V2rayZ-TUN",
    "ipv4Address": "10.0.85.1/24",
    "ipv6Address": "fdfe:dcba:9876::1/126",
    "enableIpv6": true,
    "dnsServers": ["8.8.8.8", "8.8.4.4"],
    "mtu": 9000,
    "enableDnsHijack": true
  },
  "customRules": [...],
  "autoStart": false,
  "autoConnect": false,
  "minimizeToTray": true,
  "socksPort": 65534,
  "httpPort": 65533
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

在生成最终的正确性属性之前,我需要识别并消除冗余:

**冗余分析:**
1. 属性1.2和1.3都测试配置保存,可以合并为一个通用的"配置保存round-trip"属性
2. 属性6.1和6.2都测试模式切换时的清理,可以合并为一个"模式切换清理"属性
3. 属性8.1、8.2、8.3都测试路由模式配置生成,可以合并为一个"路由模式配置正确性"属性
4. 属性9.1和9.2都测试核心选择逻辑,可以合并为一个"核心选择优先级"属性
5. 属性10.1、10.2、10.5都测试IP地址配置,可以合并为一个"IP地址配置正确性"属性

**保留的独特属性:**
- 配置持久化(1.4)
- 模式切换应用(1.5, 6.3)
- TUN接口生命周期(2.1, 2.5)
- 资源验证(3.1, 3.3)
- 日志记录(3.4, 3.5, 4.4, 7.5, 9.3)
- 进程管理(4.1, 4.3, 4.5)
- 配置生成(4.2, 5.2, 5.3, 8.4, 9.4)
- DNS验证(5.5)
- 错误恢复(6.4)
- 错误消息(7.2, 7.4)
- 配置不变性(9.5)

### Correctness Properties

Property 1: 配置保存round-trip
*For any* 代理模式类型(TUN或系统代理),保存到用户配置后立即读取,应该得到相同的模式类型值
**Validates: Requirements 1.2, 1.3**

Property 2: 配置持久化
*For any* 用户配置,保存后重新加载配置文件,所有配置项(包括代理模式类型)应该保持不变
**Validates: Requirements 1.4**

Property 3: 模式切换配置应用
*For any* 代理模式切换操作,切换后生成的xray配置应该反映新的模式设置(TUN inbound vs SOCKS/HTTP inbound)
**Validates: Requirements 1.5, 6.3**

Property 4: TUN接口创建验证
*For any* TUN模式连接请求,如果连接成功,则应该能够查询到TUN接口的存在
**Validates: Requirements 2.1**

Property 5: TUN接口清理
*For any* TUN模式连接,断开连接后,TUN接口和相关路由规则应该被完全清除
**Validates: Requirements 2.5**

Property 6: 资源文件验证
*For any* 资源目录路径,验证函数应该正确返回wintun.dll和xray.exe的存在性
**Validates: Requirements 3.1**

Property 7: 资源缺失错误消息
*For any* 缺失的必需资源文件(wintun.dll或xray.exe),系统应该返回明确指出缺失文件名的错误消息
**Validates: Requirements 3.3**

Property 8: 操作日志记录
*For any* 关键操作(wintun加载、xray启动、TUN接口创建),成功或失败时都应该记录相应的日志条目
**Validates: Requirements 3.4, 3.5, 4.4, 7.5, 9.3**

Property 9: 核心选择优先级
*For any* 资源目录状态,当xray.exe存在时应该选择xray.exe,仅当xray.exe不存在但v2ray.exe存在时才选择v2ray.exe
**Validates: Requirements 4.1, 9.1, 9.2**

Property 10: 进程启动验证
*For any* xray启动请求,如果启动成功,则应该能够查询到有效的进程ID和运行状态
**Validates: Requirements 4.3**

Property 11: 进程异常退出处理
*For any* xray进程异常退出事件,系统应该触发错误事件并更新连接状态为断开
**Validates: Requirements 4.5, 7.4**

Property 12: xray配置JSON有效性
*For any* 生成的xray配置,应该能够被JSON解析器成功解析,且包含必需的顶层字段(inbounds, outbounds, routing)
**Validates: Requirements 4.2**

Property 13: DNS配置包含性
*For any* 用户配置的DNS服务器列表,生成的TUN模式xray配置中的DNS服务器列表应该与之完全匹配
**Validates: Requirements 5.2**

Property 14: DNS默认值
*For any* 空的DNS配置,生成的TUN模式配置应该包含预定义的默认DNS服务器(8.8.8.8, 8.8.4.4)
**Validates: Requirements 5.3**

Property 15: DNS地址验证
*For any* DNS服务器地址字符串,验证函数应该正确识别无效的IP地址格式并返回错误
**Validates: Requirements 5.5**

Property 16: 模式切换清理
*For any* 代理模式切换操作,切换前应该清理旧模式的资源(系统代理设置或TUN接口)
**Validates: Requirements 6.1, 6.2**

Property 17: 模式切换错误回滚
*For any* 模式切换操作,如果切换过程中发生错误,用户配置中的模式类型应该保持为切换前的值
**Validates: Requirements 6.4**

Property 18: 错误消息特异性
*For any* TUN模式错误场景(权限不足、驱动加载失败、接口创建失败),应该返回包含具体错误原因的不同错误消息
**Validates: Requirements 7.2**

Property 19: 路由模式配置正确性
*For any* 代理路由模式(Global/Smart/Direct),生成的TUN模式配置中的路由规则应该与该模式的语义一致
- Global: 所有流量走proxy outbound
- Smart: 包含域名分流规则
- Direct: 所有流量走direct outbound
**Validates: Requirements 8.1, 8.2, 8.3**

Property 20: 自定义路由规则包含性
*For any* 用户自定义路由规则列表,生成的xray配置中应该包含所有这些规则
**Validates: Requirements 8.4**

Property 21: 路由规则更新触发重启
*For any* 路由规则更新操作,如果当前已连接,则应该触发xray进程重启
**Validates: Requirements 8.5**

Property 22: 配置格式兼容性
*For any* 生成的配置,应该不包含xray或v2ray特有的不兼容字段,确保两者都能解析
**Validates: Requirements 9.4**

Property 23: 核心切换配置不变性
*For any* 核心切换操作(xray <-> v2ray),用户配置中的服务器列表和代理设置应该保持完全不变
**Validates: Requirements 9.5**

Property 24: IP地址配置正确性
*For any* TUN配置,生成的xray配置应该:
- 始终包含IPv4地址
- 当enableIpv6为true时包含IPv6地址
- 当enableIpv6为false时不包含IPv6地址
**Validates: Requirements 10.1, 10.2, 10.5**

## Error Handling

### 错误分类

1. **配置错误**
   - 无效的DNS地址
   - 无效的IP地址格式
   - 端口冲突
   - 配置文件损坏

2. **资源错误**
   - xray.exe不存在
   - wintun.dll不存在或损坏
   - 配置文件写入失败
   - 日志文件写入失败

3. **运行时错误**
   - TUN接口创建失败(权限不足、驱动加载失败)
   - xray进程启动失败
   - xray进程异常退出
   - 网络连接失败

4. **系统错误**
   - 权限不足(需要管理员权限)
   - 系统代理设置失败
   - 路由表操作失败

### 错误处理策略

```csharp
public class TunModeException : Exception
{
    public TunErrorType ErrorType { get; }
    public string UserFriendlyMessage { get; }
    
    public TunModeException(TunErrorType errorType, string message, string userMessage)
        : base(message)
    {
        ErrorType = errorType;
        UserFriendlyMessage = userMessage;
    }
}

public enum TunErrorType
{
    WintunNotFound,
    WintunLoadFailed,
    InterfaceCreationFailed,
    InsufficientPermissions,
    XrayNotFound,
    XrayStartFailed,
    ConfigurationError
}
```

### 错误恢复机制

1. **自动回退**: TUN模式失败时,提示用户切换到系统代理模式
2. **资源清理**: 任何错误发生时,确保清理已创建的资源(TUN接口、进程)
3. **状态恢复**: 错误后恢复到断开状态,允许用户重试
4. **详细日志**: 记录完整的错误堆栈和上下文信息

## Testing Strategy

### 单元测试

单元测试覆盖具体的功能点和边界情况:

1. **配置模型测试**
   - TunModeConfig默认值验证
   - DNS地址格式验证
   - IP地址格式验证

2. **配置生成测试**
   - TUN模式配置生成
   - 系统代理模式配置生成
   - 不同路由模式的配置差异

3. **资源管理测试**
   - 核心选择逻辑(xray优先级)
   - 资源文件验证
   - 资源缺失错误处理

4. **模式切换测试**
   - 模式切换状态转换
   - 资源清理验证
   - 错误回滚机制

### 属性测试

属性测试使用**FsCheck**库(C#的属性测试框架)验证通用属性:

**测试库选择**: FsCheck for C# (.NET)
- NuGet包: FsCheck (最新稳定版)
- 测试框架集成: FsCheck.Xunit 或 FsCheck.NUnit

**配置要求**:
- 每个属性测试至少运行100次迭代
- 使用FsCheck的`[Property]`特性标记属性测试
- 每个测试必须包含注释,明确引用设计文档中的属性编号

**属性测试标记格式**:
```csharp
// Feature: tun-mode-xray-migration, Property 1: 配置保存round-trip
[Property(MaxTest = 100)]
public Property ConfigSaveRoundTrip(ProxyModeType mode) { ... }
```

**测试覆盖**:

1. **配置Round-trip属性** (Property 1, 2)
   - 生成随机的ProxyModeType
   - 保存并读取,验证一致性
   - 生成随机的完整UserConfig
   - 序列化、反序列化,验证所有字段不变

2. **配置生成属性** (Property 3, 12, 13, 14, 19, 20, 24)
   - 生成随机的UserConfig
   - 验证生成的配置包含正确的inbound类型
   - 验证JSON可解析性
   - 验证DNS配置包含性
   - 验证路由规则正确性
   - 验证IP地址配置

3. **资源选择属性** (Property 6, 7, 9)
   - 生成随机的文件存在性组合
   - 验证核心选择逻辑
   - 验证错误消息内容

4. **模式切换属性** (Property 16, 17, 23)
   - 生成随机的模式切换序列
   - 验证资源清理
   - 验证错误回滚
   - 验证配置不变性

5. **验证函数属性** (Property 15)
   - 生成随机的IP地址字符串(有效和无效)
   - 验证验证函数的正确性

### 集成测试

集成测试验证组件间的交互:

1. **完整连接流程**
   - TUN模式连接和断开
   - 系统代理模式连接和断开
   - 模式切换流程

2. **xray进程管理**
   - 进程启动和停止
   - 进程异常退出处理
   - 日志捕获

3. **配置文件操作**
   - 配置文件生成和写入
   - 配置文件读取和解析
   - 配置文件更新

### 测试数据生成器

使用FsCheck的Arbitrary类型生成测试数据:

```csharp
public static class Generators
{
    public static Arbitrary<ProxyModeType> ProxyModeTypeGen() =>
        Gen.Elements(ProxyModeType.SystemProxy, ProxyModeType.Tun)
           .ToArbitrary();
    
    public static Arbitrary<TunModeConfig> TunConfigGen() =>
        from interfaceName in Arb.Generate<NonEmptyString>()
        from ipv4 in Gen.Elements("10.0.85.1/24", "192.168.1.1/24")
        from enableIpv6 in Arb.Generate<bool>()
        from dnsServers in Gen.ListOf(Gen.Elements("8.8.8.8", "1.1.1.1", "8.8.4.4"))
        select new TunModeConfig
        {
            InterfaceName = interfaceName.Get,
            Ipv4Address = ipv4,
            EnableIpv6 = enableIpv6,
            DnsServers = dnsServers.ToList()
        };
    
    public static Arbitrary<string> InvalidDnsAddressGen() =>
        Gen.Elements("invalid", "999.999.999.999", "abc.def.ghi.jkl", "")
           .ToArbitrary();
}
```

## Implementation Notes

### 关键实现要点

1. **管理员权限检查**
   - TUN模式需要管理员权限
   - 启动时检查权限,不足时提示用户

2. **wintun.dll加载**
   - xray会自动加载同目录下的wintun.dll
   - 确保wintun.dll与xray.exe在同一目录

3. **TUN接口命名**
   - 使用固定的接口名称"V2rayZ-TUN"
   - 避免与其他应用冲突

4. **DNS配置**
   - TUN模式下必须配置DNS
   - 默认使用Google DNS(8.8.8.8, 8.8.4.4)

5. **路由规则优先级**
   - 自定义规则优先级最高
   - 然后是模式规则(Global/Smart/Direct)
   - 最后是默认规则

6. **配置兼容性**
   - 使用v2ray和xray都支持的配置格式
   - 避免使用xray特有的新特性(如果需要兼容v2ray)

7. **错误处理**
   - 所有错误都应该有中文用户友好消息
   - 详细的技术错误记录到日志
   - 关键错误通过UI通知用户

8. **资源清理**
   - 使用try-finally确保资源清理
   - 进程退出时清理TUN接口
   - 配置文件使用临时文件,避免残留

### 性能考虑

1. **配置生成**: 缓存配置模板,减少重复生成
2. **进程管理**: 使用异步操作,避免阻塞UI
3. **日志记录**: 使用异步日志,避免IO阻塞
4. **状态查询**: 缓存进程状态,减少系统调用

### 安全考虑

1. **权限最小化**: 仅在必要时请求管理员权限
2. **配置验证**: 严格验证所有用户输入
3. **进程隔离**: xray进程独立运行,崩溃不影响主程序
4. **敏感信息**: 密码等敏感信息不记录到日志
