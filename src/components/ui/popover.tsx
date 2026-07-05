import * as React from 'react';

interface PopoverContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

const Popover: React.FC<{
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}> = ({ children, open: controlledOpen, onOpenChange }) => {
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

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
};

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error('PopoverTrigger must be used within Popover');

  const handleClick = () => context.setOpen(!context.open);

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
PopoverTrigger.displayName = 'PopoverTrigger';

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'center' | 'end'; sideOffset?: number }
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => {
  const context = React.useContext(PopoverContext);
  if (!context) throw new Error('PopoverContent must be used within Popover');

  if (!context.open) return null;

  const alignClass =
    align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2';

  return (
    <>
      <div className="fixed inset-0 z-dropdown" onClick={() => context.setOpen(false)} />
      <div
        ref={ref}
        className={`absolute z-dropdown w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 top-full mt-2 ${alignClass} ${className || ''}`}
        style={{ marginTop: sideOffset }}
        {...props}
      />
    </>
  );
});
PopoverContent.displayName = 'PopoverContent';

export { Popover, PopoverContent, PopoverTrigger };
