/**
 * Analysis Results Panel
 *
 * Visualization of digitization analysis results
 * Features radar chart, gap analysis, and recommendations
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Building,
  CheckCircle,
  Database,
  Package,
  PieChart,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { DIGITIZATION_AXES, getLevelColor } from '../../data/digitizationEvaluationData';
import { RadarChart, RadarDataPoint } from '../Charts';
import { useFinanceChartColors } from './financeChartTokens';
import { DigitizationAnalysis } from './types';

interface AnalysisResultsPanelProps {
  analysis: DigitizationAnalysis;
}

const AXIS_ICONS: Record<string, any> = {
  digital_processes: Workflow,
  digital_products: Package,
  digital_business_models: Building,
  big_data: Database,
  transformation_culture: Users,
  cybersecurity: Shield,
};

export const AnalysisResultsPanel: React.FC<AnalysisResultsPanelProps> = ({ analysis }) => {
  const chart = useFinanceChartColors();
  const axisData = useMemo(() => {
    return DIGITIZATION_AXES.map((axis) => {
      const score = analysis.axisScores?.[axis.id];
      return {
        ...axis,
        currentScore: score?.currentScore || 0,
        targetScore: score?.targetScore || 0,
        gap: score?.gap || 0,
        completedAreas: score?.completedAreas || 0,
        totalAreas: score?.totalAreas || axis.areas.length,
      };
    });
  }, [analysis.axisScores]);

  const topGaps = useMemo(() => {
    return [...axisData]
      .filter((a) => a.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3);
  }, [axisData]);

  const overallStats = useMemo(() => {
    const avgCurrent = axisData.reduce((sum, a) => sum + a.currentScore, 0) / axisData.length;
    const avgTarget = axisData.reduce((sum, a) => sum + a.targetScore, 0) / axisData.length;
    const avgGap = avgTarget - avgCurrent;
    return { avgCurrent, avgTarget, avgGap };
  }, [axisData]);

  // Prepare data for radar chart
  const radarData: RadarDataPoint[] = useMemo(() => {
    return axisData.map((axis) => ({
      axis: axis.namePl.length > 20 ? axis.namePl.substring(0, 18) + '...' : axis.namePl,
      axisId: axis.id,
      current: axis.currentScore,
      target: axis.targetScore,
      fullMark: 7,
    }));
  }, [axisData]);

  return (
    <div className="p-6 space-y-6">
      {/* Overall Score Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-sm">Overall Maturity Score</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-5xl font-bold">{analysis.overallScore?.toFixed(1) || '0'}</span>
              <span className="text-2xl text-emerald-200">/7</span>
            </div>
            <p className="text-emerald-100 text-sm mt-2">
              {analysis.completionPercent || 0}% areas ocenionych
            </p>
          </div>
          <div className="text-right">
            <div className="w-32 h-32 relative">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="white"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${((analysis.overallScore || 0) / 7) * 352} 352`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">
                  {Math.round(((analysis.overallScore || 0) / 7) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Medium poziom aktualny"
          value={overallStats.avgCurrent.toFixed(1)}
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          label="Medium poziom docelowy"
          value={overallStats.avgTarget.toFixed(1)}
          icon={Target}
          color="purple"
        />
        <StatCard
          label="Mediuma luka"
          value={overallStats.avgGap.toFixed(1)}
          icon={overallStats.avgGap > 1.5 ? AlertTriangle : CheckCircle}
          color={overallStats.avgGap > 1.5 ? 'orange' : 'green'}
        />
      </div>

      {/* Radar Chart Visualization */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <PieChart size={20} className="text-blue-500" />
            Maturity Radar Chart
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-slate-500 dark:text-slate-400">Aktualny poziom</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-transparent" />
              <span className="text-slate-500 dark:text-slate-400">Poziom docelowy</span>
            </div>
          </div>
        </div>
        <RadarChart
          data={radarData}
          height={350}
          showLegend={true}
          showTarget={true}
          currentColor={chart.net}
          targetColor={chart.actual}
        />
      </div>

      {/* Axis Breakdown */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">Wyniki per axis</h3>
        <div className="space-y-4">
          {axisData.map((axis) => {
            const Icon = AXIS_ICONS[axis.id] || Workflow;
            const progress = (axis.currentScore / 7) * 100;
            const targetProgress = (axis.targetScore / 7) * 100;

            return (
              <div key={axis.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${axis.color}20` }}
                    >
                      <Icon size={16} style={{ color: axis.color }} />
                    </div>
                    <span className="font-medium text-navy-900 dark:text-white">{axis.namePl}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                      {axis.completedAreas}/{axis.totalAreas} areas
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold" style={{ color: axis.color }}>
                        {axis.currentScore.toFixed(1)}
                      </span>
                      <ArrowRight size={14} className="text-slate-600 dark:text-slate-500" />
                      <span className="text-slate-500 dark:text-slate-400">
                        {axis.targetScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="relative h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                  {/* Target marker */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-slate-400 dark:bg-white/30 z-10"
                    style={{ left: `${targetProgress}%` }}
                  />
                  {/* Current progress */}
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: axis.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Gaps */}
      {topGaps.length > 0 && (
        <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} />
            Biggest Gaps to Address
          </h3>
          <div className="space-y-3">
            {topGaps.map((axis, index) => {
              const Icon = AXIS_ICONS[axis.id] || Workflow;
              return (
                <div
                  key={axis.id}
                  className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-600 font-bold">
                    {index + 1}
                  </div>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${axis.color}20` }}
                  >
                    <Icon size={20} style={{ color: axis.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-navy-900 dark:text-white">{axis.namePl}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Aktualnie: {axis.currentScore.toFixed(1)} → Cel: {axis.targetScore.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-600">-{axis.gap.toFixed(1)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">levels luki</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Maturity Level Legend */}
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">
          Maturity Levels Legend
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((level) => (
            <div key={level} className="text-center">
              <div
                className="w-full aspect-square rounded-xl flex items-center justify-center text-white font-bold text-lg mb-2"
                style={{ backgroundColor: getLevelColor(level) }}
              >
                {level}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {level === 1 && 'Rejestracja'}
                {level === 2 && 'Kontrola stanowiska'}
                {level === 3 && 'Kontrola procesu'}
                {level === 4 && 'Automatyzacja'}
                {level === 5 && 'MES'}
                {level === 6 && 'ERP'}
                {level === 7 && 'Algorytmy'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string;
  icon: any;
  color: string;
}> = ({ label, value, icon: Icon, color }) => {
  const colors: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
    purple: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
    green: { bg: 'bg-green-500/10', text: 'text-green-500' },
    orange: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  };

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg ${colors[color].bg} flex items-center justify-center`}
        >
          <Icon size={20} className={colors[color].text} />
        </div>
        <div>
          <p className="text-2xl font-bold text-navy-900 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResultsPanel;
