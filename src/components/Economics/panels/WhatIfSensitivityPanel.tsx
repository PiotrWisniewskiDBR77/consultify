/**
 * M16 valuation suite — What-if Sensitivity panel.
 *
 * Consumes POST /api/v8/finance-valuation/sensitivity/{tornado,data-table}
 * (server: whatIfSensitivityService — same generic LINEAR model convention as
 * finance-valuation.routes.ts §"Monte Carlo NPV": value = intercept +
 * Σ driver_i * weight_i).
 *
 * Two independent tools sharing one base-driver set:
 *   - Tornado: swing every driver ±swingPct one at a time -> <TornadoChart/>.
 *   - 2D data table: sweep two chosen drivers across explicit ranges ->
 *     <SensitivityHeatmap/> (DataTableCell{x,y,value} matches SensitivityCell
 *     1:1 — no transform needed).
 *
 * Fail-soft: a request error degrades to a quiet inline notice, never throws.
 * Behind flag `m16ValuationSuite` (default OFF) — see financeFeatureFlags.ts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SensitivityHeatmap, TornadoChart } from '@/components/Economics/charts';
import {
  type DataTable2DResult,
  runDataTable2D,
  runTornado,
  type SensitivityDrivers,
  type TornadoResult,
} from '@/services/financeValuationApi';

interface DriverRow {
  id: string;
  name: string;
  value: number;
  weight: number;
}

let rowSeq = 0;
const nextRowId = (): string => `sens-driver-${Date.now().toString(36)}-${rowSeq++}`;

const DEFAULT_ROWS: DriverRow[] = [
  { id: 'price', name: 'price', value: 100, weight: 8 },
  { id: 'volume', name: 'volume', value: 1000, weight: 1 },
  { id: 'wacc', name: 'wacc', value: 10, weight: -20 },
];

const fmt = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
};

const parseRange = (raw: string): number[] =>
  raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));

export interface WhatIfSensitivityPanelProps {
  fetcher?: {
    tornado?: typeof runTornado;
    dataTable?: typeof runDataTable2D;
  };
}

export const WhatIfSensitivityPanel: React.FC<WhatIfSensitivityPanelProps> = ({ fetcher }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<DriverRow[]>(DEFAULT_ROWS);
  const [intercept, setIntercept] = useState(0);
  const [swingPct, setSwingPct] = useState(20);

  const [xDriver, setXDriver] = useState(DEFAULT_ROWS[0].id);
  const [yDriver, setYDriver] = useState(DEFAULT_ROWS[2].id);
  const [xRangeRaw, setXRangeRaw] = useState('80,90,100,110,120');
  const [yRangeRaw, setYRangeRaw] = useState('6,8,10,12,14');

  const [tornadoResult, setTornadoResult] = useState<TornadoResult | null>(null);
  const [heatmapResult, setHeatmapResult] = useState<DataTable2DResult | null>(null);
  const [tornadoLoading, setTornadoLoading] = useState(false);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [tornadoFailed, setTornadoFailed] = useState(false);
  const [heatmapFailed, setHeatmapFailed] = useState(false);

  const baseDrivers: SensitivityDrivers = useMemo(() => {
    const d: SensitivityDrivers = {};
    for (const r of rows) d[r.id] = r.value;
    return d;
  }, [rows]);

  const weights = useMemo(() => {
    const w: Record<string, number> = {};
    for (const r of rows) w[r.id] = r.weight;
    return w;
  }, [rows]);

  const updateRow = useCallback((id: string, patch: Partial<DriverRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);
  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      { id: nextRowId(), name: `driver_${prev.length + 1}`, value: 100, weight: 1 },
    ]);
  }, []);
  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }, []);

  const runTornadoAnalysis = useCallback(async () => {
    if (rows.length === 0) return;
    setTornadoLoading(true);
    setTornadoFailed(false);
    try {
      const res = await (fetcher?.tornado ?? runTornado)({
        baseDrivers,
        weights,
        intercept,
        driverIds: rows.map((r) => r.id),
        swingPct,
      });
      setTornadoResult(res ?? null);
      setTornadoFailed(!res);
    } catch {
      setTornadoResult(null);
      setTornadoFailed(true);
    } finally {
      setTornadoLoading(false);
    }
  }, [rows, baseDrivers, weights, intercept, swingPct, fetcher]);

  const runHeatmapAnalysis = useCallback(async () => {
    const xRange = parseRange(xRangeRaw);
    const yRange = parseRange(yRangeRaw);
    if (!xDriver || !yDriver || xRange.length === 0 || yRange.length === 0) return;
    setHeatmapLoading(true);
    setHeatmapFailed(false);
    try {
      const res = await (fetcher?.dataTable ?? runDataTable2D)({
        baseDrivers,
        weights,
        intercept,
        xDriver,
        yDriver,
        xRange,
        yRange,
      });
      setHeatmapResult(res ?? null);
      setHeatmapFailed(!res);
    } catch {
      setHeatmapResult(null);
      setHeatmapFailed(true);
    } finally {
      setHeatmapLoading(false);
    }
  }, [xDriver, yDriver, xRangeRaw, yRangeRaw, baseDrivers, weights, intercept, fetcher]);

  return (
    <div
      className="rounded-xl border border-c-border bg-c-surface p-4"
      data-testid="whatif-sensitivity-panel"
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          {t('finance.m16.sensitivity.title', 'What-if sensitivity')}
        </h3>
        <p className="mt-0.5 text-xs text-c-text-secondary">
          {t(
            'finance.m16.sensitivity.subtitle',
            'Tornado (one driver at a time) and a 2D heatmap across two drivers.'
          )}
        </p>
      </div>

      {/* Base drivers */}
      <div className="mb-4 space-y-2" data-testid="sens-drivers">
        <p className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('finance.m16.sensitivity.baseDriversLabel', 'Base drivers')}
        </p>
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-c-border-subtle p-2"
            data-testid={`sens-driver-${row.id}`}
          >
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16.sensitivity.driverName', 'Name')}</span>
              <input
                type="text"
                value={row.name}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16.sensitivity.driverValue', 'Value')}</span>
              <input
                type="number"
                value={row.value}
                onChange={(e) => updateRow(row.id, { value: Number(e.target.value) || 0 })}
                className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            <label className="flex flex-col text-[11px] text-c-text-muted">
              <span className="mb-0.5">{t('finance.m16.sensitivity.weight', 'Weight')}</span>
              <input
                type="number"
                value={row.weight}
                onChange={(e) => updateRow(row.id, { weight: Number(e.target.value) || 0 })}
                className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="text-c-text-muted hover:text-c-danger"
                aria-label={`Remove ${row.name}`}
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
            {t('finance.m16.sensitivity.addDriver', '+ driver')}
          </button>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16.sensitivity.intercept', 'Intercept')}</span>
            <input
              type="number"
              value={intercept}
              onChange={(e) => setIntercept(Number(e.target.value) || 0)}
              className="w-24 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
        </div>
      </div>

      {/* Tornado */}
      <div className="mb-4 border-t border-c-border-subtle pt-3" data-testid="sens-tornado-section">
        <div className="mb-2 flex flex-wrap items-end gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
            {t('finance.m16.sensitivity.tornadoTitle', 'Tornado — one-way sensitivity')}
          </h4>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16.sensitivity.swingPct', 'Tornado swing (%)')}</span>
            <input
              type="number"
              value={swingPct}
              onChange={(e) => setSwingPct(Number(e.target.value) || 0)}
              className="w-20 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <button
            type="button"
            onClick={() => void runTornadoAnalysis()}
            disabled={tornadoLoading || rows.length === 0}
            className="rounded-lg bg-c-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            data-testid="sens-run-tornado"
          >
            {tornadoLoading
              ? t('finance.m16.sensitivity.running', 'Calculating…')
              : t('finance.m16.sensitivity.runTornado', 'Run tornado')}
          </button>
        </div>

        {tornadoFailed && (
          <p className="text-sm text-c-text-muted" data-testid="sens-tornado-failed">
            {t(
              'finance.m16.sensitivity.error',
              'Sensitivity analysis unavailable right now — try again.'
            )}
          </p>
        )}
        {!tornadoFailed && !tornadoResult && !tornadoLoading && (
          <p className="text-sm text-c-text-muted" data-testid="sens-tornado-empty">
            {t('finance.m16.sensitivity.emptyTornado', 'Add drivers and run the tornado.')}
          </p>
        )}
        {!tornadoFailed && tornadoResult && (
          <div data-testid="sens-tornado-chart">
            <TornadoChart bars={tornadoResult.bars} base={tornadoResult.base} formatValue={fmt} />
          </div>
        )}
      </div>

      {/* 2D heatmap */}
      <div className="border-t border-c-border-subtle pt-3" data-testid="sens-heatmap-section">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('finance.m16.sensitivity.heatmapTitle', '2D data table — X × Y')}
        </h4>
        <div className="mb-2 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16.sensitivity.xDriver', 'X driver')}</span>
            <select
              value={xDriver}
              onChange={(e) => setXDriver(e.target.value)}
              className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16.sensitivity.yDriver', 'Y driver')}</span>
            <select
              value={yDriver}
              onChange={(e) => setYDriver(e.target.value)}
              className="w-28 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16.sensitivity.xRange', 'X range (comma-separated)')}</span>
            <input
              type="text"
              value={xRangeRaw}
              onChange={(e) => setXRangeRaw(e.target.value)}
              className="w-40 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <label className="flex flex-col text-[11px] text-c-text-muted">
            <span className="mb-0.5">{t('finance.m16.sensitivity.yRange', 'Y range (comma-separated)')}</span>
            <input
              type="text"
              value={yRangeRaw}
              onChange={(e) => setYRangeRaw(e.target.value)}
              className="w-40 rounded border border-c-border bg-c-surface px-1.5 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </label>
          <button
            type="button"
            onClick={() => void runHeatmapAnalysis()}
            disabled={heatmapLoading}
            className="rounded-lg bg-c-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            data-testid="sens-run-heatmap"
          >
            {heatmapLoading
              ? t('finance.m16.sensitivity.running', 'Calculating…')
              : t('finance.m16.sensitivity.runHeatmap', 'Run heatmap')}
          </button>
        </div>

        {heatmapFailed && (
          <p className="text-sm text-c-text-muted" data-testid="sens-heatmap-failed">
            {t(
              'finance.m16.sensitivity.error',
              'Sensitivity analysis unavailable right now — try again.'
            )}
          </p>
        )}
        {!heatmapFailed && !heatmapResult && !heatmapLoading && (
          <p className="text-sm text-c-text-muted" data-testid="sens-heatmap-empty">
            {t(
              'finance.m16.sensitivity.emptyHeatmap',
              'Set X/Y drivers and ranges, then run the heatmap.'
            )}
          </p>
        )}
        {!heatmapFailed && heatmapResult && (
          <div data-testid="sens-heatmap-chart">
            <SensitivityHeatmap
              xLabels={heatmapResult.xLabels}
              yLabels={heatmapResult.yLabels}
              matrix={heatmapResult.matrix}
              formatValue={fmt}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatIfSensitivityPanel;
