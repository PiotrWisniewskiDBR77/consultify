import * as React from 'react';

import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * Canonical multiline input — c.* tokens only (ARTIFACT_ANATOMY / CANON).
 * Matches the Input primitive (rounded-lg, c-border, blue focus ring).
 * Set `aria-invalid` to surface the danger state.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border border-c-border bg-c-surface-raised px-3 py-2 text-sm text-c-text',
          'transition-colors placeholder:text-c-text-muted',
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
Textarea.displayName = 'Textarea';

export { Textarea };
