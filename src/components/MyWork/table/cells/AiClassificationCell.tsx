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
import { useTranslation } from 'react-i18next';

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
// Categorical identity palette (c-tag-*) — labels carry no semantic meaning,
// so we never borrow c-success/-warning/-danger here. Blue-first ordering.
// A tint bg is built via color-mix (alpha suffixes on c-* tokens are banned).
const TONE_VARS = [
  '--c-tag-1',
  '--c-tag-2',
  '--c-tag-3',
  '--c-tag-4',
  '--c-tag-6',
  '--c-tag-9',
  '--c-tag-11',
];

export const AiClassificationCell: React.FC<AiClassificationCellProps> = ({
  value,
  fieldOptions,
  manualOverride,
}) => {
  const { t } = useTranslation();
  const classes = Array.isArray(fieldOptions?.classes)
    ? (fieldOptions?.classes as string[]).filter((c): c is string => typeof c === 'string')
    : [];

  if (value == null || value === '') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1 text-xs text-c-text-muted italic"
        data-testid="ai-classification-pending"
      >
        <Sparkles size={10} className="flex-shrink-0" />
        <span>{t('myWorkTable.aiCell.pending', 'AI pending…')}</span>
      </span>
    );
  }

  const str = String(value);
  const index = classes.indexOf(str);

  if (index < 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold text-c-danger"
        style={{
          borderColor: 'var(--c-danger)',
          backgroundColor: 'color-mix(in srgb, var(--c-danger) 12%, transparent)',
        }}
        data-testid="ai-classification-invalid"
        title={`Classification value '${str}' is not in configured classes`}
      >
        <Sparkles size={10} className="flex-shrink-0" />
        <span>?</span>
      </span>
    );
  }

  const toneVar = TONE_VARS[index % TONE_VARS.length];
  const Icon = manualOverride ? UserCheck : Sparkles;
  const tooltip = manualOverride
    ? `Classification ${str} · manual_override = true`
    : `Classification ${str}`;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold"
      style={{
        color: `var(${toneVar})`,
        borderColor: `var(${toneVar})`,
        backgroundColor: `color-mix(in srgb, var(${toneVar}) 12%, transparent)`,
      }}
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
