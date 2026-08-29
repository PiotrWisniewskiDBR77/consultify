/**
 * M16 advanced suite (wire-c) — Efficient Frontier panel.
 *
 * Consumes POST /api/v8/finance-valuation/efficient-frontier (server:
 * efficientFrontierService.frontier — see finance-valuation.routes.ts §4).
 * Pure greedy knapsack per risk ceiling; no correlation matrix input in this
 * panel (server defaults it to independent risk — a richer correlation
 * editor is a follow-up, not required to show the value-vs-risk trade-off).
 *
 * The user edits a small pool of candidate initiatives (id/value/risk/cost),
 * sets a budget, hits "Build frontier", and sees the value-vs-risk curve
 * (scatter + connecting line) with the server-computed optimal point
 * highlighted.
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16AdvancedSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useFinanceChartColors } from '@/components/Economics/financeChartTokens';
import {
  type EfficientFrontierResponse,
  type FrontierInitiativeInput,
  runEfficientFrontier,
} from '@/services/financeValuationApi';

interface InitiativeRow {
  id: string;
  value: string;
  risk: string;
  cost: string;
}

let rowSeq = 0;
const nextRowId = (): string => `frontier-init-${Date.now().toString(36)}-${rowSeq++}`;

const DEFAULT_ROWS: InitiativeRow[] = [
  { id: 'alpha', value: '500000', risk: '0.15', cost: '200000' },
  { id: 'beta', value: '900000', risk: '0.35', cost: '450000' },
  { id: 'gamma', value: '1400000', risk: '0.55', cost: '700000' },
  { id: 'delta', value: '300000', risk: '0.2', cost: '150000' },
];

const fmt = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(v);
};

const fmtRisk = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(0)}%`;
};

export interface EfficientFrontierPanelProps {
  /** Allow tests / callers to inject a fetcher instead of hitting the API. */
  fetcher?: typeof runEfficientFrontier;
}

export const EfficientFrontierPanel: React.FC<EfficientFrontierPanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();
  const colors = useFinanceChartColors();
  const [rows, setRows] = useState<InitiativeRow[]>(DEFAULT_ROWS);
  const [budget, setBudget] = useState('1000000');
  const [points, setPoints] = useState(12);

  const [result, setResult] = useState<EfficientFrontierResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = useCallback((id: string, patch: Partial<InitiativeRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { id: nextRowId(), value: '100000', risk: '0.3', cost: '50000' }]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }, []);

  const run = useCallback(async () => {
    if (rows.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const initiatives: FrontierInitiativeInput[] = rows.map((r) => ({
        id: r.id,
        value: Number(r.value) || 0,
        risk: Math.min(Math.max(Number(r.risk) || 0, 0), 1),
        cost: Number(r.cost) || 0,
      }));
      const res = await (fetcher ?? runEfficientFrontier)({
        initiatives,
        budget: Number(budget) || 0,
        points,
      });
      setResult(res ?? null);
      if (!res) {
        setError(t('finance.m16c.frontier.errorGeneric', 'Efficient frontier failed to compute.'));
      }
    } catch (err: any) {
      setResult(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16c.frontier.errorGeneric', 'Efficient frontier failed to compute.')
      );
    } finally {
      setLoading(false);
    }
  }, [rows, budget, points, fetcher, t]);

  const curveData = useMemo(
    () => (result?.curve ?? []).map((p) => ({ risk: p.risk, value: p.value, mix: p.mix })),
    [result]
  );

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="efficient-frontier-panel"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('finance.m16c.frontier.title', 'Efficient frontier — value vs. risk')}
          </h3>
          <p className="mt-0.5 text-xs text-c-text-secondary">
            {t(
              'finance.m16c.frontier.subtitle',
              'Greedy portfolio selection across risk ceilings under a fixed budget.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || rows.length === 0}
          data-testid="frontier-run"
          className="shrink-0 rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-sm font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {loading
            ? t('finance.m16c.frontier.running', 'Building…')
            : t('finance.m16c.frontier.run', 'Build frontier')}
        </button>
      </div>

      {/* Initiative rows */}
      <div className="mb-3 space-y-2" data-testid="frontier-initiatives">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
            data-testid={`frontier-row-${row.id}`}
          >
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16c.frontier.id', 'Initiative')}</span>
              <input
                type="text"
                value={row.id}
                onChange={(e) => updateRow(row.id, { id: e.target.value })}
                className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16c.frontier.value', 'Value (NPV)')}</span>
              <input
                type="number"
                value={row.value}
                onChange={(e) => updateRow(row.id, { value: e.target.value })}
                className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16c.frontier.risk', 'Risk (0–1)')}</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={row.risk}
                onChange={(e) => updateRow(row.id, { risk: e.target.value })}
                className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16c.frontier.cost', 'Cost')}</span>
              <input
                type="number"
                value={row.cost}
                onChange={(e) => updateRow(row.id, { cost: e.target.value })}
                className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-c-text-muted hover:text-c-danger"
                aria-label={`Remove ${row.id}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={addRow}
            className="rounded border border-dashed border-c-border px-2 py-1 text-xs text-c-text-secondary hover:border-c-focus hover:text-c-text"
          >
            {t('finance.m16c.frontier.addInitiative', '+ initiative')}
          </button>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16c.frontier.budget', 'Budget')}</span>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-32 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16c.frontier.points', 'Frontier points')}</span>
            <input
              type="number"
              min={2}
              value={points}
              onChange={(e) => setPoints(Math.max(2, Number(e.target.value) || 2))}
              className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-right font-mono text-xs tabular-nums text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="frontier-error"
        >
          {error}
        </div>
      )}

      {!error && !result && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="frontier-empty">
          {t(
            'finance.m16c.frontier.empty',
            'Set initiatives and a budget, then build the frontier.'
          )}
        </p>
      )}

      {!error && result && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="frontier-stats">
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16c.frontier.optimalValue', 'Optimal — value')}
              </p>
              <p className="text-sm font-semibold text-c-text">{fmt(result.optimal.value)}</p>
            </div>
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16c.frontier.optimalRisk', 'Optimal — risk')}
              </p>
              <p className="text-sm font-semibold text-c-text">{fmtRisk(result.optimal.risk)}</p>
            </div>
            <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16c.frontier.optimalMix', 'Optimal mix')}
              </p>
              <p
                className="truncate text-sm font-semibold text-c-text"
                title={result.optimal.mix.join(', ')}
              >
                {result.optimal.mix.length > 0
                  ? result.optimal.mix.join(', ')
                  : t('finance.m16c.frontier.noneSelected', '—')}
              </p>
            </div>
          </div>

          <div className="h-[260px] w-full" data-testid="frontier-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curveData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="risk"
                  type="number"
                  domain={[0, 1]}
                  tickFormatter={(v: number) => fmtRisk(v)}
                  stroke={colors.axis}
                  tick={{ fontSize: 11 }}
                  label={{
                    value: String(t('finance.m16c.frontier.axisRisk', 'Risk')),
                    position: 'insideBottom',
                    offset: -4,
                    fill: colors.axis,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  dataKey="value"
                  stroke={colors.axis}
                  tick={{ fontSize: 11 }}
                  tickFormatter={fmt}
                  label={{
                    value: String(t('finance.m16c.frontier.axisValue', 'Value')),
                    angle: -90,
                    position: 'insideLeft',
                    fill: colors.axis,
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'value' ? fmt(value) : fmtRisk(value)
                  }
                  labelFormatter={(label: number) => fmtRisk(label)}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={colors.net}
                  strokeWidth={2}
                  dot={false}
                />
                <Scatter dataKey="value" fill={colors.net} />
                <ReferenceDot
                  x={result.optimal.risk}
                  y={result.optimal.value}
                  r={6}
                  fill={colors.benefit}
                  stroke={colors.benefit}
                  data-testid="frontier-optimal-dot"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};

export default EfficientFrontierPanel;
