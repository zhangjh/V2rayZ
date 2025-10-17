import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/store/app-store'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

export function ConnectionStatusCard() {
  const connectionStatus = useAppStore((state) => state.connectionStatus)
  const config = useAppStore((state) => state.config)
  const error = useAppStore((state) => state.error)
  const isLoading = useAppStore((state) => state.isLoading)
  const saveConfig = useAppStore((state) => state.saveConfig)
  const setCurrentView = useAppStore((state) => state.setCurrentView)

  const servers = config?.servers || []
  const selectedServerId = config?.selectedServerId
  const selectedServer = servers.find(s => s.id === selectedServerId)

  const getStatusInfo = () => {
    // Show error from store if present
    if (error) {
      return {
        label: '错误',
        variant: 'destructive' as const,
        description: error,
      }
    }

    if (!connectionStatus) {
      return {
        label: '未知',
        variant: 'secondary' as const,
        description: '正在获取状态...',
      }
    }

    const { v2ray, proxy } = connectionStatus

    if (v2ray.error) {
      return {
        label: '错误',
        variant: 'destructive' as const,
        description: v2ray.error,
      }
    }

    if (v2ray.running && proxy.enabled) {
      const uptime = v2ray.uptime ? `运行时间: ${Math.floor(v2ray.uptime / 60)} 分钟` : ''
      return {
        label: '已连接',
        variant: 'default' as const,
        description: `代理已启用${uptime ? ' - ' + uptime : ''}`,
      }
    }

    if (v2ray.running && !proxy.enabled) {
      return {
        label: '连接中',
        variant: 'secondary' as const,
        description: 'V2ray 运行中，正在启用系统代理...',
      }
    }

    if (isLoading) {
      return {
        label: '连接中',
        variant: 'secondary' as const,
        description: '正在启动 V2ray 进程...',
      }
    }

    return {
      label: '已断开',
      variant: 'outline' as const,
      description: '代理未启用',
    }
  }

  const handleServerChange = async (serverId: string) => {
    try {
      const updatedConfig = {
        ...config,
        selectedServerId: serverId,
        servers: config?.servers || [],
        proxyMode: config?.proxyMode || 'Smart',
        customRules: config?.customRules || [],
        autoStart: config?.autoStart || false,
        autoConnect: config?.autoConnect || false,
        minimizeToTray: config?.minimizeToTray || true,
        socksPort: config?.socksPort || 65534,
        httpPort: config?.httpPort || 65533,
      }

      await saveConfig(updatedConfig)
      toast.success('服务器已切换')
    } catch (error) {
      toast.error('切换失败', {
        description: error instanceof Error ? error.message : '切换服务器时发生错误',
      })
    }
  }

  const handleGoToServers = () => {
    setCurrentView('server')
  }

  const statusInfo = getStatusInfo()

  return (
    <Card>
      <CardHeader>
        <CardTitle>连接状态</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">状态</span>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>

        {/* 服务器选择区域 */}
        {servers.length === 0 ? (
          <div className="space-y-3">
            <div className="p-4 border border-dashed border-muted-foreground/25 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-3">
                暂无服务器配置
              </p>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGoToServers}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  添加服务器
                </Button>
              </div>
            </div>
          </div>
        ) : !selectedServer ? (
          <div className="space-y-3">
            <div className="p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-3">
                ⚠️ 请选择一个服务器以启用代理
              </p>
              <Select onValueChange={handleServerChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择服务器" />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                      <div className="flex items-center gap-2">
                        <span>{server.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {server.protocol}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 服务器切换 */}
            <div className="space-y-2">
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">当前服务器</span>
                <Select value={selectedServerId} onValueChange={handleServerChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {servers.map((server) => (
                      <SelectItem key={server.id} value={server.id}>
                        <div className="flex items-center gap-2">
                          <span>{server.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {server.protocol}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 服务器详细信息 */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">协议</span>
                <Badge variant="outline" className="text-xs">
                  {selectedServer.protocol}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">地址</span>
                <span className="text-sm font-medium truncate max-w-[150px]" title={selectedServer.address}>
                  {selectedServer.address}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">端口</span>
                <span className="text-sm font-medium">{selectedServer.port}</span>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">{statusInfo.description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
