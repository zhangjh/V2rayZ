import { useEffect } from 'react';
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

const trojanFormSchema = z.object({
  address: z.string().min(1, '服务器地址不能为空'),
  port: z.number().min(1, '端口必须大于 0').max(65535, '端口必须小于 65536'),
  password: z.string().min(1, '密码不能为空'),
  network: z.enum(['Tcp', 'Ws', 'H2']),
  security: z.enum(['None', 'Tls']),
  tlsServerName: z.string().optional(),
  tlsAllowInsecure: z.boolean(),
});

type TrojanFormValues = z.infer<typeof trojanFormSchema>;

interface TrojanFormProps {
  serverConfig?: ServerConfig;
  onSubmit: (config: any) => Promise<void>;
}

export function TrojanForm({ serverConfig, onSubmit }: TrojanFormProps) {
  const form = useForm<TrojanFormValues>({
    resolver: zodResolver(trojanFormSchema),
    defaultValues: {
      address: '',
      port: 443,
      password: '',
      network: 'Tcp',
      security: 'Tls',
      tlsServerName: '',
      tlsAllowInsecure: false,
    },
  });

  useEffect(() => {
    console.log('[TrojanForm] Server config changed:', serverConfig);
    if (serverConfig && serverConfig.protocol?.toLowerCase() === 'trojan') {
      // 标准化 network 和 security 值（首字母大写）
      const normalizeNetwork = (n: string | undefined): 'Tcp' | 'Ws' | 'H2' => {
        const lower = (n || 'tcp').toLowerCase();
        if (lower === 'ws' || lower === 'websocket') return 'Ws';
        if (lower === 'h2' || lower === 'http2') return 'H2';
        return 'Tcp';
      };
      const normalizeSecurity = (s: string | undefined): 'None' | 'Tls' => {
        const lower = (s || 'tls').toLowerCase();
        return lower === 'none' ? 'None' : 'Tls';
      };

      const formData = {
        address: serverConfig.address || '',
        port: serverConfig.port || 443,
        password: serverConfig.password || '',
        network: normalizeNetwork(serverConfig.network),
        security: normalizeSecurity(serverConfig.security),
        tlsServerName: serverConfig.tlsSettings?.serverName || '',
        tlsAllowInsecure: serverConfig.tlsSettings?.allowInsecure || false,
      };
      console.log('[TrojanForm] Resetting form with:', formData);
      form.reset(formData);
    }
  }, [serverConfig, form]);

  const handleSubmit = async (values: TrojanFormValues) => {
    const serverConfig = {
      protocol: 'Trojan' as const,
      address: values.address,
      port: values.port,
      password: values.password,
      network: values.network,
      security: values.security,
      tlsSettings:
        values.security === 'Tls'
          ? {
              serverName: values.tlsServerName || null,
              allowInsecure: values.tlsAllowInsecure,
            }
          : null,
    };

    await onSubmit(serverConfig);
  };

  const isTlsEnabled = form.watch('security') === 'Tls';

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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>密码 (Password)</FormLabel>
              <FormControl>
                <Input type="password" placeholder="输入 Trojan 密码" {...field} />
              </FormControl>
              <FormDescription>Trojan 服务器的认证密码</FormDescription>
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
