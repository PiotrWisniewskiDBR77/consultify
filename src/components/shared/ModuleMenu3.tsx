import { X } from 'lucide-react';
import React from 'react';

import { cn } from '@/utils/cn';

/**
 * MENU 1 — top module row (breadcrumb/title on the left + ONE primary CTA on
 * the right). CTA = neutral inverted (navy-on-light / white-on-dark), NIGDY
 * crimson (primary-* = crimson #85182F, tylko semantyka krytyczna).
 * Wzorzec: MyWorkHub topbar + ModuleNavBar "New item" CTA.
 */
export const MENU_1_ROW_CLASS =
  'flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/[0.05]';

export const MENU_1_PRIMARY_CTA =
  'inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-navy-900 text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';

export const MENU_1_BREADCRUMB_LINK =
  'text-sm font-medium text-c-text-muted hover:text-c-text transition-colors truncate';

export const MENU_1_BREADCRUMB_CURRENT = 'text-sm font-semibold text-c-text truncate';

export const MENU_2_TAB_BASE =
  'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';

export const MENU_2_TAB_INACTIVE = cn(
  MENU_2_TAB_BASE,
  'border-slate-200/70 bg-white/70 text-slate-700 hover:bg-state-hover',
  'dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-slate-300'
);

// Active = neutral (decyzja Piotra: crimson TYLKO dla semantyki krytycznej,
// nigdy jako stan UI; primary-* = crimson #85182F).
export const MENU_2_TAB_ACTIVE = cn(
  MENU_2_TAB_BASE,
  'border-slate-300 bg-state-selected text-slate-900',
  'dark:border-white/25 dark:text-slate-100'
);

/**
 * P-6 (Piotr, OBR-09, 2026-07-27): „Zwróć uwagę na bardzo małą przerwę
 * pomiędzy tabelą a menu trzecim. Wydaje mi się, że to jest wbrew standardowi."
 *
 * Sprawdzenie przyznało mu rację co do odczucia, ale nie co do diagnozy: kanon
 * §C3 opisuje WYŁĄCZNIE wewnętrzny padding paska (`px-4 py-2`) i regułę
 * wielokrotności 4px — odstępu MIĘDZY paskiem a nagłówkiem tabeli nie definiuje
 * nigdzie. To była luka w kanonie, nie naruszenie. Odczucie ma źródło realne:
 * dwie różne warstwy sterowania (filtry vs nagłówki kolumn) stykały się bez
 * żadnego oddechu, więc czytały się jako jedno.
 *
 * Wartość: `mb-2` = 8px (wielokrotność 4px). Świadomie skromna — większa
 * odsuwałaby filtry od tego, co filtrują.
 */
export const MENU_3_ROW_CLASS =
  'px-4 py-2 mb-2 bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/[0.05]';

export const MENU_3_INNER_CLASS =
  'flex min-h-8 items-center justify-between gap-3 overflow-x-auto whitespace-nowrap no-scrollbar';

export const MENU_3_LEFT_CLASS = 'inline-flex items-center gap-1';
export const MENU_3_RIGHT_CLASS = 'flex shrink-0 items-center justify-end gap-2';

export const MENU_3_CHIP_BASE =
  'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';

export const MENU_3_CHIP_INACTIVE = cn(
  MENU_3_CHIP_BASE,
  'border-slate-200 bg-transparent text-slate-700 hover:bg-state-hover hover:text-slate-900',
  'dark:border-white/10 dark:text-slate-300 dark:hover:text-slate-100'
);

export const MENU_3_CHIP_ACTIVE = cn(
  MENU_3_CHIP_BASE,
  'border-slate-300 bg-state-selected text-slate-900',
  'dark:border-white/30 dark:text-white'
);

export const MENU_3_BADGE_BASE =
  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums';

export const MENU_3_BADGE_INACTIVE = cn(
  MENU_3_BADGE_BASE,
  'bg-slate-300 text-slate-700 dark:bg-navy-700 dark:text-slate-300'
);

export const MENU_3_BADGE_ACTIVE = cn(
  MENU_3_BADGE_BASE,
  'bg-slate-900/10 text-slate-900 dark:bg-white/15 dark:text-white'
);

/**
 * ── R02-A-FIX · parytet z `BulkSelectionCluster` (R02-B) ────────────────────
 *
 * Audyt R02-A-FINAL-QA wykazał, że dwa kanoniczne klastry bulk — ten (rząd
 * Menu 3) i `shared/BulkSelectionCluster` (pływający pill + pasek) — wyglądały
 * inaczej przy tej samej operacji: disabled 60 vs 45, focus zakodowany na
 * `blue-500/35` zamiast tokenu, wypełnienie `bg-slate-100` vs outline, inna
 * typografia i ikona. Cel R02 („jeden kanoniczny Menu 3") tego nie dopuszcza.
 *
 * Zmiany, wszystkie w kierunku R02-B i kanonu:
 *  · focus → `ring-c-focus` (§9: focus zawsze niebieski token, nigdy hardcode);
 *  · disabled → `opacity-45`, ta sama wartość co w R01, R02-B i R03;
 *  · neutral → outline/przezroczysty zamiast wypełnienia;
 *  · typografia i ikona 1:1 z R02-B.
 *
 * Disabled jest w BAZIE, więc 67 użyć w 11 hubach dziedziczy je automatycznie —
 * lokalne `disabled:opacity-50` stają się zbędne.
 */
export const MENU_3_ACTION_BASE =
  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 disabled:cursor-not-allowed disabled:opacity-45';

export const MENU_3_ACTION_NEUTRAL = cn(
  MENU_3_ACTION_BASE,
  'border-c-border-subtle text-c-text hover:bg-state-hover'
);

export const MENU_3_ACTION_DANGER = cn(
  MENU_3_ACTION_BASE,
  'border-danger-300/40 bg-danger-50/70 text-danger-700 hover:bg-danger-100/80',
  'dark:border-danger-500/20 dark:bg-danger-500/[0.08] dark:text-danger-300 dark:hover:bg-danger-500/[0.14]'
);

export const MENU_3_ALL_DOT_CLASS = 'h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500';

export function Menu3Row({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(MENU_3_ROW_CLASS, className)}>
      <div className={MENU_3_INNER_CLASS}>{children}</div>
    </div>
  );
}

export function Menu3Badge({ count, active }: { count: React.ReactNode; active?: boolean }) {
  return <span className={active ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>{count}</span>;
}

export function Menu3Chip({
  active,
  disabled,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE,
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface Menu3BulkAction {
  id: string;
  label: React.ReactNode;
  icon?: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  variant?: 'neutral' | 'danger';
}

/** Contract v1: one left-aligned bulk cluster with outlined h-8 actions. */
export function Menu3BulkRow({
  selectedLabel,
  selectAllLabel,
  clearLabel,
  onSelectAll,
  onClear,
  actions,
  className,
}: {
  selectedLabel: React.ReactNode;
  selectAllLabel?: React.ReactNode;
  clearLabel: React.ReactNode;
  onSelectAll?: () => void;
  onClear: () => void;
  actions: Menu3BulkAction[];
  className?: string;
}) {
  /*
   * R02-A-FIX — danger ZAWSZE na końcu klastra (§4 Formuła 2: „…akcje wspólne →
   * akcje kontekstowe → danger na końcu"). Dotąd kolejność zależała wyłącznie od
   * tego, w jakiej kolejności ekran podał akcje — czyli ta sama reguła, którą
   * `BulkSelectionCluster` (R02-B) wymusza sortowaniem, tutaj była życzeniem.
   * Kolejność akcji neutralnych pozostaje dokładnie taka, jak podał wywołujący.
   */
  const orderedActions = [
    ...actions.filter((action) => action.variant !== 'danger'),
    ...actions.filter((action) => action.variant === 'danger'),
  ];

  return (
    <Menu3Row className={className}>
      <div
        data-menu3-bulk
        className="flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar"
      >
        <span className="inline-flex h-8 shrink-0 items-center px-1 text-xs font-semibold text-c-text">
          {selectedLabel}
        </span>
        {onSelectAll ? (
          <button type="button" onClick={onSelectAll} className={MENU_3_ACTION_NEUTRAL}>
            {selectAllLabel ?? 'Select all'}
          </button>
        ) : null}
        <button type="button" onClick={onClear} data-menu3-clear className={MENU_3_ACTION_NEUTRAL}>
          <X size={14} aria-hidden="true" />
          {clearLabel}
        </button>
        {orderedActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title}
              aria-disabled={action.disabled}
              /* disabled dziedziczone z MENU_3_ACTION_BASE (opacity-45) */
              className={action.variant === 'danger' ? MENU_3_ACTION_DANGER : MENU_3_ACTION_NEUTRAL}
            >
              {Icon ? <Icon size={14} /> : null}
              {action.label}
            </button>
          );
        })}
      </div>
      <span aria-hidden="true" />
    </Menu3Row>
  );
}
