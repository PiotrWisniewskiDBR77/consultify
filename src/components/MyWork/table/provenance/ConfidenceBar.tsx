/**
 * ConfidenceBar — AI confidence indicator for a table record (Block B / EPIC-T9).
 *
 * Renders a thin horizontal bar (gradient red → amber → emerald) plus a
 * percentage label. Labels INTENTIONALLY say "AI confidence" — never "Data
 * quality" or "Trustworthy" (B-P1). The score reflects only the record's
 * provenance footprint (sources, freshness, validation status), not whether
 * the underlying data is correct.
 *
 * Score handling:
 *   * `score === null | undefined` → renders as "Not scored" with a neutral
 *     bar (10% width) and `aria-disabled`.
 *   * Score outside `[0, 1]` is clamped before rendering.
 *
 * The component is fully presentational — it does not call the API.
 */

import { Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ConfidenceBarProps {
  /** Confidence score in [0, 1]. `null` / `undefined` → "not scored". */
  score: number | null | undefined;
  /** Variant: `compact` for grid gutter (no label), `full` for detail panel. */
  variant?: 'compact' | 'full';
  /** Optional click handler — wraps the bar in a `<button>` when provided. */
  onClick?: () => void;
  /** Test id, defaults to `provenance-confidence-bar`. */
  testId?: string;
}

function clamp01(n: number | null | undefined): number {
  if (n === null || n === undefined || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function tint(varName: string): string {
  return `color-mix(in srgb, var(${varName}) 18%, transparent)`;
}

function pickColor(score: number): { bg: string; fg: string } {
  if (score < 0.4) return { bg: tint('--c-danger'), fg: 'var(--c-danger)' };
  if (score < 0.65) return { bg: tint('--c-warning'), fg: 'var(--c-warning)' };
  if (score < 0.85) return { bg: tint('--c-success'), fg: 'var(--c-success)' };
  return { bg: tint('--c-success'), fg: 'var(--c-success)' };
}

export const ConfidenceBar: React.FC<ConfidenceBarProps> = ({
  score,
  variant = 'full',
  onClick,
  testId = 'provenance-confidence-bar',
}) => {
  const { i18n, t } = useTranslation('tabele-provenance');
  const isPl = i18n.language?.startsWith('pl');
  const hasScore = score !== null && score !== undefined && Number.isFinite(score);
  const value = hasScore ? clamp01(score) : 0;
  const percent = hasScore ? Math.round(value * 100) : null;
  const palette = hasScore
    ? pickColor(value)
    : { bg: 'var(--c-surface-raised)', fg: 'var(--c-text-muted)' };

  const ariaLabel = hasScore
    ? `${t('confidence.aria', { defaultValue: 'AI confidence' })}: ${percent}%`
    : t('confidence.notScoredAria', { defaultValue: 'AI confidence: not scored' });

  const tooltip = hasScore
    ? isPl
      ? `Pewność AI: ${percent}%. Wskaźnik nie ocenia jakości danych — odzwierciedla pochodzenie i historię walidacji.`
      : `AI confidence: ${percent}%. Reflects record provenance and validation history — NOT data quality.`
    : isPl
      ? 'Pewność AI: brak oceny dla tego rekordu.'
      : 'AI confidence: not yet scored.';

  const inner = (
    <span
      className={`inline-flex items-center gap-2 ${
        variant === 'compact' ? 'min-w-[64px]' : 'min-w-[120px]'
      }`}
      data-testid={testId}
      aria-label={ariaLabel}
      title={tooltip}
    >
      <Sparkles size={variant === 'compact' ? 10 : 12} style={{ color: palette.fg }} aria-hidden />
      <span
        className={`relative flex-1 overflow-hidden rounded-full ${
          variant === 'compact' ? 'h-1.5' : 'h-2'
        }`}
        style={{ backgroundColor: palette.bg }}
      >
        <span
          data-testid={`${testId}-fill`}
          className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-300"
          style={{
            width: hasScore ? `${Math.max(percent ?? 0, 4)}%` : '10%',
            backgroundColor: palette.fg,
            opacity: hasScore ? 1 : 0.4,
          }}
        />
      </span>
      {variant === 'full' && (
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: palette.fg }}>
          {hasScore ? `${percent}%` : t('confidence.notScored', { defaultValue: '—' })}
        </span>
      )}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-c-focus rounded-md"
        aria-label={ariaLabel}
        data-testid={`${testId}-button`}
      >
        {inner}
      </button>
    );
  }
  return inner;
};

export default ConfidenceBar;
