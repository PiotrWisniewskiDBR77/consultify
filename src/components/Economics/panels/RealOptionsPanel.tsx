/**
 * M16 valuation suite — Real Options panel.
 *
 * Consumes POST /api/v8/finance-valuation/real-options/{defer,abandon,staged}
 * (server: realOptionsService — CRR binomial lattice). Lets the user pick an
 * option type (defer / abandon / staged), edit its inputs, and see the
 * computed option value + go/wait/abandon-style recommendation.
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16ValuationSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type AbandonOptionResult,
  type DeferOptionResult,
  runAbandonOption,
  runDeferOption,
  runStagedInvestment,
  type StagedInvestmentResult,
} from '@/services/financeValuationApi';

type OptionType = 'defer' | 'abandon' | 'staged';

interface StageRow {
  id: string;
  cost: number;
  expectedValue: number;
  successProbPct: number;
}

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(v);
};

let stageSeq = 0;
const nextStageId = (): string => `stage-${Date.now().toString(36)}-${stageSeq++}`;

const DEFAULT_STAGES: StageRow[] = [
  { id: nextStageId(), cost: 100_000, expectedValue: 500_000, successProbPct: 60 },
  { id: nextStageId(), cost: 300_000, expectedValue: 1_200_000, successProbPct: 50 },
];

export interface RealOptionsPanelProps {
  fetcher?: {
    defer?: typeof runDeferOption;
    abandon?: typeof runAbandonOption;
    staged?: typeof runStagedInvestment;
  };
}

const badgeToneClass =
  'rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-xs font-semibold text-c-text';

export const RealOptionsPanel: React.FC<RealOptionsPanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();
  const [type, setType] = useState<OptionType>('defer');

  // Shared binomial inputs for defer/abandon.
  const [underlyingValue, setUnderlyingValue] = useState(1_000_000);
  const [investmentCost, setInvestmentCost] = useState(900_000);
  const [salvageValue, setSalvageValue] = useState(400_000);
  const [volatilityPct, setVolatilityPct] = useState(30);
  const [riskFreeRatePct, setRiskFreeRatePct] = useState(4);
  const [timeToDecideYears, setTimeToDecideYears] = useState(2);
  const [steps, setSteps] = useState(4);

  const [stages, setStages] = useState<StageRow[]>(DEFAULT_STAGES);

  const [deferResult, setDeferResult] = useState<DeferOptionResult | null>(null);
  const [abandonResult, setAbandonResult] = useState<AbandonOptionResult | null>(null);
  const [stagedResult, setStagedResult] = useState<StagedInvestmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const updateStage = useCallback((id: string, patch: Partial<StageRow>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);
  const addStage = useCallback(() => {
    setStages((prev) => [
      ...prev,
      { id: nextStageId(), cost: 100_000, expectedValue: 300_000, successProbPct: 50 },
    ]);
  }, []);
  const removeStage = useCallback((id: string) => {
    setStages((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      if (type === 'defer') {
        const res = await (fetcher?.defer ?? runDeferOption)({
          underlyingValue,
          investmentCost,
          volatility: volatilityPct / 100,
          riskFreeRate: riskFreeRatePct / 100,
          timeToDecideYears,
          steps,
        });
        setDeferResult(res ?? null);
        setFailed(!res);
      } else if (type === 'abandon') {
        const res = await (fetcher?.abandon ?? runAbandonOption)({
          underlyingValue,
          salvageValue,
          volatility: volatilityPct / 100,
          riskFreeRate: riskFreeRatePct / 100,
          timeToDecideYears,
          steps,
        });
        setAbandonResult(res ?? null);
        setFailed(!res);
      } else {
        const res = await (fetcher?.staged ?? runStagedInvestment)(
          stages.map((s) => ({
            cost: s.cost,
            expectedValue: s.expectedValue,
            successProb: s.successProbPct / 100,
          }))
        );
        setStagedResult(res ?? null);
        setFailed(!res);
      }
    } catch {
      setFailed(true);
      setDeferResult(null);
      setAbandonResult(null);
      setStagedResult(null);
    } finally {
      setLoading(false);
    }
  }, [
    type,
    underlyingValue,
    investmentCost,
    salvageValue,
    volatilityPct,
    riskFreeRatePct,
    timeToDecideYears,
    steps,
    stages,
    fetcher,
  ]);

  const switchType = (next: OptionType): void => {
    setType(next);
    setDeferResult(null);
    setAbandonResult(null);
    setStagedResult(null);
    setFailed(false);
  };

  const recLabel: Record<string, string> = {
    defer: t('finance.m16.realOptions.recDefer', 'Defer'),
    'invest-now': t('finance.m16.realOptions.recInvestNow', 'Invest now'),
    abandon: t('finance.m16.realOptions.recAbandon', 'Abandon'),
    'pilot-first': t('finance.m16.realOptions.recPilotFirst', 'Pilot first'),
    'full-commit': t('finance.m16.realOptions.recFullCommit', 'Full commit'),
  };

  const hasAnyResult = !!deferResult || !!abandonResult || !!stagedResult;

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="real-options-panel"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          {t('finance.m16.realOptions.title', 'Real options')}
        </h3>
        <p className="mt-0.5 text-xs text-c-text-secondary">
          {t(
            'finance.m16.realOptions.subtitle',
            'Value managerial flexibility — defer, abandon or stage the investment.'
          )}
        </p>
      </div>

      {/* Option type selector */}
      <div className="mb-3 flex gap-1.5" role="tablist" data-testid="ro-type-selector">
        {(
          [
            { key: 'defer', label: t('finance.m16.realOptions.typeDefer', 'Defer') },
            { key: 'abandon', label: t('finance.m16.realOptions.typeAbandon', 'Abandon') },
            { key: 'staged', label: t('finance.m16.realOptions.typeStaged', 'Staged') },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={type === opt.key}
            onClick={() => switchType(opt.key)}
            className={`rounded-full border border-c-border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
              type === opt.key
                ? 'bg-c-surface-raised text-c-text'
                : 'text-c-text-muted hover:text-c-text'
            }`}
            data-testid={`ro-type-${opt.key}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      {(type === 'defer' || type === 'abandon') && (
        <div className="mb-3 flex flex-wrap items-end gap-3" data-testid="ro-binomial-inputs">
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">
              {t('finance.m16.realOptions.underlyingValue', 'Underlying value')}
            </span>
            <input
              type="number"
              value={underlyingValue}
              onChange={(e) => setUnderlyingValue(Number(e.target.value) || 0)}
              className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          {type === 'defer' ? (
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">
                {t('finance.m16.realOptions.investmentCost', 'Investment cost')}
              </span>
              <input
                type="number"
                value={investmentCost}
                onChange={(e) => setInvestmentCost(Number(e.target.value) || 0)}
                className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
          ) : (
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">
                {t('finance.m16.realOptions.salvageValue', 'Salvage value')}
              </span>
              <input
                type="number"
                value={salvageValue}
                onChange={(e) => setSalvageValue(Number(e.target.value) || 0)}
                className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
          )}
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">
              {t('finance.m16.realOptions.volatility', 'Volatility (%)')}
            </span>
            <input
              type="number"
              value={volatilityPct}
              onChange={(e) => setVolatilityPct(Number(e.target.value) || 0)}
              className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">
              {t('finance.m16.realOptions.riskFreeRate', 'Risk-free rate (%)')}
            </span>
            <input
              type="number"
              value={riskFreeRatePct}
              onChange={(e) => setRiskFreeRatePct(Number(e.target.value) || 0)}
              className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">
              {t('finance.m16.realOptions.timeToDecide', 'Years to decide')}
            </span>
            <input
              type="number"
              value={timeToDecideYears}
              onChange={(e) => setTimeToDecideYears(Number(e.target.value) || 0)}
              className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16.realOptions.steps', 'Lattice steps')}</span>
            <input
              type="number"
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value) || 1)}
              className="w-16 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
        </div>
      )}

      {type === 'staged' && (
        <div className="mb-3 space-y-2" data-testid="ro-stages">
          {stages.map((stage, idx) => (
            <div
              key={stage.id}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
              data-testid={`ro-stage-${stage.id}`}
            >
              <span className="text-[11px] text-c-text-muted">#{idx + 1}</span>
              <label className="flex flex-col text-[11px] text-c-text-muted">
                <span className="mb-0.5">{t('finance.m16.realOptions.stageCost', 'Cost')}</span>
                <input
                  type="number"
                  value={stage.cost}
                  onChange={(e) => updateStage(stage.id, { cost: Number(e.target.value) || 0 })}
                  className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                />
              </label>
              <label className="flex flex-col text-[11px] text-c-text-muted">
                <span className="mb-0.5">
                  {t('finance.m16.realOptions.stageExpectedValue', 'Expected value')}
                </span>
                <input
                  type="number"
                  value={stage.expectedValue}
                  onChange={(e) =>
                    updateStage(stage.id, { expectedValue: Number(e.target.value) || 0 })
                  }
                  className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                />
              </label>
              <label className="flex flex-col text-[11px] text-c-text-muted">
                <span className="mb-0.5">
                  {t('finance.m16.realOptions.stageSuccessProb', 'Success probability (%)')}
                </span>
                <input
                  type="number"
                  value={stage.successProbPct}
                  onChange={(e) =>
                    updateStage(stage.id, { successProbPct: Number(e.target.value) || 0 })
                  }
                  className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                />
              </label>
              {stages.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStage(stage.id)}
                  className="text-c-text-muted hover:text-c-danger"
                  aria-label={`Remove stage ${idx + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addStage}
            className="rounded border border-dashed border-c-border px-2 py-1 text-xs text-c-text-secondary hover:border-c-focus hover:text-c-text"
          >
            {t('finance.m16.realOptions.addStage', '+ stage')}
          </button>
        </div>
      )}

      <div className="mb-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
          data-testid="ro-run"
        >
          {loading
            ? t('finance.m16.realOptions.running', 'Valuing…')
            : t('finance.m16.realOptions.run', 'Value option')}
        </button>
      </div>

      {failed && (
        <p className="text-sm text-c-text-muted" data-testid="ro-failed">
          {t('finance.m16.realOptions.error', 'Valuation unavailable right now — try again.')}
        </p>
      )}

      {!failed && !hasAnyResult && !loading && (
        <p className="text-sm text-c-text-muted" data-testid="ro-empty">
          {t('finance.m16.realOptions.empty', 'Enter the inputs and value the option.')}
        </p>
      )}

      {!failed && type === 'defer' && deferResult && (
        <div className="flex flex-wrap items-center gap-4" data-testid="ro-defer-result">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16.realOptions.optionValue', 'Option value')}
            </p>
            <p className="text-sm font-semibold text-c-text">{fmt(deferResult.optionValue)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16.realOptions.expandedNpv', 'Expanded NPV')}
            </p>
            <p className="text-sm font-semibold text-c-text">{fmt(deferResult.expandedNpv)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16.realOptions.recommendation', 'Recommendation')}
            </p>
            <span className={badgeToneClass} data-testid="ro-recommendation">
              {recLabel[deferResult.recommendation]}
            </span>
          </div>
        </div>
      )}

      {!failed && type === 'abandon' && abandonResult && (
        <div className="flex flex-wrap items-center gap-4" data-testid="ro-abandon-result">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16.realOptions.salvageValue', 'Salvage value')}
            </p>
            <p className="text-sm font-semibold text-c-text">{fmt(abandonResult.salvageValue)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16.realOptions.optionValue', 'Option value')}
            </p>
            <p className="text-sm font-semibold text-c-text">{fmt(abandonResult.optionValue)}</p>
          </div>
        </div>
      )}

      {!failed && type === 'staged' && stagedResult && (
        <div className="flex flex-wrap items-center gap-4" data-testid="ro-staged-result">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16.realOptions.totalOptionValue', 'Staged expected value')}
            </p>
            <p className="text-sm font-semibold text-c-text">
              {fmt(stagedResult.totalOptionValue)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16.realOptions.recommendation', 'Recommendation')}
            </p>
            <span className={badgeToneClass} data-testid="ro-recommendation">
              {recLabel[stagedResult.recommendation]}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealOptionsPanel;
