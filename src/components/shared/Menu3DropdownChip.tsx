/**
 * Menu3DropdownChip — canonical Menu-3 (Command Row) dropdown chip.
 *
 * S1-U1 directive: the Command Row is ONE dynamic line — folders, favorites,
 * recents etc. are absorbed as dropdown chips instead of extra rows above the
 * table. This is the shared primitive for those chips.
 *
 * Anatomy (Artifact Anatomy §9.2 ②⑧):
 * - trigger = Menu-3 chip (h-7, pill, border c.border) with optional count badge
 *   and a trailing chevron;
 * - panel = kebab-grade popover (bg c.surface-raised, border c.border,
 *   radius md, shadow) portaled to <body> so the overflow-x Command Row never
 *   clips it; closes on outside click and Escape.
 */

import { ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/utils/cn';

import {
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
} from './ModuleMenu3';

const GAP = 6;
const PANEL_MIN_WIDTH = 220;

const PANEL_CLASS =
  'fixed z-modal min-w-[220px] max-w-[320px] rounded-xl border border-c-border-subtle bg-c-surface-raised ' +
  'p-1 shadow-[0_8px_30px_rgba(15,23,42,0.12)] focus:outline-none';

export const MENU_3_DROPDOWN_ITEM_CLASS =
  'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[12px] font-medium text-c-text ' +
  'transition-colors hover:bg-c-accent-soft focus-visible:outline-none focus-visible:bg-c-accent-soft ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export interface Menu3DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Trailing content (count, checkmark…). */
  trailing?: React.ReactNode;
  /** Currently active/selected item — bolded + check-style emphasis. */
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Visual divider ABOVE this item. */
  dividerBefore?: boolean;
  onSelect: () => void;
}

export interface Menu3DropdownChipProps {
  /**
   * Pasek, w którym chip stoi — decyduje o WYSOKOŚCI.
   *
   * P-15 (Piotr, OBR-39, 2026-07-27): „Przycisk `Priority` nie jest wielkości
   * pozostałych przycisków w tym menu. Generalnie one wszystkie powinny być tej
   * samej wielkości."
   *
   * Przyczyna: filtr `Priority` w Menu 2 (Decisions) używał TEGO komponentu,
   * a on jest chipem Menu 3 — czyli `h-7` (28px). Sąsiedzi w Menu 2 mają
   * kanoniczne `h-9` (36px, §C4), więc jeden element odstawał o 8px.
   * Ten sam gatunek pomyłki, co czwarte warstwy nagłówkowe: element z jednej
   * warstwy postawiony w drugiej.
   *
   * `'menu3'` (domyślnie) = `h-7`, bez zmian dla dotychczasowych wywołań.
   * `'menu2'` = `h-9`, do użycia w pasku Menu 2.
   */
  bar?: 'menu2' | 'menu3';
  /** Chip icon (16px lucide). */
  icon?: React.ReactNode;
  /** Chip label. */
  label: string;
  /** Optional counter badge in the chip. */
  badgeCount?: number;
  /** Highlight the chip (an option other than the default is active). */
  active?: boolean;
  ariaLabel?: string;
  items: Menu3DropdownItem[];
  /** Optional custom footer node (rendered under the items, after a divider). */
  footer?: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  'data-testid'?: string;
}

export const Menu3DropdownChip: React.FC<Menu3DropdownChipProps> = ({
  bar = 'menu3',
  icon,
  label,
  badgeCount,
  active,
  ariaLabel,
  items,
  footer,
  align = 'left',
  className,
  'data-testid': testId,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = panelRef.current?.offsetWidth ?? PANEL_MIN_WIDTH;
    const panelHeight = panelRef.current?.offsetHeight ?? 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < panelHeight + GAP && rect.top > spaceBelow;

    let left = align === 'right' ? rect.right - panelWidth : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    const top = flipUp ? Math.max(8, rect.top - panelHeight - GAP) : rect.bottom + GAP;
    setPos({ top, left });
  }, [align]);

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

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel || label}
        data-testid={testId}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE,
          // §C4: kontrolki Menu 2 maja h-9. Chip Menu 3 ma h-7 — nadpisujemy
          // wysokosc i typografie, gdy ten sam komponent stoi w Menu 2 (P-15).
          bar === 'menu2' ? 'h-9 text-sm' : '',
          className
        )}
      >
        {icon}
        <span className="max-w-[140px] truncate">{label}</span>
        {typeof badgeCount === 'number' ? (
          <span className={active ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>{badgeCount}</span>
        ) : null}
        <ChevronDown
          size={12}
          className={cn('shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label={ariaLabel || label}
              tabIndex={-1}
              style={{ top: pos.top, left: pos.left }}
              className={PANEL_CLASS}
              data-testid={testId ? `${testId}-panel` : undefined}
            >
              <div className="max-h-72 overflow-y-auto">
                {items.map((item) => (
                  <React.Fragment key={item.id}>
                    {item.dividerBefore ? <div className="my-1 h-px bg-c-border-subtle" /> : null}
                    <button
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      onClick={() => {
                        item.onSelect();
                        close();
                      }}
                      className={cn(
                        MENU_3_DROPDOWN_ITEM_CLASS,
                        item.active && 'bg-c-accent-soft font-semibold',
                        item.danger && 'text-c-danger hover:bg-c-danger/10'
                      )}
                    >
                      {item.icon ? (
                        <span className="shrink-0 text-c-text-muted">{item.icon}</span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                      {item.trailing ? (
                        <span className="shrink-0 text-[11px] tabular-nums text-c-text-muted">
                          {item.trailing}
                        </span>
                      ) : null}
                    </button>
                  </React.Fragment>
                ))}
              </div>
              {footer ? (
                <>
                  <div className="my-1 h-px bg-c-border-subtle" />
                  {footer(close)}
                </>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </>
  );
};

export default Menu3DropdownChip;
