/**
 * TableSettingsPopover — canonical table settings popover (standard §I).
 *
 * A small, anchored (NOT modal) popover triggered by a `Settings2` icon button.
 * Provides per-column visibility toggles plus a "show row description" switch.
 * Closes on outside-click and Escape. Uses the `--c-*` design tokens
 * (surface-raised / border) with a rounded-xl, softly-shadowed shell.
 *
 * This is canonical infrastructure: hubs should adopt this instead of
 * hand-rolling their own column-settings dropdowns.
 */

import { Settings2 } from 'lucide-react';
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/utils/cn';

export interface TableSettingsColumn {
  /** Stable column identifier. */
  id: string;
  /** Human-readable column label. */
  label: string;
  /** Required columns cannot be hidden (toggle is disabled + checked). */
  required?: boolean;
  /** Whether the column is currently visible. */
  visible: boolean;
}

export interface TableSettingsPopoverProps {
  /** Columns to render visibility toggles for. */
  columns: TableSettingsColumn[];
  /** Fired when a (non-required) column's visibility is toggled. */
  onToggle: (columnId: string, visible: boolean) => void;
  /** Current state of the "show row description" switch. */
  showDescription: boolean;
  /** Fired when the "show row description" switch is toggled. */
  onToggleDescription: (value: boolean) => void;
  /** Accessible label / tooltip for the trigger button. */
  label?: string;
  /** Optional heading rendered at the top of the columns group. */
  columnsHeading?: string;
  /** Optional label for the description switch row. */
  descriptionLabel?: string;
  /** Extra classes for the trigger wrapper. */
  className?: string;
  /** Popover alignment relative to the trigger. */
  align?: 'left' | 'right';
}

const TRIGGER_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-full text-c-text-muted ' +
  'transition-colors hover:bg-c-accent-soft hover:text-c-text ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ' +
  'aria-expanded:bg-c-accent-soft aria-expanded:text-c-text';

const PANEL_CLASS =
  'absolute z-50 mt-2 w-64 rounded-xl border border-c-border bg-c-surface-raised ' +
  'p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] focus:outline-none';

const ROW_CLASS =
  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-c-text ' +
  'transition-colors hover:bg-c-accent-soft cursor-pointer ' +
  'focus-within:bg-c-accent-soft';

const HEADING_CLASS =
  'px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted';

const CHECKBOX_CLASS =
  'h-4 w-4 shrink-0 rounded border-c-border text-c-accent ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export const TableSettingsPopover: React.FC<TableSettingsPopoverProps> = ({
  columns,
  onToggle,
  showDescription,
  onToggleDescription,
  label = 'Table settings',
  columnsHeading = 'Columns',
  descriptionLabel = 'Show row description',
  className,
  align = 'right',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const descId = useId();

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Focus the panel when opened for keyboard users.
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    }
  }, [open]);

  const handleColumnToggle = useCallback(
    (column: TableSettingsColumn) => {
      if (column.required) return;
      onToggle(column.id, !column.visible);
    },
    [onToggle]
  );

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        className={TRIGGER_CLASS}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Settings2 size={14} />
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className={cn(PANEL_CLASS, align === 'right' ? 'right-0' : 'left-0')}
        >
          <div className={HEADING_CLASS}>{columnsHeading}</div>
          <div className="max-h-64 overflow-y-auto">
            {columns.map((column) => (
              <label key={column.id} className={ROW_CLASS}>
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={column.visible}
                  disabled={column.required}
                  onChange={() => handleColumnToggle(column)}
                />
                <span className="min-w-0 flex-1 truncate">{column.label}</span>
                {column.required ? (
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                    Locked
                  </span>
                ) : null}
              </label>
            ))}
          </div>

          <div className="my-1 h-px bg-c-border-subtle" />

          <label className={ROW_CLASS} htmlFor={descId}>
            <span className="min-w-0 flex-1 truncate">{descriptionLabel}</span>
            <input
              id={descId}
              type="checkbox"
              className={CHECKBOX_CLASS}
              checked={showDescription}
              onChange={(event) => onToggleDescription(event.target.checked)}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
};

export default TableSettingsPopover;
