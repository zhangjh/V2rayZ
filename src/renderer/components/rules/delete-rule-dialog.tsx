import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import type { DomainRule } from '@/bridge/types';

interface DeleteRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: DomainRule;
}

export function DeleteRuleDialog({ open, onOpenChange, rule }: DeleteRuleDialogProps) {
  const deleteCustomRule = useAppStore((state) => state.deleteCustomRule);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!rule.id) {
      toast.error('删除失败', {
        description: '规则 ID 无效',
      });
      return;
    }

    setIsDeleting(true);
    try {
      await deleteCustomRule(rule.id);
      toast.success('规则已删除', {
        description: `包含 ${rule.domains.length} 个域名的规则已成功删除`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error('删除失败', {
        description: error instanceof Error ? error.message : '删除规则时发生错误',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            删除规则
          </DialogTitle>
          <DialogDescription>此操作无法撤销。确定要删除此规则吗？</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
            <div className="text-sm">
              <span className="text-muted-foreground">域名：</span>
              <div className="font-mono font-medium mt-1 max-h-[120px] overflow-y-auto">
                {rule.domains.map((domain, index) => (
                  <div key={index}>{domain}</div>
                ))}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">策略：</span>
              <span className="font-medium">
                {rule.action === 'proxy' ? '代理' : rule.action === 'direct' ? '直连' : '阻止'}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
