/**
 * AutoStartManager 属性测试
 * 使用 fast-check 进行基于属性的测试
 */

import * as fc from 'fast-check';
import { createAutoStartManager, IAutoStartManager } from '../AutoStartManager';

describe('AutoStartManager Property Tests', () => {
  let autoStartManager: IAutoStartManager;

  beforeEach(() => {
    autoStartManager = createAutoStartManager();
  });

  /**
   * 属性 32: 自启动往返一致性
   * Feature: electron-cross-platform, Property 32: 自启动往返一致性
   * 验证: 需求 11.3
   *
   * 对于任何自启动启用操作，启用后查询状态应该返回 true，禁用后查询状态应该返回 false。
   */
  describe('Property 32: 自启动往返一致性', () => {
    it('启用自启动后查询状态应该返回 true', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(true), async (enabled) => {
          // 启用自启动
          const result = await autoStartManager.setAutoStart(enabled);
          expect(result).toBe(true);

          // 查询状态应该返回 true
          const status = await autoStartManager.isAutoStartEnabled();
          expect(status).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('禁用自启动后查询状态应该返回 false', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(false), async (enabled) => {
          // 先确保自启动是启用的
          await autoStartManager.setAutoStart(true);

          // 禁用自启动
          const result = await autoStartManager.setAutoStart(enabled);
          expect(result).toBe(true);

          // 查询状态应该返回 false
          const status = await autoStartManager.isAutoStartEnabled();
          expect(status).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('对于任何布尔值，设置后查询应该返回相同的状态', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (enabled) => {
          // 设置自启动状态
          const result = await autoStartManager.setAutoStart(enabled);
          expect(result).toBe(true);

          // 查询状态应该与设置的值一致
          const status = await autoStartManager.isAutoStartEnabled();
          expect(status).toBe(enabled);
        }),
        { numRuns: 100 }
      );
    });

    it('多次设置相同的状态应该保持一致', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (enabled) => {
          // 第一次设置
          await autoStartManager.setAutoStart(enabled);
          const status1 = await autoStartManager.isAutoStartEnabled();

          // 第二次设置相同的值
          await autoStartManager.setAutoStart(enabled);
          const status2 = await autoStartManager.isAutoStartEnabled();

          // 两次查询的结果应该一致
          expect(status1).toBe(enabled);
          expect(status2).toBe(enabled);
          expect(status1).toBe(status2);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 属性 33: 自启动状态查询准确性
   * Feature: electron-cross-platform, Property 33: 自启动状态查询准确性
   * 验证: 需求 11.4
   *
   * 对于任何自启动状态查询，返回的状态应该与系统实际的自启动配置一致
   * （Windows 检查注册表，macOS 检查 Login Items）。
   */
  describe('Property 33: 自启动状态查询准确性', () => {
    it('查询状态应该反映实际的系统配置', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (enabled) => {
          // 设置自启动状态
          await autoStartManager.setAutoStart(enabled);

          // 查询状态
          const queriedStatus = await autoStartManager.isAutoStartEnabled();

          // 查询的状态应该与设置的状态一致
          expect(queriedStatus).toBe(enabled);

          // 再次查询，确保状态稳定
          const secondQuery = await autoStartManager.isAutoStartEnabled();
          expect(secondQuery).toBe(enabled);
          expect(secondQuery).toBe(queriedStatus);
        }),
        { numRuns: 100 }
      );
    });

    it('未设置自启动时查询应该返回 false', async () => {
      // 确保自启动被禁用
      await autoStartManager.setAutoStart(false);

      // 多次查询都应该返回 false
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const status = await autoStartManager.isAutoStartEnabled();
          expect(status).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('设置自启动后查询应该返回 true', async () => {
      // 确保自启动被启用
      await autoStartManager.setAutoStart(true);

      // 多次查询都应该返回 true
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const status = await autoStartManager.isAutoStartEnabled();
          expect(status).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('状态查询应该是幂等的', async () => {
      await fc.assert(
        fc.asyncProperty(fc.boolean(), async (enabled) => {
          // 设置初始状态
          await autoStartManager.setAutoStart(enabled);

          // 多次查询状态
          const status1 = await autoStartManager.isAutoStartEnabled();
          const status2 = await autoStartManager.isAutoStartEnabled();
          const status3 = await autoStartManager.isAutoStartEnabled();

          // 所有查询结果应该相同
          expect(status1).toBe(enabled);
          expect(status2).toBe(enabled);
          expect(status3).toBe(enabled);
          expect(status1).toBe(status2);
          expect(status2).toBe(status3);
        }),
        { numRuns: 100 }
      );
    });

    it('在状态切换序列中查询应该始终准确', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }), async (sequence) => {
          // 执行一系列状态切换
          for (const enabled of sequence) {
            await autoStartManager.setAutoStart(enabled);
            const status = await autoStartManager.isAutoStartEnabled();
            expect(status).toBe(enabled);
          }

          // 最后一次查询应该与序列的最后一个值一致
          const finalStatus = await autoStartManager.isAutoStartEnabled();
          expect(finalStatus).toBe(sequence[sequence.length - 1]);
        }),
        { numRuns: 100 }
      );
    });
  });
});
