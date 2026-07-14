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

// Tinted chip (color-mix bg + solid text) keeps the label legible without any
// banned /NN alpha suffix on a c-* token.
function chipStyle(varName: string): React.CSSProperties {
  return {
    color: `var(${varName})`,
    borderColor: `color-mix(in srgb, var(${varName}) 40%, transparent)`,
    backgroundColor: `color-mix(in srgb, var(${varName}) 14%, transparent)`,
  };
}

function severityTone(percent: number): {
  style: React.CSSProperties;
  label: 'low' | 'medium' | 'high';
} {
  if (percent >= 0.7) {
    return { style: chipStyle('--c-danger'), label: 'high' };
  }
  if (percent >= 0.4) {
    return { style: chipStyle('--c-warning'), label: 'medium' };
  }
  return { style: chipStyle('--c-success'), label: 'low' };
}

export const RiskScoreCell: React.FC<RiskScoreCellProps> = ({ value, fieldOptions }) => {
  const scale = fieldOptions?.scale ?? 25;
  const axes = fieldOptions?.axes;

  if (value == null || value === '') {
    return (
      <span className="text-xs text-c-text-muted px-1" data-testid="risk-score-empty">
        —
      </span>
    );
  }

  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1 || num > scale) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-c-danger px-1"
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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold"
      style={tone.style}
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
