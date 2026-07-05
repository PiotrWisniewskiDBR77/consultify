/**
 * TabeleProvenanceColumn — compact provenance cell for the Word-canvas
 * `TabelePreviewLayout` records section (Block B · EPIC-T9 · B-S5b).
 *
 * The Word-canvas idiom is read-only: this component intentionally
 * mirrors only the **passive** signals (`<ConfidenceBar variant="compact">`
 * and a static `<ValidationBadge>` chip without the transitions menu).
 * No source popover or AddSource dialog here — those belong to the
 * MyWork canvas in `<RowDetailPanel>`.
 *
 * The column shows up in the parent only when (a) the feature flag is
 * ON and (b) at least one row carries a provenance signal. This
 * mitigates B-P5 ("bloating records section on no-provenance tables").
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { ConfidenceBar } from '@/components/MyWork/table/provenance/ConfidenceBar';
import { ValidationBadge } from '@/components/MyWork/table/provenance/ValidationBadge';
import type { ValidationStatus } from '@/services/api/recordProvenance.api';

export interface TabeleProvenanceColumnProps {
  confidenceScore: number | null | undefined;
  validationStatus: ValidationStatus | null | undefined;
  testId?: string;
}

/**
 * Returns the candidate provenance values from a Word-canvas preview row.
 * Reads the `__confidence_score` / `__validation_status` keys mirrored by
 * `tablePlatformMappers.recordToNode` so the Word-canvas idiom stays in
 * sync with the MyWork canvas without duplicating the source-of-truth.
 */
export function readRowProvenance(row: Record<string, unknown>): {
  confidenceScore: number | null;
  validationStatus: ValidationStatus | null;
} {
  const rawScore = row['__confidence_score'];
  const score =
    typeof rawScore === 'number' && Number.isFinite(rawScore)
      ? rawScore
      : rawScore === null || rawScore === undefined
        ? null
        : Number.isFinite(Number(rawScore))
          ? Number(rawScore)
          : null;
  const rawStatus = row['__validation_status'];
  const status =
    rawStatus === 'verified' || rawStatus === 'flagged' || rawStatus === 'unverified'
      ? (rawStatus as ValidationStatus)
      : null;
  return { confidenceScore: score, validationStatus: status };
}

/**
 * Returns `true` when any of the provided rows carries a provenance
 * signal. Drives the column visibility in `TabelePreviewLayout`
 * (B-P5 mitigation).
 */
export function rowsHaveProvenance(rows: Array<Record<string, unknown>>): boolean {
  return rows.some((row) => {
    const { confidenceScore, validationStatus } = readRowProvenance(row);
    return (
      confidenceScore !== null || (validationStatus !== null && validationStatus !== 'unverified')
    );
  });
}

export const TabeleProvenanceColumn: React.FC<TabeleProvenanceColumnProps> = ({
  confidenceScore,
  validationStatus,
  testId = 'tabele-provenance-column',
}) => {
  const { t } = useTranslation();
  const hasSignal =
    confidenceScore !== null && confidenceScore !== undefined && Number.isFinite(confidenceScore);
  const status: ValidationStatus = validationStatus ?? 'unverified';

  if (!hasSignal && status === 'unverified') {
    return (
      <span
        data-testid={`${testId}-empty`}
        className="text-[11px] text-c-text-secondary"
        aria-label={t('kimi.preview.provenance.none', 'No provenance')}
      >
        —
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <ConfidenceBar
        score={confidenceScore ?? null}
        variant="compact"
        testId={`${testId}-confidence`}
      />
      <ValidationBadge status={status} testId={`${testId}-status`} />
    </div>
  );
};

export default TabeleProvenanceColumn;
