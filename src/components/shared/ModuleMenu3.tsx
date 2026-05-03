import React from 'react';

import { cn } from '@/utils/cn';

export const MENU_2_TAB_BASE =
  'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';

export const MENU_2_TAB_INACTIVE = cn(
  MENU_2_TAB_BASE,
  'border-slate-200/70 bg-white/70 text-slate-700 hover:bg-slate-100/70',
  'dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]'
);

export const MENU_2_TAB_ACTIVE = cn(
  MENU_2_TAB_BASE,
  'border-primary-500/40 bg-primary-500/10 text-slate-900',
  'dark:border-primary-500/30 dark:text-slate-100'
);

export const MENU_3_ROW_CLASS =
  'px-4 py-2 bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/[0.05]';

export const MENU_3_INNER_CLASS =
  'flex min-h-8 items-center justify-between gap-3 overflow-x-auto whitespace-nowrap no-scrollbar';

export const MENU_3_LEFT_CLASS = 'inline-flex items-center gap-1';
export const MENU_3_RIGHT_CLASS = 'flex shrink-0 items-center justify-end gap-2';

export const MENU_3_CHIP_BASE =
  'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';

export const MENU_3_CHIP_INACTIVE = cn(
  MENU_3_CHIP_BASE,
  'border-slate-200/60 bg-slate-100 text-slate-600 hover:bg-white/60',
  'dark:border-navy-700/60 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-900/50'
);

export const MENU_3_CHIP_ACTIVE = cn(
  MENU_3_CHIP_BASE,
  'border-purple-500/40 bg-purple-500/10 text-purple-700 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.10)]',
  'dark:text-purple-200'
);

export const MENU_3_BADGE_BASE =
  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums';

export const MENU_3_BADGE_INACTIVE = cn(
  MENU_3_BADGE_BASE,
  'bg-slate-200 text-slate-600 dark:bg-navy-700 dark:text-slate-300'
);

export const MENU_3_BADGE_ACTIVE = cn(
  MENU_3_BADGE_BASE,
  'bg-purple-500/30 text-purple-700 dark:text-purple-200'
);

export const MENU_3_ACTION_BASE =
  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';

export const MENU_3_ACTION_NEUTRAL = cn(
  MENU_3_ACTION_BASE,
  'border-slate-200/60 bg-slate-100 text-slate-600 hover:bg-white/60',
  'dark:border-navy-700/60 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-900/50'
);

export const MENU_3_ACTION_DANGER = cn(
  MENU_3_ACTION_BASE,
  'border-red-300/40 bg-red-50/70 text-red-700 hover:bg-red-100/80',
  'dark:border-red-500/20 dark:bg-red-500/[0.08] dark:text-red-300 dark:hover:bg-red-500/[0.14]'
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
