/**
 * Comparison Radar Chart Component
 *
 * Multi-series radar chart for comparing multiple digitization analyses.
 * Supports up to 4 analyses with distinct colors and interactive tooltips.
 */

import React, { useMemo } from 'react';
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface AnalysisDataSeries {
  id: string;
  name: string;
  color: string;
  scores: Record<string, number>; // axisId -> score
}

interface ComparisonRadarChartProps {
  analyses: AnalysisDataSeries[];
  axisLabels: Record<string, string>; // axisId -> display label
  height?: number;
  showLegend?: boolean;
  className?: string;
  animationDuration?: number;
}

// Default color palette for analyses
const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // red
  '#6366f1', // violet
  '#ec4899', // pink
];

interface ChartDataPoint {
  axis: string;
  axisId: string;
  [key: string]: string | number; // Dynamic analysis scores
}

interface TooltipPayload {
  payload: ChartDataPoint;
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

const CustomTooltip = ({
  active,
  payload,
  analyses,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  analyses: AnalysisDataSeries[];
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 min-w-[200px]">
      <p className="font-medium text-white text-sm mb-2 pb-2 border-b border-slate-700">
        {data.axis}
      </p>
      <div className="space-y-2">
        {analyses.map((analysis) => {
          const value = data[analysis.id] as number;
          return (
            <div key={analysis.id} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: analysis.color }}
                />
                <span className="text-slate-600 dark:text-slate-500 text-xs truncate max-w-[120px]">
                  {analysis.name}
                </span>
              </div>
              <span className="font-semibold text-sm" style={{ color: analysis.color }}>
                {typeof value === 'number' ? value.toFixed(1) : '-'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ComparisonRadarChart: React.FC<ComparisonRadarChartProps> = ({
  analyses,
  axisLabels,
  height = 450,
  showLegend = true,
  className = '',
  animationDuration = 500,
}) => {
  // Assign colors to analyses if not provided
  const coloredAnalyses = useMemo(
    () =>
      analyses.map((a, i) => ({
        ...a,
        color: a.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
      })),
    [analyses]
  );

  // Transform data for recharts
  const chartData = useMemo((): ChartDataPoint[] => {
    const axisIds = Object.keys(axisLabels);

    return axisIds.map((axisId) => {
      const point: ChartDataPoint = {
        axis: axisLabels[axisId],
        axisId,
      };

      coloredAnalyses.forEach((analysis) => {
        point[analysis.id] = analysis.scores[axisId] ?? 0;
      });

      return point;
    });
  }, [axisLabels, coloredAnalyses]);

  // Calculate average scores for summary
  const summaryData = useMemo(() => {
    return coloredAnalyses.map((analysis) => {
      const scores = Object.values(analysis.scores).filter((v) => typeof v === 'number');
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        id: analysis.id,
        name: analysis.name,
        color: analysis.color,
        average: avg,
      };
    });
  }, [coloredAnalyses]);

  if (analyses.length === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ height }}>
        <p className="text-slate-500 dark:text-slate-400">Wybierz analizy do porównania</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Summary bar */}
      <div className="flex flex-wrap gap-4 mb-4 px-4">
        {summaryData.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-1.5"
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-600 dark:text-slate-500 text-sm truncate max-w-[100px]">
              {item.name}
            </span>
            <span className="font-semibold text-sm" style={{ color: item.color }}>
              {item.average.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <RechartsRadarChart
          cx="50%"
          cy="50%"
          outerRadius="70%"
          data={chartData}
          margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
        >
          <PolarGrid stroke="#334155" strokeOpacity={0.5} gridType="polygon" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={{ stroke: '#475569' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 7]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickCount={8}
            axisLine={{ stroke: '#475569' }}
          />

          {coloredAnalyses.map((analysis, index) => (
            <Radar
              key={analysis.id}
              name={analysis.name}
              dataKey={analysis.id}
              stroke={analysis.color}
              fill={analysis.color}
              fillOpacity={0.2 - index * 0.05}
              strokeWidth={2}
              activeDot={{
                r: 5,
                fill: analysis.color,
                stroke: '#fff',
                strokeWidth: 2,
              }}
              animationDuration={animationDuration}
              animationBegin={index * 100}
            />
          ))}

          <Tooltip content={<CustomTooltip analyses={coloredAnalyses} />} />

          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value, entry) => (
                <span className="text-sm" style={{ color: (entry as any).color }}>
                  {value}
                </span>
              )}
            />
          )}
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ComparisonRadarChart;
