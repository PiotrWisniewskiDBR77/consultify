/**
 * Chip base — the single shared shell for ALL canonical chips.
 *
 * Goal: kill the ~1,500 hand-rolled `inline-flex rounded-full px-2 py-0.5 …`
 * spans scattered across the app. Every canonical chip (StatusChip,
 * PriorityChip, MetaChip, ToolChip, DueChip) renders through `<ChipBase>`,
 * so they all share one radius, padding, font-size, weight, border and
 * transition — exactly as required by
 * docs/ui-standards/03-modules/module-hub-standard.md §3.3 + §N.
 *
 * Design tokens: the NEW semantic `c.*` palette (CSS vars `--c-*` in
 * src/index.css, Tailwind `c` namespace). Neutral by default; color is a
 * SIGNAL, never decoration. Light + dark come for free from the vars — no
 * manual `dark:` classes needed for the neutral shell.
 *
 * Apple/Google/OpenAI "2026 tech" feel: rounded-full pill, soft neutral
 * surface, restrained Harvard-crimson accent.
 */

import React, { forwardRef } from 'react';

import { cn } from '@/utils/cn';

/** Chip sizes. `sm` is the dense table/inline size; `md` is the Command-Row size. */
export type ChipSize = 'sm' | 'md';

/** Semantic signal tone. `neutral` is the default; the rest are SIGNALS only. */
export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

/**
 * Maps a tone to the CSS var used for its dot / icon / soft-tint.
 * Returns `null` for neutral (no colored signal — uses the muted dot color).
 */
export const CHIP_TONE_VAR: Record<Exclude<ChipTone, 'neutral'>, string> = {
  success: 'var(--c-success)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-danger)',
  info: 'var(--c-info)',
  accent: 'var(--c-accent)',
};

/**
 * Per-size geometry. Matches §3.3 (`rounded-full`, `gap-1.5`, border,
 * transition); `md` = the canonical Command-Row chip metrics.
 */
const SIZE_CLASS: Record<ChipSize, string> = {
  sm: 'h-6 px-2 text-[11px] gap-1.5',
  md: 'h-7 px-2.5 text-xs gap-1.5',
};

/** Icon px size per chip size — fixed, so chips of the same type align. */
export const CHIP_ICON_PX: Record<ChipSize, number> = {
  sm: 12,
  md: 14,
};

/**
 * Structural shell (geometry only — no color). Color comes from `CHIP_NEUTRAL`,
 * `accentSoft`, or a caller-supplied `shell` override, so they never collide in
 * the class string (`cn` here is clsx-style — it does NOT tailwind-merge, so the
 * color layer must be mutually exclusive, not appended).
 */
const CHIP_STRUCTURE =
  'inline-flex items-center whitespace-nowrap rounded-full border font-medium leading-none ' +
  'transition-colors duration-150 align-middle max-w-full';

/**
 * The neutral color layer. Uses ONLY `c.*` tokens, so it adapts to light/dark
 * via the CSS vars with no `dark:` overrides.
 */
const CHIP_NEUTRAL = 'border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised text-c-text-secondary';

export interface ChipBaseProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: ChipSize;
  /** Leading slot (icon or colored dot). */
  leading?: React.ReactNode;
  /** Trailing slot (e.g. a count badge). */
  trailing?: React.ReactNode;
  /** Apply the soft accent tint shell instead of the neutral shell. */
  accentSoft?: boolean;
  /**
   * Replace the neutral color layer (border + bg + text) with a custom one
   * (e.g. a filled signal tone from StatusChip). Mutually exclusive with the
   * neutral layer so they don't fight over source order.
   */
  shell?: string;
  children?: React.ReactNode;
}

/**
 * `<ChipBase>` — the low-level shell. Most callers should use one of the
 * semantic chips (StatusChip, MetaChip, …) instead of this directly.
 */
export const ChipBase = forwardRef<HTMLSpanElement, ChipBaseProps>(
  (
    { size = 'sm', leading, trailing, accentSoft = false, shell, className, children, ...rest },
    ref
  ) => {
    const colorLayer = accentSoft
      ? 'border-transparent bg-c-accent-soft text-c-accent'
      : (shell ?? CHIP_NEUTRAL);
    return (
      <span
        ref={ref}
        className={cn(CHIP_STRUCTURE, colorLayer, SIZE_CLASS[size], className)}
        {...rest}
      >
        {leading}
        {children != null && children !== '' ? (
          <span className="min-w-0 truncate">{children}</span>
        ) : null}
        {trailing}
      </span>
    );
  }
);

ChipBase.displayName = 'ChipBase';

/**
 * A small solid color dot used as a compact status/priority SIGNAL.
 * Color comes from a `c.*` CSS var via inline style (the var values are
 * hex/rgba, so Tailwind opacity utilities don't apply — inline keeps it
 * exact in both themes).
 */
export const ChipDot: React.FC<{ colorVar?: string; size?: ChipSize; className?: string }> = ({
  colorVar,
  size = 'sm',
  className,
}) => (
  <span
    aria-hidden="true"
    className={cn(
      'shrink-0 rounded-full',
      size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
      !colorVar && 'bg-c-text-muted',
      className
    )}
    style={colorVar ? { backgroundColor: colorVar } : undefined}
  />
);

export default ChipBase;
