import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { RefreshCw, Download, CheckCircle2, AlertCircle } from 'lucide-react'

interface GeoDataInfo {
  geoIpExists: boolean
  geoSiteExists: boolean
  geoIpSize: number
  geoSiteSize: number
  geoIpLastModified: string | null
  geoSiteLastModified: string | null
}

interface GeoDataUpdateInfo {
  geoIpNeedsUpdate: boolean
  geoSiteNeedsUpdate: boolean
  geoIpCurrentVersion: string | null
  geoIpLatestVersion: string | null
  geoSiteCurrentVersion: string | null
  geoSiteLatestVersion: string | null
}

export function AdvancedSettings() {
  const config = useAppStore((state) => state.config)
  const saveConfig = useAppStore((state) => state.saveConfig)
  
  const [socksPort, setSocksPort] = useState(config?.socksPort?.toString() || '65534')
  const [httpPort, setHttpPort] = useState(config?.httpPort?.toString() || '65533')
  const [isLoading, setIsLoading] = useState(false)
  
  const [geoDataInfo, setGeoDataInfo] = useState<GeoDataInfo | null>(null)
  const [geoDataUpdateInfo, setGeoDataUpdateInfo] = useState<GeoDataUpdateInfo | null>(null)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    loadGeoDataInfo()
    
    // Listen for geodata update events
    const handleGeoDataUpdated = (data: GeoDataInfo) => {
      setGeoDataInfo(data)
      setIsUpdating(false)
      // Clear update info after successful update
      setGeoDataUpdateInfo(null)
      toast.success('GeoData 文件更新成功')
    }
    
    const handleGeoDataUpdateFailed = () => {
      setIsUpdating(false)
      toast.error('GeoData 文件更新失败')
    }
    
    const handleGeoDataUpdateChecked = (data: GeoDataUpdateInfo) => {
      setGeoDataUpdateInfo(data)
      setIsCheckingUpdates(false)
      const hasUpdates = data.geoIpNeedsUpdate || data.geoSiteNeedsUpdate
      if (hasUpdates) {
        toast.info('发现 GeoData 更新')
      } else {
        toast.success('GeoData 文件已是最新')
      }
    }
    
    const handleGeoDataUpdateCheckFailed = () => {
      setIsCheckingUpdates(false)
      toast.error('检查更新失败')
    }
    
    window.addNativeEventListener('geoDataUpdated', handleGeoDataUpdated)
    window.addNativeEventListener('geoDataUpdateFailed', handleGeoDataUpdateFailed)
    window.addNativeEventListener('geoDataUpdateChecked', handleGeoDataUpdateChecked)
    window.addNativeEventListener('geoDataUpdateCheckFailed', handleGeoDataUpdateCheckFailed)
    
    return () => {
      window.removeNativeEventListener('geoDataUpdated', handleGeoDataUpdated)
      window.removeNativeEventListener('geoDataUpdateFailed', handleGeoDataUpdateFailed)
      window.removeNativeEventListener('geoDataUpdateChecked', handleGeoDataUpdateChecked)
      window.removeNativeEventListener('geoDataUpdateCheckFailed', handleGeoDataUpdateCheckFailed)
    }
  }, [])

  const loadGeoDataInfo = async () => {
    try {
      const result = await window.nativeApi.getGeoDataInfo()
      const response = JSON.parse(result)
      if (response.success) {
        setGeoDataInfo(response.data)
      }
    } catch (error) {
      console.error('Failed to load geodata info:', error)
    }
  }

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true)
    try {
      const result = await window.nativeApi.checkGeoDataUpdates()
      const response = JSON.parse(result)
      if (!response.success) {
        toast.error(response.error || '检查更新失败')
        setIsCheckingUpdates(false)
      }
      // Success case will be handled by event listener
    } catch (error) {
      toast.error('检查更新失败')
      setIsCheckingUpdates(false)
    }
  }

  const handleUpdate = async () => {
    if (!geoDataUpdateInfo) return
    
    setIsUpdating(true)
    try {
      const result = await window.nativeApi.updateGeoData(
        geoDataUpdateInfo.geoIpNeedsUpdate,
        geoDataUpdateInfo.geoSiteNeedsUpdate
      )
      const response = JSON.parse(result)
      if (!response.success) {
        toast.error(response.error || '更新失败')
        setIsUpdating(false)
      }
      // Success will be handled by event listener
    } catch (error) {
      toast.error('更新失败')
      setIsUpdating(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '未知'
    try {
      return new Date(dateStr).toLocaleString('zh-CN')
    } catch {
      return '未知'
    }
  }

  const handleSavePorts = async () => {
    if (!config) return

    const socksPortNum = parseInt(socksPort, 10)
    const httpPortNum = parseInt(httpPort, 10)

    // Validate ports
    if (isNaN(socksPortNum) || socksPortNum < 1024 || socksPortNum > 65535) {
      toast.error('SOCKS 端口必须在 1024-65535 之间')
      return
    }

    if (isNaN(httpPortNum) || httpPortNum < 1024 || httpPortNum > 65535) {
      toast.error('HTTP 端口必须在 1024-65535 之间')
      return
    }

    if (socksPortNum === httpPortNum) {
      toast.error('SOCKS 和 HTTP 端口不能相同')
      return
    }

    setIsLoading(true)
    try {
      const updatedConfig = {
        ...config,
        socksPort: socksPortNum,
        httpPort: httpPortNum,
      }
      await saveConfig(updatedConfig)
      toast.success('端口设置已保存，重启代理后生效')
    } catch (error) {
      toast.error('保存端口设置失败')
    } finally {
      setIsLoading(false)
    }
  }

  if (!config) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>高级</CardTitle>
        <CardDescription>高级配置选项</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="socksPort">本地 SOCKS 端口</Label>
            <div className="flex gap-2">
              <Input
                id="socksPort"
                type="number"
                min="1024"
                max="65535"
                value={socksPort}
                onChange={(e) => setSocksPort(e.target.value)}
                className="max-w-[200px]"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              默认: 65534
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="httpPort">本地 HTTP 端口</Label>
            <div className="flex gap-2">
              <Input
                id="httpPort"
                type="number"
                min="1024"
                max="65535"
                value={httpPort}
                onChange={(e) => setHttpPort(e.target.value)}
                className="max-w-[200px]"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              默认: 65533
            </p>
          </div>

          <Button onClick={handleSavePorts} disabled={isLoading}>
            {isLoading ? '保存中...' : '保存端口设置'}
          </Button>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div>
            <h4 className="text-sm font-medium mb-2">终端代理设置</h4>
            <p className="text-xs text-muted-foreground mb-3">
              复制以下命令到终端中设置代理（需要先启动代理）
            </p>
            
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Windows (CMD)</Label>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      set http_proxy=http://127.0.0.1:{httpPort}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`set http_proxy=http://127.0.0.1:${httpPort}`)
                        toast.success('已复制到剪贴板')
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      set https_proxy=http://127.0.0.1:{socksPort}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`set https_proxy=http://127.0.0.1:${socksPort}`)
                        toast.success('已复制到剪贴板')
                      }}
                    >
                      复制
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Windows (PowerShell)</Label>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      $env:http_proxy="http://127.0.0.1:{httpPort}"
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`$env:http_proxy="http://127.0.0.1:${httpPort}"`)
                        toast.success('已复制到剪贴板')
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      $env:https_proxy="http://127.0.0.1:{socksPort}"
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`$env:https_proxy="http://127.0.0.1:${socksPort}"`)
                        toast.success('已复制到剪贴板')
                      }}
                    >
                      复制
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Linux/macOS (Bash/Zsh)</Label>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      export http_proxy=http://127.0.0.1:{httpPort}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`export http_proxy=http://127.0.0.1:${httpPort}`)
                        toast.success('已复制到剪贴板')
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      export https_proxy=http://127.0.0.1:{socksPort}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`export https_proxy=http://127.0.0.1:${socksPort}`)
                        toast.success('已复制到剪贴板')
                      }}
                    >
                      复制
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">Git 代理设置</Label>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      git config --global http.proxy http://127.0.0.1:{httpPort}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`git config --global http.proxy http://127.0.0.1:${httpPort}`)
                        toast.success('已复制到剪贴板')
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      git config --global https.proxy http://127.0.0.1:{socksPort}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`git config --global https.proxy http://127.0.0.1:${httpPort}`)
                        toast.success('已复制到剪贴板')
                      }}
                    >
                      复制
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">npm 代理设置</Label>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      npm config set proxy http://127.0.0.1:{httpPort}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`npm config set proxy http://127.0.0.1:${httpPort}`)
                        toast.success('已复制到剪贴板')
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      npm config set https-proxy http://127.0.0.1:{socksPort}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`npm config set https-proxy http://127.0.0.1:${socksPort}`)
                        toast.success('已复制到剪贴板')
                      }}
                    >
                      复制
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>提示：</strong>
              </p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                <li>• 终端代理设置仅在当前会话有效</li>
                <li>• 要永久设置，请将命令添加到 ~/.bashrc 或 ~/.zshrc 文件中</li>
                <li>• SOCKS 代理端口：{socksPort}（适用于支持 SOCKS5 的应用）</li>
                <li>• 取消代理：删除或注释相关环境变量</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div>
            <h4 className="text-sm font-medium mb-2">GeoData 文件管理</h4>
            <p className="text-xs text-muted-foreground mb-3">
              GeoData 文件用于智能分流，包含 IP 地址和域名数据库
            </p>
            
            {geoDataInfo && (
              <div className="space-y-3 mb-4">
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">geoip.dat</span>
                    {geoDataInfo.geoIpExists ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                  {geoDataInfo.geoIpExists && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>大小: {formatFileSize(geoDataInfo.geoIpSize)}</div>
                      <div>更新时间: {formatDate(geoDataInfo.geoIpLastModified)}</div>
                      {geoDataUpdateInfo?.geoIpCurrentVersion && (
                        <div>当前版本: {geoDataUpdateInfo.geoIpCurrentVersion}</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">geosite.dat</span>
                    {geoDataInfo.geoSiteExists ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                  {geoDataInfo.geoSiteExists && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>大小: {formatFileSize(geoDataInfo.geoSiteSize)}</div>
                      <div>更新时间: {formatDate(geoDataInfo.geoSiteLastModified)}</div>
                      {geoDataUpdateInfo?.geoSiteCurrentVersion && (
                        <div>当前版本: {geoDataUpdateInfo.geoSiteCurrentVersion}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {geoDataUpdateInfo && (geoDataUpdateInfo.geoIpNeedsUpdate || geoDataUpdateInfo.geoSiteNeedsUpdate) && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-3">
                <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                  发现可用更新
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {geoDataUpdateInfo.geoIpNeedsUpdate && (
                    <div>• geoip.dat: {geoDataUpdateInfo.geoIpLatestVersion}</div>
                  )}
                  {geoDataUpdateInfo.geoSiteNeedsUpdate && (
                    <div>• geosite.dat: {geoDataUpdateInfo.geoSiteLatestVersion}</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleCheckUpdates} 
                disabled={isCheckingUpdates || isUpdating}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                {isCheckingUpdates ? '检查中...' : '检查更新'}
              </Button>
              
              {geoDataUpdateInfo && (geoDataUpdateInfo.geoIpNeedsUpdate || geoDataUpdateInfo.geoSiteNeedsUpdate) && (
                <Button 
                  onClick={handleUpdate} 
                  disabled={isUpdating}
                  size="sm"
                >
                  <Download className={`h-4 w-4 mr-2 ${isUpdating ? 'animate-bounce' : ''}`} />
                  {isUpdating ? '更新中...' : '立即更新'}
                </Button>
              )}
            </div>

            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>说明：</strong>
              </p>
              <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                <li>• GeoData 文件来自 v2fly 官方仓库</li>
                <li>• 更新后需要重启代理才能生效</li>
                <li>• 建议定期检查更新以获得最佳分流效果</li>
              </ul>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
