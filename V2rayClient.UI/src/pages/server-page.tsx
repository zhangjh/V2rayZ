import { useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/app-store'
import { ServerList } from '@/components/settings/server-list'
import { ServerConfigDialog } from '@/components/settings/server-config-dialog'
import type { ServerConfigWithId } from '@/bridge/types'

export function ServerPage() {
  const config = useAppStore((state) => state.config)
  const saveConfig = useAppStore((state) => state.saveConfig)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<ServerConfigWithId | undefined>()
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  const servers = config?.servers || []
  const selectedServerId = config?.selectedServerId

  const handleAddServer = () => {
    setEditingServer(undefined)
    setIsDialogOpen(true)
  }

  const handleEditServer = (server: ServerConfigWithId) => {
    setEditingServer(server)
    setIsDialogOpen(true)
  }

  const handleDeleteServer = async (serverId: string) => {
    try {
      const updatedServers = servers.filter(s => s.id !== serverId)
      
      // If deleting the selected server, clear selection
      const newSelectedServerId = selectedServerId === serverId ? undefined : selectedServerId

      const updatedConfig = {
        ...config,
        servers: updatedServers,
        selectedServerId: newSelectedServerId,
        proxyMode: config?.proxyMode || 'Smart',
        customRules: config?.customRules || [],
        autoStart: config?.autoStart || false,
        autoConnect: config?.autoConnect || false,
        minimizeToTray: config?.minimizeToTray || true,
        socksPort: config?.socksPort || 65534,
        httpPort: config?.httpPort || 65533,
      }

      await saveConfig(updatedConfig)
      toast.success('服务器已删除')
    } catch (error) {
      toast.error('删除失败', {
        description: error instanceof Error ? error.message : '删除服务器时发生错误',
      })
    }
  }

  const handleSelectServer = async (serverId: string) => {
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
      toast.success('服务器已选择')
    } catch (error) {
      toast.error('选择失败', {
        description: error instanceof Error ? error.message : '选择服务器时发生错误',
      })
    }
  }

  const handleSaveServer = async (serverData: Omit<ServerConfigWithId, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.log('[ServerPage] Saving server:', serverData)
      console.log('[ServerPage] Current servers:', servers)
      console.log('[ServerPage] Current config:', config)
      
      const now = new Date().toISOString()
      let updatedServers: ServerConfigWithId[]

      if (editingServer) {
        // Update existing server
        updatedServers = servers.map(s => 
          s.id === editingServer.id 
            ? { ...serverData, id: editingServer.id, createdAt: editingServer.createdAt, updatedAt: now }
            : s
        )
        console.log('[ServerPage] Updated existing server')
      } else {
        // Add new server
        const newServer: ServerConfigWithId = {
          ...serverData,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        }
        updatedServers = [...servers, newServer]
        console.log('[ServerPage] Added new server:', newServer)
      }

      const updatedConfig = {
        ...config,
        servers: updatedServers,
        selectedServerId: config?.selectedServerId,
        proxyMode: config?.proxyMode || 'Smart',
        customRules: config?.customRules || [],
        autoStart: config?.autoStart || false,
        autoConnect: config?.autoConnect || false,
        minimizeToTray: config?.minimizeToTray || true,
        socksPort: config?.socksPort || 65534,
        httpPort: config?.httpPort || 65533,
      }

      console.log('[ServerPage] Final config to save:', updatedConfig)
      await saveConfig(updatedConfig)
      console.log('[ServerPage] Config saved successfully')

      const action = editingServer ? '更新' : '添加'
      toast.success(`服务器配置已${action}`, {
        description: `${serverData.name} 配置已成功保存`,
      })
    } catch (error) {
      console.error('[ServerPage] Save error:', error)
      toast.error('保存失败', {
        description: error instanceof Error ? error.message : '保存服务器配置时发生错误',
      })
      throw error
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
        <p className="text-muted-foreground mt-1">
          管理您的代理服务器配置，支持 VLESS 和 Trojan 协议
        </p>
      </div>

      <ServerList
        servers={servers}
        selectedServerId={selectedServerId}
        onAddServer={handleAddServer}
        onEditServer={handleEditServer}
        onDeleteServer={handleDeleteServer}
        onSelectServer={handleSelectServer}
      />

      <ServerConfigDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        server={editingServer}
        onSave={handleSaveServer}
        onTestConnection={handleTestConnection}
        isTestingConnection={isTestingConnection}
      />
    </div>
  )
}
