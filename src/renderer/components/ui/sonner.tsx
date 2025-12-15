import { useTheme } from '@/components/theme-provider';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ richColors, ...props }: ToasterProps) => {
  const { theme } = useTheme();

  // 获取实际主题（处理 system 情况）
  const resolvedTheme =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  return (
    <Sonner
      theme={resolvedTheme as 'light' | 'dark'}
      className="toaster group"
      richColors={richColors}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          success:
            'group-[.toaster]:!bg-background group-[.toaster]:!text-foreground group-[.toaster]:!border-border',
          error:
            'group-[.toaster]:!bg-background group-[.toaster]:!text-foreground group-[.toaster]:!border-border',
          warning:
            'group-[.toaster]:!bg-background group-[.toaster]:!text-foreground group-[.toaster]:!border-border',
          info: 'group-[.toaster]:!bg-background group-[.toaster]:!text-foreground group-[.toaster]:!border-border',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
