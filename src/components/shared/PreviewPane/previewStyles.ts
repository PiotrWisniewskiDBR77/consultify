/**
 * Shared CSS class constants for preview pane building blocks.
 *
 * SSOT for all preview pill / chip / button styles used across modules.
 * Import from here instead of re-declaring inline.
 */

// ── Pill bases ──────────────────────────────────────────────────────────────

/* D21 (Piotr 07-12): przyciski akcji w preview = pill (rounded-full), "taki jak Google i Apple".
 * Zgodne z TRIADA_KANON.md A8/C9 (pigułka h-9 rounded-full, widoczna ramka) — poprzedni rounded-lg
 * tutaj był regresją względem już ustanowionego kanonu. Focus ring is blue (--c-focus). */
export const PREVIEW_PILL_BASE =
  'inline-flex items-center justify-center gap-1.5 h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';

export const PREVIEW_META_PILL =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium';

export const PREVIEW_HINT_CHIP =
  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer active:scale-[0.98]';

export const PREVIEW_RELATION_CHIP =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent';

// ── Color scheme helper for action pills ────────────────────────────────────

/**
 * Warianty pigulki akcji preview.
 *
 * KANON: TABLE_AND_PREVIEW_CANON.md §7.3b — dozwolone jest PIEC:
 *   'primary' | 'emerald' | 'amber' | 'red' | 'neutral'
 * Wariant wybiera SKUTEK akcji, nie ekran (tabela skutek->wariant w §7.3b).
 * 'primary' = maks. JEDEN na preview, granatowo-bialy kontrast, nigdy crimson.
 *
 * Trzy ponizsze sa WYCOFANE i czekaja na migracje pozostalych modulow.
 * Po niej typ zostanie zwezony do piatki (dzis zwezenie zepsuloby 12 plikow
 * poza MyWork). MyWork jest juz czysty — 2026-07-21.
 */
type PillColorScheme =
  | 'emerald'
  | 'amber'
  | 'neutral'
  | 'red'
  | 'primary'
  /** @deprecated §7.3b — mapuje sie na skale primary-* (crimson). Uzyj 'primary' albo 'neutral'. */
  | 'purple'
  /** @deprecated §7.3b — duplikat 'emerald'. Uzyj 'emerald'. */
  | 'green'
  /** @deprecated §7.3b — brak wlasnego skutku. Uzyj 'neutral'. */
  | 'blue';

const COLOR_MAP: Record<PillColorScheme, string> = {
  emerald:
    'border-emerald-300/40 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-500/15',
  blue: 'border-blue-300/40 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200 hover:bg-blue-100/70 dark:hover:bg-blue-500/15',
  purple:
    'border-primary-300/40 dark:border-primary-500/30 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-200 hover:bg-primary-100/70 dark:hover:bg-primary-500/15',
  amber:
    'border-amber-400/60 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-200/70 dark:hover:bg-amber-500/15',
  neutral:
    'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]',
  red: 'border-danger-300/40 dark:border-danger-500/30 bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-200 hover:bg-danger-100/70 dark:hover:bg-danger-500/15',
  green:
    'border-green-300/40 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-200 hover:bg-green-100/70 dark:hover:bg-green-500/15',
  /* VISUAL_STANDARD.md §5.1 — primary action = neutral high-contrast
   * (navy-on-light / white-on-dark), never crimson. */
  primary:
    'border-transparent bg-navy-900 text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]',
};

export function pillColorScheme(scheme: PillColorScheme): string {
  return COLOR_MAP[scheme] ?? COLOR_MAP.neutral;
}

export function actionPillClass(scheme: PillColorScheme, extra?: string): string {
  return [PREVIEW_PILL_BASE, pillColorScheme(scheme), extra].filter(Boolean).join(' ');
}

// ── Kebab menu shared classes ───────────────────────────────────────────────

export const KEBAB_BUTTON =
  'inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors';

export const KEBAB_MENU =
  'absolute right-0 top-full mt-1 z-50 min-w-[170px] rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1 overflow-hidden';

export const KEBAB_ITEM =
  'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors';

export const KEBAB_BACKDROP = 'fixed inset-0 z-40';

// ── Skeleton loading ────────────────────────────────────────────────────────

export const SKELETON_LINE_1 = 'h-3.5 w-full rounded bg-slate-200/60 dark:bg-white/[0.06]';
export const SKELETON_LINE_2 = 'h-3.5 w-5/6 rounded bg-slate-200/50 dark:bg-white/[0.05]';
export const SKELETON_LINE_3 = 'h-3 w-3/4 rounded bg-slate-200/40 dark:bg-white/[0.04]';
export const SKELETON_LINE_4 = 'h-3 w-2/3 rounded bg-slate-200/30 dark:bg-white/[0.03]';
