/**
 * IPC 处理器注册和管理
 * 提供类型安全的 IPC 处理器注册功能
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ApiResponse } from '../../shared/types';

/**
 * IPC 处理器函数类型
 */
export type IpcHandler<TArgs = any, TResult = any> = (
  event: IpcMainInvokeEvent,
  args: TArgs
) => Promise<TResult> | TResult;

/**
 * IPC 处理器注册器类
 * 提供统一的错误处理和响应包装
 */
export class IpcHandlerRegistry {
  private handlers: Map<string, IpcHandler> = new Map();

  /**
   * 注册 IPC 处理器
   * @param channel IPC 通道名称
   * @param handler 处理器函数
   */
  register<TArgs = any, TResult = any>(channel: string, handler: IpcHandler<TArgs, TResult>): void {
    if (this.handlers.has(channel)) {
      console.warn(`IPC handler for channel "${channel}" is already registered. Overwriting.`);
    }

    // 包装处理器，添加错误处理和响应格式化
    const wrappedHandler = async (
      event: IpcMainInvokeEvent,
      args: TArgs
    ): Promise<ApiResponse<TResult>> => {
      try {
        console.log(`[IPC] Handling request for channel: ${channel}`, args);

        const result = await handler(event, args);

        console.log(`[IPC] Request successful for channel: ${channel}`);

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error(`[IPC] Error handling channel "${channel}":`, error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = (error as any)?.code;
        const errorStack = error instanceof Error ? error.stack : undefined;

        // 记录详细错误信息
        if (errorStack) {
          console.error(`[IPC] Stack trace:`, errorStack);
        }

        return {
          success: false,
          error: errorMessage,
          code: errorCode,
        };
      }
    };

    this.handlers.set(channel, wrappedHandler);
    ipcMain.handle(channel, wrappedHandler);

    console.log(`[IPC] Registered handler for channel: ${channel}`);
  }

  /**
   * 注销 IPC 处理器
   * @param channel IPC 通道名称
   */
  unregister(channel: string): void {
    if (this.handlers.has(channel)) {
      ipcMain.removeHandler(channel);
      this.handlers.delete(channel);
      console.log(`[IPC] Unregistered handler for channel: ${channel}`);
    }
  }

  /**
   * 注销所有 IPC 处理器
   */
  unregisterAll(): void {
    for (const channel of this.handlers.keys()) {
      ipcMain.removeHandler(channel);
    }
    this.handlers.clear();
    console.log(`[IPC] Unregistered all handlers`);
  }

  /**
   * 获取已注册的通道列表
   */
  getRegisteredChannels(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 检查通道是否已注册
   */
  isRegistered(channel: string): boolean {
    return this.handlers.has(channel);
  }
}

/**
 * 全局 IPC 处理器注册器实例
 */
export const ipcHandlerRegistry = new IpcHandlerRegistry();

/**
 * 便捷函数：注册 IPC 处理器
 */
export function registerIpcHandler<TArgs = any, TResult = any>(
  channel: string,
  handler: IpcHandler<TArgs, TResult>
): void {
  ipcHandlerRegistry.register(channel, handler);
}

/**
 * 便捷函数：注销 IPC 处理器
 */
export function unregisterIpcHandler(channel: string): void {
  ipcHandlerRegistry.unregister(channel);
}
