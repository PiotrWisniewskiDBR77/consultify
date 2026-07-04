import { Loader2, Sparkles, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { PortfolioInitiative } from '../../types';

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

export function PortfolioAiPanel(props: {
  selected: PortfolioInitiative[];
  onQuickUpdate: (id: string, updates: Partial<PortfolioInitiative>) => void;
  onClose: () => void;
}) {
  const { selected, onQuickUpdate, onClose } = props;
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [overlap, setOverlap] = useState<any[]>([]);
  const [nonHuman, setNonHuman] = useState<any | null>(null);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(false);

  const aiInitiativesPayload = useMemo(
    () =>
      selected.map((initiative) => {
        const owner = initiative.ownerBusiness || initiative.ownerExecution;
        return {
          id: initiative.id,
          name: initiative.name,
          priority: initiative.priority,
          owner: owner ? `${owner.firstName} ${owner.lastName}` : undefined,
          expectedRoi: initiative.expectedRoi,
          plannedStartDate: initiative.plannedStartDate,
          plannedEndDate: initiative.plannedEndDate,
        };
      }),
    [selected]
  );

  const normalizeRecommendedPriority = (p: unknown): PortfolioInitiative['priority'] | null => {
    const raw = String(p || '')
      .trim()
      .toUpperCase();
    if (raw === 'CRITICAL') return 'CRITICAL';
    if (raw === 'HIGH') return 'HIGH';
    if (raw === 'MEDIUM') return 'MEDIUM';
    if (raw === 'LOW') return 'LOW';
    return null;
  };

  const run = async () => {
    if (selected.length === 0) {
      toast.error(t('portfolio.ai.noSelection', 'Select at least one initiative.'));
      return;
    }
    setLoading(true);
    setConflicts([]);
    setPriorities([]);
    setOverlap([]);
    setNonHuman(null);
    setScenarios([]);

    trackFunnelEvent('portfolio_ai_analysis_requested', {
      countInitiatives: selected.length,
      mode: 'full',
    });

    const ids = selected.map((i) => i.id);
    const settled = await Promise.allSettled([
      Api.post('/ai/initiatives/conflicts', { initiatives: aiInitiativesPayload }),
      Api.post('/ai/initiatives/priorities', { initiatives: aiInitiativesPayload }),
      selected.length >= 2
        ? Api.post('/portfolio-optimization/overlap', {
            initiatives: selected.map((i) => ({
              id: i.id,
              name: i.name,
              summary: i.summary,
              description: i.description,
            })),
          })
        : Promise.resolve({ suggestions: [] }),
      Api.post('/portfolio-optimization/nonhuman/analyze', { initiativeIds: ids }),
    ]);

    const [conflictsRes, prioritiesRes, overlapRes, nonHumanRes] = settled;

    if (conflictsRes.status === 'fulfilled') {
      const data: any = conflictsRes.value;
      setConflicts(
        Array.isArray(data?.conflicts) ? data.conflicts : Array.isArray(data) ? data : []
      );
    } else {
      toast.error(t('portfolio.ai.conflictsError', 'Failed to analyze conflicts.'));
    }

    if (prioritiesRes.status === 'fulfilled') {
      const data: any = prioritiesRes.value;
      setPriorities(
        Array.isArray(data?.priorities) ? data.priorities : Array.isArray(data) ? data : []
      );
    } else {
      toast.error(t('portfolio.ai.prioritiesError', 'Failed to generate priority suggestions.'));
    }

    if (overlapRes.status === 'fulfilled') {
      const data: any = overlapRes.value;
      setOverlap(
        Array.isArray(data?.suggestions) ? data.suggestions : Array.isArray(data) ? data : []
      );
    } else {
      toast.error(t('portfolio.ai.overlapError', 'Failed to detect overlap suggestions.'));
    }

    if (nonHumanRes.status === 'fulfilled') {
      const data: any = nonHumanRes.value;
      setNonHuman(data || null);
      trackFunnelEvent('portfolio_nonhuman_resources_viewed', { countInitiatives: ids.length });
    } else {
      toast.error(t('portfolio.ai.nonhumanError', 'Failed to analyze non-human resources.'));
    }

    setLoading(false);
  };

  const applyPrioritySuggestion = async (suggestion: any) => {
    const name = String(suggestion?.name || '');
    const initiative = selected.find((i) => i.name === name);
    const newPriority = normalizeRecommendedPriority(suggestion?.recommendedPriority);
    if (!initiative || !newPriority) {
      toast.error(t('portfolio.ai.applyFailed', 'Failed to apply suggestion.'));
      return;
    }

    onQuickUpdate(initiative.id, { priority: newPriority });
    trackFunnelEvent('portfolio_ai_suggestion_applied', {
      type: 'priority',
      initiativeId: initiative.id,
    });
    try {
      await Api.post('/portfolio-optimization/audit', {
        actionType: 'portfolio_ai_suggestion_applied',
        resourceType: 'initiative',
        resourceId: initiative.id,
        details: {
          type: 'priority',
          from: initiative.priority,
          to: newPriority,
          rationale: suggestion?.rationale,
        },
      });
    } catch {
      // best-effort
    }
    toast.success(t('portfolio.ai.priorityApplied', 'Priority updated.'));
  };

  const quarterStartEnd = (year: number, quarterNum: number) => {
    const start = new Date(year, (quarterNum - 1) * 3, 1);
    const end = new Date(year, quarterNum * 3, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const generateHeuristicSchedule = (
    ordered: PortfolioInitiative[],
    maxPerQuarter: number,
    labelPrefix: 'time' | 'budget' | 'balanced'
  ) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;

    const schedule: Array<{
      id: string;
      name: string;
      quarter: string;
      plannedStartDate: string;
      plannedEndDate: string;
    }> = [];
    let index = 0;
    for (const initiative of ordered) {
      const slot = Math.floor(index / maxPerQuarter);
      const qNum = ((currentQuarter - 1 + slot) % 4) + 1;
      const year = currentYear + Math.floor((currentQuarter - 1 + slot) / 4);
      const { start, end } = quarterStartEnd(year, qNum);
      schedule.push({
        id: initiative.id,
        name: initiative.name,
        quarter: `Q${qNum} ${year}`,
        plannedStartDate: start,
        plannedEndDate: end,
      });
      index += 1;
    }

    const summary =
      labelPrefix === 'time'
        ? t(
            'portfolio.ai.scenarioTimeSummary',
            'Prioritizes earlier delivery by pulling key items forward.'
          )
        : labelPrefix === 'budget'
          ? t(
              'portfolio.ai.scenarioBudgetSummary',
              'Spreads work to reduce quarterly budget spikes (conservative capacity).'
            )
          : t(
              'portfolio.ai.scenarioBalancedSummary',
              'Balances quick wins and workload distribution.'
            );

    return { schedule, summary };
  };

  const buildScenarioBudgets = (schedule: Array<{ id: string; quarter?: string }>) => {
    if (!nonHuman) return undefined;
    const byQuarter = Array.isArray(nonHuman?.budgetByQuarter) ? nonHuman.budgetByQuarter : [];
    if (byQuarter.length > 0) {
      return byQuarter.map((b: any) => ({
        quarter: String(b.quarter),
        currency: String(b.currency || 'PLN'),
        total: Number(b.total || 0),
      }));
    }
    return undefined;
  };

  const generateScenarios = async () => {
    if (selected.length === 0) return;
    setScenariosLoading(true);
    trackFunnelEvent('portfolio_timeline_optimization_requested', {
      countInitiatives: selected.length,
      scenarios: 3,
    });
    trackFunnelEvent('portfolio_scenario_optimization_requested', {
      constraintsType: 'default',
      countInitiatives: selected.length,
    });

    try {
      const response: any = await Api.post('/ai/initiatives/schedule', {
        initiatives: aiInitiativesPayload.map((i) => ({
          id: i.id,
          name: i.name,
          priority: i.priority,
          expectedRoi: i.expectedRoi,
        })),
      });

      const balancedSchedule = Array.isArray(response?.schedule) ? response.schedule : [];
      const byPriority = [...selected].sort(
        (a, b) => (PRIORITY_ORDER[a.priority] || 99) - (PRIORITY_ORDER[b.priority] || 99)
      );
      const timeBoxed = generateHeuristicSchedule(byPriority, 4, 'time');
      const byBudget = [...selected].sort((a, b) => Number(a.budget || 0) - Number(b.budget || 0));
      const budgetBoxed = generateHeuristicSchedule(byBudget, 3, 'budget');

      setScenarios([
        {
          type: 'time_boxed',
          title: t('portfolio.ai.scenarioTimeBoxed', 'Time-boxed'),
          summary: timeBoxed.summary,
          schedule: timeBoxed.schedule,
          budgetByQuarter: buildScenarioBudgets(timeBoxed.schedule),
        },
        {
          type: 'budget_boxed',
          title: t('portfolio.ai.scenarioBudgetBoxed', 'Budget-boxed'),
          summary: budgetBoxed.summary,
          schedule: budgetBoxed.schedule,
          budgetByQuarter: buildScenarioBudgets(budgetBoxed.schedule),
        },
        {
          type: 'balanced',
          title: t('portfolio.ai.scenarioBalanced', 'Balanced (AI baseline)'),
          summary: t(
            'portfolio.ai.scenarioBalancedAiSummary',
            'Uses AI scheduling baseline to balance quick wins and workload.'
          ),
          schedule: balancedSchedule,
          budgetByQuarter: buildScenarioBudgets(balancedSchedule),
        },
      ]);
    } catch {
      toast.error(t('portfolio.ai.scenarioError', 'Failed to generate scenarios.'));
    } finally {
      setScenariosLoading(false);
    }
  };

  const applyScenario = async (scenario: any) => {
    if (!scenario?.schedule || scenario.schedule.length === 0) return;
    trackFunnelEvent('portfolio_scenario_selected', { scenarioType: scenario.type });
    trackFunnelEvent('portfolio_timeline_scenario_applied', { scenarioType: scenario.type });
    trackFunnelEvent('portfolio_scenario_applied', { scenarioType: scenario.type });

    try {
      await Api.post('/portfolio-optimization/timeline/apply', {
        scenarioType: scenario.type,
        schedule: scenario.schedule.map((s: any) => ({
          id: s.id,
          plannedStartDate: s.plannedStartDate,
          plannedEndDate: s.plannedEndDate,
          quarter: s.quarter,
        })),
      });

      for (const s of scenario.schedule) {
        onQuickUpdate(String(s.id), {
          plannedStartDate: s.plannedStartDate,
          plannedEndDate: s.plannedEndDate,
        });
      }
      toast.success(t('portfolio.ai.scenarioApplied', 'Scenario applied.'));
    } catch {
      toast.error(t('portfolio.ai.scenarioApplyError', 'Failed to apply scenario.'));
    }
  };

  return (
    <div className="fixed inset-0 z-overlay">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-c-border-subtle shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-navy-900/90 backdrop-blur border-b border-slate-200 dark:border-c-border-subtle px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('portfolio.ai.panelTitle', 'Portfolio AI')}
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('portfolio.ai.panelSubtitle', 'Conflicts, priorities, overlap, scenarios')}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-white/[0.05]"
            aria-label={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <button
            onClick={run}
            disabled={loading}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium transition-colors bg-navy-900 text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {t('portfolio.ai.analyzeSelection', 'AI: Analyze selection')}
          </button>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('portfolio.ai.conflictsTitle', 'Conflicts')}
            </h3>
            {loading ? (
              <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />{' '}
                {t('portfolio.ai.loading', 'Loading…')}
              </div>
            ) : conflicts.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {t('portfolio.ai.noConflicts', 'No conflicts detected.')}
              </div>
            ) : (
              <div className="space-y-2">
                {conflicts.slice(0, 10).map((c, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 dark:border-c-border-subtle p-3"
                  >
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {String(c?.type || 'conflict')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {Array.isArray(c?.initiatives) ? c.initiatives.join(' · ') : ''}
                    </div>
                    {c?.description && (
                      <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                        {String(c.description)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('portfolio.ai.prioritiesTitle', 'Priority suggestions')}
            </h3>
            {priorities.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {t('portfolio.ai.noPriorities', 'No priority suggestions.')}
              </div>
            ) : (
              <div className="space-y-2">
                {priorities.slice(0, 12).map((p, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 dark:border-c-border-subtle p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {String(p?.name || '')}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {t('portfolio.ai.recommendedPriority', 'Recommended priority')}:{' '}
                          {String(p?.recommendedPriority || '—')}
                        </div>
                      </div>
                      <button
                        onClick={() => applyPrioritySuggestion(p)}
                        className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        {t('common.apply', 'Apply')}
                      </button>
                    </div>
                    {p?.rationale && (
                      <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                        {String(p.rationale)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('portfolio.ai.scenariosTitle', 'Scenarios')}
              </h3>
              <button
                onClick={generateScenarios}
                disabled={scenariosLoading}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.10]"
              >
                {scenariosLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                {t('portfolio.ai.generateScenarios', 'Generate scenarios')}
              </button>
            </div>

            {scenarios.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'portfolio.ai.scenariosHint',
                  'Generate 2–3 options to compare time vs budget trade-offs, then apply a selected plan.'
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {scenarios.map((s: any) => (
                  <div
                    key={String(s.type)}
                    className="rounded-xl border border-slate-200 dark:border-c-border-subtle p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {String(s.title)}
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                          {String(s.summary)}
                        </div>
                      </div>
                      <button
                        onClick={() => applyScenario(s)}
                        className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        {t('common.apply', 'Apply')}
                      </button>
                    </div>
                    {Array.isArray(s.budgetByQuarter) && s.budgetByQuarter.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {t('portfolio.ai.budgetHighlights', 'Budget highlights')}
                        </div>
                        <div className="mt-2 space-y-1">
                          {s.budgetByQuarter.slice(0, 6).map((b: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700 dark:text-slate-200">
                                {String(b.quarter)} · {String(b.currency)}
                              </span>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {Number(b.total || 0).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
