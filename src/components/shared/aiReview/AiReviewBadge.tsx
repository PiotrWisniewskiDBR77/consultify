import { Gauge } from 'lucide-react';
import React from 'react';

import type { AiReviewSummary } from '@/services/aiReview/aiReviewSummary';

export interface AiReviewBadgeLabels {
  good: string;
  needs_attention: string;
  blocked: string;
  empty: string;
  timeout: string;
}

export interface AiReviewBadgeProps {
  summary: AiReviewSummary | null | undefined;
  labels: AiReviewBadgeLabels;
  emptyLabel?: string;
  showEmpty?: boolean;
}

function toneClass(verdict: AiReviewSummary['verdict']): string {
  if (verdict === 'blocked' || verdict === 'timeout') return 'text-c-danger';
  if (verdict === 'needs_attention') return 'text-c-warning';
  if (verdict === 'good') return 'text-c-success';
  return 'text-c-text-muted';
}

function pillClass(verdict: AiReviewSummary['verdict']): string {
  if (verdict === 'blocked' || verdict === 'timeout') {
    return 'border-c-danger/30 bg-c-danger/10 text-c-danger';
  }
  if (verdict === 'needs_attention') return 'border-c-warning/30 bg-c-warning/10 text-c-warning';
  if (verdict === 'good') return 'border-c-success/30 bg-c-success/10 text-c-success';
  return 'border-c-border-subtle bg-c-surface-subtle text-c-text-muted';
}

export const AiReviewBadge: React.FC<AiReviewBadgeProps> = ({
  summary,
  labels,
  emptyLabel = '—',
  showEmpty = false,
}) => {
  if (!summary || summary.score0to100 === null) {
    return showEmpty ? <span className="text-xs text-c-text-muted">{emptyLabel}</span> : null;
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" data-ai-review-badge>
      <span className={`inline-flex items-center gap-1 ${toneClass(summary.verdict)}`}>
        <Gauge size={12} />
        {summary.score0to100}
      </span>
      <span
        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${pillClass(summary.verdict)}`}
      >
        {labels[summary.verdict]}
      </span>
    </span>
  );
};
