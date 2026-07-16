/**
 * M16 wire-b — Variance Narration panel (auto-commentary plan-vs-actual).
 *
 * Consumes POST /api/v8/finance-intelligence/variance/narrate
 * (varianceNarrationService: narrateVariance + topVarianceDrivers +
 * varianceSeverity — pure, rule-based, no LLM). The engine was live with
 * zero UI before this panel.
 *
 * Distinct from VarianceBridgePanel (waterfall chart off
 * /api/v8/finance/value/variance-bridge): this panel renders the CFO-grade
 * *narrative* — one-line headline, ranked drivers, and a severity badge —
 * off the separate finance-intelligence narration endpoint.
 *
 * Fail-soft: a failed call degrades to an explicit error state, never blocks
 * the rest of the tab. Gated by `m16PlanningSuite` (financeFeatureFlags.ts,
 * default OFF).
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  postVarianceNarrate,
  type VarianceNarrateResponse,
  type VarianceSeverity,
} from '@/services/api/v8/financePlanning';

// ─────────────────────────────────────────────────────────────────────────
// Local types + helpers
// ─────────────────────────────────────────────────────────────────────────

interface BridgeRow {
  id: string;
  label: string;
  plan: string;
  actual: string;
  isCost: boolean;
}

let rowSeq = 0;
const nextRowId = (): string => `v${++rowSeq}`;

const DEFAULT_ROWS: BridgeRow[] = [
  { id: nextRowId(), label: 'Revenue', plan: '1000000', actual: '940000', isCost: false },
  { id: nextRowId(), label: 'COGS', plan: '400000', actual: '430000', isCost: true },
  { id: nextRowId(), label: 'Marketing', plan: '120000', actual: '95000', isCost: true },
];

function fmtAmount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${Math.round(abs)}`;
}

function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 10) / 10}%`;
}

const SEVERITY_STYLE: Record<VarianceSeverity, string> = {
  'on-track': 'bg-c-success/10 text-c-success border-c-success/30',
  watch: 'bg-c-warning/10 text-c-warning border-c-warning/30',
  'off-track': 'bg-c-danger/10 text-c-danger border-c-danger/30',
};

// ─────────────────────────────────────────────────────────────────────────
// Bridge rows editor
// ─────────────────────────────────────────────────────────────────────────

interface BridgeEditorProps {
  rows: BridgeRow[];
  onChange: (rows: BridgeRow[]) => void;
  t: (key: string, def: string) => string;
}

const BridgeEditor: React.FC<BridgeEditorProps> = ({ rows, onChange, t }) => {
  const setRow = (id: string, patch: Partial<BridgeRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const addRow = () =>
    onChange([
      ...rows,
      { id: nextRowId(), label: `Line ${rows.length + 1}`, plan: '0', actual: '0', isCost: false },
    ]);

  return (
    <div data-testid="variance-narration-rows">
      <div className="mb-1 grid grid-cols-[1.4fr_1fr_1fr_auto_auto] gap-2 text-[11px] font-medium uppercase tracking-wide text-c-text-muted">
        <span>{t('finance.m16b.varianceNarration.line', 'Line')}</span>
        <span>{t('finance.m16b.varianceNarration.plan', 'Plan')}</span>
        <span>{t('finance.m16b.varianceNarration.actual', 'Actual')}</span>
        <span>{t('finance.m16b.varianceNarration.isCost', 'Cost')}</span>
        <span />
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1.4fr_1fr_1fr_auto_auto] items-center gap-2"
            data-testid={`variance-narration-row-${row.id}`}
          >
            <input
              type="text"
              value={row.label}
              onChange={(e) => setRow(row.id, { label: e.target.value })}
              className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
              aria-label={t('finance.m16b.varianceNarration.line', 'Line')}
            />
            <input
              type="number"
              value={row.plan}
              onChange={(e) => setRow(row.id, { plan: e.target.value })}
              className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-right font-mono text-sm tabular-nums text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
              aria-label={t('finance.m16b.varianceNarration.plan', 'Plan')}
            />
            <input
              type="number"
              value={row.actual}
              onChange={(e) => setRow(row.id, { actual: e.target.value })}
              className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-right font-mono text-sm tabular-nums text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
              aria-label={t('finance.m16b.varianceNarration.actual', 'Actual')}
            />
            <input
              type="checkbox"
              checked={row.isCost}
              onChange={(e) => setRow(row.id, { isCost: e.target.checked })}
              className="h-4 w-4 accent-current text-c-focus"
              aria-label={t('finance.m16b.varianceNarration.isCost', 'Cost')}
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              disabled={rows.length <= 1}
              className="rounded-lg px-2 py-1.5 text-xs text-c-text-muted hover:bg-c-surface-raised disabled:opacity-30"
              aria-label={t('finance.m16b.varianceNarration.removeLine', 'Remove line')}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 rounded-lg border border-c-border px-2.5 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised"
        data-testid="variance-narration-add-line"
      >
        + {t('finance.m16b.varianceNarration.addLine', 'Add line')}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────────────────

export const VarianceNarrationPanel: React.FC = () => {
  const { t } = useTranslation();

  const [rows, setRows] = useState<BridgeRow[]>(DEFAULT_ROWS);
  const [result, setResult] = useState<VarianceNarrateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const bridge = rows.map((r) => ({
        label: r.label.trim() || t('finance.m16b.varianceNarration.unlabeled', 'Unlabeled'),
        plan: Number(r.plan) || 0,
        actual: Number(r.actual) || 0,
        isCost: r.isCost,
      }));
      const res = await postVarianceNarrate({ bridge, topN: 5 });
      setResult(res);
    } catch (err: any) {
      setResult(null);
      setError(
        err?.message
          ? String(err.message)
          : t(
              'finance.m16b.varianceNarration.errorGeneric',
              'Variance narration failed to compute.'
            )
      );
    } finally {
      setLoading(false);
    }
  };

  const severityLabel: Record<VarianceSeverity, string> = {
    'on-track': t('finance.m16b.varianceNarration.severityOnTrack', 'On track'),
    watch: t('finance.m16b.varianceNarration.severityWatch', 'Watch'),
    'off-track': t('finance.m16b.varianceNarration.severityOffTrack', 'Off track'),
  };

  return (
    <div
      data-testid="variance-narration-panel"
      className="rounded-xl border border-c-border bg-c-surface p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('finance.m16b.varianceNarration.title', 'Variance narration')}
          </h3>
          <p className="mt-0.5 text-xs text-c-text-secondary">
            {t(
              'finance.m16b.varianceNarration.subtitle',
              'Auto-generated CFO commentary on plan-vs-actual variance — headline, drivers, severity.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          data-testid="variance-narration-run"
          className="shrink-0 rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-sm font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {loading
            ? t('finance.m16b.varianceNarration.running', 'Analyzing…')
            : t('finance.m16b.varianceNarration.run', 'Narrate variance')}
        </button>
      </div>

      <div className="mb-4">
        <BridgeEditor rows={rows} onChange={setRows} t={t} />
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="variance-narration-error"
        >
          {error}
        </div>
      )}

      {!result && !error && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="variance-narration-empty">
          {t(
            'finance.m16b.varianceNarration.empty',
            'Add plan/actual lines, then run the narration.'
          )}
        </p>
      )}

      {result && (
        <div className="space-y-4" data-testid="variance-narration-result">
          {/* Headline + severity */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p
              className="max-w-xl text-sm font-medium text-c-text"
              data-testid="variance-narration-headline"
            >
              {result.narration.headline}
            </p>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${SEVERITY_STYLE[result.severity]}`}
              data-testid="variance-narration-severity"
            >
              {severityLabel[result.severity]}
            </span>
          </div>

          {/* Commentary */}
          <p className="text-sm text-c-text-secondary" data-testid="variance-narration-commentary">
            {result.narration.commentary}
          </p>

          {/* Drivers */}
          {result.drivers.length > 0 && (
            <div className="space-y-1.5" data-testid="variance-narration-drivers">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                {t('finance.m16b.varianceNarration.driversTitle', 'Top drivers')}
              </h4>
              {result.drivers.map((driver) => {
                const favorable = driver.variance > 0;
                return (
                  <div
                    key={driver.line}
                    className="flex items-center gap-3 rounded-lg border border-c-border-subtle px-2.5 py-1.5"
                    data-testid={`variance-narration-driver-${driver.line}`}
                  >
                    <span className="w-32 shrink-0 truncate text-xs font-medium text-c-text">
                      {driver.line}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-c-surface-raised">
                      <div
                        className={`h-full rounded-full ${favorable ? 'bg-c-success' : 'bg-c-danger'}`}
                        style={{ width: `${Math.min(Math.max(driver.sharePct, 2), 100)}%` }}
                      />
                    </div>
                    <span
                      className={`w-20 shrink-0 text-right font-mono text-xs font-semibold tabular-nums ${
                        favorable ? 'text-c-success' : 'text-c-danger'
                      }`}
                    >
                      {favorable ? '+' : ''}
                      {fmtAmount(driver.variance)}
                    </span>
                    <span className="w-12 shrink-0 text-right text-[11px] text-c-text-muted">
                      {fmtPct(driver.sharePct)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VarianceNarrationPanel;
