/**
 * SummaryCard — a compact, reusable representation of a heavy artifact.
 *
 * Two jobs (owner #27 "drugi kształt widoku, bardziej podsumowywalny"):
 *  1. The building block of C-mode (a dense grid of these for sections).
 *  2. An embeddable artifact chip for Reports / Decks / Notes — the same
 *     compact card can be dropped into another document with a backlink to the
 *     source artifact ID. One component, reused across modules (incl. Initiatives).
 *
 * Intentionally minimal and self-contained: header (status dot + title + ID),
 * optional one-line summary, optional inline metrics, optional highlights, and
 * an optional open affordance.
 */

import { ArrowUpRight } from 'lucide-react';
import React from 'react';

import type { MetricTone } from './types';

const DOT: Record<MetricTone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-blue-500',
  pending: 'bg-amber-500',
  success: 'bg-emerald-500',
  warning: 'bg-orange-500',
  danger: 'bg-rose-500',
};

export interface SummaryMetric {
  label: string;
  value: React.ReactNode;
}

export interface SummaryCardProps {
  title: string;
  statusTone?: MetricTone;
  /** Addressable artifact ID (INS-/INIT-…) shown as a monospace chip. */
  artifactId?: string;
  /** One-line summary under the title. */
  summary?: string;
  /** Inline key metrics (e.g. Confidence · Sessions · Findings). */
  metrics?: SummaryMetric[];
  /** Short bullet highlights (top themes / risks / opportunities). */
  highlights?: string[];
  onOpen?: () => void;
  isPolish?: boolean;
  className?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  statusTone = 'neutral',
  artifactId,
  summary,
  metrics,
  highlights,
  onOpen,
  isPolish = false,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-4 dark:border-white/[0.06] dark:bg-white/[0.02] ${className}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[statusTone]}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {artifactId && (
            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
              {artifactId}
            </span>
          )}
        </div>
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            aria-label={isPolish ? 'Otwórz' : 'Open'}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
          >
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>

      {summary && (
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {summary}
        </p>
      )}

      {metrics && metrics.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {metrics.map((m, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                {m.label}
              </span>
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                {m.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {highlights && highlights.length > 0 && (
        <ul className="space-y-1">
          {highlights.slice(0, 3).map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
              <span className="line-clamp-1">{h}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SummaryCard;
