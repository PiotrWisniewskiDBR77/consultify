/**
 * RowGutterIndicator — compact provenance signal for a grid row
 * (Block B · EPIC-T9 · B-S5).
 *
 * Renders a 3-px vertical bar (red/amber/emerald) anchored to the left
 * edge of the row. Lives inside the existing checkbox `<td>` so it does
 * NOT change column count or `colSpan` for virtualization padding rows.
 *
 * Memoized on `(score, status)` to keep `GridView`'s hot rerender path
 * cheap (B-T5 mitigation). Returns `null` when:
 *   * the feature flag is OFF, OR
 *   * both `score == null` and `status === 'unverified'` (no signal yet).
 *
 * Click opens the row detail panel through the parent `onClick`. The
 * indicator does NOT mount the full `<ProvenanceCell>` — that lives on
 * the detail panel where vertical real estate is plentiful.
 */

import React from 'react';

import type { ValidationStatus } from '@/services/api/recordProvenance.api';
import { isRecordProvenanceEnabled } from '@/utils/recordProvenanceFlag';

export interface RowGutterIndicatorProps {
  confidenceScore: number | null | undefined;
  validationStatus: ValidationStatus | null | undefined;
}

function clamp01(n: number | null | undefined): number {
  if (n === null || n === undefined || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function indicatorColor(
  score: number | null | undefined,
  status: ValidationStatus | null | undefined
): string | null {
  if (status === 'flagged') return 'var(--c-warning)';
  if (status === 'verified') return 'var(--c-success)';
  if (score === null || score === undefined || !Number.isFinite(score)) {
    // unverified + no score → no signal worth surfacing in the gutter
    return null;
  }
  const v = clamp01(score);
  if (v < 0.4) return 'var(--c-danger)';
  if (v < 0.65) return 'var(--c-warning)';
  return 'var(--c-success)';
}

const RowGutterIndicatorBase: React.FC<RowGutterIndicatorProps> = ({
  confidenceScore,
  validationStatus,
}) => {
  if (!isRecordProvenanceEnabled()) return null;
  const color = indicatorColor(confidenceScore, validationStatus);
  if (!color) return null;

  const score = clamp01(confidenceScore);
  const tooltipScore = Number.isFinite(confidenceScore as number)
    ? `${Math.round(score * 100)}%`
    : '—';
  const tooltipStatus = validationStatus ?? 'unverified';

  return (
    <span
      data-testid="provenance-row-gutter"
      aria-label={`AI confidence ${tooltipScore}, validation ${tooltipStatus}`}
      title={`AI confidence: ${tooltipScore} · ${tooltipStatus}`}
      className="absolute left-0 top-0 bottom-0 w-[3px] pointer-events-none"
      style={{ backgroundColor: color }}
    />
  );
};

export const RowGutterIndicator = React.memo(
  RowGutterIndicatorBase,
  (prev, next) =>
    prev.confidenceScore === next.confidenceScore && prev.validationStatus === next.validationStatus
);

export default RowGutterIndicator;
