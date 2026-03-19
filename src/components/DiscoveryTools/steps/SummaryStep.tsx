/**
 * SummaryStep - Final step for all tools
 *
 * Displays final source summary, insights, and recommended initiatives.
 */

import { Check, FileText, Lightbulb, Target, TrendingUp } from 'lucide-react';
import React from 'react';

import { computeDynamicSwotOverallReadiness } from '@/components/DiscoveryTools/toolCompletion';
import {
  GrowthPathsData,
  InitiativeDraft,
  PorterData,
  PortfolioPriorityData,
  ProposalCardType,
  RiskUncertaintyData,
  SWOTData,
  ToolSession,
  ToolType,
  useToolStore,
} from '@/store/useToolStore';

import { ProposalCard } from '../shared/ProposalCard';
import { PorterRadar } from '../visualizations/PorterRadar';

// ==================== TYPES ====================

interface SummaryStepProps {
  toolType: ToolType;
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}

// ==================== COMPONENT ====================

export const SummaryStep: React.FC<SummaryStepProps> = ({ toolType, session, isPolish, onAcceptCard, onRejectCard, onRethinkCard }) => {
  const { acceptCard, rejectCard, acceptAllInPhase } = useToolStore();
  const inputData = session.inputData;
  const initiatives = session.generatedInitiatives;

  // Get summary data based on tool type
  type SummaryData = {
    summary: string;
    insights: string[];
    appliedConclusions: string[];
    initiatives: InitiativeDraft[];
    metrics: Record<string, number>;
  };

  const getSummaryData = (): SummaryData => {
    if (toolType === 'dynamic-swot') {
      const swotData = inputData as SWOTData;
      const swotSummary = swotData.summary;
      const recommendedInitiatives = swotSummary?.recommendedInitiatives || [];
      return {
        summary: swotSummary?.executiveSummary || swotSummary?.keyInsights?.join(' ') || '',
        insights: swotSummary?.keyInsights || [],
        appliedConclusions: swotSummary?.appliedConclusions || [],
        initiatives: recommendedInitiatives.length > 0 ? recommendedInitiatives : initiatives,
        metrics: {
          strengths: swotData.items.filter((i) => i.quadrant === 'strengths').length,
          weaknesses: swotData.items.filter((i) => i.quadrant === 'weaknesses').length,
          opportunities: swotData.items.filter((i) => i.quadrant === 'opportunities').length,
          threats: swotData.items.filter((i) => i.quadrant === 'threats').length,
          tensions: swotData.tensions?.length || swotData.correlations.length,
          moves: swotData.recommendedMoves?.length || 0,
          outputs: swotData.outputCandidates?.length || 0,
        },
      };
    } else if (toolType === 'market-forces') {
      const porterData = inputData as PorterData;
      return {
        summary: porterData.summary?.keyInsights?.join(' ') || '',
        insights: porterData.summary?.keyInsights || [],
        appliedConclusions:
          (porterData.summary as { appliedConclusions?: string[] } | undefined)
            ?.appliedConclusions || [],
        initiatives: porterData.summary?.recommendedInitiatives || initiatives,
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
        appliedConclusions:
          (growthData.summary as { appliedConclusions?: string[] } | undefined)
            ?.appliedConclusions || [],
        initiatives: growthData.summary?.recommendedInitiatives || initiatives,
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
        appliedConclusions:
          (portfolioData.summary as { appliedConclusions?: string[] } | undefined)
            ?.appliedConclusions || [],
        initiatives: portfolioData.summary?.recommendedInitiatives || initiatives,
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
        appliedConclusions:
          (riskData.summary as { appliedConclusions?: string[] } | undefined)?.appliedConclusions ||
          [],
        initiatives: riskData.summary?.recommendedInitiatives || initiatives,
        metrics: {
          assumptions: riskData.assumptions.length,
          risks: riskData.risks.length,
          scenarios: riskData.scenarios.length,
        },
      };
    } else if (
      [
        'sop-builder',
        'a3-problem-solving',
        'smed-planner',
        'dms-builder',
        'inventory-autopilot',
      ].includes(toolType)
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
        appliedConclusions: operational.summary?.appliedConclusions || [],
        initiatives: operational.summary?.recommendedInitiatives || initiatives,
        metrics: {
          totalItems,
          sectionsWithItems,
        },
      };
    }
    return { summary: '', insights: [], appliedConclusions: [], initiatives, metrics: {} };
  };

  const summaryData = getSummaryData();

  if (toolType === 'dynamic-swot') {
    const swotData = inputData as SWOTData;
    const readiness = computeDynamicSwotOverallReadiness(swotData, isPolish);
    const readinessBuckets = {
      initiative: swotData.outputCandidates.filter(
        (candidate) => candidate.readiness === 'ready-for-initiative'
      ),
      presentation: swotData.outputCandidates.filter(
        (candidate) => candidate.readiness === 'ready-for-presentation'
      ),
      report: swotData.outputCandidates.filter(
        (candidate) => candidate.readiness === 'ready-for-report'
      ),
      idea: swotData.outputCandidates.filter((candidate) => candidate.readiness === 'keep-as-idea'),
      blocked: swotData.outputCandidates.filter((candidate) => candidate.readiness === 'blocked'),
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
            <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {isPolish ? 'Outputs & Actions' : 'Outputs & Actions'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {isPolish
                ? 'Ta faza zamienia materiał źródłowy w gotowe ścieżki decyzyjne i outputy.'
                : 'This phase turns the source material into decision routes and downstream outputs.'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            label={isPolish ? 'Readiness' : 'Readiness'}
            value={readiness.label}
            color={
              readiness.readiness === 'ready'
                ? 'emerald'
                : readiness.readiness === 'needs-work'
                  ? 'amber'
                  : 'red'
            }
          />
          <MetricCard
            label={isPolish ? 'Output candidates' : 'Output candidates'}
            value={swotData.outputCandidates.length}
            color="blue"
          />
          <MetricCard
            label={isPolish ? 'Moves' : 'Moves'}
            value={swotData.recommendedMoves.length}
            color="purple"
          />
          <MetricCard
            label={isPolish ? 'Initiatives drafts' : 'Initiative drafts'}
            value={summaryData.initiatives.length}
            color="emerald"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-800">
          <h3 className="mb-2 font-medium text-slate-900 dark:text-white">
            {isPolish ? 'Final source summary' : 'Final source summary'}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {summaryData.summary ||
              (isPolish
                ? 'Kliknij "Generuj analizę", aby otrzymać podsumowanie i routing outputów.'
                : 'Click "Generate Analysis" to create the summary and output routing.')}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
                <h3 className="font-medium text-slate-900 dark:text-white">
                  {isPolish ? 'Readiness checklist' : 'Readiness checklist'}
                </h3>
              </div>
              <div className="space-y-2">
                {[
                  {
                    label: isPolish ? 'Mission brief jest jasny' : 'Mission brief is clear',
                    done:
                      !!swotData.context.goal &&
                      !!swotData.context.scope &&
                      !!swotData.context.successSignal,
                  },
                  {
                    label: isPolish
                      ? 'Istnieją napięcia lub korelacje'
                      : 'Tensions or correlations exist',
                    done: swotData.tensions.length > 0 || swotData.correlations.length > 0,
                  },
                  {
                    label: isPolish ? 'Istnieją rekomendowane ruchy' : 'Recommended moves exist',
                    done: swotData.recommendedMoves.length > 0,
                  },
                  {
                    label: isPolish ? 'Summary gotowe' : 'Summary ready',
                    done: !!swotData.summary?.executiveSummary,
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={`h-2 w-2 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    />
                    <span
                      className={
                        item.done
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-500 dark:text-slate-400'
                      }
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-500" />
                <h3 className="font-medium text-slate-900 dark:text-white">
                  {isPolish ? 'Move-to-output bridge' : 'Move-to-output bridge'}
                </h3>
              </div>
              {swotData.recommendedMoves.length > 0 ? (
                <div className="space-y-3">
                  {swotData.recommendedMoves.slice(0, 4).map((move) => (
                    <div
                      key={move.id}
                      className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-navy-700/70 dark:bg-navy-950/40"
                    >
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {move.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {move.category}
                      </div>
                      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {move.rationale}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Brak ruchów do zmapowania na outputy.'
                    : 'No moves to bridge into outputs yet.'}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                label: isPolish ? 'Ready for initiative' : 'Ready for initiative',
                items: readinessBuckets.initiative,
              },
              {
                label: isPolish ? 'Ready for presentation' : 'Ready for presentation',
                items: readinessBuckets.presentation,
              },
              {
                label: isPolish ? 'Ready for report' : 'Ready for report',
                items: readinessBuckets.report,
              },
              { label: isPolish ? 'Keep as idea' : 'Keep as idea', items: readinessBuckets.idea },
              { label: isPolish ? 'Blocked' : 'Blocked', items: readinessBuckets.blocked },
            ].map((bucket) => (
              <div
                key={bucket.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-800"
              >
                <div className="mb-2 text-sm font-medium text-slate-900 dark:text-white">
                  {bucket.label}
                </div>
                {bucket.items.length > 0 ? (
                  <div className="space-y-2">
                    {bucket.items.map((candidate) => {
                      const isProposal = candidate.proposalStatus === 'ai-proposed' || candidate.proposalStatus === 'rethinking';
                      const candidateContent = (
                        <div>
                          <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                            {candidate.title}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                            {candidate.outputType}
                          </div>
                          {candidate.description && (
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {candidate.description}
                            </div>
                          )}
                        </div>
                      );

                      if (isProposal) {
                        return (
                          <ProposalCard
                            key={candidate.id}
                            cardId={candidate.id}
                            cardType="output-candidate"
                            proposalStatus={candidate.proposalStatus}
                            onAccept={onAcceptCard || acceptCard}
                            onReject={onRejectCard || rejectCard}
                            onRethink={onRethinkCard || (() => {})}
                            compact
                          >
                            {candidateContent}
                          </ProposalCard>
                        );
                      }

                      return (
                        <div
                          key={candidate.id}
                          className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/40 dark:text-slate-300"
                        >
                          {candidateContent}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Brak kandydatów w tej ścieżce.' : 'No candidates in this route.'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isPolish ? 'Final Summary i inicjatywy' : 'Final Summary & Initiatives'}
        </h2>
      </div>

      {/* Executive Summary */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-2">
          {isPolish ? 'Final source summary' : 'Final source summary'}
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
        {[
          'sop-builder',
          'a3-problem-solving',
          'smed-planner',
          'dms-builder',
          'inventory-autopilot',
        ].includes(toolType) && (
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
        {[
          'sop-builder',
          'a3-problem-solving',
          'smed-planner',
          'dms-builder',
          'inventory-autopilot',
        ].includes(toolType) && (
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

      {summaryData.appliedConclusions.length > 0 && (
        <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-500" />
            {isPolish ? 'Wnioski aplikowane' : 'Applied Conclusions'}
          </h3>
          <ul className="space-y-2">
            {summaryData.appliedConclusions.map((conclusion: string, index: number) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
              >
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{conclusion}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Jeśli coś tu jest nieprecyzyjne, wróć do rozmowy z AI i doprecyzuj wnioski przed generowaniem outputów.'
              : 'If anything here feels too vague, go back to the AI conversation and refine the conclusions before generating outputs.'}
          </div>
        </div>
      )}

      {/* Recommended Initiatives */}
      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          {isPolish ? 'Rekomendowane inicjatywy' : 'Recommended Initiatives'}
        </h3>
        {summaryData.initiatives.length > 0 ? (
          <div className="space-y-3">
            {summaryData.initiatives.map((initiative) => (
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
