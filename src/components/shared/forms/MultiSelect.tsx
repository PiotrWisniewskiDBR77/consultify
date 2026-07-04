/**
 * MultiSelect — portal-based multi-select with chips + search.
 *
 * Same portal mechanics as `Select` (fixed positioning, viewport-clamp,
 * auto-flip, outside-click + Escape dismiss). Selected items render as
 * removable chips inside the trigger; the dropdown has a search box at the
 * top and a scrollable, checkbox-style option list.
 *
 * Pattern mirrors src/components/shared/ModuleHub/TableSettingsPopover.tsx.
 */

import { Check, ChevronDown, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/utils/cn';

import { useDismiss, usePopoverPosition } from './usePopoverPosition';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional secondary line (e.g. email). */
  description?: string;
  icon?: React.ReactNode;
}

export interface MultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Render an option's leading visual (e.g. avatar). Falls back to icon. */
  renderOptionLeading?: (option: MultiSelectOption) => React.ReactNode;
  'aria-label'?: string;
}

const TRIGGER_CLASS =
  'flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border ' +
  'border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] ' +
  'px-3 py-1.5 text-left text-sm transition-colors ' +
  'hover:border-slate-300 dark:hover:border-c-border ' +
  'focus:outline-none focus:ring-2 focus:ring-c-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const PANEL_CLASS =
  'fixed z-context-menu rounded-xl border border-slate-200/70 dark:border-white/[0.08] ' +
  'bg-white dark:bg-navy-800 shadow-[0_8px_30px_rgba(15,23,42,0.18)] focus:outline-none overflow-hidden';

const CHIP_CLASS =
  'inline-flex items-center gap-1 rounded-full bg-slate-200/80 dark:bg-white/10 px-2 py-0.5 ' +
  'text-xs text-slate-700 dark:text-slate-200';

export const MultiSelect: React.FC<MultiSelectProps> = ({
  values,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  disabled,
  className,
  renderOptionLeading,
  'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const pos = usePopoverPosition({ open, triggerRef, panelRef, width: 'trigger' });
  useDismiss(open, close, [triggerRef, panelRef]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery('');
  }, [open]);

  const selectedOptions = useMemo(
    () => options.filter((o) => values.includes(o.value)),
    [options, values]
  );

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.description ?? '').toLowerCase().includes(q)
    );
  }, [options, query]);

  const toggle = useCallback(
    (val: string) => {
      onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);
    },
    [values, onChange]
  );

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
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => (
              <span key={option.value} className={CHIP_CLASS}>
                <span className="truncate">{option.label}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${option.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(option.value);
                  }}
                  className="rounded-full p-0.5 hover:bg-slate-300/60 dark:hover:bg-white/20"
                >
                  <X size={11} />
                </span>
              </span>
            ))
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
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
              aria-multiselectable
              tabIndex={-1}
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              className={PANEL_CLASS}
            >
              <div className="border-b border-slate-200/70 p-2 dark:border-white/[0.08]">
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className={cn(
                      'h-9 w-full rounded-lg border border-slate-200/70 bg-slate-50 pl-8 pr-3',
                      'text-sm text-slate-900 placeholder-slate-400 focus:outline-none',
                      'focus:ring-2 focus:ring-c-focus',
                      'dark:border-white/[0.08] dark:bg-navy-900 dark:text-white'
                    )}
                  />
                </div>
              </div>
              <div className="max-h-56 overflow-y-auto p-1">
                {filtered.length > 0 ? (
                  filtered.map((option) => {
                    const isSelected = values.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => toggle(option.value)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                          'hover:bg-slate-100 dark:hover:bg-white/[0.06]',
                          isSelected && 'bg-slate-100 dark:bg-white/[0.07]'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                            isSelected
                              ? 'border-slate-500 bg-slate-700 dark:border-slate-400 dark:bg-slate-500 text-white'
                              : 'border-slate-300 bg-white dark:border-c-border dark:bg-navy-900'
                          )}
                        >
                          {isSelected ? <Check size={12} /> : null}
                        </span>
                        {renderOptionLeading ? renderOptionLeading(option) : option.icon}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-900 dark:text-white">
                            {option.label}
                          </span>
                          {option.description ? (
                            <span className="block truncate text-xs text-slate-400">
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-center text-sm text-slate-400">{emptyLabel}</div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export default MultiSelect;
