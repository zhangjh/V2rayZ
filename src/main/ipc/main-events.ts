/**
 * 主进程内部事件系统
 * 用于主进程内部组件之间的通信
 */

import { EventEmitter } from 'events';

class MainEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
  }
}

export const mainEventEmitter = new MainEventEmitter();

// 事件名称常量
export const MAIN_EVENTS = {
  CONFIG_CHANGED: 'config:changed',
  PROXY_STARTED: 'proxy:started',
  PROXY_STOPPED: 'proxy:stopped',
} as const;
