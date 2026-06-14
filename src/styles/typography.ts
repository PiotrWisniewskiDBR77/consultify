/**
 * Typography SSOT — L1–L5, N, Q scale
 *
 * Every text variant in the application maps to one of these levels.
 * Import the constant instead of repeating the raw Tailwind string.
 *
 * @see docs/ui-standards/03-modules/BLOCK_TYPES_CANON.md §Fundament — System typograficzny
 */

/** Section / block header — kicker label above a card */
export const TEXT_L1 =
  'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-500';

/** Element title — card heading, row title */
export const TEXT_L2 = 'text-[13px] font-semibold text-slate-800 dark:text-slate-100';

/** Primary body copy */
export const TEXT_L3 = 'text-[13px] font-normal leading-[1.6] text-slate-700 dark:text-slate-300';

/** Supporting body copy — secondary details */
export const TEXT_L4 = 'text-[12px] font-normal text-slate-500 dark:text-slate-400';

/** Micro / caption — timestamps, helper text */
export const TEXT_L5 = 'text-[11px] font-normal text-slate-400 dark:text-slate-500';

/** Metric / number — tabular, headline KPI */
export const TEXT_N = 'text-[22px] font-semibold tabular-nums text-slate-800 dark:text-slate-100';

/** Quotation — verbatim participant quote */
export const TEXT_Q =
  'text-[13px] font-normal italic leading-[1.65] text-slate-600 dark:text-slate-300';
