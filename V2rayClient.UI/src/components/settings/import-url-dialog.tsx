import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Link, Server } from 'lucide-react'
import { parseProtocolUrl, addServerFromUrl } from '@/bridge/api-wrapper'
import type { ServerConfig } from '@/bridge/types'

interface ImportUrlDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportSuccess?: () => void
}

export function ImportUrlDialog({ open, onOpenChange, onImportSuccess }: ImportUrlDialogProps) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [parsedConfig, setParsedConfig] = useState<ServerConfig | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleParseUrl = async () => {
    if (!url.trim()) {
      toast.error('请输入协议URL')
      return
    }

    setIsParsing(true)
    try {
      const config = await parseProtocolUrl(url.trim())
      if (config) {
        setParsedConfig(config)
        
        // 自动生成服务器名称
        if (!name.trim()) {
          const protocol = config.protocol.toUpperCase()
          const address = config.address
          setName(`${protocol} - ${address}`)
        }
        
        toast.success('URL解析成功')
      }
    } catch (error) {
      console.error('Parse URL error:', error)
      setParsedConfig(null)
    } finally {
      setIsParsing(false)
    }
  }

  const handleImport = async () => {
    if (!parsedConfig || !name.trim()) {
      toast.error('请先解析URL并输入服务器名称')
      return
    }

    setIsImporting(true)
    try {
      const success = await addServerFromUrl(url.trim(), name.trim())
      if (success) {
        onImportSuccess?.()
        handleClose()
      }
    } catch (error) {
      console.error('Import server error:', error)
    } finally {
      setIsImporting(false)
    }
  }

  const handleClose = () => {
    setUrl('')
    setName('')
    setParsedConfig(null)
    onOpenChange(false)
  }

  const isValidUrl = (url: string) => {
    return url.startsWith('vless://') || url.startsWith('trojan://')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            从URL导入服务器
          </DialogTitle>
          <DialogDescription>
            支持导入 vless:// 和 trojan:// 协议链接
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* URL输入 */}
          <div className="space-y-2">
            <Label htmlFor="protocol-url">协议URL</Label>
            <div className="flex gap-2">
              <Textarea
                id="protocol-url"
                placeholder="vless://uuid@server:port?encryption=none&security=tls&type=ws&host=example.com&path=/path#name
或
trojan://password@server:port?security=tls&type=ws&host=example.com&path=/path#name"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <Button
                onClick={handleParseUrl}
                disabled={!url.trim() || !isValidUrl(url.trim()) || isParsing}
                className="shrink-0"
              >
                {isParsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  '解析'
                )}
              </Button>
            </div>
            {url.trim() && !isValidUrl(url.trim()) && (
              <p className="text-sm text-destructive">
                请输入有效的 vless:// 或 trojan:// 协议链接
              </p>
            )}
          </div>

          {/* 解析结果 */}
          {parsedConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  解析结果
                </CardTitle>
                <CardDescription>
                  URL解析成功，请确认配置信息
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">协议:</span>
                    <Badge variant="outline" className="ml-2">
                      {parsedConfig.protocol}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">地址:</span>
                    <span className="ml-2 font-mono">{parsedConfig.address}:{parsedConfig.port}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">传输:</span>
                    <span className="ml-2">{parsedConfig.network}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">加密:</span>
                    <span className="ml-2">{parsedConfig.security}</span>
                  </div>
                  {parsedConfig.protocol === 'Vless' && parsedConfig.uuid && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">UUID:</span>
                      <span className="ml-2 font-mono text-xs">{parsedConfig.uuid}</span>
                    </div>
                  )}
                  {parsedConfig.protocol === 'Trojan' && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">密码:</span>
                      <span className="ml-2">••••••••</span>
                    </div>
                  )}
                  {parsedConfig.wsSettings?.path && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">WebSocket路径:</span>
                      <span className="ml-2 font-mono">{parsedConfig.wsSettings.path}</span>
                    </div>
                  )}
                  {parsedConfig.tlsSettings?.serverName && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">TLS服务器名:</span>
                      <span className="ml-2">{parsedConfig.tlsSettings.serverName}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 服务器名称 */}
          {parsedConfig && (
            <div className="space-y-2">
              <Label htmlFor="server-name">服务器名称</Label>
              <Input
                id="server-name"
                placeholder="输入服务器名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parsedConfig || !name.trim() || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                导入中...
              </>
            ) : (
              '导入服务器'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}