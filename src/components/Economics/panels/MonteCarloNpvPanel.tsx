/**
 * M16 valuation suite — Monte Carlo NPV panel.
 *
 * Consumes POST /api/v8/finance-valuation/monte-carlo-npv (server:
 * monteCarloNpvService.simulateNpv + histogram). The route exposes a generic
 * LINEAR model (value = intercept + Σ driver_i * weight_i) since the pure
 * npvFn callback cannot cross JSON — see finance-valuation.routes.ts header.
 *
 * The user edits a small set of triangular-distribution drivers (min/mode/max)
 * plus each driver's linear weight, hits "Run simulation", and the server
 * runs a seeded Monte Carlo sim and returns summary stats + a histogram.
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16ValuationSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DistributionHistogram } from '@/components/Economics/charts';
import {
  type MonteCarloNpvResponse,
  runMonteCarloNpv,
  type TriangularDriver,
} from '@/services/financeValuationApi';

interface DriverRow {
  id: string;
  label: string;
  min: number;
  mode: number;
  max: number;
  weight: number;
}

const DEFAULT_DRIVERS: DriverRow[] = [
  { id: 'revenue', label: 'Revenue', min: 800_000, mode: 1_000_000, max: 1_300_000, weight: 1 },
  { id: 'cost', label: 'Cost', min: 600_000, mode: 700_000, max: 850_000, weight: -1 },
];

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
};

const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(0)}%`;
};

let rowSeq = 0;
const nextRowId = (): string => `driver-${Date.now().toString(36)}-${rowSeq++}`;

export interface MonteCarloNpvPanelProps {
  /** Allow tests / callers to inject a fetcher instead of hitting the API. */
  fetcher?: (req: {
    drivers: Record<string, TriangularDriver>;
    weights: Record<string, number>;
    iterations: number;
    seed: number;
    bins: number;
  }) => Promise<MonteCarloNpvResponse>;
}

export const MonteCarloNpvPanel: React.FC<MonteCarloNpvPanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<DriverRow[]>(DEFAULT_DRIVERS);
  const [iterations, setIterations] = useState(2000);
  const [seed, setSeed] = useState(42);
  const [bins, setBins] = useState(20);
  const [result, setResult] = useState<MonteCarloNpvResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const updateRow = useCallback((id: string, patch: Partial<DriverRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      {
        id: nextRowId(),
        label: `Driver ${prev.length + 1}`,
        min: 0,
        mode: 100,
        max: 200,
        weight: 1,
      },
    ]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }, []);

  const run = useCallback(async () => {
    if (rows.length === 0) return;
    setLoading(true);
    setFailed(false);
    try {
      const drivers: Record<string, TriangularDriver> = {};
      const weights: Record<string, number> = {};
      for (const row of rows) {
        drivers[row.id] = {
          kind: 'triangular',
          min: Math.min(row.min, row.max),
          mode: row.mode,
          max: Math.max(row.min, row.max),
        };
        weights[row.id] = row.weight;
      }
      const req = { drivers, weights, iterations, seed, bins };
      const res = await (fetcher ?? runMonteCarloNpv)(req);
      setResult(res ?? null);
      setFailed(!res);
    } catch {
      setResult(null);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [rows, iterations, seed, bins, fetcher]);

  const markers = result
    ? [
        { label: 'P10', value: result.simulation.p10 },
        { label: 'P50', value: result.simulation.p50 },
        { label: 'P90', value: result.simulation.p90 },
      ]
    : [];

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="monte-carlo-npv-panel"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          {t('finance.m16.monteCarlo.title', 'Monte Carlo NPV simulation')}
        </h3>
        <p className="mt-0.5 text-xs text-c-text-secondary">
          {t(
            'finance.m16.monteCarlo.subtitle',
            'Simulate NPV outcomes across driver uncertainty ranges.'
          )}
        </p>
      </div>

      {/* Driver rows */}
      <div className="mb-3 space-y-2" data-testid="mc-drivers">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
            data-testid={`mc-driver-${row.id}`}
          >
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16.monteCarlo.driverLabel', 'Driver')}</span>
              <input
                type="text"
                value={row.label}
                onChange={(e) => updateRow(row.id, { label: e.target.value })}
                className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16.monteCarlo.min', 'Min')}</span>
              <input
                type="number"
                value={row.min}
                onChange={(e) => updateRow(row.id, { min: Number(e.target.value) || 0 })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16.monteCarlo.mode', 'Mode')}</span>
              <input
                type="number"
                value={row.mode}
                onChange={(e) => updateRow(row.id, { mode: Number(e.target.value) || 0 })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16.monteCarlo.max', 'Max')}</span>
              <input
                type="number"
                value={row.max}
                onChange={(e) => updateRow(row.id, { max: Number(e.target.value) || 0 })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16.monteCarlo.weight', 'Weight')}</span>
              <input
                type="number"
                value={row.weight}
                onChange={(e) => updateRow(row.id, { weight: Number(e.target.value) || 0 })}
                className="w-16 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-c-text-muted hover:text-c-danger"
                aria-label={`Remove ${row.label}`}
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
          {t('finance.m16.monteCarlo.addDriver', '+ driver')}
        </button>
      </div>

      {/* Simulation params + run */}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16.monteCarlo.iterations', 'Iterations')}</span>
          <input
            type="number"
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value) || 0)}
            className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16.monteCarlo.seed', 'Seed')}</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <label className="flex flex-col text-[11px] text-c-text-muted">
          <span className="mb-0.5">{t('finance.m16.monteCarlo.bins', 'Histogram bins')}</span>
          <input
            type="number"
            value={bins}
            onChange={(e) => setBins(Number(e.target.value) || 0)}
            className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          />
        </label>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || rows.length === 0}
          className="rounded-lg bg-c-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          data-testid="mc-run"
        >
          {loading
            ? t('finance.m16.monteCarlo.running', 'Simulating…')
            : t('finance.m16.monteCarlo.run', 'Run simulation')}
        </button>
      </div>

      {failed && (
        <p className="text-sm text-c-text-muted" data-testid="mc-failed">
          {t('finance.m16.monteCarlo.error', 'Simulation unavailable right now — try again.')}
        </p>
      )}

      {!failed && !result && !loading && (
        <p className="text-sm text-c-text-muted" data-testid="mc-empty">
          {t(
            'finance.m16.monteCarlo.empty',
            'Set drivers and run the simulation to see the NPV distribution.'
          )}
        </p>
      )}

      {!failed && result && (
        <>
          <div
            className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
            data-testid="mc-stats"
          >
            {[
              {
                key: 'mean',
                label: t('finance.m16.monteCarlo.mean', 'Mean NPV'),
                value: fmt(result.simulation.mean),
              },
              {
                key: 'p10',
                label: t('finance.m16.monteCarlo.p10', 'P10'),
                value: fmt(result.simulation.p10),
              },
              {
                key: 'p50',
                label: t('finance.m16.monteCarlo.p50', 'P50 (median)'),
                value: fmt(result.simulation.p50),
              },
              {
                key: 'p90',
                label: t('finance.m16.monteCarlo.p90', 'P90'),
                value: fmt(result.simulation.p90),
              },
              {
                key: 'probPositive',
                label: t('finance.m16.monteCarlo.probPositive', 'P(NPV > 0)'),
                value: fmtPct(result.simulation.probPositive),
              },
              {
                key: 'var5',
                label: t('finance.m16.monteCarlo.var5', 'VaR (5%)'),
                value: fmt(result.simulation.valueAtRisk5),
              },
            ].map((tile) => (
              <div
                key={tile.key}
                className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2"
                data-testid={`mc-stat-${tile.key}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {tile.label}
                </p>
                <p className="text-sm font-semibold text-c-text">{tile.value}</p>
              </div>
            ))}
          </div>

          <div data-testid="mc-histogram">
            <DistributionHistogram
              bins={result.histogram}
              markers={markers}
              formatValue={fmt}
              emptyLabel={t(
                'finance.m16.monteCarlo.empty',
                'Set drivers and run the simulation to see the NPV distribution.'
              )}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default MonteCarloNpvPanel;
