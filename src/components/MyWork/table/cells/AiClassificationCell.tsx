/**
 * AiClassificationCell — Read-only display for `ai_classification` specialized
 * field type.
 *
 * Renders the classification class as a chip. The chip's accent tone is
 * derived deterministically from the class index (sky → indigo → violet →
 * fuchsia → emerald → amber → rose) so the same class consistently uses the
 * same tone across rows. Values not present in the configured `classes`
 * surface as a rose "?" chip with tooltip.
 *
 * Manual writes ARE allowed (manual_override audited server-side).
 *
 * Block A · EPIC-T7 · Sprint A-S5 frontend.
 *
 * DBR77 invariants: no raw hex literals; semantic Tailwind tone classes only.
 */
import { Sparkles, UserCheck } from 'lucide-react';
import React from 'react';

import type { AiClassificationFieldOptions } from '@/types/tablePlatform';

interface AiClassificationCellProps {
  value: unknown;
  fieldOptions?: AiClassificationFieldOptions;
  manualOverride?: boolean;
}

// Deterministic tone palette indexed by class position. Chosen to be:
// - distinguishable in dense rows
// - free of raw hex (Tailwind utility classes only)
// - paired light/dark variants
const TONE_RING: Array<{ bg: string; text: string; border: string }> = [
  {
    bg: 'bg-sky-100 dark:bg-sky-900/30',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800/50',
  },
  {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800/50',
  },
  {
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800/50',
  },
  {
    bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    border: 'border-fuchsia-200 dark:border-fuchsia-800/50',
  },
  {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/50',
  },
  {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/50',
  },
  {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/50',
  },
];

export const AiClassificationCell: React.FC<AiClassificationCellProps> = ({
  value,
  fieldOptions,
  manualOverride,
}) => {
  const classes = Array.isArray(fieldOptions?.classes)
    ? (fieldOptions?.classes as string[]).filter((c): c is string => typeof c === 'string')
    : [];

  if (value == null || value === '') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1 text-xs text-slate-400 dark:text-slate-500 italic"
        data-testid="ai-classification-pending"
      >
        <Sparkles size={10} className="flex-shrink-0" />
        <span>AI pending…</span>
      </span>
    );
  }

  const str = String(value);
  const index = classes.indexOf(str);

  if (index < 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/50 text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20"
        data-testid="ai-classification-invalid"
        title={`Classification value '${str}' is not in configured classes`}
      >
        <Sparkles size={10} className="flex-shrink-0" />
        <span>?</span>
      </span>
    );
  }

  const tone = TONE_RING[index % TONE_RING.length];
  const Icon = manualOverride ? UserCheck : Sparkles;
  const tooltip = manualOverride
    ? `Classification ${str} · manual_override = true`
    : `Classification ${str}`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${tone.bg} ${tone.text} ${tone.border}`}
      data-testid="ai-classification-chip"
      data-class={str}
      data-manual-override={manualOverride ? 'true' : 'false'}
      title={tooltip}
    >
      <Icon size={10} className="flex-shrink-0" />
      <span className="truncate">{str}</span>
    </span>
  );
};

AiClassificationCell.displayName = 'AiClassificationCell';

export default AiClassificationCell;
