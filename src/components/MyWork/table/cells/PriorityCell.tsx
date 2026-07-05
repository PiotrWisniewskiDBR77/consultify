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

// Chip style built from a single semantic var + color-mix tint bg, so the label
// stays legible (solid bg + solid same-hue text would be unreadable) and no
// banned /NN alpha suffix touches a c-* token.
function chipStyle(varName: string): React.CSSProperties {
  return {
    color: `var(${varName})`,
    borderColor: `color-mix(in srgb, var(${varName}) 40%, transparent)`,
    backgroundColor: `color-mix(in srgb, var(${varName}) 14%, transparent)`,
  };
}

function toneForIndex(index: number): React.CSSProperties {
  // 0 = highest priority, last = lowest. Mirrors RiskScoreCell tone scale.
  switch (index) {
    case 0:
      return chipStyle('--c-danger');
    case 1:
      return chipStyle('--c-warning');
    case 2:
      return chipStyle('--c-info');
    default:
      return {
        color: 'var(--c-text-muted)',
        borderColor: 'var(--c-border)',
        backgroundColor: 'var(--c-surface-raised)',
      };
  }
}

export const PriorityCell: React.FC<PriorityCellProps> = ({ value, fieldOptions }) => {
  const levelsKey = (fieldOptions?.levels ?? 'P0_P1_P2_P3') as keyof typeof PRESETS;
  const allowed = PRESETS[levelsKey] ?? [];

  if (value == null || value === '') {
    return (
      <span
        className="text-xs text-c-text-muted px-1"
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
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold"
        style={chipStyle('--c-danger')}
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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold"
      style={tone}
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
