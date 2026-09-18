import { Sparkles } from 'lucide-react';
import React from 'react';

import type { AiReviewSummary } from '@/services/aiReview/aiReviewSummary';
import { formatListDate } from '@/utils/listDateFormat';
import { AiReviewBadge, type AiReviewBadgeLabels } from './AiReviewBadge';

export interface AiReviewPanelLabels extends AiReviewBadgeLabels {
  title: string;
  reviewedAt: string;
  noSignals: string;
}

export interface AiReviewPanelSectionProps {
  summary: AiReviewSummary | null | undefined;
  labels: AiReviewPanelLabels;
  maxSignals?: number;
}

function signalDot(severity: AiReviewSummary['signals'][number]['severity']): string {
  if (severity === 'critical') return 'bg-c-danger';
  if (severity === 'warning') return 'bg-c-warning';
  return 'bg-c-info';
}

export const AiReviewPanelSection: React.FC<AiReviewPanelSectionProps> = ({
  summary,
  labels,
  maxSignals = 5,
}) => {
  if (!summary || summary.score0to100 === null) return null;

  const signals = summary.signals.slice(0, maxSignals);

  return (
    <div
      data-testid="ai-review-block"
      data-ai-review-panel={summary.sourceModule}
      className="rounded-lg border border-c-border-subtle bg-[var(--c-surface)] p-3 space-y-2"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-c-text flex items-center gap-1.5">
          <Sparkles size={13} className="text-c-info" />
          {labels.title}
        </span>
        <AiReviewBadge summary={summary} labels={labels} />
      </div>

      {summary.reviewedAt && (
        <div className="text-[11px] text-c-text-muted">
          {labels.reviewedAt}: {formatListDate(summary.reviewedAt)}
        </div>
      )}

      {signals.length > 0 ? (
        <ul className="space-y-1 mt-1">
          {signals.map((sig, i) => (
            <li key={`${sig.label}-${i}`} className="flex items-start gap-1.5 text-[11px] text-c-text-secondary">
              <span className={`mt-0.5 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${signalDot(sig.severity)}`} />
              <span>
                <span className="font-medium">{sig.label}</span>
                {sig.message ? ` — ${sig.message}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[11px] text-c-text-muted">{labels.noSignals}</div>
      )}
    </div>
  );
};
