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

import { ChevronDown, ChevronUp, RotateCcw, Settings2 } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { CANON_ICON } from '@/contracts/tableSurface/canon';
import { cn } from '@/utils/cn';

import { isAlwaysLockedColumn } from './tableSettingsLocks';

const PANEL_WIDTH = 256; // w-64
const GAP = 8; // mt-2

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
  /**
   * Optional column reordering (mechanika My Work / ColumnSelector 1:1):
   * renders ▲/▼ per row. Omit to hide the affordance.
   */
  onMove?: (columnId: string, direction: 'up' | 'down') => void;
  /** Optional "reset to defaults" row at the bottom of the popover. */
  onReset?: () => void;
  resetLabel?: string;
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

// TRIADA_KANON B.38 — stan aktywny UI musi być NEUTRALNY. `c-accent-soft` to
// tint crimsona (`rgba(133,24,47,.08)`), więc otwarty pstryczek świecił różowo
// w każdej tabeli aplikacji. Zamiana na neutralne wypełnienie 1:1 z aktywną
// pigułką Menu 2 (`MENU_2_TAB_ACTIVE`). Fokus zostaje niebieski (`c-focus`).
const TRIGGER_CLASS =
  'inline-flex h-8 w-8 items-center justify-center rounded-full text-c-text-muted ' +
  'transition-colors hover:bg-slate-900/[0.06] dark:hover:bg-white/10 hover:text-c-text ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ' +
  'aria-expanded:bg-slate-900/[0.07] dark:aria-expanded:bg-white/10 aria-expanded:text-c-text';

// Portaled to <body> with fixed positioning so it is NEVER clipped by an
// ancestor's overflow (the table scroll container previously cut it off, #1).
const PANEL_CLASS =
  'fixed z-context-menu w-64 rounded-xl border border-c-border bg-c-surface-raised ' +
  'p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] focus:outline-none';

const ROW_CLASS =
  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-c-text ' +
  'transition-colors hover:bg-state-hover cursor-pointer ' +
  'focus-within:bg-state-hover';

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
  onMove,
  onReset,
  resetLabel = 'Reset columns',
  label = 'Table settings',
  columnsHeading = 'Visible columns',
  descriptionLabel = 'Show row description',
  className,
  align = 'right',
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const descId = useId();

  // Compute fixed position from the trigger rect, with viewport clamping and
  // auto-flip when there isn't enough room below.
  const updatePosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < panelHeight + GAP && rect.top > spaceBelow;

    let left = align === 'right' ? rect.right - PANEL_WIDTH : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - PANEL_WIDTH - 8));
    const top = flipUp ? Math.max(8, rect.top - panelHeight - GAP) : rect.bottom + GAP;
    setPos({ top, left });
  }, [align]);

  // Recompute on open, and keep aligned on scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  // Close on outside click (trigger OR portaled panel).
  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
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

  /**
   * Kolumny po wymuszeniu kanonicznych blokad. `required` wywołującego jest
   * respektowane, ale NIE MOŻE odblokować identyfikatora ani kolumny akcji.
   */
  const lockedColumns = useMemo(
    () =>
      columns.map((column, index) => ({
        ...column,
        required: column.required || isAlwaysLockedColumn(column.id, index),
      })),
    [columns]
  );

  const handleColumnToggle = useCallback(
    (column: TableSettingsColumn, index: number) => {
      if (column.required || isAlwaysLockedColumn(column.id, index)) return;
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
        <Settings2 size={CANON_ICON.default} />
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={label}
              tabIndex={-1}
              style={{ top: pos.top, left: pos.left }}
              className={PANEL_CLASS}
            >
              <div className={HEADING_CLASS}>{columnsHeading}</div>
              <div className="max-h-64 overflow-y-auto">
                {lockedColumns.map((column, idx) => (
                  <label key={column.id} className={ROW_CLASS}>
                    <input
                      type="checkbox"
                      className={CHECKBOX_CLASS}
                      checked={column.visible}
                      disabled={column.required}
                      onChange={() => handleColumnToggle(column, idx)}
                    />
                    <span className="min-w-0 flex-1 truncate">{column.label}</span>
                    {column.required ? (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                        Locked
                      </span>
                    ) : null}
                    {onMove ? (
                      <span className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            onMove(column.id, 'up');
                          }}
                          disabled={idx === 0}
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-c-text-muted transition-colors hover:bg-state-hover hover:text-c-text disabled:opacity-30"
                          aria-label={`Move ${column.label} up`}
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            onMove(column.id, 'down');
                          }}
                          disabled={idx === lockedColumns.length - 1}
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-c-text-muted transition-colors hover:bg-state-hover hover:text-c-text disabled:opacity-30"
                          aria-label={`Move ${column.label} down`}
                        >
                          <ChevronDown size={12} />
                        </button>
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>

              {onReset ? (
                <>
                  <div className="my-1 h-px bg-c-border-subtle" />
                  <button
                    type="button"
                    onClick={onReset}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-c-text-muted transition-colors hover:bg-state-hover hover:text-c-text"
                  >
                    <RotateCcw size={13} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{resetLabel}</span>
                  </button>
                </>
              ) : null}

              {/*
                R04-1 — „Show row description" jest OSTATNIM elementem popovera
                (§5 Settings2). Wcześniej stał przed opcjonalnym „Reset columns",
                więc kolejność zależała od tego, czy ekran podał `onReset` —
                dwa ekrany, dwa różne układy tego samego popovera. Teraz pozycja
                jest stała niezależnie od przekazanych propsów.
              */}
              <div className="my-1 h-px bg-c-border-subtle" />

              <label className={ROW_CLASS} htmlFor={descId} data-settings-row="description">
                <span className="min-w-0 flex-1 truncate">{descriptionLabel}</span>
                <input
                  id={descId}
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={showDescription}
                  onChange={(event) => onToggleDescription(event.target.checked)}
                />
              </label>
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

export default TableSettingsPopover;
