/**
 * RiskScoreCell — Read-only display for `risk_score` specialized field type.
 *
 * Renders a compact chip with the score value, scale denominator (e.g. "20/25"),
 * and a severity tone (rose/amber/emerald) derived from the percentage of scale.
 * Tooltip surfaces likelihood × impact axes when available.
 *
 * Block A · EPIC-T7 · Sprint A-S5 frontend (mirror of server-side
 * `SpecializedFieldTypes.ts` `risk_score` validator).
 *
 * DBR77 invariants: no raw hex literals; semantic Tailwind tone classes only.
 */
import { ShieldAlert } from 'lucide-react';
import React from 'react';

import type { RiskScoreFieldOptions } from '@/types/tablePlatform';

interface RiskScoreCellProps {
  value: unknown;
  fieldOptions?: RiskScoreFieldOptions;
}

function severityTone(percent: number): {
  bg: string;
  text: string;
  border: string;
  label: 'low' | 'medium' | 'high';
} {
  if (percent >= 0.7) {
    return {
      bg: 'bg-danger-100 dark:bg-danger-900/30',
      text: 'text-danger-700 dark:text-danger-300',
      border: 'border-danger-200 dark:border-danger-800/50',
      label: 'high',
    };
  }
  if (percent >= 0.4) {
    return {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800/50',
      label: 'medium',
    };
  }
  return {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    label: 'low',
  };
}

export const RiskScoreCell: React.FC<RiskScoreCellProps> = ({ value, fieldOptions }) => {
  const scale = fieldOptions?.scale ?? 25;
  const axes = fieldOptions?.axes;

  if (value == null || value === '') {
    return (
      <span
        className="text-xs text-slate-600 dark:text-slate-500 px-1"
        data-testid="risk-score-empty"
      >
        —
      </span>
    );
  }

  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1 || num > scale) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-danger-600 dark:text-danger-400 px-1"
        data-testid="risk-score-invalid"
        title={`risk_score value out of range (expected 1..${scale})`}
      >
        <ShieldAlert size={11} className="flex-shrink-0" />
        <span className="tabular-nums">!</span>
      </span>
    );
  }

  const percent = num / scale;
  const tone = severityTone(percent);
  const tooltip =
    axes?.likelihood != null && axes?.impact != null
      ? `Risk ${num}/${scale} · likelihood ${axes.likelihood} × impact ${axes.impact}`
      : `Risk ${num}/${scale}`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${tone.bg} ${tone.text} ${tone.border}`}
      data-testid="risk-score-chip"
      data-severity={tone.label}
      data-scale={scale}
      title={tooltip}
    >
      <ShieldAlert size={10} className="flex-shrink-0" />
      <span className="tabular-nums">
        {num}
        <span className="opacity-60">/{scale}</span>
      </span>
    </span>
  );
};

RiskScoreCell.displayName = 'RiskScoreCell';

export default RiskScoreCell;
