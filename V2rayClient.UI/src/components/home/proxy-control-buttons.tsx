import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app-store'
import { Loader2, Play, Square } from 'lucide-react'

export function ProxyControlButtons() {
  const connectionStatus = useAppStore((state) => state.connectionStatus)
  const config = useAppStore((state) => state.config)
  const isLoading = useAppStore((state) => state.isLoading)
  const startProxy = useAppStore((state) => state.startProxy)
  const stopProxy = useAppStore((state) => state.stopProxy)

  const isConnected = connectionStatus?.v2ray?.running && connectionStatus?.proxy?.enabled
  const isDisconnected = !connectionStatus?.v2ray?.running && !connectionStatus?.proxy?.enabled
  const hasError = connectionStatus?.v2ray?.error
  
  // Check if server is configured and selected
  const isServerConfigured = (() => {
    if (!config?.selectedServerId) return false
    
    const selectedServer = config.servers?.find(s => s.id === config.selectedServerId)
    if (!selectedServer) return false
    
    // Basic checks
    if (!selectedServer.address || selectedServer.address.trim() === '') return false
    if (!selectedServer.port || selectedServer.port <= 0) return false
    
    // Protocol-specific checks
    if (selectedServer.protocol === 'Vless') {
      return !!(selectedServer.uuid && selectedServer.uuid.trim() !== '')
    } else if (selectedServer.protocol === 'Trojan') {
      return !!(selectedServer.password && selectedServer.password.trim() !== '')
    }
    
    return false
  })()





  const handleStart = async () => {
    await startProxy()
  }

  const handleStop = async () => {
    await stopProxy()
  }

  return (
    <div className="space-y-3">
      
      <div className="flex gap-3">
        <Button
          onClick={handleStart}
          disabled={isLoading || isConnected || !isServerConfigured}
          className="flex-1"
          size="lg"
          title={!isServerConfigured ? '请先选择服务器' : hasError ? hasError : ''}
        >
          {isLoading && !isConnected ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              连接中...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              启用代理
            </>
          )}
        </Button>

        <Button
          onClick={handleStop}
          disabled={isLoading || (isDisconnected && !hasError)}
          variant="outline"
          className="flex-1"
          size="lg"
        >
          {isLoading && (isConnected || hasError) ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              断开中...
            </>
          ) : (
            <>
              <Square className="mr-2 h-4 w-4" />
              禁用代理
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
