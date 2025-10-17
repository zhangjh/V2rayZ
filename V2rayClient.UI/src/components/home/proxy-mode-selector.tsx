import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app-store'
import { Loader2, Play, Square } from 'lucide-react'
import type { ProxyMode } from '@/bridge/types'

export function ProxyModeSelector() {
  const config = useAppStore((state) => state.config)
  const connectionStatus = useAppStore((state) => state.connectionStatus)
  const updateProxyMode = useAppStore((state) => state.updateProxyMode)
  const isLoading = useAppStore((state) => state.isLoading)
  const startProxy = useAppStore((state) => state.startProxy)
  const stopProxy = useAppStore((state) => state.stopProxy)

  const currentMode = config?.proxyMode || 'Smart'
  const isConnected = connectionStatus?.v2ray?.running && connectionStatus?.proxy?.enabled
  const hasError = connectionStatus?.v2ray?.error

  // Check if server is configured
  const isServerConfigured = (() => {
    if (!config?.server) return false
    
    const server = config.server
    
    // Basic checks
    if (!server.address || server.address.trim() === '') return false
    if (!server.port || server.port <= 0) return false
    
    // Protocol-specific checks
    if (server.protocol === 'Vless') {
      return !!(server.uuid && server.uuid.trim() !== '')
    } else if (server.protocol === 'Trojan') {
      return !!(server.password && server.password.trim() !== '')
    }
    
    return false
  })()

  const handleModeChange = async (value: string) => {
    await updateProxyMode(value as ProxyMode)
  }

  const handleToggleProxy = async () => {
    if (isConnected) {
      await stopProxy()
    } else {
      await startProxy()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>代理模式</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={currentMode}
          onValueChange={handleModeChange}
          disabled={isLoading}
          className="space-y-3"
        >
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="Global" id="mode-global" />
            <Label htmlFor="mode-global" className="cursor-pointer">
              <div>
                <div className="font-medium">全局代理</div>
                <div className="text-xs text-muted-foreground">
                  所有流量通过代理服务器
                </div>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <RadioGroupItem value="Smart" id="mode-smart" />
            <Label htmlFor="mode-smart" className="cursor-pointer">
              <div>
                <div className="font-medium">智能分流</div>
                <div className="text-xs text-muted-foreground">
                  国内直连，国外走代理
                </div>
              </div>
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <RadioGroupItem value="Direct" id="mode-direct" />
            <Label htmlFor="mode-direct" className="cursor-pointer">
              <div>
                <div className="font-medium">直接连接</div>
                <div className="text-xs text-muted-foreground">
                  所有流量直接连接，不使用代理
                </div>
              </div>
            </Label>
          </div>
        </RadioGroup>

        <div className="pt-2 border-t">
          {!isServerConfigured && (
            <div className="p-3 mb-3 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ 请先在"服务器"页面配置代理服务器信息
              </p>
            </div>
          )}
          
          <Button
            onClick={handleToggleProxy}
            disabled={isLoading || !isServerConfigured}
            className="w-full"
            size="lg"
            variant={isConnected ? "outline" : "default"}
            title={!isServerConfigured ? '请先配置服务器' : hasError ? hasError : ''}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isConnected ? '断开中...' : '连接中...'}
              </>
            ) : isConnected ? (
              <>
                <Square className="mr-2 h-4 w-4" />
                关闭代理
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                开启代理
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
