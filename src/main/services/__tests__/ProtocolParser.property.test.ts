/**
 * ProtocolParser 属性测试
 * 使用 fast-check 进行基于属性的测试
 */

import * as fc from 'fast-check';
import { ProtocolParser } from '../ProtocolParser';

// ============================================================================
// 生成器 (Generators)
// ============================================================================

/**
 * 生成有效的 VLESS URL 参数
 */
const vlessParamsArbitrary = () => {
  return fc.record({
    uuid: fc.uuid(),
    address: fc.domain(),
    port: fc.integer({ min: 1, max: 65535 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    encryption: fc.option(fc.constantFrom('none', 'auto', 'aes-128-gcm'), { nil: undefined }),
    flow: fc.option(fc.constantFrom('xtls-rprx-vision', 'xtls-rprx-vision-udp443'), {
      nil: undefined,
    }),
    network: fc.option(fc.constantFrom('tcp', 'ws', 'grpc', 'http'), { nil: undefined }),
    security: fc.option(fc.constantFrom('none', 'tls', 'reality'), { nil: undefined }),
    // WebSocket 参数
    wsPath: fc.option(
      fc.string({ minLength: 1, maxLength: 50 }).map((s) => `/${s}`),
      { nil: undefined }
    ),
    wsHost: fc.option(fc.domain(), { nil: undefined }),
    // TLS 参数
    sni: fc.option(fc.domain(), { nil: undefined }),
    allowInsecure: fc.option(fc.boolean(), { nil: undefined }),
    alpn: fc.option(fc.array(fc.constantFrom('h2', 'http/1.1'), { minLength: 1, maxLength: 2 }), {
      nil: undefined,
    }),
    fingerprint: fc.option(fc.constantFrom('chrome', 'firefox', 'safari', 'edge'), {
      nil: undefined,
    }),
  });
};

/**
 * 生成有效的 Trojan URL 参数
 */
const trojanParamsArbitrary = () => {
  return fc.record({
    // 密码使用字母数字字符，避免 URL 特殊字符
    password: fc
      .stringMatching(/^[a-zA-Z0-9_\-\.]+$/)
      .filter((s) => s.length >= 1 && s.length <= 100),
    address: fc.domain(),
    port: fc.integer({ min: 1, max: 65535 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    network: fc.option(fc.constantFrom('tcp', 'ws', 'grpc', 'http'), { nil: undefined }),
    security: fc.option(fc.constantFrom('none', 'tls', 'reality'), { nil: undefined }),
    // WebSocket 参数
    wsPath: fc.option(
      fc.string({ minLength: 1, maxLength: 50 }).map((s) => `/${s}`),
      { nil: undefined }
    ),
    wsHost: fc.option(fc.domain(), { nil: undefined }),
    // TLS 参数
    sni: fc.option(fc.domain(), { nil: undefined }),
    allowInsecure: fc.option(fc.boolean(), { nil: undefined }),
    alpn: fc.option(fc.array(fc.constantFrom('h2', 'http/1.1'), { minLength: 1, maxLength: 2 }), {
      nil: undefined,
    }),
    fingerprint: fc.option(fc.constantFrom('chrome', 'firefox', 'safari', 'edge'), {
      nil: undefined,
    }),
  });
};

// ============================================================================
// URL 构建辅助函数
// ============================================================================

/**
 * 构建 VLESS URL
 */
function buildVlessUrl(
  params: ReturnType<typeof vlessParamsArbitrary> extends fc.Arbitrary<infer T> ? T : never
): string {
  const searchParams = new URLSearchParams();

  if (params.encryption) searchParams.set('encryption', params.encryption);
  if (params.flow) searchParams.set('flow', params.flow);
  if (params.network) searchParams.set('type', params.network);
  if (params.security) searchParams.set('security', params.security);

  // WebSocket 参数
  if (params.network === 'ws') {
    if (params.wsPath) searchParams.set('path', params.wsPath);
    if (params.wsHost) searchParams.set('host', params.wsHost);
  }

  // TLS 参数
  if (params.security === 'tls' || params.security === 'reality') {
    if (params.sni) searchParams.set('sni', params.sni);
    if (params.allowInsecure !== undefined)
      searchParams.set('allowInsecure', params.allowInsecure ? '1' : '0');
    if (params.alpn) searchParams.set('alpn', params.alpn.join(','));
    if (params.fingerprint) searchParams.set('fp', params.fingerprint);
  }

  const query = searchParams.toString();
  const hash = encodeURIComponent(params.name);

  return `vless://${params.uuid}@${params.address}:${params.port}${query ? '?' + query : ''}#${hash}`;
}

/**
 * 构建 Trojan URL
 */
function buildTrojanUrl(
  params: ReturnType<typeof trojanParamsArbitrary> extends fc.Arbitrary<infer T> ? T : never
): string {
  const searchParams = new URLSearchParams();

  if (params.network) searchParams.set('type', params.network);
  if (params.security) searchParams.set('security', params.security);

  // WebSocket 参数
  if (params.network === 'ws') {
    if (params.wsPath) searchParams.set('path', params.wsPath);
    if (params.wsHost) searchParams.set('host', params.wsHost);
  }

  // TLS 参数
  if (params.security === 'tls' || params.security === 'reality') {
    if (params.sni) searchParams.set('sni', params.sni);
    if (params.allowInsecure !== undefined)
      searchParams.set('allowInsecure', params.allowInsecure ? '1' : '0');
    if (params.alpn) searchParams.set('alpn', params.alpn.join(','));
    if (params.fingerprint) searchParams.set('fp', params.fingerprint);
  }

  const query = searchParams.toString();
  const hash = encodeURIComponent(params.name);

  return `trojan://${params.password}@${params.address}:${params.port}${query ? '?' + query : ''}#${hash}`;
}

// ============================================================================
// 属性测试
// ============================================================================

describe('ProtocolParser Property Tests', () => {
  let parser: ProtocolParser;

  beforeEach(() => {
    parser = new ProtocolParser();
  });

  /**
   * 属性 25: VLESS URL 解析正确性
   * 对于任何有效的 VLESS 协议 URL，解析后的服务器配置应该包含所有必需字段（address、port、uuid），
   * 并且字段值应该与 URL 中的参数匹配。
   *
   * Feature: electron-cross-platform, Property 25: VLESS URL 解析正确性
   * Validates: Requirements 8.1
   */
  describe('Property 25: VLESS URL parsing correctness', () => {
    it('should parse VLESS URL and extract all required fields correctly', async () => {
      await fc.assert(
        fc.property(vlessParamsArbitrary(), (params) => {
          const url = buildVlessUrl(params);
          const config = parser.parseUrl(url);

          // 验证协议
          expect(config.protocol).toBe('vless');

          // 验证必需字段
          expect(config.address).toBe(params.address);
          expect(config.port).toBe(params.port);
          expect(config.uuid).toBe(params.uuid);

          // 验证名称
          expect(config.name).toBe(params.name);

          // 验证可选字段
          if (params.encryption) {
            expect(config.encryption).toBe(params.encryption);
          }
          if (params.flow) {
            expect(config.flow).toBe(params.flow);
          }
          if (params.network) {
            expect(config.network).toBe(params.network);
          }
          if (params.security) {
            expect(config.security).toBe(params.security);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should generate unique IDs for each parsed server', async () => {
      await fc.assert(
        fc.property(vlessParamsArbitrary(), (params) => {
          const url = buildVlessUrl(params);
          const config1 = parser.parseUrl(url);
          const config2 = parser.parseUrl(url);

          // 每次解析应该生成不同的 ID
          expect(config1.id).not.toBe(config2.id);

          // 但其他字段应该相同
          expect(config1.address).toBe(config2.address);
          expect(config1.port).toBe(config2.port);
          expect(config1.uuid).toBe(config2.uuid);
        }),
        { numRuns: 50 }
      );
    });

    it('should use default name when hash is missing', async () => {
      await fc.assert(
        fc.property(
          fc.uuid(),
          fc.domain(),
          fc.integer({ min: 1, max: 65535 }),
          (uuid, address, port) => {
            const url = `vless://${uuid}@${address}:${port}`;
            const config = parser.parseUrl(url);

            // 应该使用 address:port 作为默认名称
            expect(config.name).toBe(`${address}:${port}`);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle URLs with minimal parameters', async () => {
      await fc.assert(
        fc.property(
          fc.uuid(),
          fc.domain(),
          fc.integer({ min: 1, max: 65535 }),
          (uuid, address, port) => {
            const url = `vless://${uuid}@${address}:${port}`;
            const config = parser.parseUrl(url);

            expect(config.protocol).toBe('vless');
            expect(config.address).toBe(address);
            expect(config.port).toBe(port);
            expect(config.uuid).toBe(uuid);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject VLESS URLs without UUID', () => {
      const invalidUrls = ['vless://@example.com:443', 'vless://example.com:443'];

      for (const url of invalidUrls) {
        expect(() => parser.parseUrl(url)).toThrow();
      }
    });
  });

  /**
   * 属性 26: Trojan URL 解析正确性
   * 对于任何有效的 Trojan 协议 URL，解析后的服务器配置应该包含所有必需字段（address、port、password），
   * 并且字段值应该与 URL 中的参数匹配。
   *
   * Feature: electron-cross-platform, Property 26: Trojan URL 解析正确性
   * Validates: Requirements 8.2
   */
  describe('Property 26: Trojan URL parsing correctness', () => {
    it('should parse Trojan URL and extract all required fields correctly', async () => {
      await fc.assert(
        fc.property(trojanParamsArbitrary(), (params) => {
          const url = buildTrojanUrl(params);
          const config = parser.parseUrl(url);

          // 验证协议
          expect(config.protocol).toBe('trojan');

          // 验证必需字段
          expect(config.address).toBe(params.address);
          expect(config.port).toBe(params.port);
          expect(config.password).toBe(params.password);

          // 验证名称
          expect(config.name).toBe(params.name);

          // 验证可选字段
          if (params.network) {
            expect(config.network).toBe(params.network);
          }
          if (params.security) {
            expect(config.security).toBe(params.security);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should generate unique IDs for each parsed server', async () => {
      await fc.assert(
        fc.property(trojanParamsArbitrary(), (params) => {
          const url = buildTrojanUrl(params);
          const config1 = parser.parseUrl(url);
          const config2 = parser.parseUrl(url);

          // 每次解析应该生成不同的 ID
          expect(config1.id).not.toBe(config2.id);

          // 但其他字段应该相同
          expect(config1.address).toBe(config2.address);
          expect(config1.port).toBe(config2.port);
          expect(config1.password).toBe(config2.password);
        }),
        { numRuns: 50 }
      );
    });

    it('should use default name when hash is missing', async () => {
      await fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9_\-\.]+$/).filter((s) => s.length >= 1 && s.length <= 100),
          fc.domain(),
          fc.integer({ min: 1, max: 65535 }),
          (password, address, port) => {
            const url = `trojan://${password}@${address}:${port}`;
            const config = parser.parseUrl(url);

            // 应该使用 address:port 作为默认名称
            expect(config.name).toBe(`${address}:${port}`);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle URLs with minimal parameters', async () => {
      await fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9_\-\.]+$/).filter((s) => s.length >= 1 && s.length <= 100),
          fc.domain(),
          fc.integer({ min: 1, max: 65535 }),
          (password, address, port) => {
            const url = `trojan://${password}@${address}:${port}`;
            const config = parser.parseUrl(url);

            expect(config.protocol).toBe('trojan');
            expect(config.address).toBe(address);
            expect(config.port).toBe(port);
            expect(config.password).toBe(password);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject Trojan URLs without password', () => {
      const invalidUrls = ['trojan://@example.com:443', 'trojan://example.com:443'];

      for (const url of invalidUrls) {
        expect(() => parser.parseUrl(url)).toThrow();
      }
    });
  });

  /**
   * 属性 27: 传输层配置解析
   * 对于任何包含传输层配置的协议 URL（WebSocket、gRPC），
   * 解析后的配置应该包含对应的传输设置（path、headers 等）。
   *
   * Feature: electron-cross-platform, Property 27: 传输层配置解析
   * Validates: Requirements 8.4
   */
  describe('Property 27: Transport layer configuration parsing', () => {
    it('should parse WebSocket settings correctly for VLESS', async () => {
      await fc.assert(
        fc.property(vlessParamsArbitrary(), (params) => {
          // 强制使用 WebSocket
          const wsParams = { ...params, network: 'ws' as const };
          const url = buildVlessUrl(wsParams);
          const config = parser.parseUrl(url);

          expect(config.network).toBe('ws');

          if (wsParams.wsPath || wsParams.wsHost) {
            expect(config.wsSettings).toBeDefined();

            if (wsParams.wsPath) {
              expect(config.wsSettings?.path).toBe(wsParams.wsPath);
            }

            if (wsParams.wsHost) {
              expect(config.wsSettings?.headers).toBeDefined();
              expect(config.wsSettings?.headers?.Host).toBe(wsParams.wsHost);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should parse WebSocket settings correctly for Trojan', async () => {
      await fc.assert(
        fc.property(trojanParamsArbitrary(), (params) => {
          // 强制使用 WebSocket
          const wsParams = { ...params, network: 'ws' as const };
          const url = buildTrojanUrl(wsParams);
          const config = parser.parseUrl(url);

          expect(config.network).toBe('ws');

          if (wsParams.wsPath || wsParams.wsHost) {
            expect(config.wsSettings).toBeDefined();

            if (wsParams.wsPath) {
              expect(config.wsSettings?.path).toBe(wsParams.wsPath);
            }

            if (wsParams.wsHost) {
              expect(config.wsSettings?.headers).toBeDefined();
              expect(config.wsSettings?.headers?.Host).toBe(wsParams.wsHost);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle TCP transport without extra settings', async () => {
      await fc.assert(
        fc.property(vlessParamsArbitrary(), (params) => {
          const tcpParams = { ...params, network: 'tcp' as const };
          const url = buildVlessUrl(tcpParams);
          const config = parser.parseUrl(url);

          expect(config.network).toBe('tcp');
          expect(config.wsSettings).toBeUndefined();
          expect(config.grpcSettings).toBeUndefined();
          expect(config.httpSettings).toBeUndefined();
        }),
        { numRuns: 50 }
      );
    });

    it('should parse gRPC settings when serviceName is provided', () => {
      const url = 'vless://uuid@example.com:443?type=grpc&serviceName=myservice#test';
      const config = parser.parseUrl(url);

      expect(config.network).toBe('grpc');
      expect(config.grpcSettings).toBeDefined();
      expect(config.grpcSettings?.serviceName).toBe('myservice');
    });

    it('should parse HTTP settings when host and path are provided', () => {
      const url = 'vless://uuid@example.com:443?type=http&host=example.com&path=/path#test';
      const config = parser.parseUrl(url);

      expect(config.network).toBe('http');
      expect(config.httpSettings).toBeDefined();
      expect(config.httpSettings?.host).toEqual(['example.com']);
      expect(config.httpSettings?.path).toBe('/path');
    });
  });

  /**
   * 属性 28: TLS 配置解析
   * 对于任何包含 TLS 配置的协议 URL，解析后的配置应该包含 TLS 设置（serverName、allowInsecure 等）。
   *
   * Feature: electron-cross-platform, Property 28: TLS 配置解析
   * Validates: Requirements 8.5
   */
  describe('Property 28: TLS configuration parsing', () => {
    it('should parse TLS settings correctly for VLESS', async () => {
      await fc.assert(
        fc.property(vlessParamsArbitrary(), (params) => {
          // 强制使用 TLS
          const tlsParams = { ...params, security: 'tls' as const };
          const url = buildVlessUrl(tlsParams);
          const config = parser.parseUrl(url);

          expect(config.security).toBe('tls');
          expect(config.tlsSettings).toBeDefined();

          if (tlsParams.sni) {
            expect(config.tlsSettings?.serverName).toBe(tlsParams.sni);
          }

          if (tlsParams.allowInsecure !== undefined) {
            expect(config.tlsSettings?.allowInsecure).toBe(tlsParams.allowInsecure);
          }

          if (tlsParams.alpn) {
            expect(config.tlsSettings?.alpn).toEqual(tlsParams.alpn);
          }

          if (tlsParams.fingerprint) {
            expect(config.tlsSettings?.fingerprint).toBe(tlsParams.fingerprint);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should parse TLS settings correctly for Trojan', async () => {
      await fc.assert(
        fc.property(trojanParamsArbitrary(), (params) => {
          // 强制使用 TLS
          const tlsParams = { ...params, security: 'tls' as const };
          const url = buildTrojanUrl(tlsParams);
          const config = parser.parseUrl(url);

          expect(config.security).toBe('tls');
          expect(config.tlsSettings).toBeDefined();

          if (tlsParams.sni) {
            expect(config.tlsSettings?.serverName).toBe(tlsParams.sni);
          }

          if (tlsParams.allowInsecure !== undefined) {
            expect(config.tlsSettings?.allowInsecure).toBe(tlsParams.allowInsecure);
          }

          if (tlsParams.alpn) {
            expect(config.tlsSettings?.alpn).toEqual(tlsParams.alpn);
          }

          if (tlsParams.fingerprint) {
            expect(config.tlsSettings?.fingerprint).toBe(tlsParams.fingerprint);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not include TLS settings when security is none', async () => {
      await fc.assert(
        fc.property(vlessParamsArbitrary(), (params) => {
          const noTlsParams = { ...params, security: 'none' as const };
          const url = buildVlessUrl(noTlsParams);
          const config = parser.parseUrl(url);

          expect(config.security).toBe('none');
          expect(config.tlsSettings).toBeUndefined();
        }),
        { numRuns: 50 }
      );
    });

    it('should parse allowInsecure flag correctly', () => {
      const urlTrue = 'vless://uuid@example.com:443?security=tls&allowInsecure=1#test';
      const configTrue = parser.parseUrl(urlTrue);
      expect(configTrue.tlsSettings?.allowInsecure).toBe(true);

      const urlFalse = 'vless://uuid@example.com:443?security=tls&allowInsecure=0#test';
      const configFalse = parser.parseUrl(urlFalse);
      expect(configFalse.tlsSettings?.allowInsecure).toBe(false);
    });

    it('should parse ALPN as array', () => {
      const url = 'vless://uuid@example.com:443?security=tls&alpn=h2,http/1.1#test';
      const config = parser.parseUrl(url);

      expect(config.tlsSettings?.alpn).toEqual(['h2', 'http/1.1']);
    });

    it('should use host parameter as SNI fallback', () => {
      const url = 'vless://uuid@example.com:443?security=tls&host=sni.example.com#test';
      const config = parser.parseUrl(url);

      expect(config.tlsSettings?.serverName).toBe('sni.example.com');
    });
  });

  /**
   * 通用测试：不支持的协议
   */
  describe('Unsupported protocols', () => {
    it('should reject unsupported protocols', () => {
      const unsupportedUrls = [
        'http://example.com',
        'https://example.com',
        'vmess://base64string',
        'ss://base64string',
      ];

      for (const url of unsupportedUrls) {
        expect(() => parser.parseUrl(url)).toThrow();
      }
    });

    it('should correctly identify supported protocols', () => {
      expect(parser.isSupported('vless://uuid@example.com:443')).toBe(true);
      expect(parser.isSupported('trojan://password@example.com:443')).toBe(true);
      expect(parser.isSupported('http://example.com')).toBe(false);
      expect(parser.isSupported('vmess://base64')).toBe(false);
    });
  });

  /**
   * 通用测试：错误处理
   */
  describe('Error handling', () => {
    it('should throw error for malformed URLs', () => {
      const malformedUrls = ['vless://', 'trojan://', 'not-a-url', ''];

      for (const url of malformedUrls) {
        expect(() => parser.parseUrl(url)).toThrow();
      }
    });

    it('should handle special characters in names', async () => {
      await fc.assert(
        fc.property(
          fc.uuid(),
          fc.domain(),
          fc.integer({ min: 1, max: 65535 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (uuid, address, port, name) => {
            const encodedName = encodeURIComponent(name);
            const url = `vless://${uuid}@${address}:${port}#${encodedName}`;
            const config = parser.parseUrl(url);

            expect(config.name).toBe(name);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
