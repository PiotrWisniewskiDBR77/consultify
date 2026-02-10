/**
 * SmartSuggestions
 *
 * Displays context-aware suggestions based on user's PMO state.
 * Supports two variants:
 * - 'full': Rich suggestions with icons, colors, and dismiss buttons
 * - 'minimal': 3 short, subtle text prompts for welcome screen
 */

import {
  ChevronRight,
  Clock,
  Lightbulb,
  Map,
  MessageSquare,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface Suggestion {
  id: string;
  type: 'continue' | 'action' | 'insight' | 'followup' | 'expand';
  text: string;
  priority: number;
  context: string[];
  action?: {
    type: 'navigate' | 'chat' | 'execute';
    view?: string;
    prompt?: string;
    data?: Record<string, unknown>;
  };
}

interface SmartSuggestionsProps {
  projectId?: string;
  onSuggestionClick: (suggestion: Suggestion) => void;
  className?: string;
  variant?: 'full' | 'minimal';
  /** Workspace context for context-aware suggestions */
  workspaceType?: string;
  /** Entity name for personalized prompts */
  entityName?: string;
  /** Cross-conversation intelligence: recent org decisions */
  recentDecisions?: Array<{ decisionSummary: string; outcomeStatus: string }>;
  /** Cross-conversation intelligence: org patterns */
  orgPatterns?: Array<{ title: string; type: string }>;
}

const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  continue: Clock,
  action: Target,
  insight: Lightbulb,
  followup: MessageSquare,
  expand: Map,
};

const SUGGESTION_COLORS: Record<string, string> = {
  continue: 'from-blue-500/10 to-blue-600/5 border-blue-200/50 dark:border-blue-800/50',
  action: 'from-primary-500/10 to-primary-600/5 border-primary-200/50 dark:border-primary-800/50',
  insight: 'from-amber-500/10 to-amber-600/5 border-amber-200/50 dark:border-amber-800/50',
  followup: 'from-green-500/10 to-green-600/5 border-green-200/50 dark:border-green-800/50',
  expand: 'from-purple-500/10 to-purple-600/5 border-purple-200/50 dark:border-purple-800/50',
};

export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
  projectId,
  onSuggestionClick,
  className = '',
  variant = 'full',
  workspaceType,
  entityName,
  recentDecisions,
  orgPatterns,
}) => {
  const { t } = useTranslation();
  const { setCurrentView } = useAppStore();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Fetch suggestions on mount and when projectId changes (only for full variant)
  useEffect(() => {
    if (variant === 'full') {
      fetchSuggestions();
    }
  }, [projectId, variant]);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/ai/suggestions${projectId ? `?projectId=${projectId}` : ''}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('[SmartSuggestions] Fetch error:', err);
      setSuggestions([
        {
          id: 'start-assessment',
          type: 'action',
          text: t('aiChat.suggestions.startAssessment', 'Start your digital maturity assessment'),
          priority: 95,
          context: ['fallback'],
          action: { type: 'navigate', view: 'ASSESSMENT_OVERVIEW' },
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = (suggestion: Suggestion) => {
    if (suggestion.action?.type === 'navigate' && suggestion.action.view) {
      setCurrentView(suggestion.action.view as AppView);
    } else {
      onSuggestionClick(suggestion);
    }
  };

  const handleMinimalClick = (prompt: string) => {
    onSuggestionClick({
      id: 'minimal',
      type: 'action',
      text: prompt,
      priority: 100,
      context: ['minimal'],
      action: { type: 'chat', prompt },
    });
  };

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed((prev) => new Set(prev).add(id));
  };

  // Minimal variant - context-aware text suggestions
  if (variant === 'minimal') {
    // Build context-aware suggestions based on workspace type
    const contextSuggestions: Array<{ id: string; text: string; prompt: string }> = [];

    // Always include daily brief
    contextSuggestions.push({
      id: 'brief',
      text: t('aiChat.dailyBrief', 'Daily brief'),
      prompt: '__DAILY_BRIEF__',
    });

    // Workspace-specific suggestions
    switch (workspaceType) {
      case 'assessment':
        contextSuggestions.push(
          {
            id: 'assess-help',
            text: entityName
              ? t('aiChat.quickActions.assessHelp.label', 'Analyze {{name}}', { name: entityName })
              : t('aiChat.quickActions.assessGeneral.label', 'Assessment tips'),
            prompt: entityName
              ? t(
                  'aiChat.quickActions.assessHelp.prompt',
                  'Help me analyze the assessment "{{name}}" — what are the key findings and recommendations?',
                  { name: entityName }
                )
              : t(
                  'aiChat.quickActions.assessGeneral.prompt',
                  'What are best practices for conducting a digital maturity assessment?'
                ),
          },
          {
            id: 'assess-gaps',
            text: t('aiChat.quickActions.identifyGaps.label', 'Identify gaps'),
            prompt: t(
              'aiChat.quickActions.identifyGaps.prompt',
              'What are the biggest gaps in our digital maturity and how should we prioritize closing them?'
            ),
          }
        );
        break;
      case 'initiative':
        contextSuggestions.push(
          {
            id: 'init-prioritize',
            text: t('aiChat.quickActions.prioritize.label', 'Prioritize initiatives'),
            prompt: t(
              'aiChat.quickActions.prioritize.prompt',
              'Help me prioritize the current initiatives by impact and feasibility'
            ),
          },
          {
            id: 'init-risks',
            text: t('aiChat.quickActions.risks.label', 'Risk analysis'),
            prompt: t(
              'aiChat.quickActions.risks.prompt',
              'What are the main risks for our active initiatives and how should we mitigate them?'
            ),
          }
        );
        break;
      case 'roadmap':
        contextSuggestions.push(
          {
            id: 'road-timeline',
            text: t('aiChat.quickActions.timeline.label', 'Review timeline'),
            prompt: t(
              'aiChat.quickActions.timeline.prompt',
              'Review our transformation roadmap timeline — are we on track?'
            ),
          },
          {
            id: 'road-deps',
            text: t('aiChat.quickActions.dependencies.label', 'Check dependencies'),
            prompt: t(
              'aiChat.quickActions.dependencies.prompt',
              'Analyze dependencies between our roadmap items and flag potential bottlenecks'
            ),
          }
        );
        break;
      case 'task':
        contextSuggestions.push(
          {
            id: 'task-plan',
            text: t('aiChat.quickActions.planWeek.label', 'Plan the week'),
            prompt: t(
              'aiChat.quickActions.planWeek.prompt',
              'Help me plan priorities for the next week'
            ),
          },
          {
            id: 'task-blockers',
            text: t('aiChat.quickActions.blockers.label', 'Unblock me'),
            prompt: t(
              'aiChat.quickActions.blockers.prompt',
              'I am blocked — help me find solutions for my current blockers'
            ),
          }
        );
        break;
      case 'report':
        contextSuggestions.push(
          {
            id: 'report-summary',
            text: t('aiChat.quickActions.reportSummary.label', 'Summarize report'),
            prompt: t(
              'aiChat.quickActions.reportSummary.prompt',
              'Summarize the key findings and action items from the current report'
            ),
          },
          {
            id: 'report-exec',
            text: t('aiChat.quickActions.execSummary.label', 'Executive summary'),
            prompt: t(
              'aiChat.quickActions.execSummary.prompt',
              'Write a concise executive summary for stakeholder communication'
            ),
          }
        );
        break;
      case 'dashboard':
        contextSuggestions.push(
          {
            id: 'dash-summary',
            text: t('aiChat.quickActions.daySummary.label', 'Podsumuj mój dzień'),
            prompt: t(
              'aiChat.quickActions.daySummary.prompt',
              'Podsumuj mój dzień — co wymaga mojej uwagi, jakie mam blokery i co powinienem zrobić?'
            ),
          },
          {
            id: 'dash-next',
            text: t('aiChat.quickActions.nextSteps.label', 'Kolejne kroki'),
            prompt: t(
              'aiChat.quickActions.nextSteps.prompt',
              'Jakie powinny być moje kolejne kroki na podstawie obecnego stanu projektów?'
            ),
          }
        );
        break;
      case 'economics':
      case 'financial':
        contextSuggestions.push(
          {
            id: 'econ-roi',
            text: t('aiChat.quickActions.roiAnalysis.label', 'Analiza ROI'),
            prompt: t(
              'aiChat.quickActions.roiAnalysis.prompt',
              'Przeanalizuj ROI naszego portfela inicjatyw — który scenariusz jest najbardziej realistyczny?'
            ),
          },
          {
            id: 'econ-compare',
            text: t('aiChat.quickActions.compareScenarios.label', 'Porównaj scenariusze'),
            prompt: t(
              'aiChat.quickActions.compareScenarios.prompt',
              'Porównaj scenariusze finansowe (bazowy, optymistyczny, pesymistyczny) i zarekomenduj działania.'
            ),
          }
        );
        break;
      case 'admin':
      case 'admin_dashboard':
        contextSuggestions.push(
          {
            id: 'admin-usage',
            text: t('aiChat.quickActions.usageMetrics.label', 'Metryki użycia'),
            prompt: t(
              'aiChat.quickActions.usageMetrics.prompt',
              'Pokaż mi kluczowe metryki użycia platformy — aktywność użytkowników, trendy, adoption rate.'
            ),
          },
          {
            id: 'admin-optimize',
            text: t('aiChat.quickActions.optimize.label', 'Optymalizuj koszty'),
            prompt: t(
              'aiChat.quickActions.optimize.prompt',
              'Jakie mam możliwości optymalizacji kosztów i usage w organizacji?'
            ),
          }
        );
        break;
      case 'context_builder':
        contextSuggestions.push(
          {
            id: 'ctx-fill',
            text: t('aiChat.quickActions.helpFill.label', 'Pomóż wypełnić profil'),
            prompt: t(
              'aiChat.quickActions.helpFill.prompt',
              'Pomóż mi wypełnić profil organizacji — zadawaj pytania a ja odpowiem.'
            ),
          },
          {
            id: 'ctx-challenge',
            text: t('aiChat.quickActions.challengeGoals.label', 'Ocena celów'),
            prompt: t(
              'aiChat.quickActions.challengeGoals.prompt',
              'Oceń moje cele strategiczne — czy są SMART? Co powinienem zmienić?'
            ),
          }
        );
        break;
      case 'decision':
        contextSuggestions.push(
          {
            id: 'dec-analyze',
            text: t('aiChat.quickActions.analyzeDecision.label', 'Analizuj opcje'),
            prompt: t(
              'aiChat.quickActions.analyzeDecision.prompt',
              'Przeanalizuj opcje tej decyzji — jakie są za i przeciw każdej opcji?'
            ),
          },
          {
            id: 'dec-recommend',
            text: t('aiChat.quickActions.recommend.label', 'Rekomendacja'),
            prompt: t(
              'aiChat.quickActions.recommend.prompt',
              'Na podstawie kontekstu projektu, którą opcję rekomendujesz i dlaczego?'
            ),
          }
        );
        break;
      default:
        // Generic suggestions
        contextSuggestions.push(
          {
            id: 'week',
            text: t('aiChat.quickActions.planWeek.label', 'Plan the week'),
            prompt: t(
              'aiChat.quickActions.planWeek.prompt',
              'Help me plan priorities for the next week'
            ),
          },
          {
            id: 'overview',
            text: t('aiChat.quickActions.overview.label', 'Przegląd sytuacji'),
            prompt: t(
              'aiChat.quickActions.overview.prompt',
              'Daj mi przegląd obecnej sytuacji — co idzie dobrze, co wymaga uwagi?'
            ),
          }
        );
    }

    // Universal pool of suggestions (~20) for rotation (C2.1)
    const universalPool: Array<{ id: string; text: string; prompt: string }> = [
      {
        id: 'u-strategy',
        text: t('aiChat.pool.strategy', 'Analiza strategii'),
        prompt: t(
          'aiChat.pool.strategyPrompt',
          'Przeanalizuj naszą obecną strategię transformacji — co działa, a co wymaga korekty?'
        ),
      },
      {
        id: 'u-risks',
        text: t('aiChat.pool.risks', 'Mapa ryzyk'),
        prompt: t(
          'aiChat.pool.risksPrompt',
          'Jakie są najważniejsze ryzyka w naszym portfelu i jak je mitygować?'
        ),
      },
      {
        id: 'u-kpi',
        text: t('aiChat.pool.kpi', 'Przegląd KPI'),
        prompt: t('aiChat.pool.kpiPrompt', 'Pokaż mi przegląd kluczowych KPI — co wymaga uwagi?'),
      },
      {
        id: 'u-blockers',
        text: t('aiChat.pool.blockers', 'Blokery'),
        prompt: t(
          'aiChat.pool.blockersPrompt',
          'Jakie blokery mam w moich zadaniach i jak je rozwiązać?'
        ),
      },
      {
        id: 'u-priorities',
        text: t('aiChat.pool.priorities', 'Priorytety tygodnia'),
        prompt: t('aiChat.pool.prioritiesPrompt', 'Pomóż mi ustalić priorytety na ten tydzień.'),
      },
      {
        id: 'u-stakeholders',
        text: t('aiChat.pool.stakeholders', 'Komunikacja ze stakeholderami'),
        prompt: t(
          'aiChat.pool.stakeholdersPrompt',
          'Przygotuj podsumowanie postępów dla stakeholderów.'
        ),
      },
      {
        id: 'u-budget',
        text: t('aiChat.pool.budget', 'Analiza budżetu'),
        prompt: t(
          'aiChat.pool.budgetPrompt',
          'Przeanalizuj wykorzystanie budżetu w naszych inicjatywach.'
        ),
      },
      {
        id: 'u-timeline',
        text: t('aiChat.pool.timeline', 'Harmonogram'),
        prompt: t(
          'aiChat.pool.timelinePrompt',
          'Czy jesteśmy na dobrej drodze z harmonogramem? Pokaż opóźnienia.'
        ),
      },
      {
        id: 'u-team',
        text: t('aiChat.pool.team', 'Obciążenie zespołu'),
        prompt: t(
          'aiChat.pool.teamPrompt',
          'Jak wygląda obciążenie zespołu? Kto jest przeciążony?'
        ),
      },
      {
        id: 'u-maturity',
        text: t('aiChat.pool.maturity', 'Dojrzałość cyfrowa'),
        prompt: t(
          'aiChat.pool.maturityPrompt',
          'Jakie są nasze największe luki w dojrzałości cyfrowej?'
        ),
      },
      {
        id: 'u-roi',
        text: t('aiChat.pool.roi', 'Analiza ROI'),
        prompt: t('aiChat.pool.roiPrompt', 'Przeanalizuj ROI naszych top 5 inicjatyw.'),
      },
      {
        id: 'u-decisions',
        text: t('aiChat.pool.decisions', 'Oczekujące decyzje'),
        prompt: t(
          'aiChat.pool.decisionsPrompt',
          'Jakie decyzje czekają na mnie i które są najpilniejsze?'
        ),
      },
      {
        id: 'u-benchmark',
        text: t('aiChat.pool.benchmark', 'Benchmark branżowy'),
        prompt: t(
          'aiChat.pool.benchmarkPrompt',
          'Jak wypadamy na tle branży w kluczowych obszarach?'
        ),
      },
      {
        id: 'u-quick-wins',
        text: t('aiChat.pool.quickWins', 'Quick wins'),
        prompt: t(
          'aiChat.pool.quickWinsPrompt',
          'Jakie quick wins możemy zrealizować w najbliższych 2 tygodniach?'
        ),
      },
      {
        id: 'u-lessons',
        text: t('aiChat.pool.lessons', 'Lessons learned'),
        prompt: t(
          'aiChat.pool.lessonsPrompt',
          'Jakie wnioski wyciągnęliśmy z ostatnich projektów?'
        ),
      },
      {
        id: 'u-innovation',
        text: t('aiChat.pool.innovation', 'Pomysły na innowacje'),
        prompt: t(
          'aiChat.pool.innovationPrompt',
          'Zaproponuj innowacyjne podejścia do naszych obecnych wyzwań.'
        ),
      },
      {
        id: 'u-change',
        text: t('aiChat.pool.change', 'Zarządzanie zmianą'),
        prompt: t(
          'aiChat.pool.changePrompt',
          'Jak zarządzać oporem wobec zmian w naszej organizacji?'
        ),
      },
      {
        id: 'u-report',
        text: t('aiChat.pool.report', 'Raport tygodniowy'),
        prompt: t(
          'aiChat.pool.reportPrompt',
          'Wygeneruj raport tygodniowy z postępów transformacji.'
        ),
      },
      {
        id: 'u-dependencies',
        text: t('aiChat.pool.dependencies', 'Zależności'),
        prompt: t(
          'aiChat.pool.dependenciesPrompt',
          'Pokaż zależności między inicjatywami i potencjalne wąskie gardła.'
        ),
      },
      {
        id: 'u-next-steps',
        text: t('aiChat.pool.nextSteps', 'Kolejne kroki'),
        prompt: t(
          'aiChat.pool.nextStepsPrompt',
          'Jakie powinny być moje kolejne kroki na podstawie obecnego stanu?'
        ),
      },
    ];

    // Merge context-specific with universal pool, deduplicate by id
    const contextIds = new Set(contextSuggestions.map((s) => s.id));
    const merged = [...contextSuggestions, ...universalPool.filter((s) => !contextIds.has(s.id))];

    // Shuffle using a seed based on the current hour (rotates every hour)
    const hourSeed = Math.floor(Date.now() / (1000 * 60 * 60));
    const shuffled = [...merged];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = ((hourSeed * (i + 1) * 2654435761) >>> 0) % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Always keep Daily Brief first, then pick 3 more from shuffled pool
    const dailyBrief = contextSuggestions.find((s) => s.id === 'brief');
    const rest = shuffled.filter((s) => s.id !== 'brief');
    const minimalSuggestions = dailyBrief ? [dailyBrief, ...rest.slice(0, 3)] : rest.slice(0, 4);

    return (
      <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
        {minimalSuggestions.map((item) => (
          <button
            key={item.id}
            onClick={() => handleMinimalClick(item.prompt)}
            className="
              px-3 py-1.5 text-xs
              rounded-full
              border border-slate-200/70 dark:border-navy-700/70
              bg-white/60 dark:bg-navy-900/40
              text-slate-600 dark:text-slate-400
              hover:text-primary-600 dark:hover:text-primary-400
              hover:border-primary-300 dark:hover:border-primary-700
              hover:bg-primary-50/50 dark:hover:bg-primary-900/20
              transition-all duration-200
              backdrop-blur-sm
            "
          >
            {item.text}
          </button>
        ))}
      </div>
    );
  }

  // Cross-conversation intelligence: add decision-derived suggestions
  const memorySuggestions: Suggestion[] = [];
  if (recentDecisions && recentDecisions.length > 0) {
    // Add follow-up suggestion for the most recent decision
    const latest = recentDecisions[0];
    memorySuggestions.push({
      id: 'memory-followup',
      type: 'followup',
      text: t('aiChat.suggestions.decisionFollowUp', 'Follow up on: {{summary}}', {
        summary:
          latest.decisionSummary.length > 60
            ? latest.decisionSummary.slice(0, 60) + '…'
            : latest.decisionSummary,
      }),
      priority: 90,
      context: ['org_memory'],
      action: {
        type: 'chat',
        prompt: `Follow up on the previous decision: "${latest.decisionSummary}". What has changed since then? What is the current status and are there any new risks or opportunities?`,
      },
    });
  }
  if (orgPatterns && orgPatterns.length > 0) {
    const bestPractice = orgPatterns.find((p) => p.type === 'BEST_PRACTICE') || orgPatterns[0];
    memorySuggestions.push({
      id: 'memory-pattern',
      type: 'insight',
      text: t('aiChat.suggestions.orgPattern', 'Apply: {{title}}', {
        title:
          bestPractice.title.length > 50
            ? bestPractice.title.slice(0, 50) + '…'
            : bestPractice.title,
      }),
      priority: 85,
      context: ['org_memory'],
      action: {
        type: 'chat',
        prompt: `Our organization has identified this best practice: "${bestPractice.title}". How should we apply this to our current context?`,
      },
    });
  }

  // Full variant - rich suggestions
  const allSuggestions = [...suggestions, ...memorySuggestions];
  const visibleSuggestions = allSuggestions.filter((s) => !dismissed.has(s.id));

  if (isLoading || visibleSuggestions.length === 0) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-primary-500" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {t('aiChat.suggestions.title', 'Suggested for you')}
        </span>
      </div>

      {/* Suggestions List */}
      <div className="flex flex-wrap gap-2">
        {visibleSuggestions.map((suggestion) => {
          const Icon = SUGGESTION_ICONS[suggestion.type] || Sparkles;
          const colorClass = SUGGESTION_COLORS[suggestion.type] || SUGGESTION_COLORS.action;

          return (
            <button
              key={suggestion.id}
              onClick={() => handleClick(suggestion)}
              className={`
                                group relative flex items-center gap-2 px-3 py-2
                                bg-gradient-to-r ${colorClass}
                                border rounded-xl
                                text-sm text-navy-700 dark:text-slate-200
                                hover:shadow-md hover:scale-[1.02]
                                transition-all duration-200
                            `}
            >
              <Icon size={14} className="shrink-0 text-current opacity-70" />
              <span>{suggestion.text}</span>
              <ChevronRight
                size={14}
                className="shrink-0 opacity-0 group-hover:opacity-70 transition-opacity"
              />

              {/* Dismiss button */}
              <button
                onClick={(e) => handleDismiss(suggestion.id, e)}
                className="
                                    absolute -top-1 -right-1 p-0.5
                                    bg-slate-200 dark:bg-navy-700
                                    rounded-full opacity-0 group-hover:opacity-100
                                    transition-opacity
                                "
              >
                <X size={10} className="text-slate-500 dark:text-slate-400" />
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Compact inline suggestion chip
 */
interface SuggestionChipProps {
  suggestion: Suggestion;
  onClick: () => void;
}

export const SuggestionChip: React.FC<SuggestionChipProps> = ({ suggestion, onClick }) => {
  const Icon = SUGGESTION_ICONS[suggestion.type] || Sparkles;

  return (
    <button
      onClick={onClick}
      className="
                inline-flex items-center gap-1.5 px-2.5 py-1
                bg-slate-100 dark:bg-navy-800
                hover:bg-primary-100 dark:hover:bg-primary-900/30
                border border-slate-200 dark:border-navy-700
                hover:border-primary-300 dark:hover:border-primary-700
                rounded-full text-xs
                text-slate-600 dark:text-slate-300
                hover:text-primary-700 dark:hover:text-primary-300
                transition-all duration-200
            "
    >
      <Icon size={12} />
      {suggestion.text}
    </button>
  );
};

export default SmartSuggestions;
