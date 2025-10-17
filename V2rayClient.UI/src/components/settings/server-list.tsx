
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Edit, Trash2, Server } from 'lucide-react'
import type { ServerConfigWithId } from '@/bridge/types'

interface ServerListProps {
    servers: ServerConfigWithId[]
    selectedServerId?: string
    onAddServer: () => void
    onEditServer: (server: ServerConfigWithId) => void
    onDeleteServer: (serverId: string) => void
    onSelectServer: (serverId: string) => void
}

export function ServerList({
    servers,
    selectedServerId,
    onAddServer,
    onEditServer,
    onDeleteServer,
    onSelectServer,
}: ServerListProps) {
    const handleDelete = (serverId: string) => {
        onDeleteServer(serverId)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('zh-CN')
    }

    const getProtocolBadgeVariant = (protocol: string) => {
        return protocol === 'Vless' ? 'default' : 'secondary'
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">服务器列表</h3>
                    <p className="text-sm text-muted-foreground">
                        管理您的代理服务器配置
                    </p>
                </div>
                <Button onClick={onAddServer} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    添加服务器
                </Button>
            </div>

            {servers.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Server className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">暂无服务器配置</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center">
                            您还没有添加任何服务器配置。点击上方按钮添加您的第一个服务器。
                        </p>
                        <Button onClick={onAddServer} className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            添加服务器
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {servers.map((server) => (
                        <Card
                            key={server.id}
                            className={`cursor-pointer transition-colors ${selectedServerId === server.id
                                ? 'ring-2 ring-primary bg-primary/5'
                                : 'hover:bg-muted/50'
                                }`}
                            onClick={() => onSelectServer(server.id)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CardTitle className="text-base">{server.name}</CardTitle>
                                        <Badge variant={getProtocolBadgeVariant(server.protocol)}>
                                            {server.protocol}
                                        </Badge>
                                        {selectedServerId === server.id && (
                                            <Badge variant="outline" className="text-xs">
                                                当前选中
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onEditServer(server)
                                            }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>删除服务器配置</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        确定要删除服务器 "{server.name}" 吗？此操作无法撤销。
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(server.id)}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        删除
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                                <CardDescription>
                                    {server.address}:{server.port}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">传输协议:</span>
                                        <span className="ml-2 font-medium">{server.network}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">加密:</span>
                                        <span className="ml-2 font-medium">{server.security}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground">创建时间:</span>
                                        <span className="ml-2 font-medium">{formatDate(server.createdAt)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}