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
  RefreshCw,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    type MinimalItem = { id: string; text: string; prompt: string };

    const ROTATE_MS = 6500;
    const VISIBLE_COUNT = 10; // show a "keyboard" of quick actions

    const basePool: MinimalItem[] = useMemo(
      () => [
        { id: 'brief', text: t('aiChat.dailyBrief', 'Dzienny brief'), prompt: '__DAILY_BRIEF__' },
        {
          id: 'plan-week',
          text: t('aiChat.quickActions.planWeek.label', 'Zaplanuj tydzień'),
          prompt: t(
            'aiChat.quickActions.planWeek.prompt',
            'Pomóż mi zaplanować priorytety na najbliższy tydzień.'
          ),
        },
        {
          id: 'overview',
          text: t('aiChat.quickActions.overview.label', 'Przegląd sytuacji'),
          prompt: t(
            'aiChat.quickActions.overview.prompt',
            'Daj mi przegląd obecnej sytuacji — co idzie dobrze, co wymaga uwagi, jakie są najbliższe ryzyka?'
          ),
        },
        {
          id: 'today-priorities',
          text: 'Priorytety na dziś',
          prompt: 'Ułóż mi 3 priorytety na dziś na podstawie moich zadań i statusu projektów.',
        },
        {
          id: 'top-risks',
          text: 'Top ryzyka',
          prompt: 'Wypisz 5 największych ryzyk i zaproponuj mitigacje (krótko i konkretnie).',
        },
        {
          id: 'blockers',
          text: 'Usuń blokery',
          prompt:
            'Mam blokery. Zadaj mi 5 pytań diagnostycznych i zaproponuj 3 ścieżki odblokowania.',
        },
        {
          id: 'status-update',
          text: 'Status dla interesariuszy',
          prompt:
            'Napisz krótką aktualizację statusową (max 6 zdań) dla interesariuszy: postęp, ryzyka, następne kroki.',
        },
        {
          id: 'meeting-agenda',
          text: 'Agenda spotkania',
          prompt: 'Przygotuj agendę 30-min spotkania statusowego + lista decyzji do podjęcia.',
        },
        {
          id: 'next-steps',
          text: 'Kolejne kroki',
          prompt: 'Jakie powinny być moje kolejne kroki w tym tygodniu? Podaj plan w punktach.',
        },
        {
          id: 'kpis',
          text: 'KPI transformacji',
          prompt: 'Zaproponuj 8 KPI dla transformacji (z definicją, częstotliwością i ownerem).',
        },
        {
          id: 'raci',
          text: 'RACI',
          prompt: 'Stwórz przykładową macierz RACI dla wdrożenia kluczowej inicjatywy.',
        },
        {
          id: 'roadmap',
          text: 'Roadmapa',
          prompt: 'Zaproponuj high-level roadmapę na 90 dni (fazy, deliverables, zależności).',
        },
        {
          id: 'quick-wins',
          text: 'Szybkie wygrane',
          prompt: 'Zaproponuj 5 szybkich wygranych (2–6 tygodni) z wpływem i ryzykami.',
        },
        {
          id: 'initiative-ideas',
          text: 'Pomysły na inicjatywy',
          prompt: 'Zaproponuj 7 inicjatyw transformacyjnych i oceń je w tabeli (wpływ / wysiłek).',
        },
        {
          id: 'prioritize',
          text: 'Priorytetyzuj',
          prompt: 'Pomóż mi priorytetyzować inicjatywy: kryteria, scoring, i rekomendacja top 5.',
        },
        {
          id: 'exec-summary',
          text: 'Podsumowanie dla zarządu',
          prompt: 'Napisz 10-liniowe executive summary dla zarządu (PL, z konkretami).',
        },
        {
          id: 'email',
          text: 'Mail do zespołu',
          prompt:
            'Napisz mail do zespołu: co robimy, dlaczego teraz, kto za co odpowiada, do kiedy.',
        },
        {
          id: 'decision',
          text: 'Decyzja: za/przeciw',
          prompt: 'Pomóż mi podjąć decyzję: wypisz opcje, za/przeciw, ryzyka i rekomendację.',
        },
        {
          id: 'assess',
          text: 'Ocena dojrzałości',
          prompt: 'Jakie 10 pytań powinienem zadać, żeby szybko ocenić dojrzałość cyfrową firmy?',
        },
        {
          id: 'what-to-ask',
          text: 'Pytania do zespołu',
          prompt:
            'Wygeneruj listę 12 pytań do zespołu (blokery, ryzyka, zależności, decyzje) na najbliższy tydzień.',
        },
      ],
      [t]
    );

    const contextPool: MinimalItem[] = useMemo(() => {
      const out: MinimalItem[] = [];
      const name = String(entityName || '').trim();
      if (workspaceType === 'assessment') {
        out.push({
          id: 'ctx-assessment',
          text: name ? `Analiza: ${name}` : 'Analiza oceny',
          prompt: name
            ? `Pomóż mi przeanalizować ocenę „${name}” — 5 wniosków i 5 rekomendacji.`
            : 'Pomóż mi przeanalizować tę ocenę — 5 wniosków i 5 rekomendacji.',
        });
      }
      if (workspaceType === 'initiative') {
        out.push({
          id: 'ctx-initiative-risks',
          text: 'Ryzyka inicjatywy',
          prompt: 'Jakie są główne ryzyka tej inicjatywy i jak je zmitigować?',
        });
      }
      if (workspaceType === 'roadmap') {
        out.push({
          id: 'ctx-roadmap-deps',
          text: 'Zależności roadmapy',
          prompt: 'Zidentyfikuj zależności i potencjalne wąskie gardła w roadmapie.',
        });
      }
      if (workspaceType === 'task') {
        out.push({
          id: 'ctx-task-priorities',
          text: 'Priorytety zadań',
          prompt: 'Pomóż mi ustalić priorytety zadań: co robić teraz, co delegować, co wstrzymać.',
        });
      }
      if (workspaceType === 'report') {
        out.push({
          id: 'ctx-report-summary',
          text: 'Podsumuj raport',
          prompt: 'Podsumuj raport: 5 kluczowych wniosków + 5 działań do wykonania.',
        });
      }
      if (workspaceType === 'dashboard') {
        out.push({
          id: 'ctx-dashboard-attn',
          text: 'Co wymaga uwagi?',
          prompt: 'Co wymaga mojej uwagi w pierwszej kolejności? Zrób listę TOP 5.',
        });
      }
      return out;
    }, [entityName, workspaceType]);

    const pool: MinimalItem[] = useMemo(() => {
      const seen = new Set<string>();
      const merged: MinimalItem[] = [];
      for (const item of [...contextPool, ...basePool]) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
      return merged;
    }, [basePool, contextPool]);

    const [tick, setTick] = useState(0);

    const pick = useCallback(
      (seed: number): MinimalItem[] => {
        // deterministic shuffle based on seed (avoids layout jitter)
        let x = (seed + 1) >>> 0;
        const rand = () => {
          x = (x * 1664525 + 1013904223) >>> 0;
          return x / 4294967296;
        };
        const arr = [...pool];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.slice(0, Math.min(VISIBLE_COUNT, arr.length));
      },
      [pool]
    );

    const minimalSuggestions = useMemo(() => pick(tick), [pick, tick]);

    const rotate = useCallback(() => setTick((v) => v + 1), []);

    useEffect(() => {
      // reset rotation when context changes
      setTick(0);
    }, [workspaceType, entityName]);

    useEffect(() => {
      const id = window.setInterval(() => rotate(), ROTATE_MS);
      return () => window.clearInterval(id);
    }, [rotate]);

    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="w-full max-w-3xl">
          <div className="relative flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-200/70 dark:border-navy-800/70 bg-white/40 dark:bg-navy-950/20 px-3 py-2 backdrop-blur-sm">
            {minimalSuggestions.map((item) => (
              <button
                key={item.id}
                onClick={() => handleMinimalClick(item.prompt)}
                className="px-3 py-1 rounded-full text-[11px] border border-slate-200/70 dark:border-navy-800/70 bg-white/50 dark:bg-navy-950/30 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-white/10 hover:bg-white/70 dark:hover:bg-navy-900/40 transition-colors"
                title={item.prompt === '__DAILY_BRIEF__' ? 'Dzienny brief' : item.prompt}
              >
                {item.text}
              </button>
            ))}

            <button
              onClick={rotate}
              className="ml-1 p-1.5 rounded-full border border-slate-200/70 dark:border-navy-800/70 bg-white/40 dark:bg-navy-950/20 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/70 dark:hover:bg-navy-900/40 transition-colors"
              title="Odśwież propozycje"
              aria-label="Odśwież propozycje"
              type="button"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
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
