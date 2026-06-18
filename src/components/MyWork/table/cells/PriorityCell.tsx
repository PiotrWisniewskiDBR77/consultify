/**
 * PriorityCell — Read-only display for `priority` specialized field type.
 *
 * Renders a compact chip with the priority level (P0..P3 or critical/high/
 * medium/low). Tone is derived from the level position (highest = rose,
 * lowest = slate). Invalid values surface as a neutral "?" chip with tooltip.
 *
 * Block A · EPIC-T7 · Sprint A-S5 frontend (mirror of server-side
 * `SpecializedFieldTypes.ts` `priority` validator).
 *
 * DBR77 invariants: no raw hex literals; semantic Tailwind tone classes only.
 */
import { Flag } from 'lucide-react';
import React from 'react';

import type { PriorityFieldOptions } from '@/types/tablePlatform';

interface PriorityCellProps {
  value: unknown;
  fieldOptions?: PriorityFieldOptions;
}

const PRESETS: Record<NonNullable<PriorityFieldOptions['levels']>, readonly string[]> = {
  P0_P1_P2_P3: ['P0', 'P1', 'P2', 'P3'],
  CRITICAL_HIGH_MEDIUM_LOW: ['critical', 'high', 'medium', 'low'],
};

function toneForIndex(index: number): { bg: string; text: string; border: string } {
  // 0 = highest priority, last = lowest. Mirrors RiskScoreCell tone scale.
  switch (index) {
    case 0:
      return {
        bg: 'bg-danger-100 dark:bg-danger-900/30',
        text: 'text-danger-700 dark:text-danger-300',
        border: 'border-danger-200 dark:border-danger-800/50',
      };
    case 1:
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-800/50',
      };
    case 2:
      return {
        bg: 'bg-sky-100 dark:bg-sky-900/30',
        text: 'text-sky-700 dark:text-sky-300',
        border: 'border-sky-200 dark:border-sky-800/50',
      };
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-800/40',
        text: 'text-slate-600 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-700/60',
      };
  }
}

export const PriorityCell: React.FC<PriorityCellProps> = ({ value, fieldOptions }) => {
  const levelsKey = (fieldOptions?.levels ?? 'P0_P1_P2_P3') as keyof typeof PRESETS;
  const allowed = PRESETS[levelsKey] ?? [];

  if (value == null || value === '') {
    return (
      <span
        className="text-xs text-slate-600 dark:text-slate-500 px-1"
        data-testid="priority-empty"
      >
        —
      </span>
    );
  }

  const str = String(value);
  const index = allowed.indexOf(str);

  if (index < 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-danger-200 dark:border-danger-800/50 text-[10px] font-semibold text-danger-700 dark:text-danger-300 bg-danger-50 dark:bg-danger-900/20"
        data-testid="priority-invalid"
        title={`priority value '${str}' is not in preset '${String(levelsKey)}'`}
      >
        <Flag size={10} className="flex-shrink-0" />
        <span>?</span>
      </span>
    );
  }

  const tone = toneForIndex(index);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${tone.bg} ${tone.text} ${tone.border}`}
      data-testid="priority-chip"
      data-level={str}
      data-preset={String(levelsKey)}
      title={`Priority ${str}`}
    >
      <Flag size={10} className="flex-shrink-0" />
      <span className="uppercase tracking-wide">{str}</span>
    </span>
  );
};

PriorityCell.displayName = 'PriorityCell';

export default PriorityCell;
