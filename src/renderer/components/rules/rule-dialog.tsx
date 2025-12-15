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
import { Input } from '@/components/ui/input';
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
  domain: z.string().min(1, '域名不能为空').regex(domainRegex, '域名格式不正确'),
  action: z.enum(['proxy', 'direct', 'block']),
  enabled: z.boolean(),
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
      domain: '',
      action: 'proxy',
      enabled: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && rule) {
        form.reset({
          domain: rule.domain,
          action: rule.action,
          enabled: rule.enabled,
        });
      } else {
        form.reset({
          domain: '',
          action: 'proxy',
          enabled: true,
        });
      }
    }
  }, [open, mode, rule, form]);

  const onSubmit = async (values: RuleFormValues) => {
    try {
      if (mode === 'add') {
        const newRule: DomainRule = {
          id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          domain: values.domain,
          action: values.action as RuleAction,
          enabled: values.enabled,
        };
        await addCustomRule(newRule);
        toast.success('规则已添加');
      } else if (mode === 'edit' && rule) {
        const updatedRule: DomainRule = {
          ...rule,
          domain: values.domain,
          action: values.action as RuleAction,
          enabled: values.enabled,
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
            {mode === 'add' ? '添加新的域名代理规则' : '修改现有的域名代理规则'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>域名</FormLabel>
                  <FormControl>
                    <Input placeholder="example.com 或 *.example.com" {...field} />
                  </FormControl>
                  <FormDescription>支持完整域名或通配符域名</FormDescription>
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
                    <FormLabel>启用此规则</FormLabel>
                    <FormDescription>禁用的规则不会生效</FormDescription>
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
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'add' ? '添加' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
