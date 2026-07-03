import { X } from 'lucide-react';
import * as React from 'react';

interface SheetContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const Sheet: React.FC<SheetProps> = ({ open: controlledOpen, onOpenChange, children }) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const setOpen = React.useCallback(
    (value: React.SetStateAction<boolean>) => {
      const newValue = typeof value === 'function' ? value(open) : value;
      if (controlledOpen === undefined) {
        setInternalOpen(newValue);
      }
      onOpenChange?.(newValue);
    },
    [controlledOpen, open, onOpenChange]
  );

  return <SheetContext.Provider value={{ open, setOpen }}>{children}</SheetContext.Provider>;
};

const SheetTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error('SheetTrigger must be used within Sheet');

  const handleClick = () => context.setOpen(true);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      ref,
    });
  }

  return (
    <button ref={ref} className={className} onClick={handleClick} type="button" {...props}>
      {children}
    </button>
  );
});
SheetTrigger.displayName = 'SheetTrigger';

const SheetClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error('SheetClose must be used within Sheet');

  return (
    <button
      ref={ref}
      type="button"
      className={`rounded-lg p-1.5 opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none ${className || ''}`}
      onClick={() => context.setOpen(false)}
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  );
});
SheetClose.displayName = 'SheetClose';

const SheetPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

const SheetOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={`fixed inset-0 z-overlay bg-black/60 animate-in fade-in-0 ${className || ''}`}
      {...props}
    />
  )
);
SheetOverlay.displayName = 'SheetOverlay';

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'right' | 'left' | 'top' | 'bottom';
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, side = 'right', ...props }, ref) => {
    const context = React.useContext(SheetContext);
    if (!context) throw new Error('SheetContent must be used within Sheet');

    if (!context.open) return null;

    const sideClass =
      side === 'left'
        ? 'inset-y-0 left-0 h-full w-full max-w-lg border-r slide-in-from-left'
        : side === 'top'
          ? 'inset-x-0 top-0 h-auto max-h-[90vh] border-b slide-in-from-top'
          : side === 'bottom'
            ? 'inset-x-0 bottom-0 h-auto max-h-[90vh] border-t slide-in-from-bottom'
            : 'inset-y-0 right-0 h-full w-full max-w-lg border-l slide-in-from-right';

    return (
      <SheetPortal>
        <SheetOverlay onClick={() => context.setOpen(false)} />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={`fixed z-modal gap-4 overflow-y-auto border border-slate-200 bg-white p-0 shadow-lg duration-200 animate-in dark:border-navy-700 dark:bg-navy-900 ${sideClass} ${className || ''}`}
          {...props}
        >
          {children}
        </div>
      </SheetPortal>
    );
  }
);
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`flex flex-col space-y-1.5 px-6 pb-2 pt-6 pr-14 text-left ${className || ''}`}
    {...props}
  />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ''}`}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={`text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100 ${className || ''}`}
      {...props}
    />
  )
);
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={`text-sm text-slate-500 dark:text-slate-400 ${className || ''}`}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
