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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { ServerConfig } from '@/bridge/types';

const hysteria2FormSchema = z.object({
  address: z.string().min(1, '服务器地址不能为空'),
  port: z.number().min(1, '端口必须大于 0').max(65535, '端口必须小于 65536'),
  password: z.string().min(1, '密码不能为空'),
  // 带宽限制
  upMbps: z.number().optional(),
  downMbps: z.number().optional(),
  // 混淆设置
  obfsEnabled: z.boolean(),
  obfsPassword: z.string().optional(),
  // TLS 设置
  tlsServerName: z.string().optional(),
  tlsAllowInsecure: z.boolean(),
});

type Hysteria2FormValues = z.infer<typeof hysteria2FormSchema>;

interface Hysteria2FormProps {
  serverConfig?: ServerConfig;
  onSubmit: (config: any) => Promise<void>;
}

export function Hysteria2Form({ serverConfig, onSubmit }: Hysteria2FormProps) {
  const form = useForm<Hysteria2FormValues>({
    resolver: zodResolver(hysteria2FormSchema),
    defaultValues: {
      address: '',
      port: 443,
      password: '',
      upMbps: undefined,
      downMbps: undefined,
      obfsEnabled: false,
      obfsPassword: '',
      tlsServerName: '',
      tlsAllowInsecure: false,
    },
  });

  useEffect(() => {
    console.log('[Hysteria2Form] Server config changed:', serverConfig);
    if (serverConfig && serverConfig.protocol?.toLowerCase() === 'hysteria2') {
      const formData = {
        address: serverConfig.address || '',
        port: serverConfig.port || 443,
        password: serverConfig.password || '',
        upMbps: serverConfig.hysteria2Settings?.upMbps ?? undefined,
        downMbps: serverConfig.hysteria2Settings?.downMbps ?? undefined,
        obfsEnabled: !!serverConfig.hysteria2Settings?.obfs?.type,
        obfsPassword: serverConfig.hysteria2Settings?.obfs?.password || '',
        tlsServerName: serverConfig.tlsSettings?.serverName || '',
        tlsAllowInsecure: serverConfig.tlsSettings?.allowInsecure || false,
      };
      console.log('[Hysteria2Form] Resetting form with:', formData);
      form.reset(formData);
    }
  }, [serverConfig, form]);

  const handleSubmit = async (values: Hysteria2FormValues) => {
    const serverConfig: any = {
      protocol: 'hysteria2' as const,
      address: values.address,
      port: values.port,
      password: values.password,
      // Hysteria2 总是使用 TLS
      security: 'tls',
      tlsSettings: {
        serverName: values.tlsServerName || undefined,
        allowInsecure: values.tlsAllowInsecure,
      },
      hysteria2Settings: {
        upMbps: values.upMbps || undefined,
        downMbps: values.downMbps || undefined,
        obfs: values.obfsEnabled && values.obfsPassword
          ? {
              type: 'salamander',
              password: values.obfsPassword,
            }
          : undefined,
      },
    };

    await onSubmit(serverConfig);
  };

  const isObfsEnabled = form.watch('obfsEnabled');

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
                <Input type="password" placeholder="输入 Hysteria2 密码" {...field} />
              </FormControl>
              <FormDescription>Hysteria2 服务器的认证密码</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="upMbps"
            render={({ field }) => (
              <FormItem>
                <FormLabel>上行带宽 (Mbps)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="可选"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      field.onChange(val ? parseInt(val) : undefined);
                    }}
                  />
                </FormControl>
                <FormDescription>留空使用 BBR</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="downMbps"
            render={({ field }) => (
              <FormItem>
                <FormLabel>下行带宽 (Mbps)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="可选"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      field.onChange(val ? parseInt(val) : undefined);
                    }}
                  />
                </FormControl>
                <FormDescription>留空使用 BBR</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="obfsEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>启用 QUIC 流量混淆</FormLabel>
                <FormDescription>使用 Salamander 混淆器伪装 QUIC 流量</FormDescription>
              </div>
            </FormItem>
          )}
        />

        {isObfsEnabled && (
          <FormField
            control={form.control}
            name="obfsPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>混淆密码</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="输入混淆密码" {...field} />
                </FormControl>
                <FormDescription>Salamander 混淆器密码，需与服务端一致</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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
