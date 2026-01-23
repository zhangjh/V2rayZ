import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { ServerConfig } from '@/bridge/types';

const vlessFormSchema = z.object({
  address: z.string().min(1, '服务器地址不能为空'),
  port: z.number().min(1, '端口必须大于 0').max(65535, '端口必须小于 65536'),
  uuid: z
    .string()
    .min(1, 'UUID 不能为空')
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'UUID 格式不正确'),
  encryption: z.string().optional(),
  flow: z.string().optional(),
  network: z.enum(['Tcp', 'Ws', 'H2']),
  security: z.enum(['None', 'Tls', 'Reality']),
  tlsServerName: z.string().optional(),
  tlsAllowInsecure: z.boolean(),
  tlsFingerprint: z.string().optional(),
  realityPublicKey: z.string().optional(),
  realityShortId: z.string().optional(),
  wsPath: z.string().optional(),
  wsHost: z.string().optional(),
});

type VlessFormValues = z.infer<typeof vlessFormSchema>;

interface VlessFormProps {
  serverConfig?: ServerConfig;
  onSubmit: (config: any) => Promise<void>;
}

export function VlessForm({ serverConfig, onSubmit }: VlessFormProps) {
  const normalizeNetwork = (n: string | undefined): 'Tcp' | 'Ws' | 'H2' => {
    const lower = (n || 'tcp').toLowerCase();
    if (lower === 'ws' || lower === 'websocket') return 'Ws';
    if (lower === 'h2' || lower === 'http2') return 'H2';
    return 'Tcp';
  };

  const normalizeSecurity = (s: string | undefined): 'None' | 'Tls' | 'Reality' => {
    const lower = (s || 'tls').toLowerCase();
    if (lower === 'none') return 'None';
    if (lower === 'reality') return 'Reality';
    return 'Tls';
  };

  const getDefaultValues = (): VlessFormValues => {
    if (serverConfig && serverConfig.protocol?.toLowerCase() === 'vless') {
      return {
        address: serverConfig.address || '',
        port: serverConfig.port || 443,
        uuid: serverConfig.uuid || '',
        encryption: serverConfig.encryption || 'none',
        flow: serverConfig.flow || '',
        network: normalizeNetwork(serverConfig.network),
        security: normalizeSecurity(serverConfig.security),
        tlsServerName: serverConfig.tlsSettings?.serverName || '',
        tlsAllowInsecure: serverConfig.tlsSettings?.allowInsecure || false,
        tlsFingerprint: serverConfig.tlsSettings?.fingerprint || 'chrome',
        realityPublicKey: serverConfig.realitySettings?.publicKey || '',
        realityShortId: serverConfig.realitySettings?.shortId || '',
        wsPath: serverConfig.wsSettings?.path || '',
        wsHost: serverConfig.wsSettings?.headers?.['Host'] || '',
      };
    }
    return {
      address: '',
      port: 443,
      uuid: '',
      encryption: 'none',
      flow: '',
      network: 'Tcp',
      security: 'Tls',
      tlsServerName: '',
      tlsAllowInsecure: false,
      tlsFingerprint: 'chrome',
      realityPublicKey: '',
      realityShortId: '',
      wsPath: '',
      wsHost: '',
    };
  };

  const form = useForm<VlessFormValues>({
    resolver: zodResolver(vlessFormSchema),
    defaultValues: getDefaultValues(),
  });

  const handleSubmit = async (values: VlessFormValues) => {
    const network = values.network.toLowerCase() as 'tcp' | 'ws' | 'h2';
    const security = values.security.toLowerCase() as 'none' | 'tls' | 'reality';

    const serverConfig = {
      protocol: 'vless' as const,
      address: values.address,
      port: values.port,
      uuid: values.uuid,
      encryption: values.encryption || 'none',
      flow: values.flow || undefined,
      network,
      security,
      tlsSettings:
        security === 'tls' || security === 'reality'
          ? {
              serverName: values.tlsServerName?.trim() || null,
              allowInsecure: security === 'tls' ? values.tlsAllowInsecure : false,
              fingerprint: values.tlsFingerprint || 'chrome',
            }
          : null,
      realitySettings:
        security === 'reality'
          ? {
              publicKey: values.realityPublicKey?.trim() || '',
              shortId: values.realityShortId?.trim() || undefined,
            }
          : null,
      wsSettings:
        network === 'ws'
          ? {
              path: values.wsPath || '/',
              host: values.wsHost || null,
            }
          : null,
    };

    await onSubmit(serverConfig);
  };

  const isTlsEnabled = form.watch('security') === 'Tls';
  const isRealityEnabled = form.watch('security') === 'Reality';
  const isWebSocketEnabled = form.watch('network') === 'Ws';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>服务器地址</FormLabel>
              <FormControl>
                <Input placeholder="example.com" {...field} />
              </FormControl>
              <FormDescription>服务器的域名或 IP 地址</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="port"
          render={({ field }) => (
            <FormItem>
              <FormLabel>端口</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="443"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                />
              </FormControl>
              <FormDescription>服务器端口号（1-65535）</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="uuid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>UUID</FormLabel>
              <FormControl>
                <Input placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" {...field} />
              </FormControl>
              <FormDescription>用户 ID，格式为标准 UUID</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="encryption"
          render={({ field }) => (
            <FormItem>
              <FormLabel>加密方式</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择加密方式" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">none</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>VLESS 协议的加密方式（通常为 none）</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="network"
          render={({ field }) => (
            <FormItem>
              <FormLabel>传输协议</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择传输协议" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Tcp">TCP</SelectItem>
                  <SelectItem value="Ws">WebSocket</SelectItem>
                  <SelectItem value="H2">HTTP/2</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>底层传输协议类型</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="security"
          render={({ field }) => (
            <FormItem>
              <FormLabel>传输层加密</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择传输层加密" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="None">无</SelectItem>
                  <SelectItem value="Tls">TLS</SelectItem>
                  <SelectItem value="Reality">Reality</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>传输层安全协议</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {isTlsEnabled && (
          <>
            <FormField
              control={form.control}
              name="tlsServerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TLS 服务器名称（可选）</FormLabel>
                  <FormControl>
                    <Input placeholder="example.com" {...field} />
                  </FormControl>
                  <FormDescription>用于 TLS SNI，留空则使用服务器地址</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tlsFingerprint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TLS 指纹</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择 TLS 指纹" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="chrome">Chrome</SelectItem>
                      <SelectItem value="firefox">Firefox</SelectItem>
                      <SelectItem value="safari">Safari</SelectItem>
                      <SelectItem value="edge">Edge</SelectItem>
                      <SelectItem value="ios">iOS</SelectItem>
                      <SelectItem value="android">Android</SelectItem>
                      <SelectItem value="random">随机</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>uTLS 客户端指纹伪装</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tlsAllowInsecure"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>允许不安全的连接</FormLabel>
                    <FormDescription>跳过 TLS 证书验证（不推荐，仅用于测试）</FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </>
        )}

        {isRealityEnabled && (
          <>
            <FormField
              control={form.control}
              name="tlsServerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目标网站（SNI）</FormLabel>
                  <FormControl>
                    <Input placeholder="www.microsoft.com" {...field} />
                  </FormControl>
                  <FormDescription>Reality 伪装的目标网站域名</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="realityPublicKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Public Key</FormLabel>
                  <FormControl>
                    <Input placeholder="服务端生成的公钥" {...field} />
                  </FormControl>
                  <FormDescription>Reality 公钥，由服务端生成</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="realityShortId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short ID（可选）</FormLabel>
                  <FormControl>
                    <Input placeholder="留空或填写服务端配置的值" {...field} />
                  </FormControl>
                  <FormDescription>Reality Short ID，需与服务端配置一致</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tlsFingerprint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TLS 指纹</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择 TLS 指纹" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="chrome">Chrome</SelectItem>
                      <SelectItem value="firefox">Firefox</SelectItem>
                      <SelectItem value="safari">Safari</SelectItem>
                      <SelectItem value="edge">Edge</SelectItem>
                      <SelectItem value="ios">iOS</SelectItem>
                      <SelectItem value="android">Android</SelectItem>
                      <SelectItem value="random">随机</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>uTLS 客户端指纹伪装</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="flow"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Flow（可选）</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === '_none' ? '' : v)}
                    value={field.value || '_none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择 Flow 控制" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">无</SelectItem>
                      <SelectItem value="xtls-rprx-vision">xtls-rprx-vision</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>XTLS 流控，Reality 推荐使用 xtls-rprx-vision</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {isWebSocketEnabled && (
          <>
            <FormField
              control={form.control}
              name="wsPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WebSocket 路径</FormLabel>
                  <FormControl>
                    <Input placeholder="" {...field} />
                  </FormControl>
                  <FormDescription>WebSocket 连接路径</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="wsHost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WebSocket 主机头（可选）</FormLabel>
                  <FormControl>
                    <Input placeholder="example.com" {...field} />
                  </FormControl>
                  <FormDescription>WebSocket 伪装域名，留空则使用服务器地址</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex gap-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存配置
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={form.formState.isSubmitting}
          >
            重置
          </Button>
        </div>
      </form>
    </Form>
  );
}
