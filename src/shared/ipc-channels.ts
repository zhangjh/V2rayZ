// IPC 通道常量定义
export const IPC_CHANNELS = {
  // 代理控制
  PROXY_START: 'proxy:start',
  PROXY_STOP: 'proxy:stop',
  PROXY_GET_STATUS: 'proxy:getStatus',
  PROXY_RESTART: 'proxy:restart',
  
  // 配置管理
  CONFIG_GET: 'config:get',
  CONFIG_SAVE: 'config:save',
  CONFIG_UPDATE_MODE: 'config:updateMode',
  
  // 服务器管理
  SERVER_SWITCH: 'server:switch',
  SERVER_PARSE_URL: 'server:parseUrl',
  SERVER_ADD_FROM_URL: 'server:addFromUrl',
  SERVER_DELETE: 'server:delete',
  SERVER_UPDATE: 'server:update',
  
  // 路由规则
  RULE_ADD: 'rule:add',
  RULE_DELETE: 'rule:delete',
  RULE_UPDATE: 'rule:update',
  
  // 系统代理
  SYSTEM_PROXY_ENABLE: 'systemProxy:enable',
  SYSTEM_PROXY_DISABLE: 'systemProxy:disable',
  SYSTEM_PROXY_GET_STATUS: 'systemProxy:getStatus',
  
  // 自启动
  AUTO_START_SET: 'autoStart:set',
  AUTO_START_GET_STATUS: 'autoStart:getStatus',
  
  // 日志
  LOG_GET: 'log:get',
  LOG_CLEAR: 'log:clear',
  
  // 事件 (Main -> Renderer)
  EVENT_PROXY_STARTED: 'event:proxyStarted',
  EVENT_PROXY_STOPPED: 'event:proxyStopped',
  EVENT_PROXY_ERROR: 'event:proxyError',
  EVENT_CONFIG_CHANGED: 'event:configChanged',
  EVENT_LOG_RECEIVED: 'event:logReceived',
  EVENT_STATS_UPDATE: 'event:statsUpdate',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
