/**
 * 协议解析服务
 * 负责解析 VLESS 和 Trojan 协议 URL
 */

import { randomUUID } from 'crypto';
import type {
  ServerConfig,
  Protocol,
  Network,
  Security,
  TlsSettings,
  WebSocketSettings,
  GrpcSettings,
  HttpSettings,
} from '../../shared/types';

export interface IProtocolParser {
  /**
   * 检查 URL 是否为支持的协议
   */
  isSupported(url: string): boolean;

  /**
   * 解析协议 URL 为服务器配置
   */
  parseUrl(url: string): ServerConfig;

  /**
   * 将服务器配置生成为分享 URL
   */
  generateUrl(config: ServerConfig): string;
}

export class ProtocolParser implements IProtocolParser {
  /**
   * 检查 URL 是否为支持的协议
   */
  isSupported(url: string): boolean {
    return url.startsWith('vless://') || url.startsWith('trojan://');
  }

  /**
   * 解析协议 URL 为服务器配置
   */
  parseUrl(url: string): ServerConfig {
    if (!this.isSupported(url)) {
      throw new Error(`不支持的协议: ${url.split('://')[0]}`);
    }

    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol.replace(':', '') as Protocol;

      if (protocol === 'vless') {
        return this.parseVless(urlObj);
      } else if (protocol === 'trojan') {
        return this.parseTrojan(urlObj);
      }

      throw new Error(`不支持的协议: ${protocol}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`URL 解析失败: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 解析 VLESS URL
   * 格式: vless://uuid@address:port?encryption=none&security=tls&type=ws&host=example.com&path=/path#name
   */
  private parseVless(url: URL): ServerConfig {
    const uuid = url.username;
    const address = url.hostname;
    const port = parseInt(url.port) || 443;
    const params = new URLSearchParams(url.search);
    const name = decodeURIComponent(url.hash.slice(1)) || `${address}:${port}`;

    if (!uuid) {
      throw new Error('VLESS URL 缺少 UUID');
    }

    const config: ServerConfig = {
      id: randomUUID(),
      name,
      protocol: 'vless',
      address,
      port,
      uuid,
      encryption: params.get('encryption') || 'none',
      flow: params.get('flow') || undefined,
    };

    // 解析传输层配置
    const network = params.get('type') as Network | null;
    if (network) {
      config.network = network;
      this.parseTransportSettings(config, params, network);
    }

    // 解析安全配置
    const security = params.get('security') as Security | null;
    if (security) {
      config.security = security;
      if (security === 'tls' || security === 'reality') {
        config.tlsSettings = this.parseTlsSettings(params);
      }
    }

    return config;
  }

  /**
   * 解析 Trojan URL
   * 格式: trojan://password@address:port?security=tls&type=ws&host=example.com&path=/path#name
   */
  private parseTrojan(url: URL): ServerConfig {
    const password = decodeURIComponent(url.username);
    const address = url.hostname;
    const port = parseInt(url.port) || 443;
    const params = new URLSearchParams(url.search);
    const name = decodeURIComponent(url.hash.slice(1)) || `${address}:${port}`;

    if (!password) {
      throw new Error('Trojan URL 缺少密码');
    }

    const config: ServerConfig = {
      id: randomUUID(),
      name,
      protocol: 'trojan',
      address,
      port,
      password,
    };

    // 解析传输层配置
    const network = params.get('type') as Network | null;
    if (network) {
      config.network = network;
      this.parseTransportSettings(config, params, network);
    }

    // 解析安全配置
    const security = params.get('security') as Security | null;
    if (security) {
      config.security = security;
      if (security === 'tls' || security === 'reality') {
        config.tlsSettings = this.parseTlsSettings(params);
      }
    }

    return config;
  }

  /**
   * 解析传输层配置
   */
  private parseTransportSettings(
    config: ServerConfig,
    params: URLSearchParams,
    network: Network
  ): void {
    switch (network) {
      case 'ws':
        config.wsSettings = this.parseWebSocketSettings(params);
        break;
      case 'grpc':
        config.grpcSettings = this.parseGrpcSettings(params);
        break;
      case 'http':
        config.httpSettings = this.parseHttpSettings(params);
        break;
      case 'tcp':
        // TCP 不需要额外配置
        break;
      default:
        throw new Error(`不支持的传输层类型: ${network}`);
    }
  }

  /**
   * 解析 WebSocket 配置
   */
  private parseWebSocketSettings(params: URLSearchParams): WebSocketSettings {
    const settings: WebSocketSettings = {};

    const path = params.get('path');
    if (path) {
      settings.path = path;
    }

    const host = params.get('host');
    if (host) {
      settings.headers = { Host: host };
    }

    const maxEarlyData = params.get('maxEarlyData');
    if (maxEarlyData) {
      settings.maxEarlyData = parseInt(maxEarlyData);
    }

    const earlyDataHeaderName = params.get('earlyDataHeaderName');
    if (earlyDataHeaderName) {
      settings.earlyDataHeaderName = earlyDataHeaderName;
    }

    return settings;
  }

  /**
   * 解析 gRPC 配置
   */
  private parseGrpcSettings(params: URLSearchParams): GrpcSettings {
    const settings: GrpcSettings = {};

    const serviceName = params.get('serviceName');
    if (serviceName) {
      settings.serviceName = serviceName;
    }

    const multiMode = params.get('mode');
    if (multiMode === 'multi') {
      settings.multiMode = true;
    }

    return settings;
  }

  /**
   * 解析 HTTP 配置
   */
  private parseHttpSettings(params: URLSearchParams): HttpSettings {
    const settings: HttpSettings = {};

    const host = params.get('host');
    if (host) {
      settings.host = host.split(',');
    }

    const path = params.get('path');
    if (path) {
      settings.path = path;
    }

    const method = params.get('method');
    if (method) {
      settings.method = method;
    }

    return settings;
  }

  /**
   * 解析 TLS 配置
   */
  private parseTlsSettings(params: URLSearchParams): TlsSettings {
    const settings: TlsSettings = {};

    // SNI / Server Name
    const sni = params.get('sni') || params.get('host');
    if (sni) {
      settings.serverName = sni;
    }

    // Allow Insecure
    const allowInsecure = params.get('allowInsecure');
    if (allowInsecure !== null) {
      settings.allowInsecure = allowInsecure === '1' || allowInsecure === 'true';
    }

    // ALPN
    const alpn = params.get('alpn');
    if (alpn) {
      settings.alpn = alpn.split(',');
    }

    // Fingerprint
    const fingerprint = params.get('fp') || params.get('fingerprint');
    if (fingerprint) {
      settings.fingerprint = fingerprint;
    }

    return settings;
  }

  /**
   * 将服务器配置生成为分享 URL
   */
  generateUrl(config: ServerConfig): string {
    if (config.protocol === 'vless') {
      return this.generateVlessUrl(config);
    } else if (config.protocol === 'trojan') {
      return this.generateTrojanUrl(config);
    }
    throw new Error(`不支持的协议: ${config.protocol}`);
  }

  /**
   * 生成 VLESS URL
   */
  private generateVlessUrl(config: ServerConfig): string {
    const params = new URLSearchParams();

    // 加密方式
    if (config.encryption) {
      params.set('encryption', config.encryption);
    }

    // Flow
    if (config.flow) {
      params.set('flow', config.flow);
    }

    // 传输层配置
    this.appendTransportParams(params, config);

    // 安全配置
    this.appendSecurityParams(params, config);

    const name = encodeURIComponent(config.name || `${config.address}:${config.port}`);
    return `vless://${config.uuid}@${config.address}:${config.port}?${params.toString()}#${name}`;
  }

  /**
   * 生成 Trojan URL
   */
  private generateTrojanUrl(config: ServerConfig): string {
    const params = new URLSearchParams();

    // 传输层配置
    this.appendTransportParams(params, config);

    // 安全配置
    this.appendSecurityParams(params, config);

    const name = encodeURIComponent(config.name || `${config.address}:${config.port}`);
    const password = encodeURIComponent(config.password || '');
    return `trojan://${password}@${config.address}:${config.port}?${params.toString()}#${name}`;
  }

  /**
   * 添加传输层参数
   */
  private appendTransportParams(params: URLSearchParams, config: ServerConfig): void {
    if (config.network) {
      params.set('type', config.network);
    }

    // WebSocket 配置
    if (config.network === 'ws' && config.wsSettings) {
      if (config.wsSettings.path) {
        params.set('path', config.wsSettings.path);
      }
      if (config.wsSettings.headers?.Host) {
        params.set('host', config.wsSettings.headers.Host);
      }
      if (config.wsSettings.maxEarlyData) {
        params.set('maxEarlyData', config.wsSettings.maxEarlyData.toString());
      }
      if (config.wsSettings.earlyDataHeaderName) {
        params.set('earlyDataHeaderName', config.wsSettings.earlyDataHeaderName);
      }
    }

    // gRPC 配置
    if (config.network === 'grpc' && config.grpcSettings) {
      if (config.grpcSettings.serviceName) {
        params.set('serviceName', config.grpcSettings.serviceName);
      }
      if (config.grpcSettings.multiMode) {
        params.set('mode', 'multi');
      }
    }

    // HTTP 配置
    if (config.network === 'http' && config.httpSettings) {
      if (config.httpSettings.host) {
        params.set('host', config.httpSettings.host.join(','));
      }
      if (config.httpSettings.path) {
        params.set('path', config.httpSettings.path);
      }
      if (config.httpSettings.method) {
        params.set('method', config.httpSettings.method);
      }
    }
  }

  /**
   * 添加安全参数
   */
  private appendSecurityParams(params: URLSearchParams, config: ServerConfig): void {
    if (config.security) {
      params.set('security', config.security);
    }

    if (config.tlsSettings) {
      if (config.tlsSettings.serverName) {
        params.set('sni', config.tlsSettings.serverName);
      }
      if (config.tlsSettings.allowInsecure) {
        params.set('allowInsecure', '1');
      }
      if (config.tlsSettings.alpn && config.tlsSettings.alpn.length > 0) {
        params.set('alpn', config.tlsSettings.alpn.join(','));
      }
      if (config.tlsSettings.fingerprint) {
        params.set('fp', config.tlsSettings.fingerprint);
      }
    }
  }
}
