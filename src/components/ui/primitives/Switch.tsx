/**
 * Switch — canonical primitive wrapping the shadcn `switch.tsx`.
 *
 * Enforces the `--c-*` tokens (neutral/blue c-focus "on" track — active states
 * are neutral per TRIADA kanon, never crimson — neutral "off" track, blue
 * c-focus focus ring) and adds an optional inline label + error/hint, so
 * modules import from `primitives` rather than the raw shadcn component.
 */

import * as React from 'react';

import { Switch as ShadcnSwitch } from '@/components/ui/switch';
import { cn } from '@/utils/cn';

export interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Inline label rendered to the right of the control. */
  label?: React.ReactNode;
  /** Helper text rendered below (hidden when `error` is set). */
  hint?: string;
  /** Error message — when set, the hint is replaced and danger text shown. */
  error?: string;
  /** Render the label before the switch instead of after. */
  labelPosition?: 'left' | 'right';
  className?: string;
  /** Classes applied to the switch control itself. */
  switchClassName?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

const TRACK_BASE =
  'h-5 w-9 border-transparent data-[state=on]:bg-c-focus-solid ' +
  'focus-visible:ring-[color:var(--c-focus)] focus-visible:ring-offset-c-surface';

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked = false,
      onCheckedChange,
      disabled = false,
      label,
      hint,
      error,
      labelPosition = 'right',
      className,
      switchClassName,
      id: providedId,
      name,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    const generatedId = React.useId();
    const id = providedId ?? generatedId;
    const describedById = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

    const control = (
      <ShadcnSwitch
        ref={ref}
        id={id}
        name={name}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={!label ? ariaLabel : undefined}
        aria-describedby={describedById}
        data-state={checked ? 'on' : 'off'}
        className={cn(TRACK_BASE, checked ? 'bg-c-focus-solid' : 'bg-c-border', switchClassName)}
      />
    );

    const labelNode = label ? (
      <label htmlFor={id} className="cursor-pointer select-none text-sm text-c-text">
        {label}
      </label>
    ) : null;

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <div className="flex items-center gap-2.5">
          {labelPosition === 'left' ? labelNode : null}
          {control}
          {labelPosition === 'right' ? labelNode : null}
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

Switch.displayName = 'PrimitiveSwitch';

export default Switch;
