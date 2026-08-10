/**
 * FinancialCharts — doc 09 §7.3: "charts show cumulative cash flow,
 * benefit/cost composition, scenario range and sensitivity — not decorative
 * dashboards". Four charts, each answering one decision question:
 *
 *  1. Cumulative cash flow  — WHEN does the case pay back? (time series,
 *     zero reference line = payback crossing, one line per scenario)
 *  2. Benefit/cost composition — WHAT is driving the number per period?
 *     (mirrored bars: benefit up, cost down, around the same zero baseline)
 *  3. Scenario range — HOW MUCH could the headline NPV vary? (Base vs
 *     Upside vs Downside, direct-labeled, single money axis)
 *  4. Sensitivity — WHICH driver assumption matters most? (tornado chart,
 *     ±20% swing per driver, sorted by impact)
 *
 * Every chart is driven ONLY by `result` (the sibling engine's output) and
 * `status`. When `status !== 'fresh'` the last-known numbers are dimmed under
 * a "stale — recompute" scrim rather than presented as current (doc 11 E09
 * DoD: "invalid/stale state blocks misleading approval"). When there is no
 * result at all (empty/blocked/error, never computed), each chart shows an
 * honest empty state instead of a fabricated placeholder chart (Z3).
 */
import { AlertTriangle } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useFinanceChartColors } from '@/components/Economics/financeChartTokens';

import { formatMoney, formatPeriodLabel } from './financialFormat';
import { useScenarioColors } from './financialScenarioColors';
import type {
  FinancialCaseResult,
  FinancialCaseStatus,
  FinancialScenarioId,
} from './financialTypes';
import { FINANCIAL_SCENARIOS } from './financialTypes';

export interface FinancialChartsProps {
  result: FinancialCaseResult | null;
  status: FinancialCaseStatus;
  currency: string;
}

const SCENARIO_LABEL_KEY: Record<FinancialScenarioId, string> = {
  base: 'ideas.financial.scenario.base',
  upside: 'ideas.financial.scenario.upside',
  downside: 'ideas.financial.scenario.downside',
};
const SCENARIO_LABEL_EN: Record<FinancialScenarioId, string> = {
  base: 'Base',
  upside: 'Upside',
  downside: 'Downside',
};

function ChartCard({
  title,
  subtitle,
  isStale,
  hasData,
  children,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  isStale: boolean;
  hasData: boolean;
  children: React.ReactNode;
  emptyLabel: string;
}) {
  return (
    <div className="border border-c-border rounded-lg bg-c-surface p-3 relative">
      <div className="mb-2">
        <h4 className="text-xs font-semibold text-c-text">{title}</h4>
        <p className="text-[10px] text-c-text-muted">{subtitle}</p>
      </div>
      {!hasData ? (
        <div className="h-[180px] flex items-center justify-center text-xs text-c-text-muted italic">
          {emptyLabel}
        </div>
      ) : (
        <div className={`h-[200px] ${isStale ? 'opacity-40 grayscale-[30%]' : ''}`}>{children}</div>
      )}
      {hasData && isStale && (
        <div className="absolute inset-x-3 bottom-3 flex items-center gap-1 text-[10px] font-medium text-c-warning bg-c-surface/90 border border-c-warning/30 rounded-md px-1.5 py-1">
          <AlertTriangle size={11} />
          <span>stale</span>
        </div>
      )}
    </div>
  );
}

export const FinancialCharts: React.FC<FinancialChartsProps> = ({ result, status, currency }) => {
  const { t } = useTranslation();
  const colors = useFinanceChartColors();
  const scenarioColors = useScenarioColors();
  const isStale = status !== 'fresh';
  const money = (v: number) => formatMoney(v, currency);

  const presentScenarios = useMemo(
    () => FINANCIAL_SCENARIOS.filter((s) => result?.scenarios[s]),
    [result]
  );

  // ── 1. Cumulative cash flow ──────────────────────────────────────────
  const cashFlowData = useMemo(() => {
    if (!result) return [];
    const base = result.scenarios.base;
    if (!base) return [];
    return base.periods.map((p, idx) => {
      const row: Record<string, number | string> = { period: formatPeriodLabel(p.period) };
      for (const sc of presentScenarios) {
        const scenarioPeriods = result.scenarios[sc]?.periods;
        row[sc] = scenarioPeriods?.[idx]?.cumulativeCashFlow ?? 0;
      }
      return row;
    });
  }, [result, presentScenarios]);

  // ── 2. Benefit / cost composition (Base scenario, per period) ───────
  const compositionData = useMemo(() => {
    const base = result?.scenarios.base;
    if (!base) return [];
    return base.periods.map((p) => ({
      period: formatPeriodLabel(p.period),
      benefit: p.benefit,
      cost: -Math.abs(p.cost),
    }));
  }, [result]);

  // ── 3. Scenario range (headline NPV per scenario) ───────────────────
  const rangeData = useMemo(() => {
    return presentScenarios.map((sc) => ({
      scenario: sc,
      label: t(SCENARIO_LABEL_KEY[sc], SCENARIO_LABEL_EN[sc]),
      npv: result?.scenarios[sc]?.npv ?? null,
    }));
  }, [result, presentScenarios, t]);
  const npvValues = rangeData.map((r) => r.npv).filter((v): v is number => v !== null);
  const npvSpread = npvValues.length > 1 ? Math.max(...npvValues) - Math.min(...npvValues) : null;

  // ── 4. Sensitivity (tornado) ─────────────────────────────────────────
  const sensitivityData = useMemo(() => {
    if (!result) return [];
    return [...result.sensitivity]
      .map((row) => ({
        ...row,
        swing: Math.abs(row.highNpv - row.lowNpv),
      }))
      .sort((a, b) => b.swing - a.swing)
      .slice(0, 8);
  }, [result]);

  const hasAnyResult = Boolean(result);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <ChartCard
        title={t('ideas.financial.chart.cashFlow.title', 'Cumulative cash flow')}
        subtitle={t(
          'ideas.financial.chart.cashFlow.subtitle',
          'When does the case cross zero (payback)?'
        )}
        isStale={isStale}
        hasData={hasAnyResult && cashFlowData.length > 0}
        emptyLabel={t('ideas.financial.chart.noResult', 'Recompute to see this chart.')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={cashFlowData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" stroke={colors.axis} tick={{ fontSize: 10 }} />
            <YAxis stroke={colors.axis} tick={{ fontSize: 10 }} tickFormatter={money} width={70} />
            <ReferenceLine y={0} stroke={colors.reference} />
            <Tooltip formatter={(v: number) => money(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {presentScenarios.map((sc) => (
              <Line
                key={sc}
                type="monotone"
                dataKey={sc}
                name={t(SCENARIO_LABEL_KEY[sc], SCENARIO_LABEL_EN[sc])}
                stroke={scenarioColors[sc]}
                strokeWidth={sc === 'base' ? 2.5 : 1.5}
                strokeDasharray={sc === 'base' ? undefined : '4 3'}
                dot={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={t('ideas.financial.chart.composition.title', 'Benefit / cost composition')}
        subtitle={t(
          'ideas.financial.chart.composition.subtitle',
          'What is driving each period (Base scenario)?'
        )}
        isStale={isStale}
        hasData={hasAnyResult && compositionData.length > 0}
        emptyLabel={t('ideas.financial.chart.noResult', 'Recompute to see this chart.')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={compositionData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" stroke={colors.axis} tick={{ fontSize: 10 }} />
            <YAxis stroke={colors.axis} tick={{ fontSize: 10 }} tickFormatter={money} width={70} />
            <ReferenceLine y={0} stroke={colors.reference} />
            <Tooltip formatter={(v: number) => money(Math.abs(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="benefit"
              name={t('ideas.financial.benefit', 'Benefit')}
              fill={colors.benefit}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="cost"
              name={t('ideas.financial.cost', 'Cost')}
              fill={colors.cost}
              radius={[0, 0, 2, 2]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={t('ideas.financial.chart.range.title', 'Scenario range (NPV)')}
        subtitle={
          npvSpread !== null
            ? t(
                'ideas.financial.chart.range.subtitleSpread',
                'Spread across scenarios: {{spread}}',
                {
                  spread: money(npvSpread),
                }
              )
            : t('ideas.financial.chart.range.subtitle', 'Base vs Upside vs Downside')
        }
        isStale={isStale}
        hasData={hasAnyResult && rangeData.some((r) => r.npv !== null)}
        emptyLabel={t('ideas.financial.chart.noResult', 'Recompute to see this chart.')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rangeData}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
          >
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              stroke={colors.axis}
              tick={{ fontSize: 10 }}
              tickFormatter={money}
            />
            <YAxis
              type="category"
              dataKey="label"
              stroke={colors.axis}
              tick={{ fontSize: 11 }}
              width={70}
            />
            <ReferenceLine x={0} stroke={colors.reference} />
            <Tooltip formatter={(v: number) => money(v)} />
            <Bar
              dataKey="npv"
              radius={4}
              label={{ position: 'right', fontSize: 10, formatter: money }}
            >
              {rangeData.map((row) => (
                <Cell key={row.scenario} fill={scenarioColors[row.scenario]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={t('ideas.financial.chart.sensitivity.title', 'Sensitivity')}
        subtitle={t(
          'ideas.financial.chart.sensitivity.subtitle',
          'Which driver assumption swings NPV most (±20%)?'
        )}
        isStale={isStale}
        hasData={hasAnyResult && sensitivityData.length > 0}
        emptyLabel={t(
          'ideas.financial.chart.noSensitivity',
          'No sensitivity rows returned by the engine yet.'
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sensitivityData}
            layout="vertical"
            margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
          >
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              stroke={colors.axis}
              tick={{ fontSize: 10 }}
              tickFormatter={money}
            />
            <YAxis
              type="category"
              dataKey="driverLabel"
              stroke={colors.axis}
              tick={{ fontSize: 10 }}
              width={100}
            />
            <ReferenceLine x={0} stroke={colors.reference} />
            <Tooltip formatter={(v: number) => money(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="lowNpv"
              name={t('ideas.financial.chart.sensitivity.low', '-20%')}
              fill={colors.cost}
              radius={[2, 0, 0, 2]}
            />
            <Bar
              dataKey="highNpv"
              name={t('ideas.financial.chart.sensitivity.high', '+20%')}
              fill={colors.benefit}
              radius={[0, 2, 2, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};
