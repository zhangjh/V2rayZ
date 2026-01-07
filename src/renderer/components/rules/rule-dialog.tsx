import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import type { DomainRule, RuleAction } from '../../../shared/types';

const domainRegex = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

const ruleFormSchema = z.object({
  domains: z.string().min(1, '域名不能为空'),
  action: z.enum(['proxy', 'direct', 'block']),
  enabled: z.boolean(),
  bypassFakeIP: z.boolean(),
});

type RuleFormValues = z.infer<typeof ruleFormSchema>;

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  rule?: DomainRule;
}

export function RuleDialog({ open, onOpenChange, mode, rule }: RuleDialogProps) {
  const addCustomRule = useAppStore((state) => state.addCustomRule);
  const updateCustomRule = useAppStore((state) => state.updateCustomRule);

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      domains: '',
      action: 'proxy',
      enabled: true,
      bypassFakeIP: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && rule) {
        form.reset({
          domains: rule.domains.join('\n'),
          action: rule.action,
          enabled: rule.enabled,
          bypassFakeIP: rule.bypassFakeIP ?? false,
        });
      } else {
        form.reset({
          domains: '',
          action: 'proxy',
          enabled: true,
          bypassFakeIP: false,
        });
      }
    }
  }, [open, mode, rule, form]);

  const parseDomains = (input: string): string[] => {
    return input
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  const validateDomain = (domain: string): boolean => {
    return domainRegex.test(domain);
  };

  const onSubmit = async (values: RuleFormValues) => {
    try {
      const domains = parseDomains(values.domains);

      if (domains.length === 0) {
        toast.error('请输入至少一个域名');
        return;
      }

      const invalidDomains = domains.filter((d) => !validateDomain(d));
      if (invalidDomains.length > 0) {
        toast.error('域名格式不正确', {
          description: `以下域名格式无效: ${invalidDomains.slice(0, 3).join(', ')}${invalidDomains.length > 3 ? '...' : ''}`,
        });
        return;
      }

      if (mode === 'add') {
        const newRule: DomainRule = {
          id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          domains,
          action: values.action as RuleAction,
          enabled: values.enabled,
          bypassFakeIP: values.bypassFakeIP,
        };
        await addCustomRule(newRule);
        toast.success('规则已添加');
      } else if (rule) {
        const updatedRule: DomainRule = {
          ...rule,
          domains,
          action: values.action as RuleAction,
          enabled: values.enabled,
          bypassFakeIP: values.bypassFakeIP,
        };
        await updateCustomRule(updatedRule);
        toast.success('规则已更新');
      }

      onOpenChange(false);
    } catch (error) {
      toast.error('保存失败', {
        description: error instanceof Error ? error.message : '保存规则时发生错误',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? '添加规则' : '编辑规则'}</DialogTitle>
          <DialogDescription>
            {mode === 'add' ? '添加新的域名代理规则，每行一个域名' : '修改域名代理规则'}
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
                      placeholder={`google.com\ngithub.com\nopenai.com`}
                      className="min-h-[120px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    每行输入一个域名，会自动匹配该域名及其所有子域名
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>策略</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择策略" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="proxy">代理</SelectItem>
                      <SelectItem value="direct">直连</SelectItem>
                      <SelectItem value="block">阻止</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>启用规则</FormLabel>
                    <FormDescription>禁用的规则不会生效</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bypassFakeIP"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>绕过 FakeIP</FormLabel>
                    <FormDescription>
                      默认无需开启，不理解请保持关闭。仅用于解决 Cloudflare Tunnel 等应用的 QUIC 协议兼容性问题。
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
  );
}
