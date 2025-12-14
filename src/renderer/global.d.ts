/**
 * 全局类型声明
 */

import { ElectronAPI } from '../main/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};
