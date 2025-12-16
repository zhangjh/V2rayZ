/**
 * 代理管理服务
 * 负责 sing-box 进程的生命周期管理和配置生成
 */

import { app, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { UserConfig, ServerConfig, ProxyStatus } from '../../shared/types';
// RoutingRuleManager 不再使用，配置生成已内置
import type { ILogManager } from './LogManager';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { resourceManager } from './ResourceManager';
import { retry } from '../utils/retry';

/**
 * sing-box 1.12.x 配置类型定义
 */

interface SingBoxLogConfig {
  level: string;
  timestamp: boolean;
  output?: string;
}

interface SingBoxDnsServer {
  tag: string;
  type: string;
  server?: string;
  detour?: string;
}

interface SingBoxDnsRule {
  rule_set?: string;
  query_type?: string[];
  domain?: string[];
  server: string;
}

interface SingBoxFakeIPConfig {
  enabled: boolean;
  inet4_range?: string;
  inet6_range?: string;
}

interface SingBoxDnsConfig {
  servers: SingBoxDnsServer[];
  rules?: SingBoxDnsRule[];
  final?: string;
  strategy?: string;
  fakeip?: SingBoxFakeIPConfig;
}

interface SingBoxInbound {
  type: string;
  tag: string;
  listen?: string;
  listen_port?: number;
  // TUN 模式
  interface_name?: string;
  address?: string[];
  mtu?: number;
  auto_route?: boolean;
  strict_route?: boolean;
  stack?: string;
  sniff?: boolean;
  sniff_override_destination?: boolean;
  platform?: {
    http_proxy?: {
      enabled: boolean;
      server: string;
      server_port: number;
    };
  };
}

interface SingBoxOutbound {
  type: string;
  tag: string;
  server?: string;
  server_port?: number;
  // VLESS
  uuid?: string;
  flow?: string;
  packet_encoding?: string;
  // Trojan
  password?: string;
  // TLS
  tls?: {
    enabled: boolean;
    server_name?: string;
    insecure?: boolean;
    alpn?: string[];
    utls?: {
      enabled: boolean;
      fingerprint: string;
    };
  };
  // Transport
  transport?: {
    type: string;
    path?: string;
    headers?: Record<string, string | string[]>;
    service_name?: string;
  };
  // DNS resolver for outbound server domain
  domain_resolver?: string;
}

interface SingBoxRouteRule {
  protocol?: string;
  rule_set?: string;
  domain?: string[];
  domain_suffix?: string[];
  domain_keyword?: string[];
  ip_cidr?: string[];
  action: string;
  outbound?: string;
}

interface SingBoxRuleSet {
  tag: string;
  type: string;
  format: string;
  path: string;
}

interface SingBoxRouteConfig {
  rule_set?: SingBoxRuleSet[];
  rules: SingBoxRouteRule[];
  default_domain_resolver?: string;
  auto_detect_interface?: boolean;
  final?: string;
}

interface SingBoxExperimental {
  cache_file?: {
    enabled: boolean;
    path: string;
  };
}

interface SingBoxConfig {
  log: SingBoxLogConfig;
  dns?: SingBoxDnsConfig;
  inbounds: SingBoxInbound[];
  outbounds: SingBoxOutbound[];
  route?: SingBoxRouteConfig;
  experimental?: SingBoxExperimental;
}

export interface IProxyManager {
  start(config: UserConfig): Promise<void>;
  stop(): Promise<void>;
  restart(config: UserConfig): Promise<void>;
  getStatus(): ProxyStatus;
  generateSingBoxConfig(config: UserConfig): SingBoxConfig;
  on(event: 'started' | 'stopped' | 'error', listener: (...args: any[]) => void): void;
  off(event: 'started' | 'stopped' | 'error', listener: (...args: any[]) => void): void;
}

export class ProxyManager extends EventEmitter implements IProxyManager {
  private singboxProcess: ChildProcess | null = null;
  private startTime: Date | null = null;
  private pid: number | null = null;
  private singboxPid: number | null = null; // macOS TUN 模式下实际的 sing-box PID
  private currentConfig: UserConfig | null = null;
  private configPath: string;
  private singboxPath: string;
  private logManager: ILogManager | null = null;
  private lastLogMessage: string = '';
  private lastLogCount: number = 0;
  private lastLogTime: number = 0;
  private mainWindow: BrowserWindow | null = null;
  private lastErrorOutput: string = '';
  private logFileWatcher: ReturnType<typeof setInterval> | null = null;
  private lastLogFileSize: number = 0;

  constructor(
    logManager?: ILogManager,
    mainWindow?: BrowserWindow,
    configPath?: string,
    singboxPath?: string
  ) {
    super();
    this.logManager = logManager || null;
    this.mainWindow = mainWindow || null;

    // 配置文件路径
    if (configPath) {
      this.configPath = configPath;
    } else {
      const userDataPath = app.getPath('userData');
      this.configPath = path.join(userDataPath, 'singbox_config.json');
    }

    // sing-box 可执行文件路径
    if (singboxPath) {
      this.singboxPath = singboxPath;
    } else {
      this.singboxPath = this.getSingBoxPath();
    }
  }

  /**
   * 启动代理
   */
  async start(config: UserConfig): Promise<void> {
    // 如果已经在运行，先停止
    if (this.singboxProcess) {
      await this.stop();
    }

    // 检查是否选择了服务器
    if (!config.selectedServerId) {
      throw new Error('No server selected');
    }

    // 查找选中的服务器
    const selectedServer = config.servers.find((s) => s.id === config.selectedServerId);
    if (!selectedServer) {
      throw new Error('Selected server not found');
    }

    // 先保存当前配置（needsRootPrivilege 等方法需要用到）
    this.currentConfig = config;

    // 生成 sing-box 配置
    const singboxConfig = this.generateSingBoxConfig(config);

    // 写入配置文件
    await this.writeSingBoxConfig(singboxConfig);

    // 使用重试机制启动 sing-box 进程
    await retry(() => this.startSingBoxProcess(), {
      maxRetries: 2,
      delay: 2000,
      exponentialBackoff: true,
      shouldRetry: (error) => {
        // 只对特定错误进行重试
        const message = error.message.toLowerCase();

        // 不重试的错误类型
        const nonRetryableErrors = [
          '找不到',
          '权限',
          'permission',
          'enoent',
          'eacces',
          'eperm',
          '配置文件格式错误',
          'invalid config',
        ];

        // 如果是不可重试的错误，直接失败
        if (nonRetryableErrors.some((pattern) => message.includes(pattern))) {
          return false;
        }

        // 其他错误可以重试
        return true;
      },
      onRetry: (error, attempt) => {
        this.logToManager('warn', `启动失败，正在进行第 ${attempt} 次重试: ${error.message}`);
      },
    });
  }

  /**
   * 停止代理
   */
  async stop(): Promise<void> {
    // macOS TUN 模式：即使 singboxProcess 为 null，也可能有后台进程在运行
    if (!this.singboxProcess && !this.singboxPid) {
      return;
    }

    await this.stopSingBoxProcess();
  }

  /**
   * 重启代理
   */
  async restart(config: UserConfig): Promise<void> {
    await this.stop();
    await this.start(config);
  }

  /**
   * 切换代理模式
   * 检测模式变化，如果代理正在运行则重启
   */
  async switchMode(newConfig: UserConfig): Promise<void> {
    // 检查是否有模式变化
    const modeChanged = this.hasModeChanged(newConfig);

    if (!modeChanged) {
      // 模式没有变化，只更新配置
      this.currentConfig = newConfig;
      return;
    }

    // 如果代理正在运行，需要重启
    if (this.singboxProcess) {
      this.logToManager('info', '代理模式已更改，正在重启代理...');
      await this.restart(newConfig);
    } else {
      // 代理未运行，只更新配置
      this.currentConfig = newConfig;
    }
  }

  /**
   * 检查模式是否变化
   */
  private hasModeChanged(newConfig: UserConfig): boolean {
    if (!this.currentConfig) {
      return true;
    }

    // 检查代理模式
    if (this.currentConfig.proxyMode !== newConfig.proxyMode) {
      return true;
    }

    // 检查代理模式类型
    if (this.currentConfig.proxyModeType !== newConfig.proxyModeType) {
      return true;
    }

    // 检查选中的服务器
    if (this.currentConfig.selectedServerId !== newConfig.selectedServerId) {
      return true;
    }

    // 检查端口
    if (
      this.currentConfig.socksPort !== newConfig.socksPort ||
      this.currentConfig.httpPort !== newConfig.httpPort
    ) {
      return true;
    }

    // 检查 TUN 配置（如果是 TUN 模式）
    if (newConfig.proxyModeType === 'tun') {
      const oldTun = this.currentConfig.tunConfig;
      const newTun = newConfig.tunConfig;

      if (
        oldTun.mtu !== newTun.mtu ||
        oldTun.stack !== newTun.stack ||
        oldTun.autoRoute !== newTun.autoRoute ||
        oldTun.strictRoute !== newTun.strictRoute
      ) {
        return true;
      }
    }

    // 检查自定义规则
    if (JSON.stringify(this.currentConfig.customRules) !== JSON.stringify(newConfig.customRules)) {
      return true;
    }

    return false;
  }

  /**
   * 获取代理状态
   */
  getStatus(): ProxyStatus {
    // macOS TUN 模式：检查 singboxPid 而不是 singboxProcess
    const isRunning = this.singboxProcess !== null || this.singboxPid !== null;
    const activePid = this.singboxPid || this.pid;

    if (!isRunning || !activePid) {
      return {
        running: false,
      };
    }

    // 计算运行时间
    let uptime: number | undefined;
    if (this.startTime) {
      uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    }

    return {
      running: true,
      pid: activePid,
      startTime: this.startTime || undefined,
      uptime,
      currentServer: this.currentConfig?.servers.find(
        (s) => s.id === this.currentConfig?.selectedServerId
      ),
    };
  }

  /**
   * 生成 sing-box 配置（sing-box 1.12.x 格式）
   */
  generateSingBoxConfig(config: UserConfig): SingBoxConfig {
    const selectedServer = config.servers.find((s) => s.id === config.selectedServerId);
    if (!selectedServer) {
      throw new Error('Selected server not found');
    }

    // 调试日志
    console.log('[ProxyManager] Generating config with:', {
      proxyMode: config.proxyMode,
      proxyModeType: config.proxyModeType,
      selectedServerId: config.selectedServerId,
      serverProtocol: selectedServer.protocol,
    });

    // 获取用户数据目录用于缓存文件
    const userDataPath = app.getPath('userData');
    const cachePath = path.join(userDataPath, 'cache.db');

    const singboxConfig: SingBoxConfig = {
      log: this.generateLogConfig(config),
      dns: this.generateDnsConfig(config, selectedServer),
      inbounds: this.generateInbounds(config),
      outbounds: this.generateOutbounds(selectedServer),
      route: this.generateRouteConfig(config),
      experimental: {
        cache_file: {
          enabled: true,
          path: cachePath,
        },
      },
    };

    // 调试日志
    console.log('[ProxyManager] Generated inbounds count:', singboxConfig.inbounds.length);
    console.log('[ProxyManager] Generated outbounds count:', singboxConfig.outbounds.length);
    console.log('[ProxyManager] Route rule_set count:', singboxConfig.route?.rule_set?.length || 0);

    return singboxConfig;
  }

  /**
   * 生成日志配置
   */
  private generateLogConfig(config: UserConfig): SingBoxLogConfig {
    // 使用 info 级别，只显示启动/停止和关键信息
    // debug 级别会输出大量连接日志，但 sing-box 不输出路由决策（域名->出站）
    // warn 级别只显示警告和错误
    const logConfig: SingBoxLogConfig = {
      level: config.logLevel || 'info',
      timestamp: true,
    };

    // 在 macOS TUN 模式下，使用 osascript 运行时无法捕获 stdout
    // 需要将日志输出到文件，然后通过文件监控读取
    // 注意：这里直接根据 config 参数判断，而不是 this.currentConfig
    const isMacTunMode =
      process.platform === 'darwin' && config.proxyModeType?.toLowerCase() !== 'systemproxy';
    if (isMacTunMode) {
      logConfig.output = this.getLogFilePath();
    }

    return logConfig;
  }

  /**
   * 获取 sing-box 日志文件路径
   */
  private getLogFilePath(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'singbox.log');
  }

  /**
   * 生成 DNS 配置（sing-box 1.12.x 格式）
   * 关键：代理服务器域名必须使用本地 DNS 解析，否则会形成死循环
   */
  private generateDnsConfig(config: UserConfig, selectedServer: ServerConfig): SingBoxDnsConfig {
    // 使用小写比较代理模式和模式类型
    const proxyMode = (config.proxyMode || 'smart').toLowerCase();

    const dnsConfig: SingBoxDnsConfig = {
      servers: [
        {
          tag: 'dns-remote',
          type: 'udp',
          server: '8.8.8.8',
          detour: 'proxy',
        },
        {
          tag: 'dns-local',
          type: 'udp',
          server: '223.5.5.5',
        },
      ],
      final: 'dns-remote',
      strategy: 'ipv4_only',
    };

    // DNS 规则：代理服务器域名必须使用本地 DNS 解析
    // 这是最重要的规则，必须放在最前面，否则代理服务器的 DNS 查询会通过代理发送，形成死循环
    const dnsRules: SingBoxDnsRule[] = [];

    // 添加代理服务器域名使用本地 DNS 的规则
    if (selectedServer?.address) {
      dnsRules.push({
        domain: [selectedServer.address],
        server: 'dns-local',
      } as SingBoxDnsRule);
    }

    // 根据代理模式配置其他 DNS 规则
    if (proxyMode === 'smart') {
      // 智能分流模式：中国域名走本地 DNS，国外域名走远程 DNS
      dnsRules.push(
        {
          rule_set: 'geosite-cn',
          server: 'dns-local',
        },
        {
          rule_set: 'geosite-geolocation-!cn',
          server: 'dns-remote',
        }
      );
    }
    // 全局代理模式：所有域名走远程 DNS（final: dns-remote 已设置）
    // 直连模式：所有域名走本地 DNS
    if (proxyMode === 'direct') {
      dnsConfig.final = 'dns-local';
    }

    // 设置 DNS 规则
    if (dnsRules.length > 0) {
      dnsConfig.rules = dnsRules;
    }

    return dnsConfig;
  }

  /**
   * 生成 Inbound 配置（sing-box 1.12.x 格式）
   */
  private generateInbounds(config: UserConfig): SingBoxInbound[] {
    const inbounds: SingBoxInbound[] = [];

    // 使用小写比较，兼容 SystemProxy/systemProxy 和 Tun/tun
    const modeType = (config.proxyModeType || 'tun').toLowerCase();

    console.log('[ProxyManager] generateInbounds - proxyModeType:', config.proxyModeType);
    console.log('[ProxyManager] generateInbounds - modeType (lowercase):', modeType);

    if (modeType === 'systemproxy') {
      // 系统代理模式：HTTP + SOCKS inbound
      inbounds.push(
        {
          type: 'http',
          tag: 'http-in',
          listen: '127.0.0.1',
          listen_port: config.httpPort || 2080,
        },
        {
          type: 'socks',
          tag: 'socks-in',
          listen: '127.0.0.1',
          listen_port: config.socksPort || 2081,
        }
      );
    } else {
      // TUN 模式（默认，参考示例配置）
      // 不指定 interface_name，让 sing-box 自动选择可用的接口
      const tunInbound: SingBoxInbound = {
        type: 'tun',
        tag: 'tun-in',
        address: [config.tunConfig?.inet4Address || '172.19.0.1/30'],
        mtu: config.tunConfig?.mtu || 1400,
        auto_route: config.tunConfig?.autoRoute ?? true,
        // macOS 上不使用 strict_route，避免网络完全不通
        strict_route: process.platform === 'darwin' ? false : (config.tunConfig?.strictRoute ?? true),
        stack: config.tunConfig?.stack || 'mixed',
        sniff: true,
        sniff_override_destination: true,
      };

      // macOS 平台特定配置
      if (process.platform === 'darwin') {
        tunInbound.platform = {
          http_proxy: {
            enabled: true,
            server: '127.0.0.1',
            server_port: config.httpPort || 2080,
          },
        };
      }

      inbounds.push(tunInbound);
    }

    return inbounds;
  }

  /**
   * 生成 Outbound 配置（sing-box 1.12.x 格式）
   * 包含 proxy, direct, block 三个出站
   */
  private generateOutbounds(selectedServer: ServerConfig): SingBoxOutbound[] {
    const outbounds: SingBoxOutbound[] = [];

    // 代理出站
    outbounds.push(this.generateProxyOutbound(selectedServer));

    // 直连出站
    outbounds.push({
      type: 'direct',
      tag: 'direct',
    });

    // 阻断出站
    outbounds.push({
      type: 'block',
      tag: 'block',
    });

    return outbounds;
  }

  /**
   * 生成代理 Outbound 配置（sing-box 1.12.x 格式）
   */
  private generateProxyOutbound(server: ServerConfig): SingBoxOutbound {
    // sing-box 要求协议类型必须是小写
    const protocol = server.protocol.toLowerCase();

    const outbound: SingBoxOutbound = {
      type: protocol,
      tag: 'proxy',
      server: server.address,
      server_port: server.port,
      // 关键：代理服务器域名必须使用本地 DNS 解析，否则会形成死循环
      // 因为 dns-remote 通过 proxy 出站，如果代理服务器域名也用 dns-remote 解析，
      // 就会导致：解析代理服务器 -> 需要连接代理 -> 需要解析代理服务器 -> 死循环
      domain_resolver: 'dns-local',
    };

    // VLESS 特定配置
    if (protocol === 'vless') {
      outbound.uuid = server.uuid;
      if (server.flow) {
        outbound.flow = server.flow;
      }
      outbound.packet_encoding = 'xudp';
    }

    // Trojan 特定配置
    if (protocol === 'trojan') {
      outbound.password = server.password;
    }

    // TLS 配置
    if (server.security === 'tls' || server.tlsSettings) {
      outbound.tls = {
        enabled: true,
        server_name: server.tlsSettings?.serverName || server.address,
        insecure: server.tlsSettings?.allowInsecure || false,
        utls: {
          enabled: true,
          fingerprint: 'chrome',
        },
      };
      if (server.tlsSettings?.alpn) {
        outbound.tls.alpn = server.tlsSettings.alpn;
      }
    }

    // 传输层配置
    if (server.network && server.network !== 'tcp') {
      outbound.transport = this.generateTransportConfig(server);
    }

    return outbound;
  }

  /**
   * 生成传输层配置
   */
  private generateTransportConfig(server: ServerConfig): SingBoxOutbound['transport'] {
    if (server.network === 'ws' && server.wsSettings) {
      return {
        type: 'ws',
        path: server.wsSettings.path || '/',
        headers: server.wsSettings.headers,
      };
    }

    if (server.network === 'grpc' && server.grpcSettings) {
      return {
        type: 'grpc',
        service_name: server.grpcSettings.serviceName || '',
      };
    }

    return undefined;
  }

  /**
   * 生成路由配置（sing-box 1.12.x 格式）
   */
  private generateRouteConfig(config: UserConfig): SingBoxRouteConfig {
    const rules: SingBoxRouteRule[] = [];

    // 使用小写比较代理模式
    const proxyMode = (config.proxyMode || 'smart').toLowerCase();

    // 获取当前选中的服务器，用于排除代理服务器域名
    const selectedServer = config.servers.find((s) => s.id === config.selectedServerId);

    // DNS 劫持规则（必须）
    rules.push({
      protocol: 'dns',
      action: 'hijack-dns',
    });

    // 排除代理服务器域名，确保代理服务器的连接走直连
    // 这必须放在其他规则之前，否则可能被 geosite-cn 匹配导致死循环
    if (selectedServer?.address) {
      rules.push({
        domain: [selectedServer.address],
        action: 'route',
        outbound: 'direct',
      });
    }

    // 私有 IP 段直连（内网地址不应该走代理）
    rules.push({
      ip_cidr: [
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        '127.0.0.0/8',
        '169.254.0.0/16',
        '224.0.0.0/4',
        '240.0.0.0/4',
      ],
      action: 'route',
      outbound: 'direct',
    });

    // 智能分流规则（默认启用，除非是直连模式）
    if (proxyMode !== 'direct') {
      // 国外域名走代理
      rules.push({
        rule_set: 'geosite-geolocation-!cn',
        action: 'route',
        outbound: 'proxy',
      });
      // 中国域名直连
      rules.push({
        rule_set: 'geosite-cn',
        action: 'route',
        outbound: 'direct',
      });
      // 中国 IP 直连
      rules.push({
        rule_set: 'geoip-cn',
        action: 'route',
        outbound: 'direct',
      });
    }

    // 添加自定义规则
    const customRules = this.generateCustomRules(config.customRules || []);
    rules.push(...customRules);

    // 始终添加 rule_set 配置（除非是直连模式）
    // 全局代理模式使用远程 DNS 避免 DNS 污染，智能分流模式使用本地 DNS 提高国内访问速度
    const routeConfig: SingBoxRouteConfig = {
      rules,
      default_domain_resolver: proxyMode === 'global' ? 'dns-remote' : 'dns-local',
      auto_detect_interface: true,
      final: proxyMode === 'direct' ? 'direct' : 'proxy',
    };

    // 添加 rule_set（除非是直连模式）
    if (proxyMode !== 'direct') {
      routeConfig.rule_set = [
        {
          tag: 'geosite-cn',
          type: 'local',
          format: 'binary',
          path: resourceManager.getGeoSiteCNPath(),
        },
        {
          tag: 'geosite-geolocation-!cn',
          type: 'local',
          format: 'binary',
          path: resourceManager.getGeoSiteNonCNPath(),
        },
        {
          tag: 'geoip-cn',
          type: 'local',
          format: 'binary',
          path: resourceManager.getGeoIPPath(),
        },
      ];
    }

    return routeConfig;
  }

  /**
   * 生成自定义路由规则
   */
  private generateCustomRules(
    customRules: import('../../shared/types').DomainRule[]
  ): SingBoxRouteRule[] {
    const rules: SingBoxRouteRule[] = [];

    for (const rule of customRules) {
      if (!rule.enabled) continue;

      const singboxRule: SingBoxRouteRule = {
        action: 'route',
      };

      // 处理域名
      if (rule.domain.startsWith('*.')) {
        singboxRule.domain_suffix = [rule.domain.slice(2)];
      } else if (rule.domain.includes('*')) {
        singboxRule.domain_keyword = [rule.domain.replace(/\*/g, '')];
      } else {
        singboxRule.domain = [rule.domain];
      }

      // 设置出站
      if (rule.action === 'proxy') {
        singboxRule.outbound = 'proxy';
      } else if (rule.action === 'direct') {
        singboxRule.outbound = 'direct';
      } else if (rule.action === 'block') {
        singboxRule.outbound = 'block';
      }

      rules.push(singboxRule);
    }

    return rules;
  }

  /**
   * 写入 sing-box 配置文件
   */
  private async writeSingBoxConfig(config: SingBoxConfig): Promise<void> {
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(this.configPath, content, 'utf-8');
  }

  /**
   * 检查当前配置是否需要 root/admin 权限（TUN 模式）
   * Windows 和 macOS 的 TUN 模式都需要管理员权限
   */
  private needsRootPrivilege(): boolean {
    const isTunMode = this.currentConfig?.proxyModeType?.toLowerCase() !== 'systemproxy';
    // Windows 和 macOS 的 TUN 模式都需要管理员权限
    return isTunMode && (process.platform === 'darwin' || process.platform === 'win32');
  }

  /**
   * 检查是否需要使用 osascript 运行（仅 macOS）
   */
  private needsOsascript(): boolean {
    return process.platform === 'darwin' && this.needsRootPrivilege();
  }

  /**
   * 启动 sing-box 进程
   */
  private async startSingBoxProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 检查 sing-box 可执行文件是否存在
        const fs = require('fs');
        if (!fs.existsSync(this.singboxPath)) {
          const error = new Error(`找不到 sing-box 可执行文件: ${this.singboxPath}`);
          this.logToManager('error', error.message);
          reject(error);
          return;
        }

        // 在 macOS 上，TUN 模式需要使用 osascript 请求 root 权限
        // 在 Windows 上，应用应该已经以管理员权限运行（通过 UAC 提升）
        let command: string;
        let args: string[];

        if (this.needsOsascript()) {
          // macOS: 使用 osascript 请求管理员权限运行
          // 注意：路径中可能包含空格，需要使用转义引号
          // sing-box 配置中已经设置了 log.output，日志会写入文件
          // 使用 & 让进程在后台运行，并将 PID 写入文件
          const pidFile = path.join(app.getPath('userData'), 'singbox.pid');
          command = '/usr/bin/osascript';
          // 使用 bash -c 来执行后台命令，确保 & 正常工作
          args = [
            '-e',
            `do shell script "/bin/bash -c '\\"${this.singboxPath}\\" run -c \\"${this.configPath}\\" & echo $! > \\"${pidFile}\\"'" with administrator privileges`,
          ];
          this.logToManager('info', 'TUN 模式需要管理员权限，正在请求...');
        } else {
          // Windows 或系统代理模式：直接运行
          command = this.singboxPath;
          args = ['run', '-c', this.configPath];
        }

        // 启动进程
        this.singboxProcess = spawn(command, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        // 记录启动信息
        this.pid = this.singboxProcess.pid || null;
        this.startTime = new Date();

        this.logToManager('info', `正在启动 sing-box 进程 (PID: ${this.pid})...`);

        // 监听进程输出
        if (this.singboxProcess.stdout) {
          this.singboxProcess.stdout.on('data', (data: Buffer) => {
            this.handleProcessOutput(data.toString());
          });
        }

        if (this.singboxProcess.stderr) {
          this.singboxProcess.stderr.on('data', (data: Buffer) => {
            const output = data.toString();
            this.lastErrorOutput = output;
            this.handleProcessOutput(output);
          });
        }

        // 监听进程事件
        this.singboxProcess.on('error', (error) => {
          console.error('sing-box process error:', error);
          const friendlyError = this.parseLaunchError(error);
          this.logToManager('error', friendlyError);
          this.handleProcessError(error);
          reject(new Error(friendlyError));
        });

        this.singboxProcess.on('exit', (code, signal) => {
          console.log(`sing-box process exited with code ${code}, signal ${signal}`);

          // 对于 macOS TUN 模式，osascript 退出码为 0 表示成功启动了后台进程
          if (this.needsOsascript()) {
            if (code === 0) {
              // osascript 成功执行，sing-box 在后台运行
              // 读取 PID 文件获取实际的 sing-box PID
              this.readSingBoxPidFromFile();
              return; // 不调用 handleProcessExit，因为 sing-box 还在运行
            } else {
              // osascript 执行失败（用户取消或其他错误）
              const errorMessage =
                code === 1 ? '用户取消了管理员权限请求' : `启动失败，退出码: ${code}`;
              this.logToManager('error', errorMessage);
              reject(new Error(errorMessage));
              this.handleProcessExit(code, signal);
              return;
            }
          }

          // 如果在启动阶段就退出了，说明启动失败
          const startupTime = Date.now() - (this.startTime?.getTime() || Date.now());
          if (startupTime < 2000 && code !== null && code !== 0) {
            const errorMessage = this.parseStartupError(code, this.lastErrorOutput);
            this.logToManager('error', errorMessage);
            reject(new Error(errorMessage));
          }

          this.handleProcessExit(code, signal);
        });

        // 等待一小段时间确保进程启动成功
        setTimeout(() => {
          if (this.singboxProcess && this.pid) {
            // 如果使用 osascript 运行（macOS TUN 模式），启动日志文件监控
            if (this.needsOsascript()) {
              this.startLogFileWatcher();
            }

            // 触发启动事件
            this.emit('started');
            this.sendEventToRenderer(IPC_CHANNELS.EVENT_PROXY_STARTED, {
              pid: this.pid,
              startTime: this.startTime,
            });
            this.logToManager('info', 'sing-box 进程启动成功');
            resolve();
          } else {
            const error = '启动 sing-box 进程失败：进程未能正常启动';
            this.logToManager('error', error);
            reject(new Error(error));
          }
        }, 1000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logToManager('error', `启动 sing-box 进程时发生异常: ${errorMessage}`);
        reject(error);
      }
    });
  }

  /**
   * 解析进程启动错误
   */
  private parseLaunchError(error: Error): string {
    const errorCode = (error as NodeJS.ErrnoException).code;

    switch (errorCode) {
      case 'ENOENT':
        return '找不到 sing-box 可执行文件，请检查安装是否完整';
      case 'EACCES':
        return 'sing-box 可执行文件没有执行权限，请检查文件权限';
      case 'EPERM':
        return '权限不足，无法启动 sing-box 进程。TUN 模式需要管理员权限';
      default:
        return `启动 sing-box 进程失败: ${error.message}`;
    }
  }

  /**
   * 解析启动阶段的错误
   */
  private parseStartupError(exitCode: number, errorOutput: string): string {
    // 首先尝试从错误输出中提取有用信息
    if (errorOutput) {
      const lowerOutput = errorOutput.toLowerCase();

      if (lowerOutput.includes('permission denied') || lowerOutput.includes('access denied')) {
        return 'TUN 模式需要管理员权限，请以管理员身份运行应用';
      }

      if (lowerOutput.includes('address already in use') || lowerOutput.includes('bind')) {
        return '端口已被占用，请在设置中更换其他端口或关闭占用端口的程序';
      }

      if (
        lowerOutput.includes('invalid config') ||
        lowerOutput.includes('parse') ||
        lowerOutput.includes('json')
      ) {
        return 'sing-box 配置文件格式错误，请检查服务器配置';
      }

      if (lowerOutput.includes('connection refused') || lowerOutput.includes('dial')) {
        return '无法连接到代理服务器，请检查服务器地址和端口';
      }

      if (lowerOutput.includes('certificate') || lowerOutput.includes('tls')) {
        return 'TLS 证书验证失败，请检查服务器 TLS 配置';
      }

      // 如果有具体的错误信息，翻译后返回
      const friendlyMessage = this.translateErrorMessage(errorOutput);
      if (friendlyMessage !== errorOutput) {
        return `sing-box 启动失败: ${friendlyMessage}`;
      }
    }

    // 根据退出码返回通用错误信息
    switch (exitCode) {
      case 1:
        return 'sing-box 启动失败，请检查配置文件和服务器设置';
      case 2:
        return 'sing-box 配置文件格式错误，请检查服务器配置';
      case 126:
        return 'sing-box 可执行文件没有执行权限';
      case 127:
        return '找不到 sing-box 可执行文件';
      default:
        return `sing-box 启动失败，退出码: ${exitCode}`;
    }
  }

  /**
   * 停止 sing-box 进程
   */
  private async stopSingBoxProcess(): Promise<void> {
    // macOS TUN 模式：sing-box 以 root 权限在后台运行，需要用 osascript 终止
    if (this.singboxPid && process.platform === 'darwin') {
      return this.stopSingBoxWithSudo();
    }

    if (!this.singboxProcess) {
      return;
    }

    return new Promise((resolve) => {
      const proc = this.singboxProcess!;

      // 设置超时强制终止
      const killTimeout = setTimeout(() => {
        if (proc.killed === false) {
          console.warn('sing-box process did not exit gracefully, force killing');
          proc.kill('SIGKILL');
        }
      }, 5000);

      // 监听退出事件
      proc.once('exit', () => {
        clearTimeout(killTimeout);
        this.cleanup();
        resolve();
      });

      // 发送 SIGTERM 信号优雅终止
      proc.kill('SIGTERM');
    });
  }

  /**
   * 使用 sudo 停止 sing-box 进程（macOS TUN 模式）
   */
  private async stopSingBoxWithSudo(): Promise<void> {
    if (!this.singboxPid) {
      this.cleanup();
      return;
    }

    this.logToManager('info', `正在停止 sing-box 进程 (PID: ${this.singboxPid})...`);

    return new Promise((resolve) => {
      const killProcess = spawn('/usr/bin/osascript', [
        '-e',
        `do shell script "kill -TERM ${this.singboxPid}" with administrator privileges`,
      ]);

      killProcess.on('exit', (code) => {
        if (code === 0) {
          this.logToManager('info', 'sing-box 进程已停止');
        } else {
          this.logToManager('warn', `停止 sing-box 进程可能失败，退出码: ${code}`);
        }

        // 清理 PID 文件
        const fsSync = require('fs');
        try {
          fsSync.unlinkSync(this.getPidFilePath());
        } catch {
          // 忽略错误
        }

        this.cleanup();

        // 触发停止事件
        this.emit('stopped');
        this.sendEventToRenderer(IPC_CHANNELS.EVENT_PROXY_STOPPED, {});

        resolve();
      });

      killProcess.on('error', (error) => {
        this.logToManager('error', `停止 sing-box 进程失败: ${error.message}`);
        this.cleanup();
        resolve();
      });
    });
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.stopLogFileWatcher();
    this.singboxProcess = null;
    this.pid = null;
    this.singboxPid = null;
    this.startTime = null;
  }

  /**
   * 从 PID 文件读取 sing-box 的实际 PID（macOS TUN 模式）
   */
  private async readSingBoxPidFromFile(): Promise<void> {
    const pidFile = path.join(app.getPath('userData'), 'singbox.pid');
    try {
      const pidContent = await fs.readFile(pidFile, 'utf-8');
      const pid = parseInt(pidContent.trim(), 10);
      if (!isNaN(pid) && pid > 0) {
        this.singboxPid = pid;
        this.pid = pid; // 更新显示的 PID
        this.logToManager('info', `sing-box 后台进程 PID: ${pid}`);
      }
    } catch (error) {
      this.logToManager('warn', `无法读取 sing-box PID 文件: ${error}`);
    }
  }

  /**
   * 获取 PID 文件路径
   */
  private getPidFilePath(): string {
    return path.join(app.getPath('userData'), 'singbox.pid');
  }

  /**
   * 启动日志文件监控（用于 macOS TUN 模式）
   */
  private startLogFileWatcher(): void {
    if (this.logFileWatcher) {
      return;
    }

    const logFilePath = this.getLogFilePath();
    this.lastLogFileSize = 0;

    // 清空旧的日志文件
    const fsSync = require('fs');
    try {
      fsSync.writeFileSync(logFilePath, '');
    } catch {
      // 忽略错误
    }

    // 每 500ms 检查一次日志文件
    this.logFileWatcher = setInterval(async () => {
      try {
        const stats = await fs.stat(logFilePath);
        if (stats.size > this.lastLogFileSize) {
          // 读取新增的内容
          const fd = await fs.open(logFilePath, 'r');
          const buffer = Buffer.alloc(stats.size - this.lastLogFileSize);
          await fd.read(buffer, 0, buffer.length, this.lastLogFileSize);
          await fd.close();

          const newContent = buffer.toString('utf-8');
          this.lastLogFileSize = stats.size;

          // 处理日志内容
          if (newContent.trim()) {
            this.handleProcessOutput(newContent);
          }
        }
      } catch {
        // 文件可能还不存在，忽略错误
      }
    }, 500);
  }

  /**
   * 停止日志文件监控
   */
  private stopLogFileWatcher(): void {
    if (this.logFileWatcher) {
      clearInterval(this.logFileWatcher);
      this.logFileWatcher = null;
    }
    this.lastLogFileSize = 0;
  }

  /**
   * 处理进程输出
   */
  private handleProcessOutput(data: string): void {
    // 移除 ANSI 颜色代码
    const cleanData = this.removeAnsiCodes(data);

    // 按行分割
    const lines = cleanData.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      this.parseAndLogLine(line);
    }
  }

  /**
   * 移除 ANSI 颜色代码
   */
  private removeAnsiCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * 解析并记录日志行
   */
  private parseAndLogLine(line: string): void {
    // 过滤重复日志
    if (this.isDuplicateLog(line)) {
      return;
    }

    // 过滤低价值日志（连接建立、DNS 查询等频繁日志）
    if (this.isLowValueLog(line)) {
      return;
    }

    // 解析 sing-box 日志格式
    const logInfo = this.parseSingBoxLog(line);

    if (logInfo) {
      // 转换为友好的中文提示
      const friendlyMessage = this.translateErrorMessage(logInfo.message);

      // 记录到 LogManager
      this.logToManager(logInfo.level, friendlyMessage);
    } else {
      // 无法解析的日志，直接记录
      this.logToManager('info', line);
    }
  }

  /**
   * 检查是否为低价值日志（应该被过滤）
   * 保留：路由决策、错误、启动/停止、outbound 选择等重要日志
   * 过滤：频繁的连接建立/关闭、握手等日志
   */
  private isLowValueLog(line: string): boolean {
    const lowerLine = line.toLowerCase();

    // 高价值日志模式 - 这些日志应该保留
    const keepPatterns = [
      'started', // 启动完成
      'stopped', // 停止
      'sing-box started', // sing-box 启动
      'error', // 错误
      'fatal', // 致命错误
      'warn', // 警告
      'failed', // 失败
      'updated default interface', // 网络接口变化
    ];

    // 检查是否包含高价值模式
    for (const pattern of keepPatterns) {
      if (lowerLine.includes(pattern)) {
        return false; // 不过滤，保留这条日志
      }
    }

    // 过滤的低价值日志模式（sing-box 的连接日志太频繁）
    const filterPatterns = [
      'outbound connection', // 出站连接（太频繁）
      'outbound packet', // 出站数据包（太频繁）
      'inbound connection', // 入站连接建立（太频繁）
      'inbound/tun', // TUN 入站日志（太频繁）
      'inbound/http', // HTTP 入站日志
      'inbound/socks', // SOCKS 入站日志
      'connection to', // 连接到目标
      'connection from', // 来自的连接
      'dns query', // DNS 查询
      'dns response', // DNS 响应
      'dns: exchanged', // DNS 交换
      'dns: cached', // DNS 缓存
      'resolved', // DNS 解析完成
      'connection closed', // 连接关闭
      'connection established', // 连接建立
      'handshake', // 握手
      'tls handshake', // TLS 握手
      'udp packet', // UDP 包
      'tcp connection', // TCP 连接
    ];

    for (const pattern of filterPatterns) {
      if (lowerLine.includes(pattern)) {
        return true; // 过滤掉
      }
    }

    return false; // 默认保留
  }

  /**
   * 检查是否为重复日志
   */
  private isDuplicateLog(message: string): boolean {
    const now = Date.now();

    // 如果消息相同且在 1 秒内
    if (message === this.lastLogMessage && now - this.lastLogTime < 1000) {
      this.lastLogCount++;

      // 如果重复超过 5 次，过滤掉
      if (this.lastLogCount > 5) {
        return true;
      }
    } else {
      // 新消息，重置计数
      this.lastLogMessage = message;
      this.lastLogCount = 1;
      this.lastLogTime = now;
    }

    return false;
  }

  /**
   * 解析 sing-box 日志
   */
  private parseSingBoxLog(
    line: string
  ): { level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'; message: string } | null {
    // sing-box 日志格式示例：
    // 2024-01-01 12:00:00 INFO message
    // 2024-01-01 12:00:00 [INFO] message

    // 尝试匹配日志级别
    const levelMatch = line.match(/\b(DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\b/i);
    if (!levelMatch) {
      return null;
    }

    let level = levelMatch[1].toUpperCase();
    if (level === 'WARNING') {
      level = 'WARN';
    }

    // 提取消息内容（去掉时间戳和级别）
    const message = line
      .replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/, '')
      .replace(/\[?(DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\]?/i, '')
      .trim();

    return {
      level: level.toLowerCase() as 'debug' | 'info' | 'warn' | 'error' | 'fatal',
      message,
    };
  }

  /**
   * 翻译错误消息为友好的中文提示
   */
  private translateErrorMessage(message: string): string {
    const lowerMessage = message.toLowerCase();

    // 常见错误模式匹配
    if (
      lowerMessage.includes('connection refused') ||
      lowerMessage.includes('connect: connection refused')
    ) {
      return '连接被拒绝：无法连接到代理服务器，请检查服务器地址和端口是否正确';
    }

    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return '连接超时：服务器响应超时，请检查网络连接或更换服务器';
    }

    if (lowerMessage.includes('dns') && lowerMessage.includes('fail')) {
      return 'DNS 解析失败：无法解析服务器域名，请检查 DNS 设置';
    }

    if (
      lowerMessage.includes('certificate') ||
      lowerMessage.includes('tls') ||
      lowerMessage.includes('ssl')
    ) {
      return 'TLS 证书错误：服务器证书验证失败，请检查 TLS 设置';
    }

    if (lowerMessage.includes('authentication failed') || lowerMessage.includes('auth fail')) {
      return '认证失败：用户名或密码错误，请检查服务器配置';
    }

    if (lowerMessage.includes('permission denied') || lowerMessage.includes('access denied')) {
      return '权限不足：需要管理员权限才能启动 TUN 模式';
    }

    if (
      lowerMessage.includes('address already in use') ||
      lowerMessage.includes('bind: address already in use')
    ) {
      return '端口已被占用：请更换其他端口或关闭占用端口的程序';
    }

    if (lowerMessage.includes('invalid config') || lowerMessage.includes('config error')) {
      return '配置错误：sing-box 配置文件格式不正确';
    }

    // 如果没有匹配到特定错误，返回原始消息
    return message;
  }

  /**
   * 记录日志到 LogManager
   */
  private logToManager(
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: string
  ): void {
    if (this.logManager) {
      this.logManager.addLog(level, message, 'sing-box');
    }
  }

  /**
   * 处理进程错误
   */
  private handleProcessError(error: Error): void {
    const errorMessage = this.translateErrorMessage(error.message);

    // 触发错误事件
    this.emit('error', {
      message: errorMessage,
      error: error.message,
    });

    // 发送到前端
    this.sendEventToRenderer(IPC_CHANNELS.EVENT_PROXY_ERROR, {
      message: errorMessage,
      error: error.message,
    });
  }

  /**
   * 处理进程退出
   */
  private handleProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    // 解析退出原因
    const exitReason = this.parseExitReason(code, signal);

    this.logToManager('info', `sing-box process exited: ${exitReason}`);

    // 如果是异常退出（非正常停止）
    if (code !== null && code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      const errorMessage = this.parseExitError(code);

      this.logToManager('error', `sing-box异常退出: ${errorMessage}`);

      // 触发错误事件
      this.emit('error', {
        message: errorMessage,
        code,
        signal,
      });

      // 发送到前端
      this.sendEventToRenderer(IPC_CHANNELS.EVENT_PROXY_ERROR, {
        message: errorMessage,
        code,
        signal,
      });
    } else {
      // 正常退出，触发停止事件
      this.emit('stopped');
      this.sendEventToRenderer(IPC_CHANNELS.EVENT_PROXY_STOPPED, {});
    }

    this.cleanup();
  }

  /**
   * 解析退出原因
   */
  private parseExitReason(code: number | null, signal: NodeJS.Signals | null): string {
    if (signal) {
      return `信号 ${signal}`;
    }
    if (code !== null) {
      return `退出码 ${code}`;
    }
    return '未知原因';
  }

  /**
   * 解析退出错误
   */
  private parseExitError(code: number): string {
    // 尝试从最后的错误输出中提取错误信息
    if (this.lastErrorOutput) {
      const friendlyMessage = this.translateErrorMessage(this.lastErrorOutput);
      if (friendlyMessage !== this.lastErrorOutput) {
        return friendlyMessage;
      }
    }

    // 根据退出码返回通用错误信息
    switch (code) {
      case 1:
        return 'sing-box 启动失败，请检查配置文件';
      case 2:
        return 'sing-box 配置文件格式错误';
      case 126:
        return 'sing-box 可执行文件没有执行权限';
      case 127:
        return '找不到 sing-box 可执行文件';
      case 137:
        return 'sing-box 进程被强制终止';
      case 143:
        return 'sing-box 进程被正常终止';
      default:
        return `sing-box 异常退出，退出码: ${code}`;
    }
  }

  /**
   * 发送事件到渲染进程
   */
  private sendEventToRenderer(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * 获取 sing-box 可执行文件路径
   */
  private getSingBoxPath(): string {
    return resourceManager.getSingBoxPath();
  }
}
