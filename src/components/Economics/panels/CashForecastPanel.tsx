/**
 * M16 wire-b — Cash Forecast panel (liquidity / runway).
 *
 * Consumes POST /api/v8/finance-planning/cash-forecast (cashForecastService:
 * directCashForecast → runway → minCashAlerts → cashCurve, one call, fala 4
 * bridge — see server/src/routes/v8/finance-planning.routes.ts). The engine
 * was live with zero UI before this panel.
 *
 * Form: opening cash + editable inflow/outflow periods + optional monthly
 * burn + optional min-cash floor. Output: cash curve (recharts line, plan vs.
 * zero-line), a runway gauge (inline SVG, semi-circle), and min-cash alerts.
 *
 * Fail-soft (wzór: ExecutionIntelligencePanel / VarianceBridgePanel): a failed
 * call degrades to an explicit error state, never blocks the rest of the tab.
 * Gated by `m16PlanningSuite` (financeFeatureFlags.ts, default OFF).
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { readMotionMs, useFinanceChartColors } from '@/components/Economics/financeChartTokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  type CashCurvePoint,
  type CashForecastResponse,
  type CashMinAlert,
  postCashForecast,
} from '@/services/api/v8/financePlanning';

// ─────────────────────────────────────────────────────────────────────────
// Local types + helpers
// ─────────────────────────────────────────────────────────────────────────

interface PeriodRow {
  id: string;
  period: string;
  inflows: string;
  outflows: string;
}

let rowSeq = 0;
const nextRowId = (): string => `p${++rowSeq}`;

const DEFAULT_ROWS: PeriodRow[] = [
  { id: nextRowId(), period: 'M1', inflows: '120000', outflows: '150000' },
  { id: nextRowId(), period: 'M2', inflows: '125000', outflows: '150000' },
  { id: nextRowId(), period: 'M3', inflows: '130000', outflows: '155000' },
  { id: nextRowId(), period: 'M4', inflows: '135000', outflows: '150000' },
];

/** Rounded, compact currency-ish formatting (no locale dependency — mirrors server fmtAmount). */
function fmtAmount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  return `${sign}${Math.round(abs)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Runway gauge — inline semi-circle SVG (no library primitive fits; small +
// self-contained, mirrors the style of the shared charts/ primitives).
// ─────────────────────────────────────────────────────────────────────────

interface RunwayGaugeProps {
  runwayPeriods: number;
  totalPeriods: number;
  cashOutPeriod: string | null;
  label: string;
  neverLabel: string;
  cashOutLabel: (period: string) => string;
}

const RunwayGauge: React.FC<RunwayGaugeProps> = ({
  runwayPeriods,
  totalPeriods,
  cashOutPeriod,
  label,
  neverLabel,
  cashOutLabel,
}) => {
  const colors = useFinanceChartColors();
  const safeTotal = Math.max(totalPeriods, 1);
  const fraction = Math.min(Math.max(runwayPeriods / safeTotal, 0), 1);

  const willRunOut = cashOutPeriod != null;
  const severity: 'success' | 'warning' | 'danger' = !willRunOut
    ? 'success'
    : fraction <= 0.34
      ? 'danger'
      : fraction <= 0.67
        ? 'warning'
        : 'success';
  const arcColor =
    severity === 'danger' ? colors.cost : severity === 'warning' ? colors.warning : colors.benefit;

  const r = 70;
  const cx = 100;
  const cy = 100;
  const arcLen = Math.PI * r;
  const drawn = willRunOut ? arcLen * fraction : arcLen;

  return (
    <div
      className="flex flex-col items-center"
      data-testid="cash-runway-gauge"
      data-severity={severity}
    >
      <svg viewBox="0 0 200 115" className="w-full max-w-[220px]" role="img" aria-label={label}>
        <path
          d={`M 30 ${cy} A ${r} ${r} 0 0 1 170 ${cy}`}
          fill="none"
          stroke={colors.grid}
          strokeWidth={14}
          strokeLinecap="round"
        />
        <path
          d={`M 30 ${cy} A ${r} ${r} 0 0 1 170 ${cy}`}
          fill="none"
          stroke={arcColor}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${drawn} ${arcLen}`}
        />
        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          className="fill-c-text text-[26px] font-semibold"
        >
          {willRunOut ? runwayPeriods : `${totalPeriods}+`}
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-c-text-muted text-[11px]">
          {label}
        </text>
      </svg>
      <div
        className="mt-1 text-center text-xs text-c-text-secondary"
        data-testid="cash-runway-note"
      >
        {willRunOut && cashOutPeriod ? cashOutLabel(cashOutPeriod) : neverLabel}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Period rows editor
// ─────────────────────────────────────────────────────────────────────────

interface PeriodsEditorProps {
  rows: PeriodRow[];
  onChange: (rows: PeriodRow[]) => void;
  t: (key: string, def: string) => string;
}

const PeriodsEditor: React.FC<PeriodsEditorProps> = ({ rows, onChange, t }) => {
  const setRow = (id: string, patch: Partial<PeriodRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const addRow = () =>
    onChange([
      ...rows,
      { id: nextRowId(), period: `M${rows.length + 1}`, inflows: '0', outflows: '0' },
    ]);

  return (
    <div data-testid="cash-forecast-periods">
      <div className="mb-1 grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[11px] font-medium uppercase tracking-wide text-c-text-muted">
        <span>{t('finance.m16b.cashForecast.periodLabel', 'Period')}</span>
        <span>{t('finance.m16b.cashForecast.inflows', 'Inflows')}</span>
        <span>{t('finance.m16b.cashForecast.outflows', 'Outflows')}</span>
        <span />
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2"
            data-testid={`cash-forecast-row-${row.id}`}
          >
            <input
              type="text"
              value={row.period}
              onChange={(e) => setRow(row.id, { period: e.target.value })}
              className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-sm text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
              aria-label={t('finance.m16b.cashForecast.periodLabel', 'Period')}
            />
            <input
              type="number"
              value={row.inflows}
              onChange={(e) => setRow(row.id, { inflows: e.target.value })}
              className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-right font-mono text-sm tabular-nums text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
              aria-label={t('finance.m16b.cashForecast.inflows', 'Inflows')}
            />
            <input
              type="number"
              value={row.outflows}
              onChange={(e) => setRow(row.id, { outflows: e.target.value })}
              className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-right font-mono text-sm tabular-nums text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
              aria-label={t('finance.m16b.cashForecast.outflows', 'Outflows')}
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              disabled={rows.length <= 1}
              className="rounded-lg px-2 py-1.5 text-xs text-c-text-muted hover:bg-c-surface-raised disabled:opacity-30"
              aria-label={t('finance.m16b.cashForecast.removePeriod', 'Remove period')}
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
        data-testid="cash-forecast-add-period"
      >
        + {t('finance.m16b.cashForecast.addPeriod', 'Add period')}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────────────────

export const CashForecastPanel: React.FC = () => {
  const { t } = useTranslation();
  const colors = useFinanceChartColors();
  const prefersReducedMotion = useReducedMotion();
  const chartAnimationMs = prefersReducedMotion ? 0 : readMotionMs('--motion-base', 180);

  const [openingCash, setOpeningCash] = useState('250000');
  const [monthlyBurn, setMonthlyBurn] = useState('30000');
  const [minCash, setMinCash] = useState('50000');
  const [rows, setRows] = useState<PeriodRow[]>(DEFAULT_ROWS);

  const [result, setResult] = useState<CashForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const periods = rows.map((r) => ({
        period: r.period.trim() || undefined,
        inflows: Number(r.inflows) || 0,
        outflows: Number(r.outflows) || 0,
      }));
      const burn = Number(monthlyBurn);
      const floor = Number(minCash);
      const res = await postCashForecast({
        openingCash: Number(openingCash) || 0,
        periods,
        ...(Number.isFinite(burn) && burn > 0 ? { monthlyBurn: burn } : {}),
        ...(Number.isFinite(floor) ? { minCash: floor } : {}),
      });
      setResult(res);
    } catch (err: any) {
      setResult(null);
      setError(
        err?.message
          ? String(err.message)
          : t('finance.m16b.cashForecast.errorGeneric', 'Cash forecast failed to compute.')
      );
    } finally {
      setLoading(false);
    }
  };

  const curve: CashCurvePoint[] = useMemo(() => result?.curve ?? [], [result]);
  const alerts: CashMinAlert[] = result?.alerts ?? [];

  const chartDomainPad = useMemo(() => {
    if (curve.length === 0) return 0;
    const values = curve.map((p) => p.cash);
    const span = Math.max(...values) - Math.min(...values);
    return span > 0 ? span * 0.1 : Math.max(Math.abs(values[0]) * 0.1, 100);
  }, [curve]);

  return (
    <div
      data-testid="cash-forecast-panel"
      className="rounded-xl border border-c-border bg-c-surface p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-c-text">
            {t('finance.m16b.cashForecast.title', 'Cash / liquidity forecast')}
          </h3>
          <p className="mt-0.5 text-xs text-c-text-secondary">
            {t(
              'finance.m16b.cashForecast.subtitle',
              'Direct-method cash forecast — runway, minimum-cash alerts and the closing-cash curve.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          data-testid="cash-forecast-run"
          className="shrink-0 rounded-xl border border-c-border bg-c-surface-raised px-3.5 py-2 text-sm font-medium text-c-text transition hover:border-c-focus disabled:opacity-50"
        >
          {loading
            ? t('finance.m16b.cashForecast.running', 'Computing…')
            : t('finance.m16b.cashForecast.run', 'Run forecast')}
        </button>
      </div>

      {/* Inputs */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-c-text-secondary">
            {t('finance.m16b.cashForecast.openingCash', 'Opening cash')}
          </span>
          <input
            type="number"
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-right font-mono text-sm tabular-nums text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-c-text-secondary">
            {t('finance.m16b.cashForecast.monthlyBurn', 'Monthly burn (optional)')}
          </span>
          <input
            type="number"
            value={monthlyBurn}
            onChange={(e) => setMonthlyBurn(e.target.value)}
            className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-right font-mono text-sm tabular-nums text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-c-text-secondary">
            {t('finance.m16b.cashForecast.minCash', 'Minimum cash floor (optional)')}
          </span>
          <input
            type="number"
            value={minCash}
            onChange={(e) => setMinCash(e.target.value)}
            className="w-full rounded-lg border border-c-border bg-c-surface px-2 py-1.5 text-right font-mono text-sm tabular-nums text-c-text focus:border-c-focus focus:outline-none focus:ring-2 focus:ring-c-focus/30"
          />
        </label>
      </div>

      <div className="mb-4">
        <PeriodsEditor rows={rows} onChange={setRows} t={t} />
      </div>

      {/* States */}
      {error && (
        <div
          className="mb-4 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-sm text-c-danger"
          data-testid="cash-forecast-error"
        >
          {error}
        </div>
      )}

      {!result && !error && !loading && (
        <p className="text-sm text-c-text-secondary" data-testid="cash-forecast-empty">
          {t(
            'finance.m16b.cashForecast.empty',
            'Set opening cash and periods, then run the forecast.'
          )}
        </p>
      )}

      {result && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          <RunwayGauge
            runwayPeriods={result.runway.runwayPeriods}
            totalPeriods={rows.length}
            cashOutPeriod={result.runway.cashOutPeriod}
            label={t('finance.m16b.cashForecast.runwayLabel', 'periods runway')}
            neverLabel={t(
              'finance.m16b.cashForecast.runwayNever',
              'Cash does not run out within the forecast horizon.'
            )}
            cashOutLabel={(period) =>
              String(
                t('finance.m16b.cashForecast.runwayCashOut', 'Cash runs out at {{period}}', {
                  period,
                } as any)
              )
            }
          />

          <div className="min-w-0">
            <div className="h-[220px] w-full" data-testid="cash-forecast-curve">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curve} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" stroke={colors.axis} tick={{ fontSize: 11 }} />
                  <YAxis
                    stroke={colors.axis}
                    tick={{ fontSize: 11 }}
                    tickFormatter={fmtAmount}
                    domain={[
                      (min: number) => min - chartDomainPad,
                      (max: number) => max + chartDomainPad,
                    ]}
                  />
                  <Tooltip
                    formatter={(value: number) => fmtAmount(Number(value))}
                    labelFormatter={(label) => String(label)}
                    contentStyle={{
                      boxShadow: 'var(--elevation-2)',
                      backgroundColor: 'var(--c-surface)',
                      border: '1px solid var(--c-border)',
                      borderRadius: '10px',
                      fontSize: '11px',
                    }}
                  />
                  <ReferenceLine y={0} stroke={colors.reference} strokeDasharray="4 4" />
                  {Number.isFinite(Number(minCash)) && Number(minCash) !== 0 && (
                    <ReferenceLine
                      y={Number(minCash)}
                      stroke={colors.warning}
                      strokeDasharray="4 4"
                      label={{
                        value: String(t('finance.m16b.cashForecast.floorLabel', 'Min cash')),
                        fill: colors.warning,
                        fontSize: 10,
                        position: 'insideTopLeft',
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="cash"
                    stroke={colors.net}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={!prefersReducedMotion}
                    animationDuration={chartAnimationMs}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {alerts.length > 0 && (
              <div className="mt-3 space-y-1.5" data-testid="cash-forecast-alerts">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('finance.m16b.cashForecast.alertsTitle', 'Minimum-cash alerts')}
                </h4>
                {alerts.map((alert) => (
                  <div
                    key={alert.period}
                    className="flex items-center justify-between rounded-lg border border-c-warning/30 bg-c-warning/10 px-2.5 py-1.5 text-xs text-c-text"
                    data-testid={`cash-forecast-alert-${alert.period}`}
                  >
                    <span className="font-medium">{alert.period}</span>
                    <span className="text-c-text-secondary">
                      {String(
                        t('finance.m16b.cashForecast.alertClosing', 'closing {{value}}', {
                          value: fmtAmount(alert.closingCash),
                        } as any)
                      )}
                    </span>
                    <span className="font-mono font-semibold text-c-warning">
                      -{fmtAmount(alert.shortfall)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CashForecastPanel;
