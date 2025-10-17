import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store/app-store'

export function ConnectionStatusCard() {
  const connectionStatus = useAppStore((state) => state.connectionStatus)
  const config = useAppStore((state) => state.config)
  const error = useAppStore((state) => state.error)
  const isLoading = useAppStore((state) => state.isLoading)

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

  const statusInfo = getStatusInfo()
  const serverAddress = config?.server?.address || '未配置'
  const serverPort = config?.server?.port || '-'
  const protocol = config?.server?.protocol || '-'

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
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">协议</span>
            <span className="text-sm font-medium">{protocol}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">服务器</span>
            <span className="text-sm font-medium truncate max-w-[200px]" title={serverAddress}>
              {serverAddress}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">端口</span>
            <span className="text-sm font-medium">{serverPort}</span>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">{statusInfo.description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
