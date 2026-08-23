import type { LucideIcon } from 'lucide-react';
import { MoreHorizontal } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { actionPillClass, type PillColorScheme } from './previewStyles';

export interface ActionButton {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  colorScheme: PillColorScheme;
  /** Stretch to fill available space (flex-1) */
  flex?: boolean;
  disabled?: boolean;
  /** Extra CSS classes */
  className?: string;
  /** Single-key shortcut displayed as a badge (e.g. "T" for Triage). Handled by TableWithPreviewLayout. */
  shortcut?: string;
}

export interface ActionRow {
  buttons?: ActionButton[];
  /** Use CSS grid with N columns instead of flex. When omitted, uses flex layout. */
  columns?: number;
  id?: string;
  label?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export interface PreviewActionBarProps {
  rows?: ActionRow[];
  actions?: ActionRow[];
  /**
   * Akcje drugorzedne — chowane pod trigger "..." zamiast psuc gestosc stopki.
   *
   * KANON: DOKTRYNA_GESTOSCI.md §1/§15 — max 5 widocznych akcji, reszta w
   * obowiazkowym overflow. Przed tym propem (dodanym 2026-07-21) kazdy ekran,
   * ktory potrzebowal wiecej niz kilka akcji, pisal WLASNY przycisk "..." +
   * dropdown recznie — DecisionPreviewPanel.tsx zrobil to osobno, a jego
   * wlasny mockup porownawczy (dev-render) zrobil to SAM wieczor po raz drugi,
   * inaczej. Ten prop istnieje, zeby trzeci raz sie nie zdarzyl: dolacz akcje
   * tutaj, komponent renderuje trigger + menu za Ciebie, zawsze tak samo.
   *
   * Renderowane jako ikona-only przycisk doklejony do OSTATNIEGO wiersza z
   * `rows` (albo jako samodzielny wiersz, gdy `rows` jest puste/pominiete).
   */
  overflowActions?: ActionButton[];
  /** aria-label triggera overflow. Domyslnie angielski (icon-only, jak reszta ikon-buttonow w repo) — podaj przetlumaczony string, jesli ekran tego wymaga. */
  overflowLabel?: string;
}

const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

const MENU_WIDTH = 208; // w-52
const MENU_GAP = 8;

/**
 * PILNE-9 / POWIĄZANE (2026-07-27): menu spod „…" w stopce podglądu było
 * `absolute right-0 top-full` — ZAWSZE w dół i wewnątrz drzewa panelu. Stopka
 * podglądu siedzi przy dolnej krawędzi ekranu, więc ostatnia pozycja (np.
 * „Delegate" w Decisions) lądowała pod krawędzią: raz ucięta przez `overflow`
 * panelu, raz poza widocznym obszarem okna.
 *
 * Menu renderuje się teraz w portalu z pozycją `fixed`, liczoną z prostokąta
 * triggera: odbija się w GÓRĘ, gdy pod triggerem brakuje miejsca, i dostaje
 * `maxHeight` z przewijaniem, gdy nie mieści się w żadną stronę. Portal zdejmuje
 * przy okazji zależność od `overflow` rodzica.
 */
const OverflowTrigger: React.FC<{
  actions: ActionButton[];
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}> = ({ actions, label, open, onToggle, onClose }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [onClose]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;
    const rect = trigger.getBoundingClientRect();
    // Pierwszy przebieg: menu jeszcze nie zmierzone — szacunek po liczbie pozycji.
    const menuHeight = menuRef.current?.offsetHeight || Math.min(actions.length * 34 + 8, 320);
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const flipUp = menuHeight > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(320, flipUp ? spaceAbove : spaceBelow));
    const top = flipUp
      ? Math.max(MENU_GAP, rect.top - MENU_GAP - Math.min(menuHeight, maxHeight))
      : rect.bottom + MENU_GAP;
    const left = Math.max(
      MENU_GAP,
      Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - MENU_GAP)
    );
    setPos({ top, left, maxHeight });
  }, [actions.length]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    // Druga faza — po zamontowaniu menu znamy jego realną wysokość.
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeAndRestoreFocus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeAndRestoreFocus, open]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        ref={triggerRef}
        onClick={onToggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={actionPillClass('neutral', 'h-full')}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div className="fixed inset-0 z-dropdown" onClick={closeAndRestoreFocus} />
              <div
                ref={menuRef}
                role="menu"
                data-testid="preview-overflow-menu"
                style={{
                  top: pos?.top ?? 0,
                  left: pos?.left ?? 0,
                  maxHeight: pos?.maxHeight ?? 320,
                  visibility: pos ? 'visible' : 'hidden',
                }}
                className="fixed z-overlay w-52 rounded-xl border border-c-border-subtle bg-c-surface-raised shadow-xl overflow-y-auto"
              >
                {actions.map((btn, i) => {
                  const Icon = btn.icon;
                  return (
                    <button
                      type="button"
                      key={i}
                      role="menuitem"
                      onClick={() => {
                        btn.onClick();
                        closeAndRestoreFocus();
                      }}
                      disabled={btn.disabled}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-c-surface text-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {Icon ? <Icon size={14} /> : null}
                      {btn.label}
                    </button>
                  );
                })}
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
};

export const PreviewActionBar: React.FC<PreviewActionBarProps> = ({
  rows,
  actions,
  overflowActions,
  overflowLabel = 'More actions',
}) => {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const resolvedRows: Array<{ buttons: ActionButton[]; columns?: number }> = (
    rows ??
    actions ??
    []
  ).map((row) =>
    row.buttons
      ? { buttons: row.buttons, columns: row.columns }
      : {
          buttons: [
            {
              label: row.label || '',
              onClick: row.onClick || (() => undefined),
              colorScheme: row.variant === 'primary' ? 'primary' : 'neutral',
              disabled: false,
            },
          ],
          columns: row.columns,
        }
  );

  // DOKTRYNA_GESTOSCI §1: >5 widocznych akcji lacznie (rows + trigger) wymaga
  // overflow. Ostrzeżenie w konsoli dev, nie blokada — niektore ekrany moga
  // miec uzasadniony wyjatek, ale maja o tym wiedziec w momencie budowy.
  if (process.env.NODE_ENV !== 'production') {
    const widocznychLacznie = resolvedRows.reduce((n, r) => n + r.buttons.length, 0);
    if (widocznychLacznie > 5 && !overflowActions?.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[PreviewActionBar] ${widocznychLacznie} widocznych akcji (limit: 5, DOKTRYNA_GESTOSCI.md §1). ` +
          `Przenies nadmiarowe do propa "overflowActions" zamiast pisac wlasny przycisk "...".`
      );
    }
  }

  const overflowProps = overflowActions?.length
    ? {
        actions: overflowActions,
        label: overflowLabel,
        open: overflowOpen,
        onToggle: () => setOverflowOpen((v) => !v),
        onClose: () => setOverflowOpen(false),
      }
    : null;

  const ostatniIdx = resolvedRows.length - 1;

  return (
    <div className="space-y-2.5 py-1">
      {resolvedRows.map((row, rowIdx) => {
        const isGrid = row.columns && row.columns > 1;
        const containerClass = isGrid
          ? `grid ${GRID_COLS[row.columns!] ?? `grid-cols-${row.columns}`} gap-2`
          : 'flex gap-2 items-stretch';
        const doklejOverflow = rowIdx === ostatniIdx && !!overflowProps;

        return (
          <div key={rowIdx} className={containerClass}>
            {row.buttons.map((btn, btnIdx) => {
              const Icon = btn.icon;
              return (
                <button
                  type="button"
                  key={btnIdx}
                  onClick={btn.onClick}
                  disabled={btn.disabled}
                  className={actionPillClass(
                    btn.colorScheme,
                    [
                      btn.flex ? 'flex-1' : '',
                      'w-full',
                      btn.disabled ? 'opacity-50 cursor-not-allowed' : '',
                      btn.className ?? '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  )}
                >
                  {Icon ? <Icon size={14} /> : null}
                  {btn.label}
                  {btn.shortcut ? (
                    <kbd className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded text-[9px] font-semibold leading-none bg-black/[0.06] dark:bg-white/[0.08] text-current opacity-60">
                      {btn.shortcut}
                    </kbd>
                  ) : null}
                </button>
              );
            })}
            {doklejOverflow ? <OverflowTrigger {...overflowProps!} /> : null}
          </div>
        );
      })}

      {/* rows puste/pominiete, ale sa overflowActions — samodzielny wiersz z samym triggerem */}
      {resolvedRows.length === 0 && overflowProps ? (
        <div className="flex gap-2 justify-end">
          <OverflowTrigger {...overflowProps} />
        </div>
      ) : null}
    </div>
  );
};

export default PreviewActionBar;
