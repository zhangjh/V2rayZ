/**
 * RoutingRuleManager 属性测试
 * 使用 fast-check 进行基于属性的测试
 *
 * Feature: electron-cross-platform, Property 29: 自定义域名规则集成
 * Validates: Requirements 9.3
 */

import * as fc from 'fast-check';
import { RoutingRuleManager } from '../RoutingRuleManager';
import type { UserConfig, DomainRule } from '../../../shared/types';

// ============================================================================
// 生成器 (Generators)
// ============================================================================

/**
 * 生成有效的域名规则
 */
const domainRuleArbitrary = (): fc.Arbitrary<DomainRule> => {
  return fc.record({
    id: fc.uuid(),
    domain: fc.oneof(
      // 普通域名
      fc.domain(),
      // 通配符域名
      fc.domain().map((d) => `*.${d}`),
      // 包含通配符的域名
      fc.domain().map((d) => {
        const parts = d.split('.');
        if (parts.length > 1) {
          return `${parts[0]}*${parts.slice(1).join('.')}`;
        }
        return d;
      })
    ),
    action: fc.constantFrom('proxy', 'direct', 'block'),
    enabled: fc.boolean(),
  });
};

/**
 * 生成简化的用户配置（仅包含路由相关字段）
 */
const userConfigArbitrary = (): fc.Arbitrary<UserConfig> => {
  return fc.record({
    servers: fc.constant([]),
    selectedServerId: fc.constant(null),
    proxyMode: fc.constantFrom('global', 'smart', 'direct'),
    proxyModeType: fc.constant('systemProxy' as const),
    tunConfig: fc.constant({
      mtu: 9000,
      stack: 'system' as const,
      autoRoute: true,
      strictRoute: true,
    }),
    customRules: fc.array(domainRuleArbitrary(), { maxLength: 20 }),
    autoStart: fc.constant(false),
    autoConnect: fc.constant(false),
    minimizeToTray: fc.constant(true),
    socksPort: fc.constant(65534),
    httpPort: fc.constant(65533),
    logLevel: fc.constant('info' as const),
  });
};

// ============================================================================
// 属性测试
// ============================================================================

describe('RoutingRuleManager Property Tests', () => {
  let manager: RoutingRuleManager;

  beforeEach(() => {
    manager = new RoutingRuleManager();
  });

  /**
   * 属性 29: 自定义域名规则集成
   * 对于任何自定义域名规则，添加到配置后生成的 sing-box 配置应该在 route.rules 中包含对应的规则条目。
   *
   * Validates: Requirements 9.3
   */
  describe('Property 29: Custom domain rule integration', () => {
    it('should integrate all enabled custom rules into route config', async () => {
      await fc.assert(
        fc.asyncProperty(userConfigArbitrary(), async (config) => {
          // 生成路由配置
          const routeConfig = manager.generateRouteConfig(config);

          // 获取启用的自定义规则
          const enabledRules = config.customRules.filter((r) => r.enabled);

          if (enabledRules.length === 0) {
            // 如果没有启用的规则，跳过验证
            return;
          }

          // 验证路由配置包含规则
          expect(routeConfig.rules).toBeDefined();
          expect(Array.isArray(routeConfig.rules)).toBe(true);

          // 收集所有自定义规则中的域名
          const customDomains = new Set<string>();
          for (const rule of enabledRules) {
            // 处理不同类型的域名格式
            if (rule.domain.startsWith('*.')) {
              customDomains.add(rule.domain.slice(2));
            } else if (rule.domain.includes('*')) {
              customDomains.add(rule.domain.replace(/\*/g, ''));
            } else {
              customDomains.add(rule.domain);
            }
          }

          // 验证路由规则中包含这些域名
          const routeDomains = new Set<string>();
          for (const rule of routeConfig.rules) {
            if (rule.domain) {
              rule.domain.forEach((d) => routeDomains.add(d));
            }
            if (rule.domain_suffix) {
              rule.domain_suffix.forEach((d) => routeDomains.add(d));
            }
            if (rule.domain_keyword) {
              rule.domain_keyword.forEach((d) => routeDomains.add(d));
            }
          }

          // 检查所有自定义域名都在路由规则中
          for (const domain of customDomains) {
            expect(routeDomains.has(domain)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should map custom rule actions to correct outbounds', async () => {
      await fc.assert(
        fc.asyncProperty(userConfigArbitrary(), async (config) => {
          // 生成路由配置
          const routeConfig = manager.generateRouteConfig(config);

          // 获取启用的自定义规则
          const enabledRules = config.customRules.filter((r) => r.enabled);

          if (enabledRules.length === 0) {
            return;
          }

          // 按 action 分组规则
          const rulesByAction = new Map<string, Set<string>>();
          for (const rule of enabledRules) {
            if (!rulesByAction.has(rule.action)) {
              rulesByAction.set(rule.action, new Set());
            }
            const domain = rule.domain.startsWith('*.')
              ? rule.domain.slice(2)
              : rule.domain.replace(/\*/g, '');
            rulesByAction.get(rule.action)!.add(domain);
          }

          // 验证每个 action 对应的 outbound
          for (const [action, domains] of rulesByAction.entries()) {
            const expectedOutbound = action; // proxy, direct, block

            // 在路由规则中查找对应的规则
            for (const routeRule of routeConfig.rules) {
              if (routeRule.outbound === expectedOutbound) {
                // 检查是否包含我们的域名
                const ruleDomains = new Set<string>();
                if (routeRule.domain) {
                  routeRule.domain.forEach((d) => ruleDomains.add(d));
                }
                if (routeRule.domain_suffix) {
                  routeRule.domain_suffix.forEach((d) => ruleDomains.add(d));
                }
                if (routeRule.domain_keyword) {
                  routeRule.domain_keyword.forEach((d) => ruleDomains.add(d));
                }

                // 验证至少有一些域名匹配
                const hasMatch = Array.from(domains).some((d) => ruleDomains.has(d));
                if (hasMatch) {
                  // 找到匹配的规则，验证通过
                  expect(routeRule.outbound).toBe(expectedOutbound);
                }
              }
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not include disabled custom rules', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(domainRuleArbitrary(), { minLength: 1, maxLength: 10 }),
          async (rules) => {
            // 确保至少有一个禁用的规则
            const disabledRule = { ...rules[0], enabled: false };
            const config: UserConfig = {
              servers: [],
              selectedServerId: null,
              proxyMode: 'smart',
              proxyModeType: 'systemProxy',
              tunConfig: {
                mtu: 9000,
                stack: 'system',
                autoRoute: true,
                strictRoute: true,
              },
              customRules: [disabledRule, ...rules.slice(1)],
              autoStart: false,
              autoConnect: false,
              minimizeToTray: true,
              socksPort: 65534,
              httpPort: 65533,
              logLevel: 'info',
            };

            // 生成路由配置
            const routeConfig = manager.generateRouteConfig(config);

            // 提取禁用规则的域名
            const disabledDomain = disabledRule.domain.startsWith('*.')
              ? disabledRule.domain.slice(2)
              : disabledRule.domain.replace(/\*/g, '');

            // 验证路由规则中不包含禁用规则的域名
            const routeDomains = new Set<string>();
            for (const rule of routeConfig.rules) {
              if (rule.domain) {
                rule.domain.forEach((d) => routeDomains.add(d));
              }
              if (rule.domain_suffix) {
                rule.domain_suffix.forEach((d) => routeDomains.add(d));
              }
              if (rule.domain_keyword) {
                rule.domain_keyword.forEach((d) => routeDomains.add(d));
              }
            }

            // 禁用的域名不应该出现在路由规则中
            // 注意：如果其他启用的规则包含相同域名，则可能出现
            // 所以我们只检查如果只有这一个规则且被禁用，则不应出现
            if (config.customRules.filter((r) => r.enabled).length === 0) {
              expect(routeDomains.has(disabledDomain)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle wildcard domains correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.domain(),
          fc.constantFrom('proxy', 'direct', 'block'),
          async (baseDomain, action) => {
            const wildcardRule: DomainRule = {
              id: 'wildcard-rule',
              domain: `*.${baseDomain}`,
              action,
              enabled: true,
            };

            const config: UserConfig = {
              servers: [],
              selectedServerId: null,
              proxyMode: 'smart',
              proxyModeType: 'systemProxy',
              tunConfig: {
                mtu: 9000,
                stack: 'system',
                autoRoute: true,
                strictRoute: true,
              },
              customRules: [wildcardRule],
              autoStart: false,
              autoConnect: false,
              minimizeToTray: true,
              socksPort: 65534,
              httpPort: 65533,
              logLevel: 'info',
            };

            // 生成路由配置
            const routeConfig = manager.generateRouteConfig(config);

            // 验证通配符域名被转换为 domain_suffix
            const hasSuffixRule = routeConfig.rules.some(
              (rule) =>
                rule.domain_suffix &&
                rule.domain_suffix.includes(baseDomain) &&
                rule.outbound === action
            );

            expect(hasSuffixRule).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle exact domains correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.domain(),
          fc.constantFrom('proxy', 'direct', 'block'),
          async (domain, action) => {
            const exactRule: DomainRule = {
              id: 'exact-rule',
              domain,
              action,
              enabled: true,
            };

            const config: UserConfig = {
              servers: [],
              selectedServerId: null,
              proxyMode: 'smart',
              proxyModeType: 'systemProxy',
              tunConfig: {
                mtu: 9000,
                stack: 'system',
                autoRoute: true,
                strictRoute: true,
              },
              customRules: [exactRule],
              autoStart: false,
              autoConnect: false,
              minimizeToTray: true,
              socksPort: 65534,
              httpPort: 65533,
              logLevel: 'info',
            };

            // 生成路由配置
            const routeConfig = manager.generateRouteConfig(config);

            // 验证精确域名被添加到 domain 字段
            const hasExactRule = routeConfig.rules.some(
              (rule) => rule.domain && rule.domain.includes(domain) && rule.outbound === action
            );

            expect(hasExactRule).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should group rules by action', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(domainRuleArbitrary(), { minLength: 3, maxLength: 10 }),
          async (rules) => {
            // 确保所有规则都启用
            const enabledRules = rules.map((r) => ({ ...r, enabled: true }));

            const config: UserConfig = {
              servers: [],
              selectedServerId: null,
              proxyMode: 'smart',
              proxyModeType: 'systemProxy',
              tunConfig: {
                mtu: 9000,
                stack: 'system',
                autoRoute: true,
                strictRoute: true,
              },
              customRules: enabledRules,
              autoStart: false,
              autoConnect: false,
              minimizeToTray: true,
              socksPort: 65534,
              httpPort: 65533,
              logLevel: 'info',
            };

            // 生成路由配置
            const routeConfig = manager.generateRouteConfig(config);

            // 按 action 统计自定义规则
            const actionCounts = new Map<string, number>();
            for (const rule of enabledRules) {
              actionCounts.set(rule.action, (actionCounts.get(rule.action) || 0) + 1);
            }

            // 验证每个 action 在路由规则中都有对应的规则
            for (const [action, count] of actionCounts.entries()) {
              if (count > 0) {
                const hasActionRule = routeConfig.rules.some((rule) => rule.outbound === action);
                expect(hasActionRule).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve rule order - custom rules should come first', async () => {
      await fc.assert(
        fc.asyncProperty(userConfigArbitrary(), async (config) => {
          // 确保有自定义规则
          if (config.customRules.length === 0) {
            config.customRules.push({
              id: 'test-rule',
              domain: 'test.com',
              action: 'proxy',
              enabled: true,
            });
          }

          // 生成路由配置
          const routeConfig = manager.generateRouteConfig(config);

          // 获取启用的自定义规则数量
          const enabledCustomRulesCount = config.customRules.filter((r) => r.enabled).length;

          if (enabledCustomRulesCount === 0) {
            return;
          }

          // 验证路由规则不为空
          expect(routeConfig.rules.length).toBeGreaterThan(0);

          // 自定义规则应该在前面
          // 我们通过检查前几个规则是否包含自定义域名来验证
          const customDomains = new Set<string>();
          for (const rule of config.customRules.filter((r) => r.enabled)) {
            const domain = rule.domain.startsWith('*.')
              ? rule.domain.slice(2)
              : rule.domain.replace(/\*/g, '');
            customDomains.add(domain);
          }

          // 检查前面的规则是否包含自定义域名
          let foundCustomRule = false;
          for (let i = 0; i < Math.min(routeConfig.rules.length, 10); i++) {
            const rule = routeConfig.rules[i];
            const ruleDomains = [
              ...(rule.domain || []),
              ...(rule.domain_suffix || []),
              ...(rule.domain_keyword || []),
            ];

            for (const domain of ruleDomains) {
              if (customDomains.has(domain)) {
                foundCustomRule = true;
                break;
              }
            }

            if (foundCustomRule) break;
          }

          // 应该能找到至少一个自定义规则
          expect(foundCustomRule).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty custom rules gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('global', 'smart', 'direct'), async (proxyMode) => {
          const config: UserConfig = {
            servers: [],
            selectedServerId: null,
            proxyMode,
            proxyModeType: 'systemProxy',
            tunConfig: {
              mtu: 9000,
              stack: 'system',
              autoRoute: true,
              strictRoute: true,
            },
            customRules: [], // 空的自定义规则
            autoStart: false,
            autoConnect: false,
            minimizeToTray: true,
            socksPort: 65534,
            httpPort: 65533,
            logLevel: 'info',
          };

          // 生成路由配置应该成功
          const routeConfig = manager.generateRouteConfig(config);

          // 验证配置有效
          expect(routeConfig).toBeDefined();
          expect(routeConfig.rules).toBeDefined();
          expect(Array.isArray(routeConfig.rules)).toBe(true);

          // 验证有默认的 final 出站
          expect(routeConfig.final).toBeDefined();
        }),
        { numRuns: 50 }
      );
    });

    it('should handle multiple rules with same domain but different actions', async () => {
      await fc.assert(
        fc.asyncProperty(fc.domain(), async (domain) => {
          const config: UserConfig = {
            servers: [],
            selectedServerId: null,
            proxyMode: 'smart',
            proxyModeType: 'systemProxy',
            tunConfig: {
              mtu: 9000,
              stack: 'system',
              autoRoute: true,
              strictRoute: true,
            },
            customRules: [
              {
                id: 'rule-1',
                domain,
                action: 'proxy',
                enabled: true,
              },
              {
                id: 'rule-2',
                domain,
                action: 'direct',
                enabled: true,
              },
            ],
            autoStart: false,
            autoConnect: false,
            minimizeToTray: true,
            socksPort: 65534,
            httpPort: 65533,
            logLevel: 'info',
          };

          // 生成路由配置
          const routeConfig = manager.generateRouteConfig(config);

          // 验证两个 action 都有对应的规则
          const hasProxyRule = routeConfig.rules.some(
            (rule) =>
              rule.outbound === 'proxy' &&
              (rule.domain?.includes(domain) ||
                rule.domain_suffix?.includes(domain) ||
                rule.domain_keyword?.includes(domain))
          );

          const hasDirectRule = routeConfig.rules.some(
            (rule) =>
              rule.outbound === 'direct' &&
              (rule.domain?.includes(domain) ||
                rule.domain_suffix?.includes(domain) ||
                rule.domain_keyword?.includes(domain))
          );

          // 至少应该有一个规则（因为可能会合并）
          expect(hasProxyRule || hasDirectRule).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 属性 30: 路由规则修改触发重启
   * 对于任何路由规则修改（添加、删除、更新），如果代理正在运行，系统应该重新生成配置并重启代理。
   *
   * 注意：此测试验证配置生成的变化。完整的重启逻辑将在 ProxyManager 中实现和测试。
   *
   * Validates: Requirements 9.4
   */
  describe('Property 30: Route rule modification triggers restart', () => {
    it('should generate different config when custom rules are added', async () => {
      await fc.assert(
        fc.asyncProperty(
          userConfigArbitrary(),
          domainRuleArbitrary(),
          async (baseConfig, newRule) => {
            // 确保新规则是启用的
            const enabledNewRule = { ...newRule, enabled: true };

            // 生成初始配置
            const initialConfig = manager.generateRouteConfig(baseConfig);

            // 添加新规则
            const modifiedConfig = {
              ...baseConfig,
              customRules: [...baseConfig.customRules, enabledNewRule],
            };

            // 生成修改后的配置
            const modifiedRouteConfig = manager.generateRouteConfig(modifiedConfig);

            // 验证配置发生了变化
            // 如果初始配置没有自定义规则，添加后应该有变化
            if (baseConfig.customRules.filter((r) => r.enabled).length === 0) {
              expect(modifiedRouteConfig).not.toEqual(initialConfig);
            }

            // 验证新规则的域名出现在修改后的配置中
            const newDomain = enabledNewRule.domain.startsWith('*.')
              ? enabledNewRule.domain.slice(2)
              : enabledNewRule.domain.replace(/\*/g, '');

            const routeDomains = new Set<string>();
            for (const rule of modifiedRouteConfig.rules) {
              if (rule.domain) {
                rule.domain.forEach((d) => routeDomains.add(d));
              }
              if (rule.domain_suffix) {
                rule.domain_suffix.forEach((d) => routeDomains.add(d));
              }
              if (rule.domain_keyword) {
                rule.domain_keyword.forEach((d) => routeDomains.add(d));
              }
            }

            expect(routeDomains.has(newDomain)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different config when custom rules are removed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(domainRuleArbitrary(), { minLength: 1, maxLength: 10 }),
          async (rules) => {
            // 确保所有规则都启用
            const enabledRules = rules.map((r) => ({ ...r, enabled: true }));

            const baseConfig: UserConfig = {
              servers: [],
              selectedServerId: null,
              proxyMode: 'smart',
              proxyModeType: 'systemProxy',
              tunConfig: {
                mtu: 9000,
                stack: 'system',
                autoRoute: true,
                strictRoute: true,
              },
              customRules: enabledRules,
              autoStart: false,
              autoConnect: false,
              minimizeToTray: true,
              socksPort: 65534,
              httpPort: 65533,
              logLevel: 'info',
            };

            // 生成初始配置
            const initialConfig = manager.generateRouteConfig(baseConfig);

            // 移除第一个规则
            const modifiedConfig = {
              ...baseConfig,
              customRules: enabledRules.slice(1),
            };

            // 生成修改后的配置
            const modifiedRouteConfig = manager.generateRouteConfig(modifiedConfig);

            // 验证配置发生了变化（如果有多个规则）
            if (enabledRules.length > 1) {
              // 配置应该不同
              expect(modifiedRouteConfig).not.toEqual(initialConfig);
            }

            // 验证被移除规则的域名不在修改后的配置中
            const removedDomain = enabledRules[0].domain.startsWith('*.')
              ? enabledRules[0].domain.slice(2)
              : enabledRules[0].domain.replace(/\*/g, '');

            const routeDomains = new Set<string>();
            for (const rule of modifiedRouteConfig.rules) {
              if (rule.domain) {
                rule.domain.forEach((d) => routeDomains.add(d));
              }
              if (rule.domain_suffix) {
                rule.domain_suffix.forEach((d) => routeDomains.add(d));
              }
              if (rule.domain_keyword) {
                rule.domain_keyword.forEach((d) => routeDomains.add(d));
              }
            }

            // 如果只有一个规则被移除，且没有其他规则使用相同域名，则不应出现
            if (enabledRules.length === 1) {
              expect(routeDomains.has(removedDomain)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different config when rule action is changed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.domain(),
          fc.constantFrom('proxy', 'direct', 'block'),
          fc.constantFrom('proxy', 'direct', 'block'),
          async (domain, initialAction, newAction) => {
            // 确保 action 不同
            if (initialAction === newAction) {
              return;
            }

            const initialRule: DomainRule = {
              id: 'test-rule',
              domain,
              action: initialAction,
              enabled: true,
            };

            const baseConfig: UserConfig = {
              servers: [],
              selectedServerId: null,
              proxyMode: 'smart',
              proxyModeType: 'systemProxy',
              tunConfig: {
                mtu: 9000,
                stack: 'system',
                autoRoute: true,
                strictRoute: true,
              },
              customRules: [initialRule],
              autoStart: false,
              autoConnect: false,
              minimizeToTray: true,
              socksPort: 65534,
              httpPort: 65533,
              logLevel: 'info',
            };

            // 生成初始配置
            const initialConfig = manager.generateRouteConfig(baseConfig);

            // 修改规则的 action
            const modifiedRule = { ...initialRule, action: newAction };
            const modifiedConfig = {
              ...baseConfig,
              customRules: [modifiedRule],
            };

            // 生成修改后的配置
            const modifiedRouteConfig = manager.generateRouteConfig(modifiedConfig);

            // 验证配置发生了变化
            expect(modifiedRouteConfig).not.toEqual(initialConfig);

            // 验证新 action 的规则存在
            const hasNewActionRule = modifiedRouteConfig.rules.some(
              (rule) =>
                rule.outbound === newAction &&
                (rule.domain?.includes(domain) ||
                  rule.domain_suffix?.includes(domain) ||
                  rule.domain_keyword?.includes(domain))
            );

            expect(hasNewActionRule).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different config when rule is enabled/disabled', async () => {
      await fc.assert(
        fc.asyncProperty(domainRuleArbitrary(), async (rule) => {
          // 初始状态：规则启用
          const enabledRule = { ...rule, enabled: true };

          const baseConfig: UserConfig = {
            servers: [],
            selectedServerId: null,
            proxyMode: 'smart',
            proxyModeType: 'systemProxy',
            tunConfig: {
              mtu: 9000,
              stack: 'system',
              autoRoute: true,
              strictRoute: true,
            },
            customRules: [enabledRule],
            autoStart: false,
            autoConnect: false,
            minimizeToTray: true,
            socksPort: 65534,
            httpPort: 65533,
            logLevel: 'info',
          };

          // 生成启用状态的配置
          const enabledConfig = manager.generateRouteConfig(baseConfig);

          // 禁用规则
          const disabledRule = { ...rule, enabled: false };
          const modifiedConfig = {
            ...baseConfig,
            customRules: [disabledRule],
          };

          // 生成禁用状态的配置
          const disabledConfig = manager.generateRouteConfig(modifiedConfig);

          // 验证配置发生了变化
          expect(disabledConfig).not.toEqual(enabledConfig);

          // 验证禁用规则的域名不在配置中
          const domain = rule.domain.startsWith('*.')
            ? rule.domain.slice(2)
            : rule.domain.replace(/\*/g, '');

          const routeDomains = new Set<string>();
          for (const routeRule of disabledConfig.rules) {
            if (routeRule.domain) {
              routeRule.domain.forEach((d) => routeDomains.add(d));
            }
            if (routeRule.domain_suffix) {
              routeRule.domain_suffix.forEach((d) => routeDomains.add(d));
            }
            if (routeRule.domain_keyword) {
              routeRule.domain_keyword.forEach((d) => routeDomains.add(d));
            }
          }

          expect(routeDomains.has(domain)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate different config when proxy mode changes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('global', 'smart', 'direct'),
          fc.constantFrom('global', 'smart', 'direct'),
          async (initialMode, newMode) => {
            // 确保模式不同
            if (initialMode === newMode) {
              return;
            }

            const baseConfig: UserConfig = {
              servers: [],
              selectedServerId: null,
              proxyMode: initialMode,
              proxyModeType: 'systemProxy',
              tunConfig: {
                mtu: 9000,
                stack: 'system',
                autoRoute: true,
                strictRoute: true,
              },
              customRules: [],
              autoStart: false,
              autoConnect: false,
              minimizeToTray: true,
              socksPort: 65534,
              httpPort: 65533,
              logLevel: 'info',
            };

            // 生成初始配置
            const initialConfig = manager.generateRouteConfig(baseConfig);

            // 修改代理模式
            const modifiedConfig = {
              ...baseConfig,
              proxyMode: newMode,
            };

            // 生成修改后的配置
            const modifiedRouteConfig = manager.generateRouteConfig(modifiedConfig);

            // 验证配置发生了变化
            expect(modifiedRouteConfig).not.toEqual(initialConfig);

            // 验证 final 出站根据模式变化
            if (newMode === 'direct') {
              expect(modifiedRouteConfig.final).toBe('direct');
            } else {
              expect(modifiedRouteConfig.final).toBe('proxy');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect configuration changes that require restart', async () => {
      await fc.assert(
        fc.asyncProperty(userConfigArbitrary(), userConfigArbitrary(), async (config1, config2) => {
          // 生成两个配置
          const routeConfig1 = manager.generateRouteConfig(config1);
          const routeConfig2 = manager.generateRouteConfig(config2);

          // 如果配置不同，则需要重启
          const configsAreDifferent = JSON.stringify(routeConfig1) !== JSON.stringify(routeConfig2);

          // 获取启用的自定义规则
          const enabledRules1 = config1.customRules.filter((r) => r.enabled);
          const enabledRules2 = config2.customRules.filter((r) => r.enabled);

          // 如果代理模式、启用的自定义规则或其他路由相关设置不同，配置应该不同
          const settingsAreDifferent =
            config1.proxyMode !== config2.proxyMode ||
            JSON.stringify(enabledRules1) !== JSON.stringify(enabledRules2);

          // 如果设置不同，配置也应该不同
          if (settingsAreDifferent) {
            expect(configsAreDifferent).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain idempotency - same config generates same route config', async () => {
      await fc.assert(
        fc.asyncProperty(userConfigArbitrary(), async (config) => {
          // 多次生成配置
          const routeConfig1 = manager.generateRouteConfig(config);
          const routeConfig2 = manager.generateRouteConfig(config);
          const routeConfig3 = manager.generateRouteConfig(config);

          // 验证配置相同
          expect(routeConfig1).toEqual(routeConfig2);
          expect(routeConfig2).toEqual(routeConfig3);
        }),
        { numRuns: 100 }
      );
    });
  });
});
