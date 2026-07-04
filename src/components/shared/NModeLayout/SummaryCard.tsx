/**
 * SummaryCard (#27d)
 *
 * A compact, embeddable summary block — the "compact + embed" sibling of the
 * full NModeShell. It renders a title row (optional status dot + icon + title +
 * subtitle), an optional compact label/value metrics strip, an optional body,
 * and an optional footer.
 *
 * Designed for two contexts:
 *  1. Inside a detail view, as a lightweight summary panel.
 *  2. Embedded in Reports / Decks, where space is tight (use `compact`).
 *
 * Visual language mirrors NModePropertiesStrip / NModeShell: rounded-2xl,
 * subtle border, backdrop-blur, and the clean label+value (dashboard) style
 * for metrics — never input boxes.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5
 */

import React from 'react';

/** Tone applied to a metric's value text color. */
export type SummaryCardMetricTone = 'default' | 'positive' | 'warning' | 'danger';

export interface SummaryCardMetric {
  /** Short uppercase label shown above the value */
  label: string;
  /** Display value (already formatted) */
  value: string;
  /** Semantic tone for the value text color (default: 'default') */
  tone?: SummaryCardMetricTone;
}

export interface SummaryCardProps {
  /** Card title (font-semibold) */
  title: string;
  /** Optional subtitle shown next to the title */
  subtitle?: string;
  /** Optional leading lucide icon component */
  icon?: React.FC<{ size?: number; className?: string }>;
  /** Optional status dot color class, e.g. 'bg-emerald-400' */
  statusDotColor?: string;
  /** Optional compact horizontal label/value strip */
  metrics?: SummaryCardMetric[];
  /** Card body */
  children?: React.ReactNode;
  /** Optional footer rendered below a top hairline divider */
  footer?: React.ReactNode;
  /** Tighter paddings for embedding (Reports/Decks) */
  compact?: boolean;
  /** When provided, the whole card becomes clickable (button-like) */
  onClick?: () => void;
  /** Extra classes for the root element */
  className?: string;
}

/** Maps a metric tone to its value text color (light + dark). */
const TONE_VALUE_CLASS: Record<SummaryCardMetricTone, string> = {
  default: 'text-slate-800 dark:text-slate-200',
  positive: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-danger-600 dark:text-danger-400',
};

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  subtitle,
  icon: Icon,
  statusDotColor,
  metrics,
  children,
  footer,
  compact = false,
  onClick,
  className = '',
}) => {
  const clickable = typeof onClick === 'function';

  const rootClass = [
    'rounded-2xl border border-slate-200/60 dark:border-navy-700/40',
    'bg-white dark:bg-navy-900/40 backdrop-blur-xl',
    'text-left w-full transition-all',
    compact ? 'p-3.5' : 'p-5',
    clickable
      ? 'cursor-pointer hover:ring-2 hover:ring-c-info/40 hover:border-primary-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus'
      : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {/* ── Title row ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-0">
        {statusDotColor && (
          <span className={`shrink-0 h-2 w-2 rounded-full ${statusDotColor}`} aria-hidden="true" />
        )}
        {Icon && (
          <Icon size={compact ? 15 : 16} className="shrink-0 text-slate-500 dark:text-slate-400" />
        )}
        <span
          className={`min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100 ${
            compact ? 'text-sm' : 'text-base'
          }`}
        >
          {title}
        </span>
        {subtitle && (
          <span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-500">
            {subtitle}
          </span>
        )}
      </div>

      {/* ── Metrics strip ─────────────────────────────────────── */}
      {metrics && metrics.length > 0 && (
        <div className={`flex flex-wrap gap-x-6 gap-y-2 ${compact ? 'mt-2.5' : 'mt-3'}`}>
          {metrics.map((metric, index) => (
            <div key={`${metric.label}-${index}`} className="min-w-0 space-y-0.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {metric.label}
              </div>
              <div
                className={`truncate text-sm font-medium ${
                  TONE_VALUE_CLASS[metric.tone || 'default']
                }`}
              >
                {metric.value || '—'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────── */}
      {children && (
        <div
          className={`text-sm text-slate-700 dark:text-slate-300 ${compact ? 'mt-2.5' : 'mt-3'}`}
        >
          {children}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────── */}
      {footer && (
        <div
          className={`border-t border-slate-200/60 dark:border-navy-700/40 ${
            compact ? 'mt-3 pt-2.5' : 'mt-4 pt-3'
          }`}
        >
          {footer}
        </div>
      )}
    </>
  );

  if (clickable) {
    return (
      <button type="button" onClick={onClick} className={rootClass}>
        {content}
      </button>
    );
  }

  return <div className={rootClass}>{content}</div>;
};

export default SummaryCard;
