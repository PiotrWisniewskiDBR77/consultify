/**
 * AiSummaryCell — Read-only display for `ai_generated_summary` specialized
 * field type.
 *
 * Renders the AI-derived summary text with a sparkle marker indicating AI
 * authorship, a truncation at the configured `max_chars` limit, and a tooltip
 * exposing the prompt template used to generate it. An empty value surfaces
 * an explicit "AI pending" affordance rather than a dash, so reviewers can
 * distinguish "no summary yet" from a truly empty record.
 *
 * Manual writes ARE allowed (per A-S0-F5 contract: this type is in
 * `AI_REGEN_FIELD_TYPES` not `AUTO_FIELD_TYPES`); manual values render with
 * an audited "manual_override" indicator visible in the tooltip.
 *
 * Block A · EPIC-T7 · Sprint A-S5 frontend.
 *
 * DBR77 invariants: no raw hex literals; semantic Tailwind tone classes only.
 */
import { Sparkles, UserCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { AiGeneratedSummaryFieldOptions } from '@/types/tablePlatform';

interface AiSummaryCellProps {
  value: unknown;
  fieldOptions?: AiGeneratedSummaryFieldOptions;
  /**
   * Whether this value was overridden manually rather than AI-generated.
   * Mirrored from `tp_records.audit_log` `manual_override` flag (server side).
   */
  manualOverride?: boolean;
}

const HARD_LIMIT = 2000;

export const AiSummaryCell: React.FC<AiSummaryCellProps> = ({
  value,
  fieldOptions,
  manualOverride,
}) => {
  const { t } = useTranslation();
  const max = Math.max(1, Math.min(HARD_LIMIT, Number(fieldOptions?.max_chars) || 200));
  const promptTemplate = fieldOptions?.prompt_template ?? '';

  if (value == null || value === '') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1 text-xs text-c-text-muted italic"
        data-testid="ai-summary-pending"
        title={
          promptTemplate
            ? t('myWorkTable.aiCell.promptTooltip', 'AI prompt: {{template}}', {
                template: promptTemplate,
              })
            : undefined
        }
      >
        <Sparkles size={10} className="flex-shrink-0" />
        <span>{t('myWorkTable.aiCell.pending', 'AI pending…')}</span>
      </span>
    );
  }

  const text = String(value);
  const truncated = text.length > max;
  const display = truncated ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
  const tooltip = [
    text.length > display.length ? `${text.length} chars (truncated to ${max})` : null,
    promptTemplate ? `prompt: ${promptTemplate}` : null,
    manualOverride ? 'manual_override = true' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const Icon = manualOverride ? UserCheck : Sparkles;

  return (
    <span
      className="inline-flex items-center gap-1 px-1 text-xs text-c-text-muted max-w-full"
      data-testid="ai-summary-text"
      data-truncated={truncated ? 'true' : 'false'}
      data-manual-override={manualOverride ? 'true' : 'false'}
      title={tooltip || undefined}
    >
      <Icon
        size={10}
        className={`flex-shrink-0 ${manualOverride ? 'text-c-warning' : 'text-c-text-secondary'}`}
      />
      <span className="truncate">{display}</span>
    </span>
  );
};

AiSummaryCell.displayName = 'AiSummaryCell';

export default AiSummaryCell;
