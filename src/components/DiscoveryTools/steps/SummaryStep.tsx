/**
 * SummaryStep - Final step for all tools
 *
 * Displays executive summary, insights, and recommended initiatives.
 */

import { FileText, Lightbulb, Target, TrendingUp } from 'lucide-react';
import React from 'react';

import {
  GrowthPathsData,
  PortfolioPriorityData,
  PorterData,
  RiskUncertaintyData,
  SWOTData,
  ToolSession,
  ToolType,
} from '@/store/useToolStore';

import { PorterRadar } from '../visualizations/PorterRadar';
import { SWOTMatrix } from '../visualizations/SWOTMatrix';

// ==================== TYPES ====================

interface SummaryStepProps {
  toolType: ToolType;
  session: ToolSession;
  isPolish: boolean;
}

// ==================== COMPONENT ====================

export const SummaryStep: React.FC<SummaryStepProps> = ({ toolType, session, isPolish }) => {
  const inputData = session.inputData;
  const initiatives = session.generatedInitiatives;

  // Get summary data based on tool type
  type SummaryData = {
    summary: string;
    insights: string[];
    metrics: Record<string, number>;
  };

  const getSummaryData = (): SummaryData => {
    if (toolType === 'dynamic-swot') {
      const swotData = inputData as SWOTData;
      return {
        summary: swotData.summary?.keyInsights?.join(' ') || '',
        insights: swotData.summary?.keyInsights || [],
        metrics: {
          strengths: swotData.items.filter((i) => i.quadrant === 'strengths').length,
          weaknesses: swotData.items.filter((i) => i.quadrant === 'weaknesses').length,
          opportunities: swotData.items.filter((i) => i.quadrant === 'opportunities').length,
          threats: swotData.items.filter((i) => i.quadrant === 'threats').length,
          correlations: swotData.correlations.length,
        },
      };
    } else if (toolType === 'market-forces') {
      const porterData = inputData as PorterData;
      return {
        summary: porterData.summary?.keyInsights?.join(' ') || '',
        insights: porterData.summary?.keyInsights || [],
        metrics: {
          attractiveness: porterData.overallAttractiveness || 0,
          avgForceScore: Object.values(porterData.forces).reduce((sum, f) => sum + f.score, 0) / 5,
        },
      };
    } else if (toolType === 'growth-paths') {
      const growthData = inputData as GrowthPathsData;
      return {
        summary: growthData.summary?.keyInsights?.join(' ') || '',
        insights: growthData.summary?.keyInsights || [],
        metrics: {
          marketPenetration: growthData.quadrants.marketPenetration.length,
          marketDevelopment: growthData.quadrants.marketDevelopment.length,
          productDevelopment: growthData.quadrants.productDevelopment.length,
          diversification: growthData.quadrants.diversification.length,
        },
      };
    } else if (toolType === 'portfolio-priority') {
      const portfolioData = inputData as PortfolioPriorityData;
      return {
        summary: portfolioData.summary?.keyInsights?.join(' ') || '',
        insights: portfolioData.summary?.keyInsights || [],
        metrics: {
          total: portfolioData.initiatives.length,
          stars: portfolioData.initiatives.filter((i) => i.category === 'star').length,
          cashCows: portfolioData.initiatives.filter((i) => i.category === 'cash-cow').length,
          questionMarks: portfolioData.initiatives.filter((i) => i.category === 'question-mark')
            .length,
          dogs: portfolioData.initiatives.filter((i) => i.category === 'dog').length,
        },
      };
    } else if (toolType === 'risk-uncertainty') {
      const riskData = inputData as RiskUncertaintyData;
      return {
        summary: riskData.summary?.keyInsights?.join(' ') || '',
        insights: riskData.summary?.keyInsights || [],
        metrics: {
          assumptions: riskData.assumptions.length,
          risks: riskData.risks.length,
          scenarios: riskData.scenarios.length,
        },
      };
    } else if (
      ['sop-builder', 'a3-problem-solving', 'smed-planner', 'dms-builder', 'inventory-autopilot'].includes(
        toolType
      )
    ) {
      const operational = inputData as { sections?: Record<string, unknown[]>; summary?: any };
      const sections = (operational.sections || {}) as Record<string, unknown[]>;
      const sectionItems = Object.values(sections);
      const totalItems = sectionItems.reduce(
        (sum, items) => sum + (Array.isArray(items) ? items.length : 0),
        0
      );
      const sectionsWithItems = sectionItems.filter(
        (items) => Array.isArray(items) && items.length > 0
      ).length;
      return {
        summary: operational.summary?.keyInsights?.join(' ') || '',
        insights: operational.summary?.keyInsights || [],
        metrics: {
          totalItems,
          sectionsWithItems,
        },
      };
    }
    return { summary: '', insights: [], metrics: {} };
  };

  const summaryData = getSummaryData();

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isPolish ? 'Podsumowanie i Inicjatywy' : 'Summary & Initiatives'}
        </h2>
      </div>

      {/* Executive Summary */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-2">
          {isPolish ? 'Podsumowanie wykonawcze' : 'Executive Summary'}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {summaryData.summary ||
            (isPolish
              ? 'Kliknij "Generuj analizę" aby otrzymać podsumowanie AI.'
              : 'Click "Generate Analysis" to get an AI summary.')}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {toolType === 'dynamic-swot' && (
          <>
            <MetricCard
              label={isPolish ? 'Mocne strony' : 'Strengths'}
              value={(summaryData.metrics as any).strengths || 0}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Słabe strony' : 'Weaknesses'}
              value={(summaryData.metrics as any).weaknesses || 0}
              color="red"
            />
            <MetricCard
              label={isPolish ? 'Szanse' : 'Opportunities'}
              value={(summaryData.metrics as any).opportunities || 0}
              color="blue"
            />
            <MetricCard
              label={isPolish ? 'Zagrożenia' : 'Threats'}
              value={(summaryData.metrics as any).threats || 0}
              color="amber"
            />
          </>
        )}
        {toolType === 'market-forces' && (
          <>
            <MetricCard
              label={isPolish ? 'Atrakcyjność branży' : 'Industry Attractiveness'}
              value={`${((summaryData.metrics as any).attractiveness || 0).toFixed(1)}/5`}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Śr. siła konkurencji' : 'Avg. Force Score'}
              value={`${((summaryData.metrics as any).avgForceScore || 0).toFixed(1)}/5`}
              color="blue"
            />
          </>
        )}
        {toolType === 'growth-paths' && (
          <>
            <MetricCard
              label={isPolish ? 'Penetracja' : 'Penetration'}
              value={(summaryData.metrics as any).marketPenetration || 0}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Rozwój rynku' : 'Market dev.'}
              value={(summaryData.metrics as any).marketDevelopment || 0}
              color="blue"
            />
            <MetricCard
              label={isPolish ? 'Rozwój produktu' : 'Product dev.'}
              value={(summaryData.metrics as any).productDevelopment || 0}
              color="purple"
            />
            <MetricCard
              label={isPolish ? 'Dywersyfikacja' : 'Diversification'}
              value={(summaryData.metrics as any).diversification || 0}
              color="amber"
            />
          </>
        )}
        {toolType === 'portfolio-priority' && (
          <>
            <MetricCard
              label={isPolish ? 'Stars' : 'Stars'}
              value={(summaryData.metrics as any).stars || 0}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Cash Cows' : 'Cash Cows'}
              value={(summaryData.metrics as any).cashCows || 0}
              color="blue"
            />
            <MetricCard
              label={isPolish ? 'Question Marks' : 'Question Marks'}
              value={(summaryData.metrics as any).questionMarks || 0}
              color="amber"
            />
            <MetricCard
              label={isPolish ? 'Dogs' : 'Dogs'}
              value={(summaryData.metrics as any).dogs || 0}
              color="red"
            />
          </>
        )}
        {toolType === 'risk-uncertainty' && (
          <>
            <MetricCard
              label={isPolish ? 'Założenia' : 'Assumptions'}
              value={(summaryData.metrics as any).assumptions || 0}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Ryzyka' : 'Risks'}
              value={(summaryData.metrics as any).risks || 0}
              color="amber"
            />
            <MetricCard
              label={isPolish ? 'Scenariusze' : 'Scenarios'}
              value={(summaryData.metrics as any).scenarios || 0}
              color="blue"
            />
          </>
        )}
        {['sop-builder', 'a3-problem-solving', 'smed-planner', 'dms-builder', 'inventory-autopilot'].includes(
          toolType
        ) && (
          <>
            <MetricCard
              label={isPolish ? 'Elementy' : 'Items'}
              value={(summaryData.metrics as any).totalItems || 0}
              color="emerald"
            />
            <MetricCard
              label={isPolish ? 'Sekcje' : 'Sections'}
              value={(summaryData.metrics as any).sectionsWithItems || 0}
              color="blue"
            />
          </>
        )}
      </div>

      {/* Visualization */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-4">
          {isPolish ? 'Wizualizacja' : 'Visualization'}
        </h3>
        {toolType === 'dynamic-swot' && (
          <SWOTMatrix data={inputData as SWOTData} isPolish={isPolish} />
        )}
        {toolType === 'market-forces' && (
          <PorterRadar data={inputData as PorterData} isPolish={isPolish} />
        )}
        {toolType === 'growth-paths' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Podsumowanie ścieżek wzrostu znajduje się w metrykach powyżej.'
              : 'Growth paths summary is reflected in the metrics above.'}
          </div>
        )}
        {toolType === 'portfolio-priority' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Macierz BCG jest dostępna w kroku Portfolio Matrix.'
              : 'BCG matrix is available in the Portfolio Matrix step.'}
          </div>
        )}
        {toolType === 'risk-uncertainty' && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Podsumowanie ryzyk jest widoczne w metrykach powyżej.'
              : 'Risk summary is reflected in the metrics above.'}
          </div>
        )}
        {['sop-builder', 'a3-problem-solving', 'smed-planner', 'dms-builder', 'inventory-autopilot'].includes(
          toolType
        ) && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Podsumowanie operacyjne jest widoczne w metrykach powyżej.'
              : 'Operational summary is reflected in the metrics above.'}
          </div>
        )}
      </div>

      {/* Key Insights */}
      {summaryData.insights.length > 0 && (
        <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary-500" />
            {isPolish ? 'Kluczowe wnioski' : 'Key Insights'}
          </h3>
          <ul className="space-y-2">
            {summaryData.insights.map((insight: string, index: number) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
              >
                <span className="text-primary-500">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Initiatives */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          {isPolish ? 'Rekomendowane inicjatywy' : 'Recommended Initiatives'}
        </h3>
        {initiatives.length > 0 ? (
          <div className="space-y-3">
            {initiatives.map((initiative) => (
              <div
                key={initiative.id}
                className="p-3 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">
                      {initiative.title}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {initiative.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        initiative.type === 'strategic'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : initiative.type === 'operational'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : initiative.type === 'defensive'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      }`}
                    >
                      {initiative.type}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span>Impact: {initiative.estimatedImpact}</span>
                  <span>Effort: {initiative.estimatedEffort}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            {isPolish
              ? 'Kliknij "Generuj analizę" aby otrzymać rekomendacje inicjatyw.'
              : 'Click "Generate Analysis" to get initiative recommendations.'}
          </p>
        )}
      </div>
    </div>
  );
};

// Metric card helper component
const MetricCard: React.FC<{
  label: string;
  value: number | string;
  color: string;
}> = ({ label, value, color }) => (
  <div
    className={`p-4 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800`}
  >
    <div className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</div>
    <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
  </div>
);

export default SummaryStep;
