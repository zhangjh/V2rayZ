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

// 添加模式：支持多行域名输入
const addRuleFormSchema = z.object({
  domains: z.string().min(1, '域名不能为空'),
  action: z.enum(['proxy', 'direct', 'block']),
  enabled: z.boolean(),
});

// 编辑模式：单个域名
const editRuleFormSchema = z.object({
  domain: z.string().min(1, '域名不能为空').regex(domainRegex, '域名格式不正确'),
  action: z.enum(['proxy', 'direct', 'block']),
  enabled: z.boolean(),
});

type AddRuleFormValues = z.infer<typeof addRuleFormSchema>;
type EditRuleFormValues = z.infer<typeof editRuleFormSchema>;

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  rule?: DomainRule;
}

export function RuleDialog({ open, onOpenChange, mode, rule }: RuleDialogProps) {
  const addCustomRulesBatch = useAppStore((state) => state.addCustomRulesBatch);
  const updateCustomRule = useAppStore((state) => state.updateCustomRule);

  // 添加模式使用多行表单
  const addForm = useForm<AddRuleFormValues>({
    resolver: zodResolver(addRuleFormSchema),
    defaultValues: {
      domains: '',
      action: 'proxy',
      enabled: true,
    },
  });

  // 编辑模式使用单行表单
  const editForm = useForm<EditRuleFormValues>({
    resolver: zodResolver(editRuleFormSchema),
    defaultValues: {
      domain: '',
      action: 'proxy',
      enabled: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && rule) {
        editForm.reset({
          domain: rule.domain,
          action: rule.action,
          enabled: rule.enabled,
        });
      } else {
        addForm.reset({
          domains: '',
          action: 'proxy',
          enabled: true,
        });
      }
    }
  }, [open, mode, rule, addForm, editForm]);

  // 解析多行域名输入
  const parseDomains = (input: string): string[] => {
    return input
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  // 验证域名格式
  const validateDomain = (domain: string): boolean => {
    return domainRegex.test(domain);
  };

  const onAddSubmit = async (values: AddRuleFormValues) => {
    try {
      const domains = parseDomains(values.domains);

      if (domains.length === 0) {
        toast.error('请输入至少一个域名');
        return;
      }

      // 验证所有域名格式
      const invalidDomains = domains.filter((d) => !validateDomain(d));
      if (invalidDomains.length > 0) {
        toast.error('域名格式不正确', {
          description: `以下域名格式无效: ${invalidDomains.slice(0, 3).join(', ')}${invalidDomains.length > 3 ? '...' : ''}`,
        });
        return;
      }

      // 批量创建规则
      const newRules: DomainRule[] = domains.map((domain) => ({
        id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        domain,
        action: values.action as RuleAction,
        enabled: values.enabled,
      }));

      await addCustomRulesBatch(newRules);
      toast.success(`已添加 ${newRules.length} 条规则`);
      onOpenChange(false);
    } catch (error) {
      toast.error('保存失败', {
        description: error instanceof Error ? error.message : '保存规则时发生错误',
      });
    }
  };

  const onEditSubmit = async (values: EditRuleFormValues) => {
    try {
      if (!rule) return;

      const updatedRule: DomainRule = {
        ...rule,
        domain: values.domain,
        action: values.action as RuleAction,
        enabled: values.enabled,
      };
      await updateCustomRule(updatedRule);
      toast.success('规则已更新');
      onOpenChange(false);
    } catch (error) {
      toast.error('保存失败', {
        description: error instanceof Error ? error.message : '保存规则时发生错误',
      });
    }
  };

  // 添加模式的表单
  if (mode === 'add') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>添加规则</DialogTitle>
            <DialogDescription>添加新的域名代理规则，支持批量添加（每行一个域名）</DialogDescription>
          </DialogHeader>

          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-6">
              <FormField
                control={addForm.control}
                name="domains"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>域名</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={`example.com\n*.google.com\ngithub.com`}
                        className="min-h-[120px] font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      每行输入一个域名，支持通配符（如 *.example.com）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addForm.control}
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
                control={addForm.control}
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={addForm.formState.isSubmitting}
                >
                  取消
                </Button>
                <Button type="submit" disabled={addForm.formState.isSubmitting}>
                  {addForm.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  添加
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }

  // 编辑模式的表单
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>编辑规则</DialogTitle>
          <DialogDescription>修改现有的域名代理规则</DialogDescription>
        </DialogHeader>

        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
            <FormField
              control={editForm.control}
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
              control={editForm.control}
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
              control={editForm.control}
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
                disabled={editForm.formState.isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={editForm.formState.isSubmitting}>
                {editForm.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                保存
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
