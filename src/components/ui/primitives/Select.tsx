/**
 * Select — canonical primitive wrapper over the shadcn native `select.tsx`.
 *
 * Enforces the `--c-*` design tokens (neutral surface, crimson focus ring),
 * a consistent h-9 control height, and adds first-class label/error/hint
 * support so modules import from `primitives` instead of the raw shadcn file.
 */

import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Field label rendered above the control. */
  label?: string;
  /** Error message — when set, the control gains a danger ring. */
  error?: string;
  /** Helper text rendered below the control (hidden when `error` is set). */
  hint?: string;
  /** Marks the field as required (adds an asterisk to the label). */
  required?: boolean;
  className?: string;
  /** Extra classes for the outer wrapper (label + control + messages). */
  wrapperClassName?: string;
  id?: string;
  name?: string;
  /** Accessible name when no visible `label` is rendered. */
  'aria-label'?: string;
  /** Links the control to an externally-rendered visible label. */
  'aria-labelledby'?: string;
}

const CONTROL_CLASS =
  'flex h-9 w-full appearance-none items-center rounded-lg border bg-c-surface-raised ' +
  'px-3 pr-9 text-sm text-c-text transition-colors ' +
  'placeholder:text-c-text-muted cursor-pointer ' +
  'focus:outline-none focus-visible:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = 'Select…',
      disabled = false,
      fullWidth = true,
      label,
      error,
      hint,
      required,
      className,
      wrapperClassName,
      id: providedId,
      name,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
    },
    ref
  ) => {
    const generatedId = React.useId();
    const id = providedId ?? generatedId;
    const describedById = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full', wrapperClassName)}>
        {label ? (
          <label htmlFor={id} className="text-sm font-medium text-c-text">
            {label}
            {required ? <span className="ml-0.5 text-c-danger">*</span> : null}
          </label>
        ) : null}

        <div className={cn('relative', fullWidth && 'w-full')}>
          <select
            ref={ref}
            id={id}
            name={name}
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            disabled={disabled}
            required={required}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedById}
            className={cn(
              CONTROL_CLASS,
              error
                ? 'border-c-danger focus-visible:ring-2 focus-visible:ring-c-danger/35'
                : 'border-c-border focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] focus-visible:border-c-accent',
              className
            )}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-c-text-muted"
          />
        </div>

        {error ? (
          <p id={`${id}-error`} className="text-xs text-c-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="text-xs text-c-text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'PrimitiveSelect';

export default Select;
