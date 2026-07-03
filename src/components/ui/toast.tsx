import { X } from 'lucide-react';
import * as React from 'react';

type ToastVariant = 'default' | 'destructive';

interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ToastVariant;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const variantStyles: Record<ToastVariant, string> = {
  default: 'border bg-background text-foreground',
  destructive: 'destructive group border-destructive bg-destructive text-destructive-foreground',
};

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all ${variantStyles[variant]} ${className || ''}`}
        {...props}
      />
    );
  }
);
Toast.displayName = 'Toast';

const ToastAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={`inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive ${className || ''}`}
    {...props}
  />
));
ToastAction.displayName = 'ToastAction';

const ToastClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={`absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-danger-300 group-[.destructive]:hover:text-danger-50 group-[.destructive]:focus:ring-danger-400 group-[.destructive]:focus:ring-offset-danger-600 ${className || ''}`}
    {...props}
  >
    <X className="h-4 w-4" />
  </button>
));
ToastClose.displayName = 'ToastClose';

const ToastTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={`text-sm font-semibold ${className || ''}`} {...props} />
  )
);
ToastTitle.displayName = 'ToastTitle';

const ToastDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={`text-sm opacity-90 ${className || ''}`} {...props} />
));
ToastDescription.displayName = 'ToastDescription';

type ToastActionElement = React.ReactElement<typeof ToastAction>;

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

const ToastViewport = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`fixed top-0 z-toast flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px] ${className || ''}`}
      {...props}
    />
  )
);
ToastViewport.displayName = 'ToastViewport';

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
};
export type { ToastActionElement, ToastProps };
