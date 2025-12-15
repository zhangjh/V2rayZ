import {
  GeneralSettings,
  AppearanceSettings,
  AdvancedSettings,
  AboutSettings,
  ProxyModeSettings,
} from '@/components/settings';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">设置</h2>
        <p className="text-muted-foreground mt-1">管理应用程序配置和偏好设置</p>
      </div>

      <div className="space-y-6">
        <GeneralSettings />
        <ProxyModeSettings />
        <AppearanceSettings />
        <AdvancedSettings />
        <AboutSettings />
      </div>
    </div>
  );
}
