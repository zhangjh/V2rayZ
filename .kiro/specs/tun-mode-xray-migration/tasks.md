# Implementation Plan

- [x] 1. 扩展数据模型以支持TUN模式
  - 创建ProxyModeType枚举,定义SystemProxy和Tun两种模式
  - 创建TunModeConfig类,包含TUN接口配置(接口名、IP地址、DNS、MTU等)
  - 扩展UserConfig类,添加ProxyModeType和TunConfig属性
  - 创建TunInboundSettings和SniffingSettings类,用于xray TUN配置
  - 创建DnsConfig和DnsServer类,用于DNS配置
  - 扩展V2rayConfig类,添加Dns属性
  - _Requirements: 1.1, 1.2, 5.1, 10.1, 10.2_

- [ ]* 1.1 为数据模型编写属性测试
  - **Property 1: 配置保存round-trip**
  - **Validates: Requirements 1.2, 1.3**

- [ ]* 1.2 为数据模型编写属性测试
  - **Property 2: 配置持久化**
  - **Validates: Requirements 1.4**

- [x] 2. 扩展ResourceManager以支持xray和wintun
  - 添加XrayExePath属性,返回xray.exe路径
  - 添加WintunDllPath属性,返回wintun.dll路径
  - 实现GetCoreExecutablePath方法,优先返回xray.exe,回退到v2ray.exe
  - 实现ValidateTunResources方法,验证xray.exe和wintun.dll是否存在
  - 更新InitializeResources方法,提取xray.exe和wintun.dll到AppData
  - _Requirements: 3.1, 4.1, 9.1, 9.2_

- [ ]* 2.1 为ResourceManager编写属性测试
  - **Property 6: 资源文件验证**
  - **Validates: Requirements 3.1**

- [ ]* 2.2 为ResourceManager编写属性测试
  - **Property 7: 资源缺失错误消息**
  - **Validates: Requirements 3.3**

- [ ]* 2.3 为ResourceManager编写属性测试
  - **Property 9: 核心选择优先级**
  - **Validates: Requirements 4.1, 9.1, 9.2**

- [x] 3. 实现TUN模式配置生成逻辑


  - 在V2rayManager中实现GenerateTunConfig方法
  - 创建TUN inbound配置(protocol: tun, 包含TunInboundSettings)
  - 配置DNS服务器(使用用户配置或默认值8.8.8.8, 8.8.4.4)
  - 配置流量嗅探(sniffing)以支持域名分流
  - 配置IPv4地址(必需)和IPv6地址(可选,根据enableIpv6)
  - 保留API inbound用于统计
  - 配置outbounds(proxy, direct, block)
  - 配置routing规则,支持Global/Smart/Direct模式
  - _Requirements: 2.1, 5.2, 5.3, 8.1, 8.2, 8.3, 10.1, 10.2, 10.5_

- [ ]* 3.1 为TUN配置生成编写属性测试
  - **Property 3: 模式切换配置应用**
  - **Validates: Requirements 1.5, 6.3**

- [ ]* 3.2 为TUN配置生成编写属性测试
  - **Property 12: xray配置JSON有效性**
  - **Validates: Requirements 4.2**

- [ ]* 3.3 为DNS配置编写属性测试
  - **Property 13: DNS配置包含性**
  - **Validates: Requirements 5.2**

- [ ]* 3.4 为DNS配置编写属性测试
  - **Property 14: DNS默认值**
  - **Validates: Requirements 5.3**

- [ ]* 3.5 为IP地址配置编写属性测试
  - **Property 24: IP地址配置正确性**
  - **Validates: Requirements 10.1, 10.2, 10.5**

- [ ]* 3.6 为路由配置编写属性测试
  - **Property 19: 路由模式配置正确性**
  - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ]* 3.7 为自定义路由规则编写属性测试
  - **Property 20: 自定义路由规则包含性**
  - **Validates: Requirements 8.4**


- [x] 4. 更新V2rayManager以使用xray-core




  - 修改GetV2rayExecutablePath方法,调用ResourceManager.GetCoreExecutablePath
  - 更新StartAsync方法,使用xray.exe而非v2ray.exe
  - 确保wintun.dll与xray.exe在同一目录(通过ResourceManager)
  - 更新日志输出,记录使用的核心类型(xray)
  - 保持配置生成的向后兼容性(xray都能解析)
  - _Requirements: 4.1, 4.2, 4.3, 9.3, 9.4_

- [ ]* 4.1 为进程管理编写属性测试
  - **Property 10: 进程启动验证**
  - **Validates: Requirements 4.3**

- [ ]* 4.2 为进程异常处理编写属性测试
  - **Property 11: 进程异常退出处理**
  - **Validates: Requirements 4.5, 7.4**

- [ ]* 4.3 为配置兼容性编写属性测试
  - **Property 22: 配置格式兼容性**
  - **Validates: Requirements 9.4**

- [ ]* 4.4 为配置不变性编写属性测试
  - **Property 23: 核心切换配置不变性**
  - **Validates: Requirements 9.5**

- [x] 5. 实现模式切换逻辑





  - 在V2rayManager中添加SwitchProxyModeAsync方法
  - 实现从系统代理模式切换到TUN模式的逻辑:
    - 停止当前xray进程
    - 清理系统代理设置(调用SystemProxyManager)
    - 更新UserConfig.ProxyModeType
    - 保存配置
  - 实现从TUN模式切换到系统代理模式的逻辑:
    - 停止当前xray进程
    - 清理TUN接口(xray停止时自动清理)
    - 更新UserConfig.ProxyModeType
    - 保存配置
  - 实现错误回滚机制,切换失败时恢复原模式
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ]* 5.1 为模式切换编写属性测试
  - **Property 16: 模式切换清理**
  - **Validates: Requirements 6.1, 6.2**

- [ ]* 5.2 为错误回滚编写属性测试
  - **Property 17: 模式切换错误回滚**
  - **Validates: Requirements 6.4**


- [x] 6. 实现TUN模式验证和错误处理




  - 在V2rayManager中实现ValidateTunModeAsync方法
  - 检查管理员权限(TUN模式需要管理员权限)
  - 验证xray.exe和wintun.dll存在
  - 创建TunModeException异常类,包含TunErrorType枚举
  - 实现错误类型分类:
    - WintunNotFound: wintun.dll不存在
    - WintunLoadFailed: wintun.dll加载失败
    - InterfaceCreationFailed: TUN接口创建失败
    - InsufficientPermissions: 权限不足
    - XrayNotFound: xray.exe不存在
    - XrayStartFailed: xray启动失败
    - ConfigurationError: 配置错误
  - 为每种错误类型提供中文用户友好消息
  - _Requirements: 3.2, 3.3, 7.2, 7.4_

- [ ]* 6.1 为错误消息编写属性测试
  - **Property 18: 错误消息特异性**
  - **Validates: Requirements 7.2**


- [x] 7. 实现DNS地址验证




  - 创建DnsValidator类
  - 实现ValidateDnsAddress方法,验证IP地址格式
  - 支持IPv4和IPv6地址验证
  - 返回验证错误消息
  - _Requirements: 5.5_

- [ ]* 7.1 为DNS验证编写属性测试
  - **Property 15: DNS地址验证**
  - **Validates: Requirements 5.5**

- [x] 8. 更新ConfigurationManager以支持新配置




  - 更新LoadConfig方法,加载ProxyModeType和TunConfig
  - 更新SaveConfig方法,保存ProxyModeType和TunConfig
  - 为新字段提供默认值(ProxyModeType.SystemProxy, 默认SystemProxy)
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 9. 更新主窗口连接逻辑




  - 修改ConnectAsync方法,根据UserConfig.ProxyModeType选择配置生成方法
  - TUN模式: 调用GenerateTunConfig
  - 系统代理模式: 调用GenerateConfig(现有方法)
  - TUN模式下不设置系统代理(透明代理)
  - 系统代理模式下设置系统代理(现有逻辑)
  - 更新DisconnectAsync方法,根据模式清理资源...
  - _Requirements: 2.1, 2.2, 2.5, 6.3_

- [ ]* 9.1 为TUN接口生命周期编写属性测试
  - **Property 4: TUN接口创建验证**
  - **Validates: Requirements 2.1**

- [ ]* 9.2 为TUN接口清理编写属性测试
  - **Property 5: TUN接口清理**
  - **Validates: Requirements 2.5**



- [x] 10. 实现日志记录增强



  - 在V2rayManager中添加TUN模式相关日志
  - 记录核心类型(xray或v2ray)
  - 记录TUN接口创建和销毁
  - 记录wintun.dll加载状态
  - 记录模式切换操作
  - 所有关键操作都记录到LogManager
  - _Requirements: 3.4, 3.5, 4.4, 7.5, 9.3_

- [ ]* 10.1 为日志记录编写属性测试
  - **Property 8: 操作日志记录**
  - **Validates: Requirements 3.4, 3.5, 4.4, 7.5, 9.3**

- [x] 11. 添加前端UI支持(React)





  - 在设置页面添加"代理模式"选项卡
  - 添加ProxyModeType选择器(单选按钮: 系统代理/TUN模式)
  - 添加TUN模式配置表单:
    - 接口名称输入框
    - IPv4地址输入框
    - DNS服务器列表编辑器
  - 添加TUN模式状态显示(主页面)
  - 显示当前模式(系统代理/TUN模式)
  - TUN模式下显示接口状态
  - 添加模式切换确认对话框
  - _Requirements: 1.1, 5.1, 7.1_



- [x] 12. 更新Bridge API以支持TUN配置



  - 在NativeApi.cs中添加GetProxyModeType方法
  - 添加SetProxyModeType方法
  - 添加GetTunConfig方法
  - 添加SetTunConfig方法
  - 添加ValidateTunMode方法
  - 添加SwitchProxyMode方法
  - 更新TypeScript类型定义(NativeApi.d.ts)
  - _Requirements: 1.1, 1.2, 5.1, 6.1, 6.2_

- [x] 13. 实现状态和错误反馈





  - 更新ConnectionState模型,添加ProxyModeType字段
  - 在主页面显示当前代理模式
  - TUN模式连接成功时显示"TUN模式已连接"
  - 系统代理模式连接成功时显示"系统代理已连接"
  - TUN模式错误时显示具体错误原因(权限不足、驱动加载失败等)
  - 添加Toast通知,提示模式切换成功/失败
  - _Requirements: 7.1, 7.2, 7.4, 6.5_

- [x] 14. 实现路由规则更新触发重启





  - 在RoutingRuleManager中添加规则变更检测
  - 当规则更新且当前已连接时,触发xray重启
  - 使用RestartAsync方法重启xray进程
  - 显示"正在应用新规则..."提示
  - _Requirements: 8.5_

- [ ]* 14.1 为路由规则更新编写属性测试
  - **Property 21: 路由规则更新触发重启**
  - **Validates: Requirements 8.5**

- [x] 15. 添加管理员权限检查和提示




  - 创建PermissionHelper类
  - 实现IsAdministrator方法,检查当前进程是否有管理员权限
  - 实现RequestAdministrator方法,请求管理员权限(重启应用)
  - 在TUN模式连接前检查权限
  - 权限不足时显示对话框,提示用户以管理员身份运行
  - _Requirements: 7.2_


- [ ] 16. 更新资源文件部署
  - 确保xray.exe包含在Resources目录
  - 确保wintun.dll包含在Resources目录
  - 更新build脚本,复制xray.exe和wintun.dll到输出目录
  - 更新installer脚本,包含xray.exe和wintun.dll
  - _Requirements: 3.1, 4.1_