import React from 'react';
import type { TFunction } from 'i18next';

import type { WorkRiskBoundarySummary } from './ExecutionTimelineView';

export const formatWorkRiskDecisionLevel = (
  boundary: WorkRiskBoundarySummary,
  t: TFunction
): string =>
  boundary.decisionLevel
    ? t('execution.rollout.risks.boundary.level', 'L{{level}}', { level: boundary.decisionLevel })
    : t('execution.rollout.risks.boundary.levelUnknown', 'L—');

export const formatWorkRiskMissingEvidence = (
  boundary: WorkRiskBoundarySummary,
  t: TFunction
): string =>
  boundary.missingEvidence.length
    ? t('execution.rollout.risks.boundary.missing', 'Missing: {{items}}', {
        items: boundary.missingEvidence.join(', '),
      })
    : t('execution.rollout.risks.boundary.complete', 'Evidence complete');

export const WorkRiskBoundaryBadge: React.FC<{
  boundary: WorkRiskBoundarySummary;
  t: TFunction;
}> = ({ boundary, t }) => {
  const decision = formatWorkRiskDecisionLevel(boundary, t);
  const missing = formatWorkRiskMissingEvidence(boundary, t);

  return (
    <div
      className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-token-md border border-c-border bg-c-surface-subtle px-2 py-1 text-[11px] font-medium text-c-text-muted"
      data-testid="rollout-work-risk-boundary"
    >
      <span>{t('execution.rollout.risks.boundary.label', 'Work/risk boundary')}</span>
      <span className="uppercase text-c-text">{boundary.riskState}</span>
      <span aria-hidden="true">·</span>
      <span>{decision}</span>
      <span aria-hidden="true">·</span>
      <span>{boundary.sourceType}</span>
      <span className="font-mono">{boundary.sourceId}</span>
      <span aria-hidden="true">·</span>
      <span>{missing}</span>
    </div>
  );
};
