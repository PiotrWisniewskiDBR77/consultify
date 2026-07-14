/**
 * Select — portal-based single-select dropdown.
 *
 * The trigger is styled like a text input (h-10 rounded-xl border). The
 * dropdown is portaled to `document.body` with fixed positioning so it is
 * NEVER clipped by an ancestor's `overflow` and never covers fields below
 * the trigger (it floats above the page). Position is viewport-clamped and
 * auto-flips up when there isn't room below. Closes on outside-click + Escape.
 *
 * Pattern mirrors src/components/shared/ModuleHub/TableSettingsPopover.tsx.
 */

import { Check, ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/utils/cn';

import { useDismiss, usePopoverPosition } from './usePopoverPosition';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Accessible label for the trigger. */
  'aria-label'?: string;
}

const TRIGGER_CLASS =
  'flex h-10 w-full items-center justify-between gap-2 rounded-xl border ' +
  'border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] ' +
  'px-3 text-left text-sm text-slate-900 dark:text-white transition-colors ' +
  'hover:border-slate-300 dark:hover:border-white/20 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary-500/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const PANEL_CLASS =
  'fixed z-context-menu rounded-xl border border-slate-200/70 dark:border-white/[0.08] ' +
  'bg-white dark:bg-navy-800 p-1 shadow-[0_8px_30px_rgba(15,23,42,0.18)] focus:outline-none';

const OPTION_CLASS =
  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ' +
  'text-slate-700 dark:text-slate-200 transition-colors ' +
  'hover:bg-slate-100 dark:hover:bg-white/[0.06]';

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const pos = usePopoverPosition({ open, triggerRef, panelRef, width: 'trigger' });
  useDismiss(open, close, [triggerRef, panelRef]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((p) => !p)}
        className={cn(TRIGGER_CLASS, className)}
      >
        <span className={cn('flex min-w-0 items-center gap-2', !selected && 'text-slate-400')}>
          {selected?.icon}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              tabIndex={-1}
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              className={PANEL_CLASS}
            >
              <div className="max-h-64 overflow-y-auto">
                {options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        OPTION_CLASS,
                        isSelected && 'bg-slate-100 dark:bg-white/[0.07]'
                      )}
                    >
                      {option.icon}
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {isSelected ? (
                        <Check size={15} className="shrink-0 text-slate-700 dark:text-slate-200" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export default Select;
