/**
 * AssessmentReportVisualizations
 *
 * Unified visualization components for assessment reports:
 * - Radar Chart (spider diagram) for maturity overview
 * - Gap Heatmap for priority analysis
 * - Score Cards for quick metrics
 * - Dimension Bars for detailed breakdown
 *
 * Supports all frameworks: DRD, SIRI, ADMA, CMMI, Lean
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getDrdLevelDescriptor } from '../../../services/drdMaturityLevels';
import {
  useAssessmentChartColors,
  type AssessmentChartColors,
} from './assessmentChartTokens';

// ============================================
// TYPES
// ============================================

export type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

export interface DimensionScore {
  id: string;
  name: string;
  namePL?: string;
  current: number;
  target: number;
  maxLevel: number;
  color?: string;
}

export interface AssessmentVisualizationData {
  framework: AssessmentFramework;
  dimensions: DimensionScore[];
  overallScore: number;
  targetScore: number;
  completionPercent: number;
}

// ============================================
// SCORE CARD COMPONENT
// ============================================

interface ScoreCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'red';
  trend?: 'up' | 'down' | 'neutral';
}

export const ScoreCard: React.FC<ScoreCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
}) => {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: 'text-blue-400',
    },
    green: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      icon: 'text-emerald-400',
    },
    purple: {
      bg: 'bg-teal-500/10',
      border: 'border-teal-500/30',
      text: 'text-teal-400',
      icon: 'text-teal-400',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      icon: 'text-amber-400',
    },
    red: {
      bg: 'bg-danger-500/10',
      border: 'border-danger-500/30',
      text: 'text-danger-400',
      icon: 'text-danger-400',
    },
  };

  const classes = colorClasses[color];

  return (
    <div className={`${classes.bg} border ${classes.border} rounded-xl p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className={`text-3xl font-bold ${classes.text} mt-1`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg ${classes.bg} ${classes.icon}`}>{icon}</div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          {trend === 'up' && <TrendingUp size={14} className="text-emerald-400" />}
          {trend === 'down' && <TrendingUp size={14} className="text-danger-400 rotate-180" />}
          <span
            className={`text-xs ${
              trend === 'up'
                ? 'text-emerald-400'
                : trend === 'down'
                  ? 'text-danger-400'
                  : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {trend === 'up' ? 'Above target' : trend === 'down' ? 'Below target' : 'On track'}
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================
// SCORE CARDS GRID
// ============================================

interface ScoreCardsGridProps {
  data: AssessmentVisualizationData;
}

export const ScoreCardsGrid: React.FC<ScoreCardsGridProps> = ({ data }) => {
  const gap = data.targetScore - data.overallScore;
  const gapTrend = gap > 0 ? 'down' : gap < 0 ? 'up' : 'neutral';

  const criticalGaps = data.dimensions.filter((d) => d.target - d.current >= 2).length;
  const onTrack = data.dimensions.filter((d) => d.current >= d.target).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <ScoreCard
        title="Overall Score"
        value={data.overallScore.toFixed(1)}
        subtitle={`Target: ${data.targetScore.toFixed(1)}`}
        icon={<BarChart3 size={20} />}
        color="blue"
        trend={gapTrend}
      />
      <ScoreCard
        title="Completion"
        value={`${data.completionPercent}%`}
        subtitle={`${data.dimensions.length} dimensions`}
        icon={<CheckCircle size={20} />}
        color={
          data.completionPercent >= 80 ? 'green' : data.completionPercent >= 50 ? 'amber' : 'red'
        }
      />
      <ScoreCard
        title="Critical Gaps"
        value={criticalGaps}
        subtitle="Gap ≥ 2 levels"
        icon={<AlertTriangle size={20} />}
        color={criticalGaps > 0 ? 'red' : 'green'}
      />
      <ScoreCard
        title="On Track"
        value={onTrack}
        subtitle={`of ${data.dimensions.length} dimensions`}
        icon={<Target size={20} />}
        color="green"
      />
    </div>
  );
};

// ============================================
// RADAR CHART COMPONENT
// ============================================

interface AssessmentRadarChartProps {
  data: AssessmentVisualizationData;
  showTarget?: boolean;
  height?: number;
}

/** Per-point payload carried through Recharts to the tooltip. */
interface RadarPoint {
  axisId: string;
  name: string;
  current: number;
  target: number;
  maxLevel: number;
}

/**
 * Rich tooltip for the DRD maturity radar: dimension name, current vs. target
 * level (with the level's title + a one-sentence description drawn from the DRD
 * structure, when the framework is DRD), and the gap. Fully bilingual.
 */
const RadarTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: RadarPoint }>;
  colors: AssessmentChartColors;
  framework: AssessmentFramework;
  isPolish: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}> = ({ active, payload, colors, framework, isPolish, t }) => {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  const gap = Math.round((p.target - p.current) * 10) / 10;
  // Level descriptors only exist for DRD; other frameworks show numbers only.
  const currentDesc =
    framework === 'DRD' ? getDrdLevelDescriptor(p.axisId, p.current) : null;
  const targetDesc =
    framework === 'DRD' ? getDrdLevelDescriptor(p.axisId, p.target) : null;

  return (
    <div
      className="rounded-lg shadow-xl p-3 max-w-[280px]"
      style={{
        backgroundColor: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
        color: colors.tooltipText,
      }}
    >
      <p className="font-semibold text-sm mb-2">{p.name}</p>
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs" style={{ color: colors.tooltipMuted }}>
              {t('assessmentModule.drdRadar.current', { defaultValue: 'Current' })}
            </span>
            <span className="font-semibold text-sm" style={{ color: colors.current }}>
              {p.current} / {p.maxLevel}
              {currentDesc ? ` · ${currentDesc.title}` : ''}
            </span>
          </div>
          {currentDesc && (
            <p className="text-xs mt-0.5" style={{ color: colors.tooltipMuted }}>
              {currentDesc.description}
            </p>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs" style={{ color: colors.tooltipMuted }}>
              {t('assessmentModule.drdRadar.target', { defaultValue: 'Target (N+1)' })}
            </span>
            <span className="font-semibold text-sm" style={{ color: colors.target }}>
              {p.target} / {p.maxLevel}
              {targetDesc ? ` · ${targetDesc.title}` : ''}
            </span>
          </div>
          {targetDesc && (
            <p className="text-xs mt-0.5" style={{ color: colors.tooltipMuted }}>
              {targetDesc.description}
            </p>
          )}
        </div>
        <div
          className="flex items-center justify-between gap-4 pt-1.5 border-t"
          style={{ borderColor: colors.tooltipBorder }}
        >
          <span className="text-xs" style={{ color: colors.tooltipMuted }}>
            {t('assessmentModule.drdRadar.gap', { defaultValue: 'Gap' })}
          </span>
          <span className="font-semibold text-sm">
            {gap > 0 ? '+' : ''}
            {gap}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Flagship maturity radar (spider chart): "current state" vs. "target (N+1)"
 * across the assessment dimensions. Theme-token colors (no crimson), bilingual
 * labels, rich per-dimension tooltips. Fail-soft: with fewer than 3 dimensions
 * carrying data, a radar is not meaningful, so nothing is rendered.
 */
export const AssessmentRadarChart: React.FC<AssessmentRadarChartProps> = ({
  data,
  showTarget = true,
  height = 400,
}) => {
  const { t, i18n } = useTranslation('assessment-module');
  const isPolish = i18n.language === 'pl';
  const colors = useAssessmentChartColors();

  const chartData = useMemo<RadarPoint[]>(() => {
    return (data.dimensions ?? []).map((dim) => ({
      axisId: dim.id,
      name: isPolish && dim.namePL ? dim.namePL : dim.name,
      current: dim.current,
      target: dim.target,
      maxLevel: dim.maxLevel,
    }));
  }, [data.dimensions, isPolish]);

  // Fail-soft: a radar needs at least 3 axes with any signal to be legible.
  const hasSignal = chartData.filter((d) => d.current > 0 || d.target > 0).length >= 3;
  if (!hasSignal) return null;

  // Domain top = the largest per-axis scale, so mixed 5/6/7 scales all fit.
  const domainMax = Math.max(5, ...chartData.map((d) => d.maxLevel || 0));

  return (
    <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
        {t('assessmentModule.drdRadar.title', { defaultValue: 'Maturity profile' })}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        {t('assessmentModule.drdRadar.subtitle', {
          defaultValue: 'Current state vs. target (N+1) per dimension',
        })}
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsRadar data={chartData} outerRadius="72%">
          <PolarGrid stroke={colors.grid} gridType="polygon" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, domainMax]}
            tick={{ fill: colors.tick, fontSize: 10 }}
            axisLine={false}
          />
          {showTarget && (
            <Radar
              name={t('assessmentModule.drdRadar.target', { defaultValue: 'Target (N+1)' })}
              dataKey="target"
              stroke={colors.target}
              fill={colors.targetFill}
              fillOpacity={1}
              strokeWidth={2}
              strokeDasharray="5 5"
              isAnimationActive={false}
            />
          )}
          <Radar
            name={t('assessmentModule.drdRadar.current', { defaultValue: 'Current' })}
            dataKey="current"
            stroke={colors.current}
            fill={colors.currentFill}
            fillOpacity={1}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => (
              <span className="text-slate-700 dark:text-slate-300 text-sm">{value}</span>
            )}
          />
          <Tooltip
            content={
              <RadarTooltip
                colors={colors}
                framework={data.framework}
                isPolish={isPolish}
                t={t}
              />
            }
          />
        </RechartsRadar>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================
// GAP HEATMAP COMPONENT
// ============================================

interface GapHeatmapProps {
  data: AssessmentVisualizationData;
  onDimensionClick?: (dimensionId: string) => void;
}

export const GapHeatmap: React.FC<GapHeatmapProps> = ({ data, onDimensionClick }) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const sortedDimensions = useMemo(() => {
    return [...data.dimensions].sort((a, b) => b.target - b.current - (a.target - a.current));
  }, [data.dimensions]);

  const getGapColor = (gap: number): string => {
    if (gap >= 3) return 'bg-danger-500';
    if (gap >= 2) return 'bg-amber-500';
    if (gap >= 1) return 'bg-amber-500';
    if (gap > 0) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const getGapLabel = (gap: number): string => {
    if (gap >= 3) return 'Critical';
    if (gap >= 2) return 'High';
    if (gap >= 1) return 'Medium';
    if (gap > 0) return 'Low';
    return 'On Track';
  };

  return (
    <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Gap Analysis</h3>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-danger-500"></span>
          <span className="text-slate-500 dark:text-slate-400">Critical (≥3)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-500"></span>
          <span className="text-slate-500 dark:text-slate-400">High (2)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-500"></span>
          <span className="text-slate-500 dark:text-slate-400">Medium (1)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500"></span>
          <span className="text-slate-500 dark:text-slate-400">On Track</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="space-y-2">
        {sortedDimensions.map((dim) => {
          const gap = dim.target - dim.current;
          const gapPercent = dim.maxLevel > 0 ? (gap / dim.maxLevel) * 100 : 0;

          return (
            <button
              key={dim.id}
              onClick={() => onDimensionClick?.(dim.id)}
              className="w-full flex items-center gap-4 p-3 bg-white dark:bg-navy-900 rounded-lg hover:bg-navy-750 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {isPolish && dim.namePL ? dim.namePL : dim.name}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${getGapColor(gap)} text-white`}
                  >
                    {getGapLabel(gap)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>Current: {dim.current}</span>
                  <ArrowRight size={12} />
                  <span>Target: {dim.target}</span>
                  <span className="text-slate-500">|</span>
                  <span className={gap > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    Gap: {gap > 0 ? '+' : ''}
                    {gap}
                  </span>
                </div>
              </div>
              <div className="w-24 h-2 bg-navy-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getGapColor(gap)} transition-all`}
                  style={{ width: `${Math.min(100, Math.abs(gapPercent) + 20)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// DIMENSION BARS COMPONENT
// ============================================

interface DimensionBarsProps {
  data: AssessmentVisualizationData;
  height?: number;
}

export const DimensionBars: React.FC<DimensionBarsProps> = ({ data, height = 300 }) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const chartData = useMemo(() => {
    return data.dimensions.map((dim) => ({
      name: isPolish && dim.namePL ? dim.namePL : dim.name,
      current: dim.current,
      target: dim.target,
      gap: dim.target - dim.current,
    }));
  }, [data.dimensions, isPolish]);

  return (
    <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Dimension Comparison
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            width={100}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#f8fafc' }}
          />
          <Legend
            formatter={(value) => (
              <span className="text-slate-700 dark:text-slate-300 text-sm">{value}</span>
            )}
          />
          <Bar dataKey="current" name="Current" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          <Bar dataKey="target" name="Target" fill="#1D9E75" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================
// FULL VISUALIZATION DASHBOARD
// ============================================

interface AssessmentVisualizationDashboardProps {
  data: AssessmentVisualizationData;
  onDimensionClick?: (dimensionId: string) => void;
}

export const AssessmentVisualizationDashboard: React.FC<AssessmentVisualizationDashboardProps> = ({
  data,
  onDimensionClick,
}) => {
  return (
    <div className="space-y-6">
      {/* Score Cards */}
      <ScoreCardsGrid data={data} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AssessmentRadarChart data={data} />
        <GapHeatmap data={data} onDimensionClick={onDimensionClick} />
      </div>

      {/* Dimension Bars */}
      <DimensionBars data={data} />
    </div>
  );
};

export default AssessmentVisualizationDashboard;
