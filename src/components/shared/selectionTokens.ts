/**
 * Canonical row-selection Tailwind class strings.
 *
 * Rule: row selection = slate surface + --c-info accent bar.
 * Never use primary/crimson for selection — crimson reads as "alarm", not "active".
 * Reference: InterviewHub already correct; light-mode-readability §3.5 (updated).
 */

/** Standard row selected (checkbox / single-click). */
export const SELECTED_ROW_CLASS =
  'bg-slate-100 dark:bg-white/[0.08] shadow-[inset_4px_0_0_var(--c-info)] ring-1 ring-slate-300/60 ring-inset dark:ring-white/[0.10]';

/** Row in preview-open state (softer than full selection). */
export const PREVIEW_SELECTED_ROW_CLASS =
  'bg-slate-50 dark:bg-white/[0.06] shadow-[inset_4px_0_0_var(--c-info)] ring-1 ring-slate-200/70 ring-inset dark:ring-white/[0.08]';

/** Keyboard-focus row (no accent bar — just a ring). */
export const FOCUSED_ROW_CLASS =
  'bg-slate-50/80 dark:bg-white/[0.04] ring-1 ring-inset ring-slate-200/80 dark:ring-white/[0.07]';
