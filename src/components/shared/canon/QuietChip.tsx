/**
 * QuietChip — canon low-noise status/priority chip (ARTIFACT_ANATOMY_STANDARD §9.2 ④).
 *
 * The problem this solves ("zupa pigułek" — pill soup): list tables render a
 * loud, ring-bordered `StatusPill` in EVERY row, drowning the actual title.
 * QuietChip is the quiet cousin for low-information columns (License, Status
 * cells inside a dense list): a soft semantic tint, NO border, optional dot.
 *
 * It does NOT invent a color system — it maps the status string to one of the
 * 5 semantic tones via `statusTone()` from the SSOT StatusPill, then renders a
 * borderless `bg-<sem>/10 + text-<sem>` swatch. When a row needs a loud,
 * bordered lifecycle badge (M1 identity bar), use StatusPill; when a cell needs
 * a calm inline marker, use QuietChip.
 *
 * Variants:
 *   - default : soft tinted background + text
 *   - dot     : just a colored dot + plain c-text-secondary label (calmest)
 *
 * @example
 *   <QuietChip status="approved" />                 // soft emerald
 *   <QuietChip status="MIT" variant="dot" />        // dot + neutral label
 *   <QuietChip status="blocked" label="Blocked" />
 */

import React from 'react';
import { statusTone, type StatusTone } from '../StatusPill';

export type QuietChipVariant = 'default' | 'dot';

/**
 * Borderless soft-tint classes per semantic tone. Deliberately NO `border-*`
 * (that is StatusPill's job). Dark variants use the platform "faint tint +
 * lifted text" convention. Tones come from statusColors' 5-color semantics.
 */
const TONE_SOFT: Record<StatusTone, string> = {
  blue: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  amber: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  emerald:
    'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  rose: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  slate: 'bg-slate-500/10 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300',
};

/** Dot color per tone (used by the `dot` variant + the optional leading dot). */
const TONE_DOT: Record<StatusTone, string> = {
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
};

/** Humanize a raw status: underscores/hyphens → spaces, capitalize first. */
function humanize(status: string): string {
  const spaced = status.trim().toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export interface QuietChipProps {
  /** Raw status/priority/label string; mapped to a semantic tone. */
  status: string;
  /** Override the displayed text. Defaults to the humanized status. */
  label?: string;
  /** Visual variant. `default` = soft tint; `dot` = dot + neutral label. */
  variant?: QuietChipVariant;
  /** Force a specific tone instead of deriving it from `status`. */
  tone?: StatusTone;
  /** Show a leading dot in `default` variant. Default `false` (calmer). */
  withDot?: boolean;
  /** Extra classes appended to the root. */
  className?: string;
}

/**
 * Quiet, borderless semantic chip for low-information list cells.
 * See file header for when to use this vs StatusPill.
 */
export const QuietChip: React.FC<QuietChipProps> = ({
  status,
  label,
  variant = 'default',
  tone: forcedTone,
  withDot = false,
  className = '',
}) => {
  const tone = forcedTone ?? statusTone(status);
  const text = label ?? humanize(status);

  if (variant === 'dot') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs text-c-text-secondary ${className}`.trim()}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
        {text}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_SOFT[tone]} ${className}`.trim()}
    >
      {withDot && (
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
      )}
      {text}
    </span>
  );
};

export default QuietChip;
