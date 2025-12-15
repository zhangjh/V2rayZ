import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { toast } from 'sonner';

export function AdvancedSettings() {
  const config = useAppStore((state) => state.config);
  const saveConfig = useAppStore((state) => state.saveConfig);

  const [socksPort, setSocksPort] = useState(config?.socksPort?.toString() || '65534');
  const [httpPort, setHttpPort] = useState(config?.httpPort?.toString() || '65533');
  const [isLoading, setIsLoading] = useState(false);

  const handleSavePorts = async () => {
    if (!config) return;

    const socksPortNum = parseInt(socksPort, 10);
    const httpPortNum = parseInt(httpPort, 10);

    // Validate ports
    if (isNaN(socksPortNum) || socksPortNum < 1024 || socksPortNum > 65535) {
      toast.error('SOCKS 端口必须在 1024-65535 之间');
      return;
    }

    if (isNaN(httpPortNum) || httpPortNum < 1024 || httpPortNum > 65535) {
      toast.error('HTTP 端口必须在 1024-65535 之间');
      return;
    }

    if (socksPortNum === httpPortNum) {
      toast.error('SOCKS 和 HTTP 端口不能相同');
      return;
    }

    setIsLoading(true);
    try {
      const updatedConfig = {
        ...config,
        socksPort: socksPortNum,
        httpPort: httpPortNum,
      };
      await saveConfig(updatedConfig);
      toast.success('端口设置已保存，重启代理后生效');
    } catch {
      toast.error('保存端口设置失败');
    } finally {
      setIsLoading(false);
    }
  };

  if (!config) {
    return null;
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
            <p className="text-xs text-muted-foreground">默认: 65534</p>
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
            <p className="text-xs text-muted-foreground">默认: 65533</p>
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
                        navigator.clipboard.writeText(
                          `set http_proxy=http://127.0.0.1:${httpPort}`
                        );
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      set https_proxy=http://127.0.0.1:{httpPort}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `set https_proxy=http://127.0.0.1:${httpPort}`
                        );
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Windows (PowerShell)
                </Label>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      $env:http_proxy="http://127.0.0.1:{httpPort}"
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `$env:http_proxy="http://127.0.0.1:${httpPort}"`
                        );
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      $env:https_proxy="http://127.0.0.1:{httpPort}"
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `$env:https_proxy="http://127.0.0.1:${httpPort}"`
                        );
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  Linux/macOS (Bash/Zsh)
                </Label>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      export http_proxy=http://127.0.0.1:{httpPort}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `export http_proxy=http://127.0.0.1:${httpPort}`
                        );
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      export https_proxy=http://127.0.0.1:{httpPort}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `export https_proxy=http://127.0.0.1:${httpPort}`
                        );
                        toast.success('已复制到剪贴板');
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
                        navigator.clipboard.writeText(
                          `git config --global http.proxy http://127.0.0.1:${httpPort}`
                        );
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      git config --global https.proxy http://127.0.0.1:{httpPort}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `git config --global https.proxy http://127.0.0.1:${httpPort}`
                        );
                        toast.success('已复制到剪贴板');
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
                        navigator.clipboard.writeText(
                          `npm config set proxy http://127.0.0.1:${httpPort}`
                        );
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      npm config set https-proxy http://127.0.0.1:{httpPort}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `npm config set https-proxy http://127.0.0.1:${httpPort}`
                        );
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-muted-foreground">
                  SOCKS5 代理设置（通用）
                </Label>
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      set ALL_PROXY=socks5://127.0.0.1:{socksPort}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `set ALL_PROXY=socks5://127.0.0.1:${socksPort}`
                        );
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      $env:ALL_PROXY="socks5://127.0.0.1:{socksPort}"
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `$env:ALL_PROXY="socks5://127.0.0.1:${socksPort}"`
                        );
                        toast.success('已复制到剪贴板');
                      }}
                    >
                      复制
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1 text-xs bg-muted rounded font-mono">
                      export ALL_PROXY=socks5://127.0.0.1:{socksPort}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `export ALL_PROXY=socks5://127.0.0.1:${socksPort}`
                        );
                        toast.success('已复制到剪贴板');
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
                <li>• HTTP 代理端口：{httpPort}（推荐，兼容性最好）</li>
                <li>• SOCKS5 代理端口：{socksPort}（部分工具支持）</li>
                <li>• 取消代理：删除或注释相关环境变量</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
