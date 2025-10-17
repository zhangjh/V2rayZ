import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, CheckCircle2 } from 'lucide-react'
import type { ServerConfig } from '@/bridge/types'

const vlessFormSchema = z.object({
  address: z.string().min(1, '服务器地址不能为空'),
  port: z.number().min(1, '端口必须大于 0').max(65535, '端口必须小于 65536'),
  uuid: z.string()
    .min(1, 'UUID 不能为空')
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'UUID 格式不正确'),
  encryption: z.string().optional(),
  network: z.enum(['Tcp', 'Ws', 'H2']),
  security: z.enum(['None', 'Tls']),
  tlsServerName: z.string().optional(),
  tlsAllowInsecure: z.boolean(),
  // WebSocket specific settings
  wsPath: z.string().optional(),
  wsHost: z.string().optional(),
})

type VlessFormValues = z.infer<typeof vlessFormSchema>

interface VlessFormProps {
  serverConfig?: ServerConfig
  onSubmit: (config: any) => Promise<void>
  onTestConnection: () => Promise<void>
  isTestingConnection: boolean
}

export function VlessForm({ serverConfig, onSubmit, onTestConnection, isTestingConnection }: VlessFormProps) {
  const form = useForm<VlessFormValues>({
    resolver: zodResolver(vlessFormSchema),
    defaultValues: {
      address: '',
      port: 443,
      uuid: '',
      encryption: 'none',
      network: 'Tcp',
      security: 'Tls',
      tlsServerName: '',
      tlsAllowInsecure: false,
      wsPath: '',
      wsHost: '',
    },
  })

  useEffect(() => {
    console.log('[VlessForm] Server config changed:', serverConfig)
    if (serverConfig && serverConfig.protocol === 'Vless') {
      const formData = {
        address: serverConfig.address || '',
        port: serverConfig.port || 443,
        uuid: serverConfig.uuid || '',
        encryption: serverConfig.encryption || 'none',
        network: serverConfig.network || 'Tcp',
        security: serverConfig.security || 'Tls',
        tlsServerName: serverConfig.tlsSettings?.serverName || '',
        tlsAllowInsecure: serverConfig.tlsSettings?.allowInsecure || false,
        wsPath: serverConfig.wsSettings?.path || '',
        wsHost: serverConfig.wsSettings?.host || '',
      }
      console.log('[VlessForm] Resetting form with:', formData)
      form.reset(formData)
    }
  }, [serverConfig, form])

  const handleSubmit = async (values: VlessFormValues) => {
    const serverConfig = {
      protocol: 'Vless' as const,
      address: values.address,
      port: values.port,
      uuid: values.uuid,
      encryption: values.encryption || 'none',
      network: values.network,
      security: values.security,
      tlsSettings: values.security === 'Tls' ? {
        serverName: values.tlsServerName || null,
        allowInsecure: values.tlsAllowInsecure,
      } : null,
      wsSettings: values.network === 'Ws' ? {
        path: values.wsPath || '/',
        host: values.wsHost || null,
      } : null,
    }

    await onSubmit(serverConfig)
  }

  const isTlsEnabled = form.watch('security') === 'Tls'
  const isWebSocketEnabled = form.watch('network') === 'Ws'

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
              <FormDescription>
                服务器的域名或 IP 地址
              </FormDescription>
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
              <FormDescription>
                服务器端口号（1-65535）
              </FormDescription>
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
                <Input
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                用户 ID，格式为标准 UUID
              </FormDescription>
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
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择加密方式" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">none</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                VLESS 协议的加密方式（通常为 none）
              </FormDescription>
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
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
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
              <FormDescription>
                底层传输协议类型
              </FormDescription>
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
              <Select
                onValueChange={field.onChange}
                value={field.value}
              >
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
              <FormDescription>
                传输层安全协议
              </FormDescription>
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
                  <FormDescription>
                    用于 TLS SNI，留空则使用服务器地址
                  </FormDescription>
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
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>允许不安全的连接</FormLabel>
                    <FormDescription>
                      跳过 TLS 证书验证（不推荐，仅用于测试）
                    </FormDescription>
                  </div>
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
                  <FormDescription>
                    WebSocket 连接路径
                  </FormDescription>
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
                  <FormDescription>
                    WebSocket 伪装域名，留空则使用服务器地址
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            保存配置
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onTestConnection}
            disabled={isTestingConnection || form.formState.isSubmitting}
          >
            {isTestingConnection ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            测试连接
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
  )
}
