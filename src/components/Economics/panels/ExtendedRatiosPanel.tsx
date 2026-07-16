/**
 * M16 value suite (wire-d) — Extended Ratios panel.
 *
 * Consumes POST /api/v8/finance/value-tracking/ratios/{extended,dupont,
 * benchmark} (server: extendedRatiosService — see finance-value.routes.ts
 * §7). Adds the return / capital-structure / coverage / efficiency ratios
 * the base analysis tabs are missing — ROE, ROA, ROIC, ROCE, D/E, equity
 * ratio, net debt / EBITDA, DSCR, asset turnover, fixed-asset turnover —
 * plus a DuPont decomposition of ROE and an industry-benchmark comparator.
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16ValueSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useFinanceChartColors } from '@/components/Economics/financeChartTokens';
import {
  type BenchmarkComparison,
  type DupontDecomposition,
  type ExtendedFinancials,
  type ExtendedRatio,
  type ExtendedRatioStatus,
  postBenchmarkStatus,
  postDupontDecomposition,
  postExtendedRatios,
} from '@/services/api/v8/financeValue';

const DEFAULT_FIN: ExtendedFinancials = {
  netIncome: 1_200_000,
  equity: 8_000_000,
  totalAssets: 20_000_000,
  ebit: 1_800_000,
  ebitda: 2_600_000,
  debt: 6_000_000,
  cash: 1_500_000,
  revenue: 15_000_000,
  fixedAssets: 9_000_000,
  taxRatePct: 19,
};

const FIELDS: Array<{ key: keyof ExtendedFinancials; labelKey: string; fallback: string }> = [
  { key: 'netIncome', labelKey: 'finance.m16d.ratios.netIncome', fallback: 'Net income' },
  { key: 'equity', labelKey: 'finance.m16d.ratios.equity', fallback: 'Equity' },
  { key: 'totalAssets', labelKey: 'finance.m16d.ratios.totalAssets', fallback: 'Total assets' },
  { key: 'ebit', labelKey: 'finance.m16d.ratios.ebit', fallback: 'EBIT' },
  { key: 'ebitda', labelKey: 'finance.m16d.ratios.ebitda', fallback: 'EBITDA' },
  { key: 'debt', labelKey: 'finance.m16d.ratios.debt', fallback: 'Debt' },
  { key: 'cash', labelKey: 'finance.m16d.ratios.cash', fallback: 'Cash' },
  { key: 'revenue', labelKey: 'finance.m16d.ratios.revenue', fallback: 'Revenue' },
  { key: 'fixedAssets', labelKey: 'finance.m16d.ratios.fixedAssets', fallback: 'Fixed assets' },
  { key: 'taxRatePct', labelKey: 'finance.m16d.ratios.taxRatePct', fallback: 'Tax rate (%)' },
];

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
};

const fmtRatio = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(2);
};

const fmtPct1 = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(1)}%`;
};

const STATUS_TONE: Record<ExtendedRatioStatus, string> = {
  ok: 'border-c-success/30 bg-c-success/10 text-c-success',
  warn: 'border-c-warning/30 bg-c-warning/10 text-c-warning',
  critical: 'border-c-danger/30 bg-c-danger/10 text-c-danger',
};

export interface ExtendedRatiosPanelProps {
  fetcher?: {
    extended?: typeof postExtendedRatios;
    dupont?: typeof postDupontDecomposition;
    benchmark?: typeof postBenchmarkStatus;
  };
}

export const ExtendedRatiosPanel: React.FC<ExtendedRatiosPanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();
  const colors = useFinanceChartColors();

  const [fin, setFin] = useState<Record<keyof ExtendedFinancials, string>>(() => {
    const out = {} as Record<keyof ExtendedFinancials, string>;
    (Object.keys(DEFAULT_FIN) as Array<keyof ExtendedFinancials>).forEach((k) => {
      out[k] = String(DEFAULT_FIN[k]);
    });
    return out;
  });

  const [ratios, setRatios] = useState<ExtendedRatio[] | null>(null);
  const [dupont, setDupont] = useState<DupontDecomposition | null>(null);

  const [benchmarkValue, setBenchmarkValue] = useState('0.12');
  const [p25, setP25] = useState('0.06');
  const [median, setMedian] = useState('0.1');
  const [p75, setP75] = useState('0.15');
  const [benchmark, setBenchmark] = useState<BenchmarkComparison | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFin = useCallback(
    (): ExtendedFinancials => ({
      netIncome: Number(fin.netIncome) || 0,
      equity: Number(fin.equity) || 0,
      totalAssets: Number(fin.totalAssets) || 0,
      ebit: Number(fin.ebit) || 0,
      ebitda: Number(fin.ebitda) || 0,
      debt: Number(fin.debt) || 0,
      cash: Number(fin.cash) || 0,
      revenue: Number(fin.revenue) || 0,
      fixedAssets: Number(fin.fixedAssets) || 0,
      taxRatePct: Number(fin.taxRatePct) || 0,
    }),
    [fin]
  );

  const computeRatios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = fetcher?.extended ?? postExtendedRatios;
      const res = await fn(currentFin());
      setRatios(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setRatios(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.ratios.errorGeneric', 'Ratio computation failed.')
      );
    } finally {
      setLoading(false);
    }
  }, [currentFin, fetcher, t]);

  const computeDupont = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = fetcher?.dupont ?? postDupontDecomposition;
      const res = await fn(currentFin());
      setDupont(res ?? null);
    } catch (err: any) {
      setDupont(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.ratios.errorGeneric', 'Ratio computation failed.')
      );
    } finally {
      setLoading(false);
    }
  }, [currentFin, fetcher, t]);

  const computeBenchmark = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = fetcher?.benchmark ?? postBenchmarkStatus;
      const res = await fn(Number(benchmarkValue) || 0, {
        p25: Number(p25) || 0,
        median: Number(median) || 0,
        p75: Number(p75) || 0,
      });
      setBenchmark(res ?? null);
    } catch (err: any) {
      setBenchmark(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16d.ratios.errorGeneric', 'Ratio computation failed.')
      );
    } finally {
      setLoading(false);
    }
  }, [benchmarkValue, p25, median, p75, fetcher, t]);

  const benchmarkChartData = useMemo(
    () => [
      { label: 'p25', v: Number(p25) || 0 },
      { label: 'median', v: Number(median) || 0 },
      { label: 'p75', v: Number(p75) || 0 },
      { label: t('finance.m16d.ratios.benchmarkYours', 'Yours'), v: Number(benchmarkValue) || 0 },
    ],
    [p25, median, p75, benchmarkValue, t]
  );

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="extended-ratios-panel"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          {t(
            'finance.m16d.ratios.title',
            'Extended ratios — return, leverage, coverage, efficiency'
          )}
        </h3>
        <p className="mt-0.5 text-xs text-c-text-secondary">
          {t(
            'finance.m16d.ratios.subtitle',
            'ROE/ROA/ROIC/ROCE, D/E, DSCR, turnover — plus DuPont and benchmark.'
          )}
        </p>
      </div>

      {/* Financial inputs */}
      <div className="mb-3 flex flex-wrap gap-2" data-testid="ratios-inputs">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t(f.labelKey, f.fallback)}</span>
            <input
              type="number"
              value={fin[f.key]}
              onChange={(e) => setFin((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void computeRatios()}
          disabled={loading}
          data-testid="ratios-compute"
          className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {t('finance.m16d.ratios.compute', 'Compute ratios')}
        </button>
        <button
          type="button"
          onClick={() => void computeDupont()}
          disabled={loading}
          data-testid="ratios-dupont-compute"
          className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {t('finance.m16d.ratios.dupontCompute', 'DuPont decomposition')}
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="ratios-error"
        >
          {error}
        </div>
      )}

      {ratios && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="ratios-grid">
          {ratios.map((r) => (
            <div
              key={r.code}
              className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2"
              data-testid={`ratio-${r.code}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {r.label}
              </p>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <span className="text-sm font-semibold text-c-text">{fmtRatio(r.value)}</span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONE[r.status]}`}
                >
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {dupont && (
        <div
          className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised p-3"
          data-testid="ratios-dupont-tree"
        >
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16d.ratios.dupontNetMargin', 'Net margin')}
            </p>
            <p className="text-sm font-semibold text-c-text">{fmtPct1(dupont.netMargin)}</p>
          </div>
          <span className="text-c-text-muted">×</span>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16d.ratios.dupontAssetTurnover', 'Asset turnover')}
            </p>
            <p className="text-sm font-semibold text-c-text">{fmtRatio(dupont.assetTurnover)}</p>
          </div>
          <span className="text-c-text-muted">×</span>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16d.ratios.dupontEquityMultiplier', 'Equity multiplier')}
            </p>
            <p className="text-sm font-semibold text-c-text">{fmtRatio(dupont.equityMultiplier)}</p>
          </div>
          <span className="text-c-text-muted">=</span>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
              {t('finance.m16d.ratios.dupontRoe', 'ROE')}
            </p>
            <p className="text-sm font-semibold text-c-text">{fmtPct1(dupont.roe)}</p>
          </div>
        </div>
      )}

      {!ratios && !dupont && !error && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="ratios-empty">
          {t('finance.m16d.ratios.empty', 'Enter financials, then compute ratios or DuPont.')}
        </p>
      )}

      {/* Benchmark */}
      <div className="mt-4 border-t border-c-border-subtle pt-4">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('finance.m16d.ratios.benchmarkTitle', 'Industry benchmark')}
        </h4>
        <div className="mb-3 flex flex-wrap items-end gap-2" data-testid="ratios-benchmark-form">
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16d.ratios.benchmarkYours', 'Yours')}</span>
            <input
              type="number"
              step={0.01}
              value={benchmarkValue}
              onChange={(e) => setBenchmarkValue(e.target.value)}
              className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">P25</span>
            <input
              type="number"
              step={0.01}
              value={p25}
              onChange={(e) => setP25(e.target.value)}
              className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16d.ratios.benchmarkMedian', 'Median')}</span>
            <input
              type="number"
              step={0.01}
              value={median}
              onChange={(e) => setMedian(e.target.value)}
              className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">P75</span>
            <input
              type="number"
              step={0.01}
              value={p75}
              onChange={(e) => setP75(e.target.value)}
              className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <button
            type="button"
            onClick={() => void computeBenchmark()}
            disabled={loading}
            data-testid="ratios-benchmark-run"
            className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
          >
            {t('finance.m16d.ratios.benchmarkRun', 'Compare to benchmark')}
          </button>
          {benchmark && (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[benchmark.status]}`}
              data-testid="ratios-benchmark-badge"
            >
              {benchmark.percentile} — {benchmark.status}
            </span>
          )}
        </div>

        <div className="h-[180px] w-full" data-testid="ratios-benchmark-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={benchmarkChartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke={colors.axis} tick={{ fontSize: 11 }} />
              <YAxis stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={fmtRatio} />
              <Tooltip formatter={(v: number) => fmtRatio(v)} />
              <Bar dataKey="v" fill={colors.net} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ExtendedRatiosPanel;
