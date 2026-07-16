/**
 * M16 value suite (wire-d) — Value Attribution Rollup panel.
 *
 * Consumes POST /api/v8/finance/value-tracking/attribution/rollup (server:
 * valueAttributionRollupService — see finance-value.routes.ts §2). When
 * several initiatives claim a share of the SAME KPI's movement, a naive sum
 * of their claims can exceed what the KPI actually moved. This panel caps
 * the sum of attributed KPI units per KPI at the observed delta
 * (anti-double-count), and shows both the capped attributed value AND the
 * double-count avoided — so "how much did we really deliver" is never
 * inflated by overlapping claims.
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16ValueSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useFinanceChartColors } from '@/components/Economics/financeChartTokens';
import {
  type PortfolioRollup,
  postAttributionRollup,
  type ValueContribution,
} from '@/services/api/v8/financeValue';

interface ContributionRow {
  id: string;
  initiativeId: string;
  kpiId: string;
  kpiDelta: string;
  contributionShare: string;
  valuePerKpiUnit: string;
}

let rowSeq = 0;
const nextRowId = (): string => `contrib-${Date.now().toString(36)}-${rowSeq++}`;

const DEFAULT_ROWS: ContributionRow[] = [
  {
    id: nextRowId(),
    initiativeId: 'init-001',
    kpiId: 'kpi-margin',
    kpiDelta: '10',
    contributionShare: '0.6',
    valuePerKpiUnit: '50000',
  },
  {
    id: nextRowId(),
    initiativeId: 'init-002',
    kpiId: 'kpi-margin',
    kpiDelta: '10',
    contributionShare: '0.6',
    valuePerKpiUnit: '50000',
  },
  {
    id: nextRowId(),
    initiativeId: 'init-003',
    kpiId: 'kpi-churn',
    kpiDelta: '5',
    contributionShare: '0.8',
    valuePerKpiUnit: '30000',
  },
];

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
};

export interface ValueAttributionPanelProps {
  fetcher?: typeof postAttributionRollup;
}

export const ValueAttributionPanel: React.FC<ValueAttributionPanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();
  const colors = useFinanceChartColors();
  const [rows, setRows] = useState<ContributionRow[]>(DEFAULT_ROWS);

  const [result, setResult] = useState<PortfolioRollup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = useCallback((id: string, patch: Partial<ContributionRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: nextRowId(),
        initiativeId: `init-${prev.length + 1}`,
        kpiId: 'kpi-margin',
        kpiDelta: '10',
        contributionShare: '0.3',
        valuePerKpiUnit: '10000',
      },
    ]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }, []);

  const run = useCallback(async () => {
    if (rows.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const contributions: ValueContribution[] = rows.map((r) => ({
        initiativeId: r.initiativeId,
        kpiId: r.kpiId,
        kpiDelta: Number(r.kpiDelta) || 0,
        contributionShare: Number(r.contributionShare) || 0,
        valuePerKpiUnit: Number(r.valuePerKpiUnit) || 0,
      }));
      const res = await (fetcher ?? postAttributionRollup)(contributions);
      setResult(res ?? null);
      if (!res) {
        setError(t('finance.m16d.attribution.errorGeneric', 'Rollup failed to compute.'));
      }
    } catch (err: any) {
      setResult(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.attribution.errorGeneric', 'Rollup failed to compute.')
      );
    } finally {
      setLoading(false);
    }
  }, [rows, fetcher, t]);

  const chartData = useMemo(
    () =>
      (result?.byKpi ?? []).map((k) => ({
        kpi: k.kpiId,
        attributed: k.attributed,
        unexplained: k.unexplainedRemainder,
      })),
    [result]
  );

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="value-attribution-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('finance.m16d.attribution.title', 'Value attribution rollup — anti-double-count')}
          </h3>
          <p className="mt-0.5 text-xs text-c-text-secondary">
            {t(
              'finance.m16d.attribution.subtitle',
              'Caps overlapping initiative claims on the same KPI at its observed delta.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || rows.length === 0}
          data-testid="attribution-run"
          className="shrink-0 rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-sm font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {loading
            ? t('finance.m16d.attribution.running', 'Rolling up…')
            : t('finance.m16d.attribution.run', 'Compute rollup')}
        </button>
      </div>

      {/* Contribution rows */}
      <div className="mb-3 space-y-2" data-testid="attribution-contributions">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
            data-testid={`attribution-row-${row.id}`}
          >
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">
                {t('finance.m16d.attribution.initiativeId', 'Initiative')}
              </span>
              <input
                type="text"
                value={row.initiativeId}
                onChange={(e) => updateRow(row.id, { initiativeId: e.target.value })}
                className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16d.attribution.kpiId', 'KPI')}</span>
              <input
                type="text"
                value={row.kpiId}
                onChange={(e) => updateRow(row.id, { kpiId: e.target.value })}
                className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16d.attribution.kpiDelta', 'KPI delta')}</span>
              <input
                type="number"
                value={row.kpiDelta}
                onChange={(e) => updateRow(row.id, { kpiDelta: e.target.value })}
                className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">
                {t('finance.m16d.attribution.share', 'Share (0–1)')}
              </span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={row.contributionShare}
                onChange={(e) => updateRow(row.id, { contributionShare: e.target.value })}
                className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">
                {t('finance.m16d.attribution.valuePerUnit', 'Value / unit')}
              </span>
              <input
                type="number"
                value={row.valuePerKpiUnit}
                onChange={(e) => updateRow(row.id, { valuePerKpiUnit: e.target.value })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-c-text-muted hover:text-c-danger"
                aria-label={`Remove ${row.initiativeId}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="rounded border border-dashed border-c-border px-2 py-1 text-xs text-c-text-secondary hover:border-c-focus hover:text-c-text"
        >
          {t('finance.m16d.attribution.addContribution', '+ contribution')}
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="attribution-error"
        >
          {error}
        </div>
      )}

      {!error && !result && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="attribution-empty">
          {t('finance.m16d.attribution.empty', 'Set contributions, then compute the rollup.')}
        </p>
      )}

      {!error && result && (
        <>
          <div
            className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
            data-testid="attribution-stats"
          >
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16d.attribution.totalAttributed', 'Total attributed')}
              </p>
              <p className="text-sm font-semibold text-c-text">{fmt(result.totalAttributed)}</p>
            </div>
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16d.attribution.doubleCountAvoided', 'Double-count avoided')}
              </p>
              <p className="text-sm font-semibold text-c-warning">
                {fmt(result.doubleCountAvoided)}
              </p>
            </div>
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16d.attribution.kpisCount', 'KPIs touched')}
              </p>
              <p className="text-sm font-semibold text-c-text">{result.byKpi.length}</p>
            </div>
          </div>

          <div className="h-[240px] w-full" data-testid="attribution-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="kpi" stroke={colors.axis} tick={{ fontSize: 11 }} />
                <YAxis stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={fmt} />
                <Tooltip formatter={(value: number) => fmt(value)} />
                <Bar
                  dataKey="attributed"
                  name={String(
                    t('finance.m16d.attribution.legendAttributed', 'Attributed (capped)')
                  )}
                  fill={colors.benefit}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="unexplained"
                  name={String(
                    t('finance.m16d.attribution.legendUnexplained', 'Unexplained remainder')
                  )}
                  fill={colors.warning}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default ValueAttributionPanel;
