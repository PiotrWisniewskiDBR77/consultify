/**
 * M16 advanced suite (wire-c) — Rolling Forecast panel.
 *
 * Consumes POST /api/v8/finance-planning/rolling-forecast/{reforecast,roll-forward}
 * (server: rollingForecastService — see finance-planning.routes.ts §2). The
 * user edits a plan (period + planned value) and actuals for the closed
 * periods, hits "Reforecast", and the panel:
 *   1. calls /rolling-forecast/reforecast to blend actuals (closed periods)
 *      with plan (future periods) into one blended line, then
 *   2. calls /rolling-forecast/roll-forward on that blended line to extend it
 *      N periods by trailing trend, rendered as a dashed continuation.
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16AdvancedSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useFinanceChartColors } from '@/components/Economics/financeChartTokens';
import {
  postRollingReforecast,
  postRollingRollForward,
  type ReforecastLine,
} from '@/services/api/v8/financePlanning';

interface PlanRow {
  period: string;
  plan: string;
  actual: string;
  hasActual: boolean;
}

const DEFAULT_ROWS: PlanRow[] = [
  { period: 'P01', plan: '100000', actual: '98000', hasActual: true },
  { period: 'P02', plan: '105000', actual: '108000', hasActual: true },
  { period: 'P03', plan: '110000', actual: '', hasActual: false },
  { period: 'P04', plan: '115000', actual: '', hasActual: false },
  { period: 'P05', plan: '120000', actual: '', hasActual: false },
];

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return Math.round(v).toString();
};

export interface RollingForecastPanelProps {
  fetcher?: {
    reforecast?: typeof postRollingReforecast;
    rollForward?: typeof postRollingRollForward;
  };
}

export const RollingForecastPanel: React.FC<RollingForecastPanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();
  const colors = useFinanceChartColors();
  const [rows, setRows] = useState<PlanRow[]>(DEFAULT_ROWS);
  const [rollByPeriods, setRollByPeriods] = useState(3);

  const [lines, setLines] = useState<ReforecastLine[] | null>(null);
  const [rolled, setRolled] = useState<{ period: string; value: number }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = useCallback((period: string, patch: Partial<PlanRow>) => {
    setRows((prev) => prev.map((r) => (r.period === period ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        period: `P${(prev.length + 1).toString().padStart(2, '0')}`,
        plan: '0',
        actual: '',
        hasActual: false,
      },
    ]);
  }, []);

  const removeRow = useCallback((period: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.period !== period) : prev));
  }, []);

  const run = useCallback(async () => {
    if (rows.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const plan = rows.map((r) => ({ period: r.period, value: Number(r.plan) || 0 }));
      const actuals = rows
        .filter((r) => r.hasActual)
        .map((r) => ({ period: r.period, value: Number(r.actual) || 0 }));

      const reforecast = fetcher?.reforecast ?? postRollingReforecast;
      const rollForward = fetcher?.rollForward ?? postRollingRollForward;

      const reforecastRes = await reforecast(plan, actuals);
      setLines(reforecastRes.lines);

      const blended = reforecastRes.lines.map((l) => ({ period: l.period, value: l.value }));
      const rollRes = await rollForward(blended, rollByPeriods);
      setRolled(rollRes.lines);
    } catch (err: any) {
      setLines(null);
      setRolled(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16c.rollingForecast.errorGeneric', 'Rolling forecast failed.')
      );
    } finally {
      setLoading(false);
    }
  }, [rows, rollByPeriods, fetcher, t]);

  const chartData = useMemo(() => {
    if (!lines) return [];
    const base = lines.map((l) => ({
      period: l.period,
      blended: l.value,
      source: l.source,
      extension: null as number | null,
    }));
    const extension = (rolled ?? []).map((r) => ({
      period: r.period,
      blended: null as number | null,
      source: 'extension' as const,
      extension: r.value,
    }));
    // Bridge the dashed extension line to the last blended point so it reads
    // as a continuation, not a gap.
    if (extension.length > 0 && base.length > 0) {
      extension[0] = { ...extension[0], extension: extension[0].extension };
      base[base.length - 1] = {
        ...base[base.length - 1],
        extension: base[base.length - 1].blended,
      };
    }
    return [...base, ...extension];
  }, [lines, rolled]);

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="rolling-forecast-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t(
              'finance.m16c.rollingForecast.title',
              'Rolling forecast — reforecast & roll-forward'
            )}
          </h3>
          <p className="mt-0.5 text-xs text-c-text-secondary">
            {t(
              'finance.m16c.rollingForecast.subtitle',
              'Blend closed-period actuals with plan, then extend by trailing trend.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || rows.length === 0}
          data-testid="rolling-forecast-run"
          className="shrink-0 rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-sm font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {loading
            ? t('finance.m16c.rollingForecast.running', 'Reforecasting…')
            : t('finance.m16c.rollingForecast.run', 'Reforecast')}
        </button>
      </div>

      {/* Plan/actuals rows */}
      <div className="mb-4" data-testid="rolling-forecast-rows">
        <div className="mb-1 grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 text-[11px] font-medium uppercase tracking-wide text-c-text-muted">
          <span>{t('finance.m16c.rollingForecast.period', 'Period')}</span>
          <span>{t('finance.m16c.rollingForecast.plan', 'Plan')}</span>
          <span>{t('finance.m16c.rollingForecast.actual', 'Actual')}</span>
          <span>{t('finance.m16c.rollingForecast.closed', 'Closed?')}</span>
          <span />
        </div>
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.period}
              className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-2"
              data-testid={`rolling-forecast-row-${row.period}`}
            >
              <input
                type="text"
                value={row.period}
                onChange={(e) => updateRow(row.period, { period: e.target.value })}
                className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
              />
              <input
                type="number"
                value={row.plan}
                onChange={(e) => updateRow(row.period, { plan: e.target.value })}
                className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-right font-mono text-sm tabular-nums text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
              />
              <input
                type="number"
                value={row.actual}
                disabled={!row.hasActual}
                onChange={(e) => updateRow(row.period, { actual: e.target.value })}
                className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-right font-mono text-sm tabular-nums text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30 disabled:opacity-40"
              />
              <input
                type="checkbox"
                checked={row.hasActual}
                onChange={(e) => updateRow(row.period, { hasActual: e.target.checked })}
                aria-label={t('finance.m16c.rollingForecast.closed', 'Closed?')}
              />
              <button
                type="button"
                onClick={() => removeRow(row.period)}
                disabled={rows.length <= 1}
                className="rounded-lg px-2 py-1.5 text-xs text-c-text-muted hover:bg-c-surface-raised disabled:opacity-30"
                aria-label={t('finance.m16c.rollingForecast.removePeriod', 'Remove period')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-c-border px-2.5 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised"
          >
            + {t('finance.m16c.rollingForecast.addPeriod', 'Add period')}
          </button>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">
              {t('finance.m16c.rollingForecast.rollBy', 'Roll forward by')}
            </span>
            <input
              type="number"
              min={0}
              value={rollByPeriods}
              onChange={(e) => setRollByPeriods(Math.max(0, Number(e.target.value) || 0))}
              className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="rolling-forecast-error"
        >
          {error}
        </div>
      )}

      {!error && !lines && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="rolling-forecast-empty">
          {t(
            'finance.m16c.rollingForecast.empty',
            'Mark closed periods with actuals, then reforecast.'
          )}
        </p>
      )}

      {!error && lines && (
        <div className="h-[240px] w-full" data-testid="rolling-forecast-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" stroke={colors.axis} tick={{ fontSize: 11 }} />
              <YAxis stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip formatter={(value: number) => fmt(value)} />
              <Line
                type="monotone"
                dataKey="blended"
                stroke={colors.net}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="extension"
                stroke={colors.cumulative}
                strokeDasharray="5 4"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-c-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ backgroundColor: colors.net }} />
              {t('finance.m16c.rollingForecast.legendBlended', 'Blended (actual + plan)')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ backgroundColor: colors.cumulative }} />
              {t('finance.m16c.rollingForecast.legendExtension', 'Roll-forward extension')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RollingForecastPanel;
