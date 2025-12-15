import { ConnectionStatusCard } from '@/components/home/connection-status-card';
import { ProxyModeSelector } from '@/components/home/proxy-mode-selector';
import { RealTimeLogs } from '@/components/home/real-time-logs';

export function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">首页</h2>
        <p className="text-muted-foreground mt-1">连接状态和快速操作</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ConnectionStatusCard />
        <ProxyModeSelector />
      </div>

      <RealTimeLogs />
    </div>
  );
}
