import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'

export function GeneralSettings() {
  const config = useAppStore((state) => state.config)
  const saveConfig = useAppStore((state) => state.saveConfig)

  const handleToggle = async (field: 'autoStart' | 'autoConnect' | 'minimizeToTray', value: boolean) => {
    if (!config) return

    const updatedConfig = {
      ...config,
      [field]: value,
    }

    try {
      await saveConfig(updatedConfig)
      toast.success('设置已保存')
    } catch (error) {
      toast.error('保存设置失败')
    }
  }

  if (!config) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>常规</CardTitle>
        <CardDescription>应用程序启动和行为设置</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="autoStart"
            checked={config.autoStart}
            onCheckedChange={(checked) => handleToggle('autoStart', checked as boolean)}
          />
          <Label
            htmlFor="autoStart"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            开机自动启动
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="autoConnect"
            checked={config.autoConnect}
            onCheckedChange={(checked) => handleToggle('autoConnect', checked as boolean)}
          />
          <Label
            htmlFor="autoConnect"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            启动时自动连接
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="minimizeToTray"
            checked={config.minimizeToTray}
            onCheckedChange={(checked) => handleToggle('minimizeToTray', checked as boolean)}
          />
          <Label
            htmlFor="minimizeToTray"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            最小化到系统托盘
          </Label>
        </div>
      </CardContent>
    </Card>
  )
}
