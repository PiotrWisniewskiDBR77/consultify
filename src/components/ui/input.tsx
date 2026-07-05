import * as React from 'react';

import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Canonical text input — c.* tokens only (ARTIFACT_ANATOMY / CANON).
 * h-9 control height, rounded-lg, blue focus ring (c-focus, never crimson —
 * crimson is brand-only). Set `aria-invalid` to surface the danger state.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-lg border border-c-border bg-c-surface-raised px-3 py-2 text-sm text-c-text',
          'transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-c-text-muted',
          'focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] focus-visible:border-c-accent',
          'aria-[invalid=true]:border-c-danger aria-[invalid=true]:focus-visible:ring-c-danger/35',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
