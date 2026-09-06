import * as React from 'react';

interface TooltipContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

const TooltipProvider: React.FC<{ children: React.ReactNode; delayDuration?: number }> = ({
  children,
}) => <>{children}</>;

const Tooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </TooltipContext.Provider>
  );
};

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  const context = React.useContext(TooltipContext);
  if (!context) throw new Error('TooltipTrigger must be used within Tooltip');

  const handleMouseEnter = () => context.setOpen(true);
  const handleMouseLeave = () => context.setOpen(false);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      ref,
    });
  }

  return (
    <button
      ref={ref}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
});
TooltipTrigger.displayName = 'TooltipTrigger';

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { sideOffset?: number; side?: 'top' | 'bottom' }
>(({ className, sideOffset = 4, side = 'top', ...props }, ref) => {
  const context = React.useContext(TooltipContext);
  if (!context) throw new Error('TooltipContent must be used within Tooltip');

  if (!context.open) return null;

  // DEC-405c — `side="bottom"` renders BELOW the trigger instead of the
  // default above-trigger placement. Needed whenever the trigger sits at the
  // very top of an `overflow-hidden` ancestor (e.g. a sidebar header): the
  // default `bottom-full` position has nowhere to render into and gets
  // silently clipped by the ancestor, which reads to the user as an empty
  // tooltip bubble rather than a missing one. Default stays 'top' so every
  // other existing tooltip in the app is unaffected.
  const placement =
    side === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-2' : 'bottom-full left-1/2 -translate-x-1/2 mb-2';
  const offsetStyle = side === 'bottom' ? { marginTop: sideOffset } : { marginBottom: sideOffset };

  return (
    <div
      ref={ref}
      className={`absolute z-dropdown overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 ${placement} ${className || ''}`}
      style={offsetStyle}
      {...props}
    />
  );
});
TooltipContent.displayName = 'TooltipContent';

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
