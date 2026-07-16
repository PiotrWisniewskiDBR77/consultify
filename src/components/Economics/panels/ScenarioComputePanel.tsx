/**
 * M16 advanced suite (wire-c) — Scenario Compute panel (fan chart).
 *
 * Consumes POST /api/v8/finance-valuation/scenarios/{apply,fan} (server:
 * scenarioComputeService — see finance-valuation.routes.ts §6). The user
 * enters one base metric series (e.g. monthly revenue) plus its starting
 * value name; the panel:
 *   1. calls /scenarios/apply for base/optimistic/conservative to scale the
 *      series by the server's fixed growth/cost multipliers (name-matched —
 *      a key containing "revenue"/"growth" scales by growthMult, "cost"/
 *      "opex"/"cogs" by costMult; anything else is copied unscaled), then
 *   2. calls /scenarios/fan to reshape the three scaled series into a
 *      base line + optimistic/conservative bands for the fan chart.
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16AdvancedSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useFinanceChartColors } from '@/components/Economics/financeChartTokens';
import {
  runScenarioApply,
  runScenarioFan,
  type ScenarioFanResponse,
} from '@/services/financeValuationApi';

const METRIC_KEY = 'revenue';

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return Math.round(v).toString();
};

export interface ScenarioComputePanelProps {
  fetcher?: {
    apply?: typeof runScenarioApply;
    fan?: typeof runScenarioFan;
  };
}

export const ScenarioComputePanel: React.FC<ScenarioComputePanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();
  const colors = useFinanceChartColors();
  const [seriesRaw, setSeriesRaw] = useState('1000000,1050000,1100000,1180000,1250000,1300000');

  const [fan, setFan] = useState<ScenarioFanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    const series = seriesRaw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (series.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const apply = fetcher?.apply ?? runScenarioApply;
      const [base, optimistic, conservative] = await Promise.all([
        apply({ assumptions: { [METRIC_KEY]: series }, scenario: 'base' }),
        apply({ assumptions: { [METRIC_KEY]: series }, scenario: 'optimistic' }),
        apply({ assumptions: { [METRIC_KEY]: series }, scenario: 'conservative' }),
      ]);
      const asSeries = (a: { assumptions: Record<string, unknown> }): number[] => {
        const v = a.assumptions[METRIC_KEY];
        return Array.isArray(v) ? (v as number[]) : [];
      };
      const fanFetcher = fetcher?.fan ?? runScenarioFan;
      const res = await fanFetcher({
        scenarios: {
          base: { [METRIC_KEY]: asSeries(base) },
          optimistic: { [METRIC_KEY]: asSeries(optimistic) },
          conservative: { [METRIC_KEY]: asSeries(conservative) },
        },
        metric: METRIC_KEY,
      });
      setFan(res ?? null);
      if (!res) {
        setError(t('finance.m16c.scenario.errorGeneric', 'Scenario compute failed.'));
      }
    } catch (err: any) {
      setFan(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16c.scenario.errorGeneric', 'Scenario compute failed.')
      );
    } finally {
      setLoading(false);
    }
  }, [seriesRaw, fetcher, t]);

  const chartData = useMemo(() => {
    if (!fan) return [];
    const optimistic = fan.bands.find((b) => b.label === 'optimistic')?.values ?? [];
    const conservative = fan.bands.find((b) => b.label === 'conservative')?.values ?? [];
    return fan.base.map((baseVal, i) => ({
      period: `P${i + 1}`,
      base: baseVal,
      optimistic: optimistic[i] ?? null,
      conservative: conservative[i] ?? null,
    }));
  }, [fan]);

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="scenario-compute-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t(
              'finance.m16c.scenario.title',
              'Scenario compute — base / optimistic / conservative'
            )}
          </h3>
          <p className="mt-0.5 text-xs text-c-text-secondary">
            {t(
              'finance.m16c.scenario.subtitle',
              'Fan chart of a metric series scaled by the three standard scenarios.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          data-testid="scenario-run"
          className="shrink-0 rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-sm font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {loading
            ? t('finance.m16c.scenario.running', 'Computing…')
            : t('finance.m16c.scenario.run', 'Run scenarios')}
        </button>
      </div>

      <div className="mb-4">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-c-text-secondary">
            {t(
              'finance.m16c.scenario.seriesLabel',
              'Base revenue series (comma-separated periods)'
            )}
          </span>
          <input
            type="text"
            value={seriesRaw}
            onChange={(e) => setSeriesRaw(e.target.value)}
            className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 font-mono text-sm tabular-nums text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
          />
        </label>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="scenario-error"
        >
          {error}
        </div>
      )}

      {!error && !fan && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="scenario-empty">
          {t('finance.m16c.scenario.empty', 'Set the base series, then run the scenarios.')}
        </p>
      )}

      {!error && fan && (
        <div className="h-[260px] w-full" data-testid="scenario-fan-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" stroke={colors.axis} tick={{ fontSize: 11 }} />
              <YAxis stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip formatter={(value: number) => fmt(value)} />
              <Area
                type="monotone"
                dataKey="optimistic"
                stroke="none"
                fill={colors.benefit}
                fillOpacity={0.12}
              />
              <Area
                type="monotone"
                dataKey="conservative"
                stroke="none"
                fill={colors.cost}
                fillOpacity={0.12}
              />
              <Line
                type="monotone"
                dataKey="optimistic"
                stroke={colors.benefit}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="conservative"
                stroke={colors.cost}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="base"
                stroke={colors.net}
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div
            className="mt-2 flex flex-wrap gap-3 text-xs text-c-text-secondary"
            data-testid="scenario-legend"
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ backgroundColor: colors.net }} />
              {t('finance.m16c.scenario.legendBase', 'Base')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ backgroundColor: colors.benefit }} />
              {t('finance.m16c.scenario.legendOptimistic', 'Optimistic')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ backgroundColor: colors.cost }} />
              {t('finance.m16c.scenario.legendConservative', 'Conservative')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScenarioComputePanel;
