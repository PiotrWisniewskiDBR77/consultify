/**
 * PreviewActionButton — STANDARD przycisku akcji w preview (ANEKS #5,
 * _STANDARD_TRIADA_NOTATKA.md; wzór wizualny: Approve/Reject/More info/
 * Delegate/Remind/Escalate/Snooze z My Work Decisions preview).
 *
 * Pigułka h-9 rounded-full Z WIDOCZNĄ RAMKĄ: ikona + etykieta + opcjonalny
 * badge skrótu klawiszowego. DOKŁADNIE 4 warianty:
 *  - positive     → zielony tint + ramka (Approve / Complete)
 *  - destructive  → czerwony tint (Reject / Delete)
 *  - warning      → bursztynowy tint (Escalate)
 *  - neutral      → ghost z ramką (cała reszta)
 *
 * Moduł NIE może stylować tego przycisku (brak className w API) — jedyna
 * dozwolona zmienność to wariant, etykieta, ikona, skrót i disabled.
 */

import type { LucideIcon } from 'lucide-react';
import React from 'react';

export type PreviewActionVariant = 'positive' | 'destructive' | 'warning' | 'neutral';

export interface PreviewActionButtonProps {
  variant: PreviewActionVariant;
  label: string;
  icon?: LucideIcon;
  /** Pojedynczy klawisz skrótu — badge po prawej (np. "A"). Obsługę klawisza zapewnia layout (TableWithPreviewLayout.actionShortcuts). */
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  ariaDescribedBy?: string;
  ariaBusy?: boolean;
}

const BASE =
  'inline-flex w-full items-center justify-center gap-1.5 h-9 px-3 rounded-full border text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS: Record<PreviewActionVariant, string> = {
  positive:
    'border-emerald-300/40 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-500/15',
  destructive:
    'border-danger-300/40 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-200 hover:bg-danger-100/70 dark:hover:bg-danger-500/15',
  warning:
    'border-amber-400/60 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-200/70 dark:hover:bg-amber-500/15',
  neutral:
    'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]',
};

export const PreviewActionButton: React.FC<PreviewActionButtonProps> = ({
  variant,
  label,
  icon: Icon,
  shortcut,
  onClick,
  disabled,
  ariaDescribedBy,
  ariaBusy,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-describedby={ariaDescribedBy}
    aria-busy={ariaBusy || undefined}
    className={`${BASE} ${VARIANTS[variant]}`}
  >
    {Icon ? <Icon size={14} /> : null}
    {label}
    {shortcut ? (
      <kbd className="ml-1 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded text-[9px] font-semibold leading-none bg-black/[0.06] dark:bg-white/[0.08] text-current opacity-60">
        {shortcut}
      </kbd>
    ) : null}
  </button>
);

export default PreviewActionButton;
