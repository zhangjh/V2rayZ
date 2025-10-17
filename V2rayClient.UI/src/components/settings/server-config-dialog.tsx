import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VlessForm } from './vless-form'
import { TrojanForm } from './trojan-form'
import type { ServerConfigWithId, ProtocolType } from '@/bridge/types'

interface ServerConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  server?: ServerConfigWithId
  onSave: (serverConfig: Omit<ServerConfigWithId, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onTestConnection: () => Promise<void>
  isTestingConnection: boolean
}

export function ServerConfigDialog({
  open,
  onOpenChange,
  server,
  onSave,
  onTestConnection,
  isTestingConnection,
}: ServerConfigDialogProps) {
  const [serverName, setServerName] = useState('')
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>('Vless')
  const [currentServerConfig, setCurrentServerConfig] = useState<any>(null)

  const isEditing = !!server

  useEffect(() => {
    if (server) {
      setServerName(server.name)
      setSelectedProtocol(server.protocol)
      setCurrentServerConfig(server)
    } else {
      setServerName('')
      setSelectedProtocol('Vless')
      setCurrentServerConfig(null)
    }
  }, [server, open])

  const handleSave = async (protocolConfig: any) => {
    if (!serverName.trim()) {
      throw new Error('服务器名称不能为空')
    }

    const serverConfig = {
      name: serverName.trim(),
      ...protocolConfig,
    }

    await onSave(serverConfig)
    onOpenChange(false)
  }

  const handleProtocolChange = (protocol: ProtocolType) => {
    setSelectedProtocol(protocol)
    // Clear current config when switching protocols
    if (protocol !== currentServerConfig?.protocol) {
      setCurrentServerConfig(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? '编辑服务器配置' : '添加服务器配置'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? '修改服务器配置信息。保存后不会自动重启代理服务。'
              : '添加新的代理服务器配置。支持 VLESS 和 Trojan 协议。'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Server Name */}
          <div className="space-y-2">
            <Label htmlFor="serverName">服务器名称</Label>
            <Input
              id="serverName"
              placeholder="例如：香港节点1"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              为此服务器配置设置一个便于识别的名称
            </p>
          </div>

          {/* Protocol Selection */}
          <div className="space-y-2">
            <Label>协议类型</Label>
            <Select
              value={selectedProtocol}
              onValueChange={handleProtocolChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Vless">VLESS</SelectItem>
                <SelectItem value="Trojan">Trojan</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              选择您的代理服务器协议类型
            </p>
          </div>

          {/* Protocol Form */}
          <div className="border-t pt-6">
            {selectedProtocol === 'Vless' && (
              <VlessForm
                serverConfig={
                  currentServerConfig?.protocol === 'Vless' ? currentServerConfig : undefined
                }
                onSubmit={handleSave}
                onTestConnection={onTestConnection}
                isTestingConnection={isTestingConnection}
              />
            )}
            {selectedProtocol === 'Trojan' && (
              <TrojanForm
                serverConfig={
                  currentServerConfig?.protocol === 'Trojan' ? currentServerConfig : undefined
                }
                onSubmit={handleSave}
                onTestConnection={onTestConnection}
                isTestingConnection={isTestingConnection}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}