# Implementation Plan

- [x] 1. 扩展 sing-box 配置模型以支持系统代理模式





  - 扩展 Inbound 类添加 Listen 和 ListenPort 属性
  - 创建 RouteConfig 类用于路由配置
  - 创建 RouteRule 类用于路由规则
  - 确保所有属性使用正确的 JSON 序列化名称（snake_case）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_


- [x] 2. 实现系统代理模式的 sing-box 配置生成
  - 在 V2rayManager 中实现 GenerateSingBoxSystemProxyConfig 方法
  - 生成 HTTP inbound 配置（监听用户配置的 HttpPort）
  - 生成 SOCKS inbound 配置（监听用户配置的 SocksPort）
  - 生成 proxy outbound（根据服务器协议：VLESS/Trojan）
  - 生成 direct 和 block outbound
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. 实现 sing-box 格式的路由规则生成



  - 在 RoutingRuleManager 中实现 GenerateSingBoxRouting 方法
  - 实现全局模式路由规则（final="proxy"）
  - 实现智能模式路由规则（CN 直连，其他代理）
  - 实现直连模式路由规则（final="direct"）
  - 实现自定义规则转换（优先级最高）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. 统一 V2rayManager 使用 sing-box 进程


  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4.1 修复 StartAsync 方法签名并添加模式判断


  - 更新 StartAsync 方法签名，确保与接口匹配（添加 UserConfig? 参数）
  - 添加 UserConfig 必需检查
  - 根据 UserConfig.ProxyModeType 判断模式（TUN 或系统代理）
  - 移除基于 config.Inbounds 的模式判断逻辑
  - _Requirements: 4.1, 4.2_


- [x] 4.2 重构 StartSingBoxAsync 支持两种模式

  - 修改 StartSingBoxAsync 根据 ProxyModeType 生成不同配置
  - 统一配置文件路径为 singbox_config.json
  - 添加模式类型日志输出
  - _Requirements: 4.2, 4.3_

- [x] 4.3 添加 sing-box 专用事件处理方法


  - 实现 OnSingBoxOutputDataReceived 方法
  - 实现 OnSingBoxErrorDataReceived 方法（包含 ANSI 颜色代码移除）
  - 实现 OnSingBoxProcessExited 方法
  - 在 StartSingBoxAsync 中使用新的事件处理方法
  - _Requirements: 4.4_

- [x] 4.4 更新 StopAsync 和 RestartAsync 方法


  - 更新 StopAsync 中的事件取消订阅，使用新的 sing-box 事件处理方法
  - 更新日志输出标识为 "sing-box"
  - 更新 RestartAsync 日志输出
  - _Requirements: 4.4_

- [x] 4.5 批量更新日志标识


  - 将所有 _logManager?.AddLog 调用中的 "v2ray" 替换为 "sing-box"
  - 更新 Debug.WriteLine 输出中的标识
  - _Requirements: 4.5_

- [x] 4.6 移除旧的 v2ray-core 启动逻辑


  - 从 StartAsync 中移除所有 v2ray-core 进程启动代码
  - 移除 GetV2rayExecutablePath 方法调用
  - 移除 WriteConfigFileAsync(V2rayConfig) 调用
  - 移除 V2RAY_LOCATION_ASSET 环境变量设置
  - _Requirements: 4.1, 4.2_

- [x] 5. 更新 IV2rayManager 接口定义





  - 移除 GenerateConfig 方法（返回 V2rayConfig）
  - 移除 GenerateTunConfig 方法（返回 V2rayConfig）
  - 添加 GenerateSingBoxConfig 方法（接受 ProxyModeType 参数）
  - 更新 StartAsync 方法签名（接受 SingBoxConfig）
  - 更新 RestartAsync 方法签名（接受 SingBoxConfig）
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 6. 更新 NativeApi 调用新的配置生成方法
  - 修改 ConnectAsync 方法调用 GenerateSingBoxConfig
  - 传递正确的 ProxyModeType 参数
  - 移除对旧 GenerateConfig/GenerateTunConfig 的调用
  - 确保系统代理模式和 TUN 模式都使用新方法
  - _Requirements: 2.5, 7.1_

- [x] 7. 移除 ResourceManager 中的 v2ray-core 引用
  - 移除 V2rayExePath 属性
  - 移除 v2ray.exe 文件存在性检查
  - 移除 V2RAY_LOCATION_ASSET 环境变量设置
  - 更新资源验证逻辑只检查 sing-box.exe
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 8. 移除 V2rayManager 中的 v2ray-core 相关代码
  - 删除 CreateProxyOutbound 方法（v2ray 格式）
  - 删除 CreateVlessOutbound 方法（v2ray 格式）
  - 删除 CreateTrojanOutbound 方法（v2ray 格式）
  - 删除 ConfigureStreamSettings 方法（v2ray 格式）
  - 删除 ParseV2rayError 方法
  - 移除 v2ray-core 进程启动逻辑
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. 清理 v2ray 模型类和配置
  - 删除 V2rayClient/Models/V2ray 目录下的所有文件
  - 删除 V2rayConfig 类
  - 删除 v2ray 特定的 Inbound/Outbound 类
  - 删除 StreamSettings、RoutingRule 等 v2ray 特定类
  - 更新所有引用这些类的代码
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 10. 更新 IRoutingRuleManager 接口
  - 添加 GenerateSingBoxRouting 方法
  - 保留原有 GenerateRoutingRules 方法（标记为 Obsolete）
  - 更新接口文档说明新旧方法的用途
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 11. 实现 sing-box 错误解析
  - 实现 ParseSingBoxError 方法
  - 解析常见 sing-box 错误（配置错误、端口占用、连接失败等）
  - 移除 ANSI 颜色代码
  - 返回用户友好的中文错误消息
  - _Requirements: 4.5_

- [x] 12. 更新测试用例
  - 更新 V2rayManagerTests 使用 SingBoxConfig
  - 添加 GenerateSingBoxConfig 测试用例
  - 添加 GenerateSingBoxRouting 测试用例
  - 更新模式切换测试用例
  - 移除 v2ray-core 相关测试
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 13. 验证系统代理模式功能

  - 手动测试：启动系统代理模式
  - 验证 HTTP 端口（65533）可连接
  - 验证 SOCKS 端口（65534）可连接
  - 使用浏览器通过代理访问国外网站
  - 使用浏览器通过代理访问国内网站（智能模式）
  - _Requirements: 10.1, 10.2, 10.3, 7.1_

- [ ] 14. 验证代理模式切换功能
  - 测试全局模式：所有流量走代理
  - 测试智能模式：CN 流量直连，其他代理
  - 测试直连模式：所有流量直连
  - 测试自定义规则：添加规则并验证生效
  - _Requirements: 10.4, 10.5, 10.6, 10.7, 7.2, 7.3_

- [ ] 15. 验证模式切换和资源清理
  - 测试从系统代理切换到 TUN 模式
  - 测试从 TUN 模式切换到系统代理
  - 测试停止代理后端口释放
  - 测试应用重启后配置保持
  - _Requirements: 10.8, 7.4, 7.5_

- [x] 16. 清理资源文件和文档
  - 从 Resources 目录删除 v2ray.exe（如果存在）
  - 更新 Resources/README.md 移除 v2ray-core 说明
  - 更新项目文档说明统一使用 sing-box
  - 更新构建脚本移除 v2ray-core 相关步骤
  - _Requirements: 5.1_

- [ ] 17. 最终验证和回归测试
  - 完整测试系统代理模式所有功能
  - 完整测试 TUN 模式所有功能（确保未破坏）
  - 测试模式切换的所有组合
  - 验证错误处理和用户提示
  - 确认应用体积减小（移除 v2ray-core 后）
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
