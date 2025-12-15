/**
 * 路由规则管理服务
 * 负责生成 sing-box 路由规则配置
 */

import type { UserConfig, DomainRule } from '../../shared/types';

/**
 * sing-box 路由规则接口
 */
export interface SingBoxRouteRule {
  // 域名匹配
  domain?: string[];
  domain_suffix?: string[];
  domain_keyword?: string[];
  domain_regex?: string[];

  // GeoIP/GeoSite 匹配
  geosite?: string[];
  geoip?: string[];

  // IP 匹配
  ip_cidr?: string[];

  // 端口匹配
  port?: number[];
  port_range?: string[];

  // 协议匹配
  protocol?: string[];

  // 出站标签
  outbound: string;
}

/**
 * sing-box 路由配置接口
 */
export interface SingBoxRouteConfig {
  rules: SingBoxRouteRule[];
  rule_set?: Array<{
    tag: string;
    type: string;
    format: string;
    path?: string;
    url?: string;
  }>;
  final?: string;
  auto_detect_interface?: boolean;
}

export interface IRoutingRuleManager {
  /**
   * 生成路由配置
   */
  generateRouteConfig(config: UserConfig): SingBoxRouteConfig;

  /**
   * 生成全局代理模式规则
   */
  generateGlobalProxyRules(): SingBoxRouteRule[];

  /**
   * 生成智能分流模式规则
   */
  generateSmartRoutingRules(): SingBoxRouteRule[];

  /**
   * 生成直连模式规则
   */
  generateDirectRules(): SingBoxRouteRule[];

  /**
   * 集成自定义域名规则
   */
  integrateCustomRules(customRules: DomainRule[]): SingBoxRouteRule[];
}

export class RoutingRuleManager implements IRoutingRuleManager {
  /**
   * 生成路由配置
   */
  generateRouteConfig(config: UserConfig): SingBoxRouteConfig {
    const rules: SingBoxRouteRule[] = [];

    // 1. 首先添加自定义规则（优先级最高）
    const customRules = this.integrateCustomRules(config.customRules);
    rules.push(...customRules);

    // 2. 根据代理模式添加相应规则
    let modeRules: SingBoxRouteRule[] = [];
    switch (config.proxyMode) {
      case 'global':
        modeRules = this.generateGlobalProxyRules();
        break;
      case 'smart':
        modeRules = this.generateSmartRoutingRules();
        break;
      case 'direct':
        modeRules = this.generateDirectRules();
        break;
    }
    rules.push(...modeRules);

    // 3. 构建完整的路由配置
    const routeConfig: SingBoxRouteConfig = {
      rules,
      auto_detect_interface: true,
    };

    // 4. 设置默认出站
    if (config.proxyMode === 'direct') {
      routeConfig.final = 'direct';
    } else {
      routeConfig.final = 'proxy';
    }

    return routeConfig;
  }

  /**
   * 生成全局代理模式规则
   * 所有流量都通过代理，除了本地地址
   */
  generateGlobalProxyRules(): SingBoxRouteRule[] {
    return [
      // 本地地址直连
      {
        ip_cidr: [
          '127.0.0.0/8',
          '10.0.0.0/8',
          '172.16.0.0/12',
          '192.168.0.0/16',
          '169.254.0.0/16',
          'fc00::/7',
          'fe80::/10',
          '::1/128',
        ],
        outbound: 'direct',
      },
      // 本地域名直连
      {
        domain_suffix: ['localhost', 'local'],
        outbound: 'direct',
      },
    ];
  }

  /**
   * 生成智能分流模式规则
   * 使用 GeoIP 和 GeoSite 进行智能分流
   */
  generateSmartRoutingRules(): SingBoxRouteRule[] {
    return [
      // 本地地址直连
      {
        ip_cidr: [
          '127.0.0.0/8',
          '10.0.0.0/8',
          '172.16.0.0/12',
          '192.168.0.0/16',
          '169.254.0.0/16',
          'fc00::/7',
          'fe80::/10',
          '::1/128',
        ],
        outbound: 'direct',
      },
      // 本地域名直连
      {
        domain_suffix: ['localhost', 'local'],
        outbound: 'direct',
      },
      // 中国大陆域名直连
      {
        geosite: ['cn'],
        outbound: 'direct',
      },
      // 中国大陆 IP 直连
      {
        geoip: ['cn'],
        outbound: 'direct',
      },
      // 国外域名走代理
      {
        geosite: ['geolocation-!cn'],
        outbound: 'proxy',
      },
    ];
  }

  /**
   * 生成直连模式规则
   * 所有流量都直连
   */
  generateDirectRules(): SingBoxRouteRule[] {
    // 直连模式不需要特殊规则，所有流量都走 direct
    return [];
  }

  /**
   * 集成自定义域名规则
   * 将用户自定义的域名规则转换为 sing-box 规则格式
   */
  integrateCustomRules(customRules: DomainRule[]): SingBoxRouteRule[] {
    // 按 action 分组规则
    const rulesByAction = new Map<string, string[]>();

    for (const rule of customRules) {
      // 只处理启用的规则
      if (!rule.enabled) {
        continue;
      }

      const action = rule.action;
      if (!rulesByAction.has(action)) {
        rulesByAction.set(action, []);
      }

      rulesByAction.get(action)!.push(rule.domain);
    }

    // 转换为 sing-box 规则
    const singboxRules: SingBoxRouteRule[] = [];

    for (const [action, domains] of rulesByAction.entries()) {
      if (domains.length === 0) {
        continue;
      }

      // 确定出站标签
      let outbound: string;
      if (action === 'proxy') {
        outbound = 'proxy';
      } else if (action === 'direct') {
        outbound = 'direct';
      } else if (action === 'block') {
        outbound = 'block';
      } else {
        // 未知 action，跳过
        continue;
      }

      // 分类域名规则
      const exactDomains: string[] = [];
      const suffixDomains: string[] = [];
      const keywordDomains: string[] = [];

      for (const domain of domains) {
        if (domain.startsWith('*.')) {
          // 通配符域名，转换为 domain_suffix
          suffixDomains.push(domain.slice(2));
        } else if (domain.includes('*')) {
          // 包含通配符，转换为 domain_keyword
          keywordDomains.push(domain.replace(/\*/g, ''));
        } else {
          // 精确域名
          exactDomains.push(domain);
        }
      }

      // 创建规则
      const rule: SingBoxRouteRule = {
        outbound,
      };

      if (exactDomains.length > 0) {
        rule.domain = exactDomains;
      }
      if (suffixDomains.length > 0) {
        rule.domain_suffix = suffixDomains;
      }
      if (keywordDomains.length > 0) {
        rule.domain_keyword = keywordDomains;
      }

      singboxRules.push(rule);
    }

    return singboxRules;
  }
}
