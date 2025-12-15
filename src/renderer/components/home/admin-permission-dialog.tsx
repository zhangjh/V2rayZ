import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AdminPermissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminPermissionDialog({ open, onOpenChange }: AdminPermissionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>需要管理员权限</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>TUN模式需要管理员权限才能创建虚拟网络接口。</p>
            <p className="font-medium">
              请关闭应用程序，然后右键点击应用程序图标，选择"以管理员身份运行"。
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>我知道了</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
