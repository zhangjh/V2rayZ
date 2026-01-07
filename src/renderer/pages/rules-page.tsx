import { useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { RuleDialog } from '@/components/rules/rule-dialog';
import { DeleteRuleDialog } from '@/components/rules/delete-rule-dialog';
import type { DomainRule } from '@/bridge/types';

export function RulesPage() {
  const config = useAppStore((state) => state.config);
  const updateCustomRule = useAppStore((state) => state.updateCustomRule);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DomainRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<DomainRule | null>(null);

  const customRules = config?.customRules || [];

  const handleToggleRule = async (rule: DomainRule) => {
    await updateCustomRule({
      ...rule,
      enabled: !rule.enabled,
    });
  };

  const handleEditRule = (rule: DomainRule) => {
    setEditingRule(rule);
  };

  const handleDeleteRule = (rule: DomainRule) => {
    setDeletingRule(rule);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">自定义规则</h2>
          <p className="text-muted-foreground mt-1">管理域名代理规则</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          添加规则
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>域名规则列表</CardTitle>
          <CardDescription>自定义规则优先级最高，将覆盖全局代理模式和智能分流规则</CardDescription>
        </CardHeader>
        <CardContent>
          {customRules.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">暂无自定义规则</p>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加第一条规则
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">启用</TableHead>
                  <TableHead>域名</TableHead>
                  <TableHead className="w-[160px]">策略</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => handleToggleRule(rule)}
                      />
                    </TableCell>
                    <TableCell className="font-mono">
                      <div className="max-w-[400px]">
                        {rule.domains.length <= 3 ? (
                          rule.domains.join(', ')
                        ) : (
                          <span title={rule.domains.join('\n')}>
                            {rule.domains.slice(0, 3).join(', ')}
                            <span className="text-muted-foreground"> +{rule.domains.length - 3}</span>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={rule.action === 'proxy' ? 'default' : 'secondary'}>
                          {rule.action === 'proxy'
                            ? '代理'
                            : rule.action === 'direct'
                              ? '直连'
                              : '阻止'}
                        </Badge>
                        {rule.bypassFakeIP && (
                          <Badge variant="outline" className="text-xs text-muted-foreground whitespace-nowrap">
                            真实DNS
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditRule(rule)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>规则说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• 输入域名会自动匹配该域名及其所有子域名</p>
          <p>• 如 google.com 会匹配 google.com、www.google.com 等</p>
          <p>• 每条规则支持多个域名，每行一个</p>
          <p>• 规则按优先级从上到下匹配</p>
          <p>• 自定义规则优先级高于全局代理模式和智能分流</p>
          <p>• <strong>绕过 FakeIP</strong>：使用真实 DNS 解析，适用于 QUIC/UDP 协议（如 Cloudflare Tunnel）</p>
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      <RuleDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} mode="add" />

      {/* Edit Rule Dialog */}
      {editingRule && (
        <RuleDialog
          open={!!editingRule}
          onOpenChange={(open: boolean) => !open && setEditingRule(null)}
          mode="edit"
          rule={editingRule}
        />
      )}

      {/* Delete Rule Dialog */}
      {deletingRule && (
        <DeleteRuleDialog
          open={!!deletingRule}
          onOpenChange={(open: boolean) => !open && setDeletingRule(null)}
          rule={deletingRule}
        />
      )}
    </div>
  );
}
