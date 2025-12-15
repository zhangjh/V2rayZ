import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ProxyModeType } from '@/bridge/types';

export function ProxyModeSettings() {
  const config = useAppStore((state) => state.config);
  const saveConfig = useAppStore((state) => state.saveConfig);
  const connectionStatus = useAppStore((state) => state.connectionStatus);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingModeType, setPendingModeType] = useState<ProxyModeType | null>(null);

  if (!config) {
    return null;
  }

  const isConnected = connectionStatus?.proxyCore?.running && connectionStatus?.proxy?.enabled;

  const handleModeTypeChange = (value: ProxyModeType) => {
    if (isConnected) {
      setPendingModeType(value);
      setShowConfirmDialog(true);
    } else {
      applyModeTypeChange(value);
    }
  };

  const applyModeTypeChange = async (modeType: ProxyModeType) => {
    try {
      const updatedConfig = {
        ...config,
        proxyModeType: modeType,
      };

      await saveConfig(updatedConfig);
      toast.success('代理模式已更新', {
        description: isConnected ? '请重新连接以应用新模式' : undefined,
      });
    } catch {
      toast.error('保存设置失败');
    }
  };

  const handleConfirmModeChange = () => {
    if (pendingModeType) {
      applyModeTypeChange(pendingModeType);
      setPendingModeType(null);
    }
    setShowConfirmDialog(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>代理模式</CardTitle>
          <CardDescription>选择代理实现方式</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>代理实现模式</Label>
            <RadioGroup
              value={config.proxyModeType}
              onValueChange={(value) => handleModeTypeChange(value as ProxyModeType)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="systemProxy" id="system-proxy" />
                <Label htmlFor="system-proxy" className="cursor-pointer font-normal">
                  <div>
                    <div className="font-medium">系统代理模式</div>
                    <div className="text-sm text-muted-foreground">
                      通过配置系统HTTP/SOCKS代理转发流量（传统模式）
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tun" id="tun-mode" />
                <Label htmlFor="tun-mode" className="cursor-pointer font-normal">
                  <div>
                    <div className="font-medium">TUN模式</div>
                    <div className="text-sm text-muted-foreground">
                      通过虚拟网络接口实现透明代理（需要管理员权限）
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground mt-2">
              TUN模式会自动配置虚拟网卡和DNS，无需手动设置
            </p>
          </div>

          {isConnected && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ 当前已连接，切换代理模式需要重新连接
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认切换代理模式</AlertDialogTitle>
            <AlertDialogDescription>
              切换代理模式将断开当前连接，您需要手动重新连接。
              <br />
              <br />
              确定要切换到{' '}
              <strong>
                {pendingModeType?.toLowerCase() === 'tun' ? 'TUN模式' : '系统代理模式'}
              </strong>{' '}
              吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingModeType(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmModeChange}>确认切换</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
