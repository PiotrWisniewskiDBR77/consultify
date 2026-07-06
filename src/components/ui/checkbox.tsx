import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/utils';

interface CheckboxProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Canonical checkbox — crimson (c-accent) is the correct brand accent for the
 * selected state; focus ring stays blue (c-focus, never crimson).
 */
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, ...props }, ref) => {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        ref={ref}
        className={cn(
          'peer h-4 w-4 shrink-0 rounded-sm border border-c-border-subtle transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-c-surface',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'border-c-accent bg-c-accent text-white' : 'bg-c-surface-raised',
          className
        )}
        onClick={() => onCheckedChange?.(!checked)}
        {...props}
      >
        {checked && <Check className="h-4 w-4" />}
      </button>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
