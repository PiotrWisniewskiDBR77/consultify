/**
 * Analysis Compare View
 *
 * Side-by-side comparison of multiple digitization analyses
 */

import {
  BarChart3,
  Building,
  Database,
  GitCompare,
  List,
  Package,
  PieChart,
  Plus,
  Search,
  Shield,
  TrendingUp,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DIGITIZATION_AXES, getLevelColor } from '../../data/digitizationEvaluationData';
import { Api } from '../../services/api';
import { AnalysisDataSeries, ComparisonRadarChart } from '../Charts';
import { LoadingState } from '../ui/primitives';
import { useFinanceChartColors } from './financeChartTokens';
import { DigitizationAnalysis } from './types';

const AXIS_ICONS: Record<string, any> = {
  digital_processes: Workflow,
  digital_products: Package,
  digital_business_models: Building,
  big_data: Database,
  transformation_culture: Users,
  cybersecurity: Shield,
};

export const AnalysisCompareView: React.FC = () => {
  // Categorical series palette = the shared `--c-tag-*` ramp (theme-aware).
  // The brand accent is deliberately NOT in the data-series ramp (no crimson-leak).
  const ANALYSIS_COLORS = useFinanceChartColors().ramp;
  const [availableAnalyses, setAvailableAnalyses] = useState<DigitizationAnalysis[]>([]);
  const [selectedAnalyses, setSelectedAnalyses] = useState<DigitizationAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  const [viewMode, setViewMode] = useState<'bar' | 'radar'>('radar');

  const loadAnalyses = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await Api.getDigitizationAnalyses({ pageSize: 100 });
      setAvailableAnalyses(result.analyses || []);
    } catch (e) {
      toast.error('Failed to load analyses');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const addAnalysis = (analysis: DigitizationAnalysis) => {
    if (selectedAnalyses.length >= 4) {
      toast.error('Maximum 4 analyses for comparison');
      return;
    }
    if (selectedAnalyses.find((a) => a.id === analysis.id)) {
      toast.error('This analysis is already selected');
      return;
    }
    setSelectedAnalyses([...selectedAnalyses, analysis]);
    setShowSelector(false);
  };

  const removeAnalysis = (id: string) => {
    setSelectedAnalyses(selectedAnalyses.filter((a) => a.id !== id));
  };

  // Prepare data for radar chart
  const radarData: AnalysisDataSeries[] = useMemo(() => {
    return selectedAnalyses.map((analysis, index) => {
      const scores: Record<string, number> = {};
      DIGITIZATION_AXES.forEach((axis) => {
        scores[axis.id] = analysis.axisScores?.[axis.id]?.currentScore || 0;
      });
      return {
        id: analysis.id,
        name: analysis.name,
        color: ANALYSIS_COLORS[index % ANALYSIS_COLORS.length],
        scores,
      };
    });
  }, [selectedAnalyses, ANALYSIS_COLORS]);

  const axisLabels: Record<string, string> = useMemo(() => {
    const labels: Record<string, string> = {};
    DIGITIZATION_AXES.forEach((axis) => {
      // Shorten labels for radar chart
      labels[axis.id] =
        axis.namePl.length > 15 ? axis.namePl.substring(0, 13) + '...' : axis.namePl;
    });
    return labels;
  }, []);

  if (isLoading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <GitCompare className="text-primary-500" />
            Compare Analyses
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Compare up to 4 digital maturity analyses
          </p>
        </div>
        {selectedAnalyses.length < 4 && (
          <button
            onClick={() => setShowSelector(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF]
                            text-white dark:text-navy-950 rounded-xl font-medium transition-colors"
          >
            <Plus size={16} />
            Dodaj analysis
          </button>
        )}
      </div>

      {/* Selected Analyses */}
      {selectedAnalyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-primary-500/10 rounded-xl flex items-center justify-center mb-4">
            <GitCompare size={32} className="text-primary-500" />
          </div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">
            No wybranych analyses
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-md">
            Select at least 2 analyses to start comparison
          </p>
          <button
            onClick={() => setShowSelector(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF]
                            text-white dark:text-navy-950 rounded-xl font-medium transition-colors"
          >
            <Plus size={16} />
            Dodaj analysis
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Analysis Cards Row */}
          <div className={`grid gap-4 grid-cols-${Math.min(selectedAnalyses.length, 4)}`}>
            {selectedAnalyses.map((analysis) => (
              <div
                key={analysis.id}
                className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 relative"
              >
                <button
                  onClick={() => removeAnalysis(analysis.id)}
                  className="absolute top-2 right-2 p-1 text-slate-600 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <BarChart3 size={20} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-navy-900 dark:text-white truncate">
                      {analysis.name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-500">
                      {new Date(analysis.createdAt).toLocaleDateString('pl-PL')}
                    </p>
                  </div>
                </div>
                <div className="text-center py-3 bg-slate-50 dark:bg-navy-900/50 rounded-lg">
                  <p className="text-3xl font-bold text-emerald-500">
                    {analysis.overallScore?.toFixed(1) || '0'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">overall score</p>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison Charts */}
          {selectedAnalyses.length >= 2 && (
            <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                  Comparison per axis
                </h3>
                {/* View toggle */}
                <div className="flex items-center bg-slate-100 dark:bg-navy-900/50 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('radar')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'radar'
                        ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <PieChart size={14} />
                    Radar
                  </button>
                  <button
                    onClick={() => setViewMode('bar')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'bar'
                        ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <List size={14} />
                    Tabela
                  </button>
                </div>
              </div>

              {viewMode === 'radar' ? (
                <ComparisonRadarChart
                  analyses={radarData}
                  axisLabels={axisLabels}
                  height={400}
                  showLegend={false}
                />
              ) : (
                <div className="space-y-4">
                  {DIGITIZATION_AXES.map((axis) => {
                    const Icon = AXIS_ICONS[axis.id] || Workflow;
                    return (
                      <div key={axis.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center"
                            style={{ backgroundColor: `${axis.color}20` }}
                          >
                            <Icon size={14} style={{ color: axis.color }} />
                          </div>
                          <span className="text-sm font-medium text-navy-900 dark:text-white">
                            {axis.namePl}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {selectedAnalyses.map((analysis, index) => {
                            const score = analysis.axisScores?.[axis.id]?.currentScore || 0;
                            return (
                              <div key={analysis.id} className="flex items-center gap-2">
                                <span className="w-24 text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {analysis.name}
                                </span>
                                <div className="flex-1 h-4 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${(score / 7) * 100}%`,
                                      backgroundColor:
                                        ANALYSIS_COLORS[index % ANALYSIS_COLORS.length],
                                    }}
                                  />
                                </div>
                                <span
                                  className="w-12 text-sm font-medium text-right"
                                  style={{
                                    color: ANALYSIS_COLORS[index % ANALYSIS_COLORS.length],
                                  }}
                                >
                                  {score.toFixed(1)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Analysis Selector Modal */}
      {showSelector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
              <h3 className="font-bold text-navy-900 dark:text-white">Select analysis</h3>
              <button
                onClick={() => setShowSelector(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg"
              >
                <X size={20} className="text-slate-600 dark:text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {availableAnalyses
                  .filter((a) => !selectedAnalyses.find((s) => s.id === a.id))
                  .map((analysis) => (
                    <button
                      key={analysis.id}
                      onClick={() => addAnalysis(analysis)}
                      className="w-full text-left p-3 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <BarChart3 size={20} className="text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-navy-900 dark:text-white truncate">
                            {analysis.name}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-500">
                            Wynik: {analysis.overallScore?.toFixed(1) || '0'}/7 •
                            {new Date(analysis.createdAt).toLocaleDateString('pl-PL')}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisCompareView;
