/**
 * PostInvestmentActualForm — FIN-007 round-trip WRITE.
 *
 * Two sequential steps, both real network calls, neither ever shows success
 * before the server has confirmed it:
 *   1. Record a baseline-bound actual (POST .../execution-control/realizations
 *      /baseline) — stamps WHICH approved Finance baseline (model+version)
 *      this actual is recorded against, at write time. Writes into the
 *      CANONICAL `roi_realized_values` table — same table every other
 *      "record realized value" form in this app writes to, just with the
 *      extra baseline pointer + Idempotency-Key this endpoint requires.
 *   2. Create the durable post-investment review (POST .../post-investment-
 *      reviews) reconciling that actual against the SAME baseline's frozen
 *      snapshot at an explicit statementType/lineCode/periodDate. On success,
 *      calls `onReviewCreated` so the sibling read panel refetches.
 *
 * Fail-closed by construction, not just by convention:
 *  - No approved baseline for this initiative → the whole form is replaced
 *    by an explicit "no approved baseline" message; there is no way to
 *    submit an actual with no baseline to bind it to.
 *  - Every submit button is disabled while its own request is in flight —
 *    a genuine double-click sends the SAME Idempotency-Key twice (the
 *    generated key is fixed for the lifetime of one attempt), which the
 *    server dedupes; it is never a chance to create two actuals.
 *  - Every failure (403/400/409/422/network) renders an explicit, readable
 *    error — never swallowed, never re-labeled as success.
 */
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { V8ExecutionControlApi } from '@/services/api/v8/execution-control';
import {
  type ApprovedBaselineOption,
  createPostInvestmentReview,
  getApprovedBaselines,
} from '@/services/api/v8/financeValue';

interface PostInvestmentActualFormProps {
  initiativeId: string;
  /** Called once a review has been durably created — the caller should bump
   * whatever key forces the read panel to refetch. */
  onReviewCreated: () => void;
}

type StatementType = 'P&L' | 'BS' | 'CF';

// Mirrors server/src/services/financialModelingService.ts's canonical line
// vocabulary exactly (PL_LINES/BS_LINES/CF_LINES) — a baseline snapshot's
// `pl`/`bs`/`cf` objects are keyed by these codes and no others. Duplicated
// here (not imported) so this FIN-007-owned form has no compile-time
// dependency on a FIN-03/04 file — see CLAUDE.md ZŁOTE REGUŁY on touching
// other modules only when they block this one; reading, not importing.
const LINE_CODES_BY_STATEMENT: Record<StatementType, string[]> = {
  'P&L': [
    'REVENUE',
    'COGS',
    'GROSS_PROFIT',
    'OPEX',
    'EBITDA',
    'DEPRECIATION',
    'EBIT',
    'INTEREST_EXPENSE',
    'EBT',
    'TAX',
    'NET_INCOME',
  ],
  BS: [
    'CASH',
    'AR',
    'INVENTORY',
    'CURRENT_ASSETS',
    'PPE_GROSS',
    'ACCUM_DEPRECIATION',
    'PPE_NET',
    'TOTAL_ASSETS',
    'AP',
    'CURRENT_LIABILITIES',
    'LONG_TERM_DEBT',
    'TOTAL_LIABILITIES',
    'EQUITY_CAPITAL',
    'RETAINED_EARNINGS',
    'TOTAL_EQUITY',
    'TOTAL_LIABILITIES_EQUITY',
  ],
  CF: [
    'NET_INCOME_CF',
    'DEPRECIATION_ADDBACK',
    'WC_CHANGES',
    'OPERATING_CF',
    'CAPEX_CF',
    'INVESTING_CF',
    'DEBT_DRAWDOWN_CF',
    'DEBT_REPAYMENT_CF',
    'EQUITY_CF',
    'DIVIDEND_CF',
    'FINANCING_CF',
    'NET_CHANGE_CASH',
    'OPENING_CASH',
    'CLOSING_CASH',
  ],
};

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fin007-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Best-effort human message for a known error code; falls back to the
 * server's own message rather than a generic "something went wrong". */
function describeError(err: unknown): string {
  const anyErr = err as { code?: string; message?: string; error?: string } | undefined;
  const code = anyErr?.code;
  const raw = anyErr?.error || anyErr?.message || 'Request failed';
  const KNOWN: Record<string, string> = {
    EXECUTION_WRITE_DENIED: 'You do not have write access to record actuals for this initiative.',
    BASELINE_NOT_APPROVED: 'The selected baseline is no longer approved. Refresh and pick another.',
    BASELINE_VERSION_CONFLICT:
      'This baseline was re-approved since you loaded it. Refresh the baseline list and try again.',
    IDEMPOTENCY_KEY_REUSED: 'This submission conflicted with a previous one. Reload and retry.',
    BASELINE_LINE_NOT_FOUND:
      'The selected statement/line/period does not exist in this baseline snapshot.',
    REVIEW_IN_PROGRESS: 'A review for this action is already being processed — retry shortly.',
    ACTUAL_NOT_FOUND: 'The recorded actual could not be found — please try recording it again.',
    ACTUAL_PERIOD_MISMATCH: 'The actual and baseline periods do not match.',
  };
  return code && KNOWN[code] ? KNOWN[code] : raw;
}

export const PostInvestmentActualForm: React.FC<PostInvestmentActualFormProps> = ({
  initiativeId,
  onReviewCreated,
}) => {
  const { t } = useTranslation();

  const [baselines, setBaselines] = useState<ApprovedBaselineOption[] | null>(null);
  const [baselinesError, setBaselinesError] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');

  const [periodMonth, setPeriodMonth] = useState(
    () => `${new Date().toISOString().slice(0, 7)}-01`
  );
  const [revenueDelta, setRevenueDelta] = useState('');
  const [costDelta, setCostDelta] = useState('');
  const [savingsDelta, setSavingsDelta] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');

  const [actualKey, setActualKey] = useState(generateIdempotencyKey);
  const [actualStatus, setActualStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle'
  );
  const [actualError, setActualError] = useState<string | null>(null);
  const [lastActualId, setLastActualId] = useState<string | null>(null);

  const [statementType, setStatementType] = useState<StatementType>('P&L');
  const [lineCode, setLineCode] = useState('REVENUE');
  const [tolerancePct, setTolerancePct] = useState('5');

  const [reviewKey, setReviewKey] = useState(generateIdempotencyKey);
  const [reviewStatus, setReviewStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle'
  );
  const [reviewError, setReviewError] = useState<string | null>(null);

  const selectedBaseline = useMemo(
    () => baselines?.find((b) => b.modelId === selectedModelId) || null,
    [baselines, selectedModelId]
  );

  const fetchBaselines = useCallback(async () => {
    setBaselinesError(false);
    try {
      const data = await getApprovedBaselines(initiativeId);
      setBaselines(data);
      if (data.length > 0 && !data.some((b) => b.modelId === selectedModelId)) {
        setSelectedModelId(data[0].modelId);
      }
    } catch {
      setBaselines(null);
      setBaselinesError(true);
    }
  }, [initiativeId, selectedModelId]);

  useEffect(() => {
    fetchBaselines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiativeId]);

  const handleRecordActual = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedBaseline || actualStatus === 'pending') return;

      const revenue = revenueDelta.trim() === '' ? null : Number(revenueDelta);
      const cost = costDelta.trim() === '' ? null : Number(costDelta);
      const savings = savingsDelta.trim() === '' ? null : Number(savingsDelta);
      if (revenue === null && cost === null && savings === null) {
        setActualStatus('error');
        setActualError('Enter at least one of revenue, cost, or savings.');
        return;
      }

      setActualStatus('pending');
      setActualError(null);
      try {
        const { entry } = await V8ExecutionControlApi.recordBaselineRealization(
          {
            initiativeId,
            periodMonth,
            realizedRevenueDelta: revenue,
            realizedCostDelta: cost,
            realizedSavings: savings,
            evidenceRef: evidenceRef.trim() || null,
            baselineModelId: selectedBaseline.modelId,
            baselineExpectedVersion: selectedBaseline.version,
          },
          actualKey
        );
        setLastActualId(entry.id);
        setActualStatus('success');
      } catch (err) {
        setActualStatus('error');
        setActualError(describeError(err));
        // A version conflict means the baseline list itself is stale —
        // refresh it so the next attempt picks up the real current version.
        const code = (err as { code?: string } | undefined)?.code;
        if (code === 'BASELINE_VERSION_CONFLICT' || code === 'BASELINE_NOT_APPROVED') {
          fetchBaselines();
        }
      }
    },
    [
      selectedBaseline,
      actualStatus,
      revenueDelta,
      costDelta,
      savingsDelta,
      initiativeId,
      periodMonth,
      evidenceRef,
      actualKey,
      fetchBaselines,
    ]
  );

  const handleCreateReview = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedBaseline || !lastActualId || reviewStatus === 'pending') return;

      setReviewStatus('pending');
      setReviewError(null);
      try {
        await createPostInvestmentReview(
          {
            initiativeId,
            actualIds: [lastActualId],
            baselineModelId: selectedBaseline.modelId,
            baselineExpectedVersion: selectedBaseline.version,
            baselineStatementType: statementType,
            baselineLineCode: lineCode,
            baselinePeriodDate: periodMonth,
            tolerancePct: tolerancePct.trim() === '' ? undefined : Number(tolerancePct),
          },
          reviewKey
        );
        setReviewStatus('success');
        onReviewCreated();
        // Reset for the next actual — fresh keys, fresh actual pointer. The
        // baseline/period/statement selection is left as-is (the common case
        // is recording several periods against the same baseline).
        setLastActualId(null);
        setRevenueDelta('');
        setCostDelta('');
        setSavingsDelta('');
        setEvidenceRef('');
        setActualStatus('idle');
        setActualKey(generateIdempotencyKey());
        setReviewKey(generateIdempotencyKey());
      } catch (err) {
        setReviewStatus('error');
        setReviewError(describeError(err));
      }
    },
    [
      selectedBaseline,
      lastActualId,
      reviewStatus,
      initiativeId,
      statementType,
      lineCode,
      periodMonth,
      tolerancePct,
      reviewKey,
      onReviewCreated,
    ]
  );

  const inputCls =
    'h-9 px-3 text-sm rounded-lg border border-c-border bg-c-surface text-c-text placeholder:text-c-text-muted focus-visible:outline-none focus-visible:ring-2 focus:ring-c-focus/40 focus-visible:border-c-focus transition-colors w-full';
  const labelCls = 'block text-xs text-c-text-muted mb-1';

  if (baselinesError) {
    return (
      <div
        className="rounded-lg border border-c-border bg-c-surface p-4 text-sm text-c-text-muted"
        data-testid="post-investment-actual-form-unavailable"
      >
        {t('results.postInvestmentReview.formUnavailable', {
          defaultValue: 'Recording actuals is not available right now.',
        })}
      </div>
    );
  }

  if (baselines !== null && baselines.length === 0) {
    return (
      <div
        className="rounded-lg border border-c-border bg-c-surface p-4 text-sm text-c-text-muted"
        data-testid="post-investment-actual-form-no-baseline"
      >
        {t('results.postInvestmentReview.noApprovedBaseline', {
          defaultValue:
            'No approved Finance baseline exists for this initiative yet — an actual can only be recorded against an approved baseline.',
        })}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-c-border bg-c-surface p-4 space-y-4"
      data-testid="post-investment-actual-form"
    >
      <h3 className="text-sm font-semibold text-c-text">
        {t('results.postInvestmentReview.recordActualTitle', {
          defaultValue: 'Record actual vs. approved baseline',
        })}
      </h3>

      <form onSubmit={handleRecordActual} className="space-y-3">
        <div>
          <label className={labelCls}>
            {t('results.postInvestmentReview.baseline', { defaultValue: 'Approved baseline' })}
          </label>
          <select
            className={inputCls}
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            disabled={!baselines}
            data-testid="post-investment-baseline-select"
          >
            {(baselines || []).map((b) => (
              <option key={b.modelId} value={b.modelId}>
                {b.name} · v{b.version}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>
              {t('results.postInvestmentReview.period', { defaultValue: 'Period' })}
            </label>
            <input
              className={inputCls}
              type="month"
              value={periodMonth.slice(0, 7)}
              onChange={(e) => setPeriodMonth(`${e.target.value}-01`)}
            />
          </div>
          <div>
            <label className={labelCls}>
              {t('results.postInvestmentReview.evidenceRef', {
                defaultValue: 'Evidence ref (optional)',
              })}
            </label>
            <input
              className={inputCls}
              value={evidenceRef}
              onChange={(e) => setEvidenceRef(e.target.value)}
              placeholder="e.g. initiative_history:abc123"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>
              {t('results.postInvestmentReview.revenueDelta', { defaultValue: 'Revenue Δ' })}
            </label>
            <input
              className={inputCls}
              type="number"
              step="any"
              value={revenueDelta}
              onChange={(e) => setRevenueDelta(e.target.value)}
              placeholder="0"
              data-testid="post-investment-revenue-delta"
            />
          </div>
          <div>
            <label className={labelCls}>
              {t('results.postInvestmentReview.costDelta', { defaultValue: 'Cost Δ' })}
            </label>
            <input
              className={inputCls}
              type="number"
              step="any"
              value={costDelta}
              onChange={(e) => setCostDelta(e.target.value)}
              placeholder="0"
              data-testid="post-investment-cost-delta"
            />
          </div>
          <div>
            <label className={labelCls}>
              {t('results.postInvestmentReview.savingsDelta', { defaultValue: 'Savings' })}
            </label>
            <input
              className={inputCls}
              type="number"
              step="any"
              value={savingsDelta}
              onChange={(e) => setSavingsDelta(e.target.value)}
              placeholder="0"
              data-testid="post-investment-savings-delta"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!selectedBaseline || actualStatus === 'pending'}
          className="w-full h-9 text-sm font-medium rounded-full bg-c-text text-c-surface hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity inline-flex items-center justify-center gap-2"
          data-testid="post-investment-record-actual-submit"
        >
          {actualStatus === 'pending' && <Loader2 size={14} className="animate-spin" />}
          {actualStatus === 'pending'
            ? t('common.saving', { defaultValue: 'Saving…' })
            : t('results.postInvestmentReview.recordActual', { defaultValue: 'Record actual' })}
        </button>

        {actualStatus === 'error' && actualError && (
          <div
            className="flex items-start gap-1.5 text-xs text-c-danger"
            data-testid="post-investment-actual-error"
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{actualError}</span>
          </div>
        )}
        {actualStatus === 'success' && lastActualId && (
          <div
            className="flex items-center gap-1.5 text-xs text-c-success"
            data-testid="post-investment-actual-success"
          >
            <CheckCircle2 size={14} />
            <span>
              {t('results.postInvestmentReview.actualRecorded', {
                defaultValue: 'Actual recorded ({{id}}).',
                id: lastActualId.slice(0, 8),
              })}
            </span>
          </div>
        )}
      </form>

      {lastActualId && (
        <form
          onSubmit={handleCreateReview}
          className="space-y-3 border-t border-c-border pt-3"
          data-testid="post-investment-create-review-form"
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>
                {t('results.postInvestmentReview.statementType', {
                  defaultValue: 'Statement',
                })}
              </label>
              <select
                className={inputCls}
                value={statementType}
                onChange={(e) => {
                  const next = e.target.value as StatementType;
                  setStatementType(next);
                  setLineCode(LINE_CODES_BY_STATEMENT[next][0]);
                }}
              >
                <option value="P&L">P&amp;L</option>
                <option value="BS">BS</option>
                <option value="CF">CF</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>
                {t('results.postInvestmentReview.lineCode', { defaultValue: 'Line' })}
              </label>
              <select
                className={inputCls}
                value={lineCode}
                onChange={(e) => setLineCode(e.target.value)}
              >
                {LINE_CODES_BY_STATEMENT[statementType].map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                {t('results.postInvestmentReview.tolerancePct', {
                  defaultValue: 'Tolerance %',
                })}
              </label>
              <input
                className={inputCls}
                type="number"
                step="any"
                min="0"
                value={tolerancePct}
                onChange={(e) => setTolerancePct(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={reviewStatus === 'pending'}
            className="w-full h-9 text-sm font-medium rounded-full bg-c-text text-c-surface hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity inline-flex items-center justify-center gap-2"
            data-testid="post-investment-create-review-submit"
          >
            {reviewStatus === 'pending' && <Loader2 size={14} className="animate-spin" />}
            {reviewStatus === 'pending'
              ? t('common.saving', { defaultValue: 'Saving…' })
              : t('results.postInvestmentReview.createReview', {
                  defaultValue: 'Reconcile & create review',
                })}
          </button>

          {reviewStatus === 'error' && reviewError && (
            <div
              className="flex items-start gap-1.5 text-xs text-c-danger"
              data-testid="post-investment-review-error"
            >
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{reviewError}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default PostInvestmentActualForm;
