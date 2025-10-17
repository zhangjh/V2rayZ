import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store/app-store'
import { ArrowUp, ArrowDown } from 'lucide-react'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`
}

export function TrafficStatsCard() {
  const stats = useAppStore((state) => state.stats)
  const refreshStatistics = useAppStore((state) => state.refreshStatistics)
  const connectionStatus = useAppStore((state) => state.connectionStatus)

  // Refresh statistics every second when connected
  useEffect(() => {
    const isConnected = connectionStatus?.v2ray?.running && connectionStatus?.proxy?.enabled
    
    if (!isConnected) {
      return
    }

    // Initial fetch
    refreshStatistics()

    // Set up interval for periodic updates
    const interval = setInterval(() => {
      refreshStatistics()
    }, 1000)

    return () => clearInterval(interval)
  }, [connectionStatus, refreshStatistics])

  const uploadTotal = stats?.uploadTotal || 0
  const downloadTotal = stats?.downloadTotal || 0
  const uploadSpeed = stats?.uploadSpeed || 0
  const downloadSpeed = stats?.downloadSpeed || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>流量统计</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">上传</span>
            </div>
            <span className="text-sm font-medium">{formatBytes(uploadTotal)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">下载</span>
            </div>
            <span className="text-sm font-medium">{formatBytes(downloadTotal)}</span>
          </div>
        </div>

        <div className="pt-3 border-t space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">上传速度</span>
            <span className="text-xs font-medium text-blue-500">
              ↑ {formatSpeed(uploadSpeed)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">下载速度</span>
            <span className="text-xs font-medium text-green-500">
              ↓ {formatSpeed(downloadSpeed)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
