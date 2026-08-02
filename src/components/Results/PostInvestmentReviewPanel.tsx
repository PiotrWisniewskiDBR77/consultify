/**
 * PostInvestmentReviewPanel — FIN-007 round-trip DISPLAY.
 *
 * Reads the durable post-investment review receipt
 * (GET /api/v8/finance/value-tracking/post-investment-reviews) — approved
 * Finance baseline vs. the Execution-recorded actual(s) it was reconciled
 * against. A fresh GET every mount/refresh: a hard reload shows the SAME
 * review because it is read straight from `finance_post_investment_reviews`,
 * never a client-side cache or a re-derived number.
 *
 * Honest empty state: no reviews yet renders as an explicit, calm message —
 * never a placeholder chart or a fabricated "on track" verdict.
 */
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  listPostInvestmentReviews,
  type PostInvestmentReview,
} from '@/services/api/v8/financeValue';

interface PostInvestmentReviewPanelProps {
  initiativeId: string;
  /** When changed, forces a refetch (mirrors ReconciliationPanel's refreshNonce). */
  refreshNonce?: number;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatMonth(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(parsed);
}

const ReviewCard: React.FC<{ review: PostInvestmentReview }> = ({ review }) => {
  const { t } = useTranslation();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const isMatched = review.reconciliationStatus === 'matched';

  return (
    <div className="rounded-lg border border-c-border bg-c-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-c-text">
            {formatMonth(review.actualPeriodMonth)}
          </div>
          <div className="text-xs text-c-text-muted">
            {t('results.postInvestmentReview.baselineLabel', {
              defaultValue: 'Baseline {{model}} v{{version}} · {{statementType}}/{{lineCode}}',
              model: review.baselineModelId.slice(0, 8),
              version: review.baselineVersion,
              statementType: review.baselineStatementType,
              lineCode: review.baselineLineCode,
            })}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isMatched ? 'bg-c-success/10 text-c-success' : 'bg-c-warning/10 text-c-warning'
          }`}
        >
          {isMatched ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {isMatched
            ? t('results.postInvestmentReview.matched', { defaultValue: 'Matched' })
            : t('results.postInvestmentReview.variance', { defaultValue: 'Variance' })}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-c-text-muted">
            {t('results.postInvestmentReview.projected', { defaultValue: 'Projected' })}
          </div>
          <div className="mt-0.5 font-semibold text-c-text">
            {formatNumber(review.projectedValue)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-c-text-muted">
            {t('results.postInvestmentReview.realized', { defaultValue: 'Realized' })}
          </div>
          <div className="mt-0.5 font-semibold text-c-text">
            {formatNumber(review.realizedValue)}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-c-text-muted">
            {t('results.postInvestmentReview.varianceLabel', { defaultValue: 'Variance' })}
          </div>
          <div className={`mt-0.5 font-semibold ${isMatched ? 'text-c-text' : 'text-c-warning'}`}>
            {review.variance >= 0 ? '+' : ''}
            {formatNumber(review.variance)} ({review.variancePct.toFixed(1)}%)
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setEvidenceOpen((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-c-focus hover:underline"
        data-testid="post-investment-review-evidence-toggle"
      >
        {evidenceOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {t('results.postInvestmentReview.viewEvidence', {
          defaultValue: 'View evidence ({{count}} actual{{plural}})',
          count: review.actualIds.length,
          plural: review.actualIds.length === 1 ? '' : 's',
        })}
      </button>

      {evidenceOpen && (
        <div
          className="mt-2 rounded-md bg-c-surface-raised p-3 text-xs text-c-text-muted"
          data-testid="post-investment-review-evidence"
        >
          <div>
            {t('results.postInvestmentReview.actualIds', { defaultValue: 'Actual record(s)' })}:{' '}
            {review.actualIds.join(', ')}
          </div>
          <div className="mt-1">
            {t('results.postInvestmentReview.createdBy', { defaultValue: 'Recorded by' })}:{' '}
            {review.createdBy} · {new Date(review.createdAt).toLocaleString()}
          </div>
          {review.evidence?.tolerancePct !== undefined && (
            <div className="mt-1">
              {t('results.postInvestmentReview.tolerance', { defaultValue: 'Tolerance' })}:{' '}
              {String(review.evidence.tolerancePct)}%
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const PostInvestmentReviewPanel: React.FC<PostInvestmentReviewPanelProps> = ({
  initiativeId,
  refreshNonce,
}) => {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<PostInvestmentReview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await listPostInvestmentReviews(initiativeId);
      setReviews(data);
    } catch {
      setReviews(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshNonce]);

  if (loading) {
    return (
      <div className="rounded-lg border border-c-border bg-c-surface p-4 text-sm text-c-text-muted">
        {t('results.postInvestmentReview.loading', {
          defaultValue: 'Loading post-investment reviews…',
        })}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-c-border bg-c-surface p-4 text-sm text-c-text-muted">
        {t('results.postInvestmentReview.unavailable', {
          defaultValue: 'Post-investment review is not available right now.',
        })}
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div
        className="rounded-lg border border-c-border bg-c-surface p-4 text-sm text-c-text-muted"
        data-testid="post-investment-review-empty"
      >
        {t('results.postInvestmentReview.empty', {
          defaultValue: 'No post-investment review yet for this initiative.',
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="post-investment-review-panel">
      <h3 className="text-sm font-semibold text-c-text">
        {t('results.postInvestmentReview.title', { defaultValue: 'Post-investment review' })}
      </h3>
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
};

export default PostInvestmentReviewPanel;
