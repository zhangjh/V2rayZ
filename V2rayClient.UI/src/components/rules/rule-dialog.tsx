import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import type { DomainRule } from '@/bridge/types'

// Domain validation regex
// Supports: example.com, *.example.com, subdomain.example.com
const domainRegex = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/

// Validate multiple domains separated by newlines
const validateDomains = (domainsText: string) => {
  const domains = domainsText
    .split('\n')
    .map(d => d.trim())
    .filter(d => d.length > 0)
  
  if (domains.length === 0) {
    return '至少需要输入一个域名'
  }
  
  for (const domain of domains) {
    if (!domainRegex.test(domain)) {
      return `域名格式不正确：${domain}（例如：example.com 或 *.example.com）`
    }
  }
  
  return true
}

const ruleFormSchema = z.object({
  domains: z
    .string()
    .min(1, '域名不能为空')
    .refine(validateDomains, {
      message: '域名格式验证失败'
    }),
  strategy: z.enum(['Proxy', 'Direct']),
  enabled: z.boolean(),
})

type RuleFormValues = z.infer<typeof ruleFormSchema>

interface RuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'add' | 'edit'
  rule?: DomainRule
  rules?: DomainRule[] // For batch edit mode
}

export function RuleDialog({ open, onOpenChange, mode, rule, rules }: RuleDialogProps) {
  const addCustomRule = useAppStore((state) => state.addCustomRule)
  const addCustomRulesBatch = useAppStore((state) => state.addCustomRulesBatch)
  const updateCustomRule = useAppStore((state) => state.updateCustomRule)

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      domains: '',
      strategy: 'Proxy',
      enabled: true,
    },
  })

  // Reset form when dialog opens or rule changes
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && rule) {
        form.reset({
          domains: rule.domain,
          strategy: rule.strategy,
          enabled: rule.enabled,
        })
      } else if (mode === 'edit' && rules && rules.length > 0) {
        // Batch edit mode - show all domains from selected rules
        const domainsText = rules.map(r => r.domain).join('\n')
        form.reset({
          domains: domainsText,
          strategy: rules[0].strategy, // Use first rule's strategy as default
          enabled: rules[0].enabled,   // Use first rule's enabled state as default
        })
      } else {
        form.reset({
          domains: '',
          strategy: 'Proxy',
          enabled: true,
        })
      }
    }
  }, [open, mode, rule, rules, form])

  const onSubmit = async (values: RuleFormValues) => {
    console.log('[RuleDialog] onSubmit called', { mode, values })
    
    try {
      // Parse domains from textarea
      const domains = values.domains
        .split('\n')
        .map(d => d.trim())
        .filter(d => d.length > 0)

      console.log('[RuleDialog] Parsed domains:', domains)

      if (mode === 'add') {
        if (domains.length === 1) {
          // Single domain - use existing logic
          const newRule: DomainRule = {
            id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            domain: domains[0],
            strategy: values.strategy,
            enabled: values.enabled,
          }
          await addCustomRule(newRule)
          toast.success('规则已添加', {
            description: `域名 ${domains[0]} 的规则已成功添加`,
          })
        } else {
          // Multiple domains - use batch add to avoid multiple restarts
          const newRules: DomainRule[] = domains.map(domain => ({
            id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            domain,
            strategy: values.strategy,
            enabled: values.enabled,
          }))
          
          await addCustomRulesBatch(newRules)
          toast.success('规则已添加', {
            description: `已成功添加 ${domains.length} 个域名规则`,
          })
        }
      } else if (mode === 'edit' && rule) {
        // Single rule edit - update with first domain
        console.log('[RuleDialog] Updating rule:', rule.id, 'with domain:', domains[0])
        
        const updatedRule: DomainRule = {
          ...rule,
          domain: domains[0],
          strategy: values.strategy,
          enabled: values.enabled,
        }
        
        console.log('[RuleDialog] Calling updateCustomRule with:', updatedRule)
        await updateCustomRule(updatedRule)
        
        console.log('[RuleDialog] Rule updated successfully')
        toast.success('规则已更新', {
          description: `域名 ${domains[0]} 的规则已成功更新`,
        })
      }
      console.log('[RuleDialog] Operation completed, closing dialog')
      onOpenChange(false)
    } catch (error) {
      console.error('[RuleDialog] Failed to save rule:', error)
      toast.error('保存失败', {
        description: error instanceof Error ? error.message : '保存规则时发生错误',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? '添加规则' : '编辑规则'}</DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? '添加新的域名代理规则'
              : '修改现有的域名代理规则'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="domains"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>域名</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="每行输入一个域名，例如：&#10;example.com&#10;*.google.com&#10;github.com"
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    每行输入一个域名，支持完整域名或通配符域名（*.example.com）
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>策略</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择策略" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Proxy">代理</SelectItem>
                      <SelectItem value="Direct">直连</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    选择该域名的访问方式
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>启用此规则</FormLabel>
                    <FormDescription>
                      禁用的规则不会生效
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {mode === 'add' ? '添加' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
