import { app } from 'electron';

export interface IAutoStartManager {
  setAutoStart(enabled: boolean): Promise<boolean>;
  isAutoStartEnabled(): Promise<boolean>;
}

class ElectronAutoStart implements IAutoStartManager {
  async setAutoStart(enabled: boolean): Promise<boolean> {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: app.getPath('exe'),
    });
    console.log(`[AutoStart] Set openAtLogin: ${enabled}`);
    return true;
  }

  async isAutoStartEnabled(): Promise<boolean> {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  }
}

export function createAutoStartManager(): IAutoStartManager {
  return new ElectronAutoStart();
}
