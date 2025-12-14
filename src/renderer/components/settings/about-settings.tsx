import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ExternalLink, Loader2 } from 'lucide-react'
import { getVersionInfo, checkForUpdates } from '@/bridge/api-wrapper'

interface VersionInfo {
  appVersion: string
  appName: string
  buildDate: string
  singBoxVersion: string
  copyright: string
  repositoryUrl: string
}

export function AboutSettings() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  useEffect(() => {
    loadVersionInfo()
  }, [])

  const loadVersionInfo = async () => {
    try {
      setLoading(true)
      const response = await getVersionInfo()
      if (response && response.success && response.data) {
        setVersionInfo(response.data)
      }
    } catch (error) {
      console.error('Failed to load version info:', error)
      toast.error('无法加载版本信息')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckUpdate = async () => {
    try {
      setCheckingUpdate(true)
      const response = await checkForUpdates()
      if (response && response.success) {
        toast.success('正在检查更新...')
      } else {
        toast.error('检查更新失败')
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
      toast.error('检查更新失败')
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleOpenGitHub = () => {
    if (versionInfo?.repositoryUrl) {
      window.open(versionInfo.repositoryUrl, '_blank')
    } else {
      toast.info('GitHub 链接: https://github.com/zhangjh/V2rayZ')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>关于</CardTitle>
          <CardDescription>应用程序信息</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>关于</CardTitle>
        <CardDescription>应用程序信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">应用版本</h4>
            <p className="text-lg font-semibold">
              {versionInfo?.appName || 'V2rayZ'} v{versionInfo?.appVersion || '1.0.0'}
            </p>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium text-muted-foreground">sing-box 版本</h4>
            <p className="text-lg font-semibold">{versionInfo?.singBoxVersion || 'Unknown'}</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Button 
              onClick={handleCheckUpdate} 
              disabled={checkingUpdate}
              className="w-full sm:w-auto"
            >
              {checkingUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {checkingUpdate ? '检查中...' : '检查更新'}
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">开源项目</h4>
            <Button
              variant="outline"
              onClick={handleOpenGitHub}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              GitHub
            </Button>
          </div>

          <Separator />

          <div className="text-xs text-muted-foreground space-y-1">
            <p>{versionInfo?.copyright || '© 2025 V2rayZ. All rights reserved.'}</p>
            <p>基于 sing-box 构建的 Windows 客户端</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
