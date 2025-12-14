/**
 * 属性测试：IPC 通信往返一致性
 * 
 * 属性 1: IPC 通信往返一致性
 * 对于任何 IPC 调用和参数，当渲染进程通过 ipcRenderer.invoke() 调用主进程方法时，
 * 主进程应该接收到相同的参数，并且返回值应该能够被渲染进程正确接收。
 * 
 * 验证: 需求 1.2
 */

import * as fc from 'fast-check';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IpcHandlerRegistry } from '../ipc-handler';
import { ApiResponse } from '../../../shared/types';

// Mock Electron IPC
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    removeHandler: jest.fn(),
  },
}));

describe('属性测试: IPC 通信往返一致性', () => {
  let registry: IpcHandlerRegistry;

  beforeEach(() => {
    registry = new IpcHandlerRegistry();
    jest.clearAllMocks();
  });

  afterEach(() => {
    registry.unregisterAll();
  });

  /**
   * 属性 1.1: 简单数据类型往返一致性
   * 对于任何简单数据类型（字符串、数字、布尔值），IPC 往返应该保持数据不变
   */
  test('属性 1.1: 简单数据类型往返一致性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.float(),
          fc.boolean(),
          fc.constant(null)
        ),
        async (value) => {
          const channel = `test:echo-${Date.now()}-${Math.random()}`;
          
          // 注册处理器，直接返回接收到的值
          registry.register(channel, async (_event, args) => args);

          // 获取最后注册的处理器
          const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
          const lastCall = handleCalls[handleCalls.length - 1];
          expect(lastCall[0]).toBe(channel);
          
          const handler = lastCall[1];
          const mockEvent = {} as IpcMainInvokeEvent;
          
          // 调用处理器
          const response = await handler(mockEvent, value) as ApiResponse;
          
          // 验证响应成功
          expect(response.success).toBe(true);
          
          // 验证数据一致性
          expect(response.data).toEqual(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 1.2: 对象数据往返一致性
   * 对于任何对象数据，IPC 往返应该保持对象结构和值不变
   */
  test('属性 1.2: 对象数据往返一致性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string(),
          name: fc.string(),
          age: fc.integer({ min: 0, max: 150 }),
          active: fc.boolean(),
          tags: fc.array(fc.string()),
        }),
        async (obj) => {
          const channel = `test:echo-object-${Date.now()}-${Math.random()}`;
          
          // 注册处理器
          registry.register(channel, async (_event, args) => args);

          const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
          const lastCall = handleCalls[handleCalls.length - 1];
          const handler = lastCall[1];
          const mockEvent = {} as IpcMainInvokeEvent;
          
          // 调用处理器
          const response = await handler(mockEvent, obj) as ApiResponse;
          
          // 验证响应成功
          expect(response.success).toBe(true);
          
          // 验证对象结构一致性
          expect(response.data).toEqual(obj);
          expect(Object.keys(response.data)).toEqual(Object.keys(obj));
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 1.3: 数组数据往返一致性
   * 对于任何数组数据，IPC 往返应该保持数组长度和元素不变
   */
  test('属性 1.3: 数组数据往返一致性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            value: fc.integer(),
          })
        ),
        async (arr) => {
          const channel = `test:echo-array-${Date.now()}-${Math.random()}`;
          
          // 注册处理器
          registry.register(channel, async (_event, args) => args);

          const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
          const lastCall = handleCalls[handleCalls.length - 1];
          const handler = lastCall[1];
          const mockEvent = {} as IpcMainInvokeEvent;
          
          // 调用处理器
          const response = await handler(mockEvent, arr) as ApiResponse;
          
          // 验证响应成功
          expect(response.success).toBe(true);
          
          // 验证数组一致性
          expect(response.data).toEqual(arr);
          expect(response.data.length).toBe(arr.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 1.4: 错误处理一致性
   * 当处理器抛出错误时，错误信息应该被正确包装并返回
   */
  test('属性 1.4: 错误处理一致性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMessage) => {
          // 为每次测试使用唯一的 channel，避免重复注册
          const channel = `test:error-${Date.now()}-${Math.random()}`;
          
          // 注册会抛出错误的处理器
          registry.register(channel, async () => {
            throw new Error(errorMessage);
          });

          // 获取最后注册的处理器
          const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
          const lastCall = handleCalls[handleCalls.length - 1];
          const handler = lastCall[1];
          const mockEvent = {} as IpcMainInvokeEvent;
          
          // 调用处理器
          const response = await handler(mockEvent, null) as ApiResponse;
          
          // 验证响应失败
          expect(response.success).toBe(false);
          
          // 验证错误信息被正确传递
          expect(response.error).toBe(errorMessage);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 1.5: 嵌套对象往返一致性
   * 对于任何嵌套对象，IPC 往返应该保持深层结构不变
   */
  test('属性 1.5: 嵌套对象往返一致性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          server: fc.record({
            id: fc.uuid(),
            name: fc.string(),
            config: fc.record({
              address: fc.string(),
              port: fc.integer({ min: 1, max: 65535 }),
              settings: fc.record({
                timeout: fc.integer({ min: 0, max: 60000 }),
                retries: fc.integer({ min: 0, max: 10 }),
              }),
            }),
          }),
        }),
        async (nestedObj) => {
          const channel = `test:echo-nested-${Date.now()}-${Math.random()}`;
          
          // 注册处理器
          registry.register(channel, async (_event, args) => args);

          const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
          const lastCall = handleCalls[handleCalls.length - 1];
          const handler = lastCall[1];
          const mockEvent = {} as IpcMainInvokeEvent;
          
          // 调用处理器
          const response = await handler(mockEvent, nestedObj) as ApiResponse;
          
          // 验证响应成功
          expect(response.success).toBe(true);
          
          // 验证嵌套结构一致性
          expect(response.data).toEqual(nestedObj);
          expect(response.data.server.config.settings).toEqual(
            nestedObj.server.config.settings
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 属性 1.6: 特殊字符串往返一致性
   * 对于包含特殊字符的字符串，IPC 往返应该保持字符不变
   */
  test('属性 1.6: 特殊字符串往返一致性', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => s.length > 0),
        async (str) => {
          const channel = `test:echo-special-string-${Date.now()}-${Math.random()}`;
          
          // 注册处理器
          registry.register(channel, async (_event, args) => args);

          const handleCalls = (ipcMain.handle as jest.Mock).mock.calls;
          const lastCall = handleCalls[handleCalls.length - 1];
          const handler = lastCall[1];
          const mockEvent = {} as IpcMainInvokeEvent;
          
          // 调用处理器
          const response = await handler(mockEvent, str) as ApiResponse;
          
          // 验证响应成功
          expect(response.success).toBe(true);
          
          // 验证字符串一致性
          expect(response.data).toBe(str);
          expect(response.data.length).toBe(str.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 1.7: 空值处理一致性
   * 对于空值（null、空对象、空数组），IPC 往返应该正确处理
   */
  test('属性 1.7: 空值处理一致性', async () => {
    const emptyValues = [
      null,
      {},
      [],
      '',
      0,
      false,
    ];

    for (const value of emptyValues) {
      const channel = `test:echo-empty-${typeof value}`;
      
      // 注册处理器
      registry.register(channel, async (_event, args) => args);

      const handleCall = (ipcMain.handle as jest.Mock).mock.calls[0];
      const handler = handleCall[1];
      const mockEvent = {} as IpcMainInvokeEvent;
      
      // 调用处理器
      const response = await handler(mockEvent, value) as ApiResponse;
      
      // 验证响应成功
      expect(response.success).toBe(true);
      
      // 验证值一致性
      expect(response.data).toEqual(value);
    }
  });
});
