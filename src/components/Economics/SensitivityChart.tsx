/**
 * Sensitivity Analysis Chart Component
 *
 * Visualizes how NPV changes with variations in key input parameters.
 * Shows tornado diagram and sensitivity curves.
 */

import { Activity, ArrowLeftRight, ChevronDown } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SensitivityDataPoint {
  change: number; // e.g., -0.2, -0.1, 0, 0.1, 0.2
  variableValue: number;
  npv: number;
}

interface SensitivityVariable {
  name: string;
  namePl: string;
  baseValue: number;
  unit: string;
  data: SensitivityDataPoint[];
  color: string;
}

interface TornadoDataPoint {
  variable: string;
  variablePl: string;
  lowNpv: number;
  highNpv: number;
  baseNpv: number;
  range: number;
}

interface SensitivityChartProps {
  variables: SensitivityVariable[];
  baseNpv: number;
  currency?: string;
  height?: number;
}

type ViewMode = 'tornado' | 'spider';

export const SensitivityChart: React.FC<SensitivityChartProps> = ({
  variables,
  baseNpv,
  currency = 'PLN',
  height = 400,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('tornado');
  const [selectedVariables, setSelectedVariables] = useState<string[]>(
    variables.slice(0, 4).map((v) => v.name)
  );

  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toFixed(0);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };

  // Prepare tornado chart data
  const tornadoData: TornadoDataPoint[] = useMemo(() => {
    return variables
      .filter((v) => selectedVariables.includes(v.name))
      .map((variable) => {
        const minData = variable.data.reduce(
          (min, d) => (d.npv < min.npv ? d : min),
          variable.data[0]
        );
        const maxData = variable.data.reduce(
          (max, d) => (d.npv > max.npv ? d : max),
          variable.data[0]
        );
        const baseData =
          variable.data.find((d) => d.change === 0) ||
          variable.data[Math.floor(variable.data.length / 2)];

        return {
          variable: variable.name,
          variablePl: variable.namePl,
          lowNpv: minData.npv,
          highNpv: maxData.npv,
          baseNpv: baseData.npv,
          range: maxData.npv - minData.npv,
        };
      })
      .sort((a, b) => b.range - a.range);
  }, [variables, selectedVariables]);

  // Prepare spider chart data
  const spiderData = useMemo(() => {
    const allChanges = new Set<number>();
    variables.forEach((v) => v.data.forEach((d) => allChanges.add(d.change)));
    const sortedChanges = Array.from(allChanges).sort((a, b) => a - b);

    return sortedChanges.map((change) => {
      const point: Record<string, number> = { change };
      variables
        .filter((v) => selectedVariables.includes(v.name))
        .forEach((v) => {
          const dataPoint = v.data.find((d) => d.change === change);
          if (dataPoint) {
            point[v.name] = dataPoint.npv;
          }
        });
      return point;
    });
  }, [variables, selectedVariables]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700">
          <p className="font-bold text-navy-900 dark:text-white mb-2">
            Zmiana: {formatPercent(label)}
          </p>
          <div className="space-y-1.5 text-sm">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <span style={{ color: entry.color }} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }} />
                  {variables.find((v) => v.name === entry.dataKey)?.namePl || entry.dataKey}:
                </span>
                <span
                  className={`font-medium ${entry.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                >
                  {new Intl.NumberFormat('pl-PL', {
                    style: 'currency',
                    currency,
                    maximumFractionDigits: 0,
                  }).format(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const TornadoTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700">
          <p className="font-bold text-navy-900 dark:text-white mb-2">{data.variablePl}</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-rose-500">Min NPV:</span>
              <span className="font-medium text-navy-900 dark:text-white">
                {new Intl.NumberFormat('pl-PL', {
                  style: 'currency',
                  currency,
                  maximumFractionDigits: 0,
                }).format(data.lowNpv)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-500">Max NPV:</span>
              <span className="font-medium text-navy-900 dark:text-white">
                {new Intl.NumberFormat('pl-PL', {
                  style: 'currency',
                  currency,
                  maximumFractionDigits: 0,
                }).format(data.highNpv)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-200 dark:border-navy-700">
              <span className="text-blue-500">Zakres:</span>
              <span className="font-bold text-blue-600">
                {new Intl.NumberFormat('pl-PL', {
                  style: 'currency',
                  currency,
                  maximumFractionDigits: 0,
                }).format(data.range)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const toggleVariable = (name: string) => {
    setSelectedVariables((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
  };

  if (variables.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <Activity size={32} className="mx-auto mb-2 opacity-50" />
          <p>No data do Sensitivity Analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Activity size={20} className="text-primary-500" />
            Sensitivity Analysis
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Impact of Parameter Changes na NPV (±20%)
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-navy-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode('tornado')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'tornado'
                ? 'bg-white dark:bg-navy-600 text-navy-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
            }`}
          >
            Tornado
          </button>
          <button
            onClick={() => setViewMode('spider')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'spider'
                ? 'bg-white dark:bg-navy-600 text-navy-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
            }`}
          >
            Spider
          </button>
        </div>
      </div>

      {/* Variable Selection */}
      <div className="flex flex-wrap gap-2 mb-4">
        {variables.map((variable) => (
          <button
            key={variable.name}
            onClick={() => toggleVariable(variable.name)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              selectedVariables.includes(variable.name)
                ? 'text-white'
                : 'bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-600'
            }`}
            style={
              selectedVariables.includes(variable.name) ? { backgroundColor: variable.color } : {}
            }
          >
            {variable.namePl}
          </button>
        ))}
      </div>

      {/* Charts */}
      {viewMode === 'tornado' ? (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={tornadoData}
            layout="vertical"
            margin={{ top: 20, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis
              type="number"
              tickFormatter={formatCurrency}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="variablePl"
              tick={{ fill: '#64748b', fontSize: 12 }}
              width={110}
            />
            <Tooltip content={<TornadoTooltip />} />
            <ReferenceLine
              x={baseNpv}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{ value: 'Bazowe NPV', position: 'top', fill: '#3b82f6', fontSize: 11 }}
            />

            {/* Low values (negative impact) */}
            <Bar
              dataKey="lowNpv"
              name="Min NPV"
              fill="#f43f5e"
              radius={[4, 0, 0, 4]}
              barSize={20}
            />

            {/* High values (positive impact) */}
            <Bar
              dataKey="highNpv"
              name="Max NPV"
              fill="#10b981"
              radius={[0, 4, 4, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={spiderData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis
              dataKey="change"
              tickFormatter={formatPercent}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <YAxis tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value: string) => (
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {variables.find((v) => v.name === value)?.namePl || value}
                </span>
              )}
            />

            <ReferenceLine y={baseNpv} stroke="#94a3b8" strokeDasharray="5 5" />
            <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="5 5" />

            {variables
              .filter((v) => selectedVariables.includes(v.name))
              .map((variable) => (
                <Line
                  key={variable.name}
                  type="monotone"
                  dataKey={variable.name}
                  name={variable.name}
                  stroke={variable.color}
                  strokeWidth={2}
                  dot={{ fill: variable.color, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Insight */}
      <div className="mt-4 p-4 bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <ArrowLeftRight size={20} className="text-primary-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-navy-900 dark:text-white">
              Most important variables
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {tornadoData.length > 0 && (
                <>
                  Highest impact on NPV has{' '}
                  <span className="font-medium text-primary-600 dark:text-primary-400">
                    {tornadoData[0].variablePl}
                  </span>
                  {tornadoData.length > 1 && (
                    <>
                      , then{' '}
                      <span className="font-medium text-primary-600 dark:text-primary-400">
                        {tornadoData[1].variablePl}
                      </span>
                    </>
                  )}
                  . Managing these variables is key to investment success.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SensitivityChart;
