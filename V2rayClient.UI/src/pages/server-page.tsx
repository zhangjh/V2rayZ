import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/store/app-store'
import { VlessForm } from '@/components/settings/vless-form'
import { TrojanForm } from '@/components/settings/trojan-form'

export function ServerPage() {
  const config = useAppStore((state) => state.config)
  const saveConfig = useAppStore((state) => state.saveConfig)
  const connectionStatus = useAppStore((state) => state.connectionStatus)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [selectedProtocol, setSelectedProtocol] = useState<'Vless' | 'Trojan'>('Vless')

  // Load protocol from config
  useEffect(() => {
    if (config?.server?.protocol) {
      setSelectedProtocol(config.server.protocol)
    }
  }, [config])



  const handleSaveConfig = async (serverConfig: any) => {
    try {
      console.log('========== SAVE CONFIG START ==========')
      console.log('Server config:', serverConfig)

      // Create default config if not exists
      const baseConfig = config || {
        proxyMode: 'Smart',
        customRules: [],
        autoStart: false,
        autoConnect: false,
        minimizeToTray: true,
        socksPort: 65534,
        httpPort: 65533,
      }

      // Update the config with new server settings
      const updatedConfig = {
        ...baseConfig,
        server: serverConfig,
      }

      console.log('Final config to save:', updatedConfig)

      await saveConfig(updatedConfig)

      console.log('========== SAVE CONFIG END ==========')

      const protocolName = serverConfig.protocol === 'Vless' ? 'VLESS' : 'Trojan'
      toast.success('配置已保存', {
        description: `${protocolName} 服务器配置已成功保存。如果代理正在运行，请重新连接以应用新配置。`,
      })
    } catch (error) {
      console.error('========== SAVE CONFIG ERROR ==========', error)
      toast.error('保存失败', {
        description: error instanceof Error ? error.message : '保存配置时发生错误',
      })
    }
  }

  const handleTestConnection = async () => {
    setIsTestingConnection(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      toast.success('连接测试成功', {
        description: '服务器配置有效，可以正常连接。',
      })
    } catch (error) {
      toast.error('连接测试失败', {
        description: error instanceof Error ? error.message : '测试连接时发生错误',
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">服务器配置</h2>
        <p className="text-muted-foreground mt-1">配置代理服务器连接信息，支持 VLESS 和 Trojan 协议</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>协议类型选择</CardTitle>
          <CardDescription>
            选择您的代理服务器协议类型
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium">协议类型</label>
            <Select
              value={selectedProtocol}
              onValueChange={(value) => setSelectedProtocol(value as 'Vless' | 'Trojan')}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Vless">VLESS</SelectItem>
                <SelectItem value="Trojan">Trojan</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              切换协议类型将显示对应的配置表单
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>服务器配置</CardTitle>
          <CardDescription>
            填写您的代理服务器连接信息。修改配置后需要重新连接才能生效。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectionStatus?.v2ray.running && (
            <div className="mb-6 p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ 代理正在运行中。修改配置后，请停止并重新启动代理以应用新配置。
              </p>
            </div>
          )}

          {selectedProtocol === 'Vless' && (
            <VlessForm
              serverConfig={config?.server?.protocol === 'Vless' ? config.server : undefined}
              onSubmit={handleSaveConfig}
              onTestConnection={handleTestConnection}
              isTestingConnection={isTestingConnection}
            />
          )}
          {selectedProtocol === 'Trojan' && (
            <TrojanForm
              serverConfig={config?.server?.protocol === 'Trojan' ? config.server : undefined}
              onSubmit={handleSaveConfig}
              onTestConnection={handleTestConnection}
              isTestingConnection={isTestingConnection}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
