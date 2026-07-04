import React from 'react';

import { cn } from '@/utils/cn';

export const MENU_2_TAB_BASE =
  'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-[var(--c-surface)]';

export const MENU_2_TAB_INACTIVE = cn(
  MENU_2_TAB_BASE,
  'border-c-border bg-transparent text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text'
);

// Menu 2 (ModuleTabs) — decyzja Piotra 2026-07-03: pill z NEUTRALNYM aktywnym
// (NIE crimson — `primary`=crimson to pułapka). Spójne z ModuleNavBar TAB_ACTIVE:
// wypełniony pill na c-surface-raised + ramka c-border + c-text.
export const MENU_2_TAB_ACTIVE = cn(
  MENU_2_TAB_BASE,
  'border-c-border bg-c-surface-raised text-c-text',
  'dark:border-c-border dark:bg-white/10 dark:text-slate-100'
);

export const MENU_3_ROW_CLASS =
  'px-4 py-2 bg-c-surface border-b border-c-border-subtle';

export const MENU_3_INNER_CLASS =
  'flex min-h-8 items-center justify-between gap-3 overflow-x-auto whitespace-nowrap no-scrollbar';

export const MENU_3_LEFT_CLASS = 'inline-flex items-center gap-1';
export const MENU_3_RIGHT_CLASS = 'flex shrink-0 items-center justify-end gap-2';

export const MENU_3_CHIP_BASE =
  'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-[var(--c-surface)]';

export const MENU_3_CHIP_INACTIVE = cn(
  MENU_3_CHIP_BASE,
  'border-c-border bg-transparent text-c-text-muted hover:bg-c-surface-raised hover:text-c-text'
);

// Selected chip = neutral accent-soft tint (§9.2 ②) — NOT crimson text.
export const MENU_3_CHIP_ACTIVE = cn(
  MENU_3_CHIP_BASE,
  'border-c-border-strong bg-c-accent-soft text-c-text'
);

export const MENU_3_BADGE_BASE =
  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums';

export const MENU_3_BADGE_INACTIVE = cn(
  MENU_3_BADGE_BASE,
  'bg-c-surface-raised text-c-text-secondary'
);

export const MENU_3_BADGE_ACTIVE = cn(
  MENU_3_BADGE_BASE,
  'bg-c-accent-soft text-c-text'
);

export const MENU_3_ACTION_BASE =
  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-[var(--c-surface)]';

export const MENU_3_ACTION_NEUTRAL = cn(
  MENU_3_ACTION_BASE,
  'border-c-border bg-c-surface-raised text-c-text-secondary hover:bg-c-surface hover:text-c-text'
);

export const MENU_3_ACTION_DANGER = cn(
  MENU_3_ACTION_BASE,
  'border-[color:var(--c-danger)]/30 bg-[color:var(--c-danger)]/[0.08] text-c-danger hover:bg-[color:var(--c-danger)]/[0.14]'
);

export const MENU_3_ALL_DOT_CLASS = 'h-1.5 w-1.5 rounded-full bg-c-text-muted';

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
