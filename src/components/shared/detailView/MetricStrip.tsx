/**
 * MetricStrip — canonical top-of-artifact metric row.
 *
 * Replaces the "10 separate boxes" layout (owner feedback #27: "mamy raz, dwa…
 * dziesięć okien, niesymetrycznie"). Renders metrics as an inline, evenly
 * spaced row with hairline dividers — a dashboard strip, not a form.
 *
 * Used by Insight + Initiative detail headers (and future artifacts).
 * Read-only metrics render as plain label/value; editable ones (gated by
 * backend capabilities) show a caret affordance and call `onEdit`.
 *
 * Style follows the platform house conventions (navy/slate/primary, dark-mode
 * aware, rounded-full pills, [11px] uppercase tracking labels).
 */

import { ChevronDown } from 'lucide-react';
import React from 'react';

import type { MetricItem, MetricTone } from './types';

const TONE_PILL: Record<MetricTone, string> = {
  neutral:
    'border-slate-200/70 bg-slate-50 text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200',
  info: 'border-blue-300/70 bg-blue-50 text-blue-700 dark:border-blue-300/[0.22] dark:bg-blue-300/[0.10] dark:text-blue-200',
  pending:
    'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-300/[0.22] dark:bg-amber-300/[0.10] dark:text-amber-200',
  success:
    'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-300/[0.22] dark:bg-emerald-300/[0.10] dark:text-emerald-200',
  warning:
    'border-orange-300/70 bg-orange-50 text-orange-700 dark:border-orange-300/[0.22] dark:bg-orange-300/[0.10] dark:text-orange-200',
  danger:
    'border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-300/[0.22] dark:bg-rose-300/[0.10] dark:text-rose-200',
};

export interface MetricStripProps {
  items: MetricItem[];
  /** Extra classes for the outer container. */
  className?: string;
}

const MetricCell: React.FC<{ item: MetricItem }> = ({ item }) => {
  const labelEl = (
    <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-500">
      {item.label}
    </span>
  );

  const valueInner =
    item.tone !== undefined ? (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE_PILL[item.tone]}`}
      >
        {item.tone !== 'neutral' && (
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        )}
        {item.value}
      </span>
    ) : (
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.value}</span>
    );

  const body = (
    <span className="mt-1 flex items-center gap-1">
      {valueInner}
      {item.editable && (
        <ChevronDown size={12} className="shrink-0 text-slate-400 dark:text-slate-500" />
      )}
    </span>
  );

  const baseClass = `flex min-w-0 flex-col ${item.wide ? 'min-w-[140px]' : ''}`;

  if (item.editable && item.onEdit) {
    return (
      <button
        type="button"
        onClick={item.onEdit}
        title={item.hint}
        className={`${baseClass} rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.04]`}
      >
        {labelEl}
        {body}
      </button>
    );
  }

  return (
    <div className={`${baseClass} px-3 py-1.5`} title={item.hint}>
      {labelEl}
      {body}
    </div>
  );
};

export const MetricStrip: React.FC<MetricStripProps> = ({ items, className = '' }) => {
  if (!items.length) return null;

  return (
    <div
      role="group"
      aria-label="Artifact metrics"
      className={`flex flex-wrap items-stretch divide-x divide-slate-200/60 dark:divide-white/[0.06] ${className}`}
    >
      {items.map((item) => (
        <MetricCell key={item.key} item={item} />
      ))}
    </div>
  );
};

export default MetricStrip;
