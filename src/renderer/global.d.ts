// Electron API 类型声明
interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
}

interface Window {
  electronAPI: ElectronAPI;
}
