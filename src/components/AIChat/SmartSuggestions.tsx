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
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? true;
};

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
  action: 'from-c-surface-raised to-c-surface-raised border-c-border dark:border-c-border',
  insight: 'from-amber-500/10 to-amber-600/5 border-amber-200/50 dark:border-amber-800/50',
  followup: 'from-green-500/10 to-green-600/5 border-green-200/50 dark:border-green-800/50',
  expand: 'from-c-surface-raised to-c-surface-raised border-c-border dark:border-c-border',
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
  const { t, i18n } = useTranslation();
  const { setCurrentView } = useAppStore();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [minimalVisibleIdx, setMinimalVisibleIdx] = useState<number[]>([0, 1, 2, 3]);
  const minimalNextIdxRef = React.useRef(4);
  const minimalSwapSlotRef = React.useRef(0);
  const minimalFadeTimeoutRef = React.useRef<number | undefined>(undefined);
  const [minimalFadeSlot, setMinimalFadeSlot] = useState<number | null>(null);

  const minimalPool: Array<{ id: string; text: string; prompt: string }> = useMemo(
    () => [
      {
        id: 'brief',
        text: t('aiChat.quickClicks.brief.label', 'Daily brief'),
        prompt: '__DAILY_BRIEF__',
      },
      {
        id: 'savings',
        text: t('aiChat.quickClicks.savings.label', 'Oszczędności'),
        prompt: t(
          'aiChat.quickClicks.savings.prompt',
          'Poszukajmy oszczędności — gdzie najszybciej możemy obniżyć koszty bez utraty jakości?'
        ),
      },
      {
        id: 'newProduct',
        text: t('aiChat.quickClicks.newProduct.label', 'Nowy produkt'),
        prompt: t(
          'aiChat.quickClicks.newProduct.prompt',
          'Wymyślmy pomysł na nowy produkt: 5 koncepcji + ocena rynku, ROI i trudności wdrożenia.'
        ),
      },
      {
        id: 'planReview',
        text: t('aiChat.quickClicks.planReview.label', 'Plany'),
        prompt: t(
          'aiChat.quickClicks.planReview.prompt',
          'Zrób przegląd naszych planów i inicjatyw: priorytety, ryzyka i co do korekty.'
        ),
      },
      {
        id: 'situation',
        text: t('aiChat.quickClicks.situation.label', 'Sytuacja'),
        prompt: t(
          'aiChat.quickClicks.situation.prompt',
          'Daj mi przegląd sytuacji: postęp, ryzyka, blokery, najbliższe decyzje i kolejne kroki.'
        ),
      },
      {
        id: 'roi',
        text: t('aiChat.quickClicks.roi.label', 'ROI'),
        prompt: t(
          'aiChat.quickClicks.roi.prompt',
          'Przeanalizuj ROI portfela inicjatyw i wskaż top 3 ruchy o najwyższym zwrocie.'
        ),
      },
      {
        id: 'risks',
        text: t('aiChat.quickClicks.risks.label', 'Ryzyka'),
        prompt: t(
          'aiChat.quickClicks.risks.prompt',
          'Zrób mapę ryzyk (top 10) i zaproponuj mitygacje oraz właścicieli.'
        ),
      },
      {
        id: 'priorities',
        text: t('aiChat.quickClicks.priorities.label', 'Priorytety'),
        prompt: t(
          'aiChat.quickClicks.priorities.prompt',
          'Ustal priorytety na tydzień: MUST/SHOULD/COULD + uzasadnienie.'
        ),
      },
      {
        id: 'kpi',
        text: t('aiChat.quickClicks.kpi.label', 'KPI'),
        prompt: t(
          'aiChat.quickClicks.kpi.prompt',
          'Zrób przegląd kluczowych KPI: co się poprawia, co spada, co wymaga reakcji.'
        ),
      },
      {
        id: 'scenario',
        text: t('aiChat.quickClicks.scenario.label', 'Scenariusze'),
        prompt: t(
          'aiChat.quickClicks.scenario.prompt',
          'Zbuduj 3 scenariusze (bazowy/optymistyczny/pesymistyczny) i powiedz jak zmieniają plan.'
        ),
      },
      {
        id: 'decision',
        text: t('aiChat.quickClicks.decision.label', 'Decyzja'),
        prompt: t(
          'aiChat.quickClicks.decision.prompt',
          'Pomóż podjąć decyzję: warianty, trade‑offy, ryzyka, koszty i rekomendacja w 5 punktach.'
        ),
      },
      {
        id: 'stakeholders',
        text: t('aiChat.quickClicks.stakeholders.label', 'Stakeholderzy'),
        prompt: t(
          'aiChat.quickClicks.stakeholders.prompt',
          'Przygotuj krótką aktualizację dla stakeholderów: status, ryzyka, decyzje do podjęcia, next steps.'
        ),
      },
      {
        id: 'governance',
        text: t('aiChat.quickClicks.governance.label', 'Governance'),
        prompt: t(
          'aiChat.quickClicks.governance.prompt',
          'Ułóż lekkie governance: rytm, KPI, decyzje, eskalacje i odpowiedzialności.'
        ),
      },
      {
        id: 'budget',
        text: t('aiChat.quickClicks.budget.label', 'Budżet'),
        prompt: t(
          'aiChat.quickClicks.budget.prompt',
          'Przeanalizuj budżet inicjatyw: odchylenia, ryzyka i gdzie warto przesunąć środki.'
        ),
      },
      {
        id: 'timeline',
        text: t('aiChat.quickClicks.timeline.label', 'Harmonogram'),
        prompt: t(
          'aiChat.quickClicks.timeline.prompt',
          'Sprawdź harmonogram: opóźnienia, krytyczna ścieżka i rekomendacje korekt.'
        ),
      },
      {
        id: 'team',
        text: t('aiChat.quickClicks.team.label', 'Zespół'),
        prompt: t(
          'aiChat.quickClicks.team.prompt',
          'Oceń obciążenie zespołu: przeciążenia, ryzyka i szybkie usprawnienia przepływu pracy.'
        ),
      },
      {
        id: 'benefits',
        text: t('aiChat.quickClicks.benefits.label', 'Korzyści'),
        prompt: t(
          'aiChat.quickClicks.benefits.prompt',
          'Ułóż plan realizacji korzyści: metryki, baseline, ownerzy, tracking i raportowanie.'
        ),
      },
      {
        id: 'capability',
        text: t('aiChat.quickClicks.capability.label', 'Kompetencje'),
        prompt: t(
          'aiChat.quickClicks.capability.prompt',
          'Jakich kompetencji brakuje? Zaproponuj plan rozwoju (edukacja + praktyka) na 6 tygodni.'
        ),
      },
      {
        id: 'dependencies',
        text: t('aiChat.quickClicks.dependencies.label', 'Zależności'),
        prompt: t(
          'aiChat.quickClicks.dependencies.prompt',
          'Wskaż zależności i wąskie gardła między inicjatywami oraz zaproponuj sequencing.'
        ),
      },
      {
        id: 'quickWins',
        text: t('aiChat.quickClicks.quickWins.label', 'Quick wins'),
        prompt: t(
          'aiChat.quickClicks.quickWins.prompt',
          'Zaproponuj 10 quick wins na 2 tygodnie: wartość, wysiłek, owner i pierwszy krok.'
        ),
      },
    ],
    [t, i18n.language]
  );

  // Rotate minimal chips from a pool (~20), one-at-a-time (slower)
  useEffect(() => {
    if (variant !== 'minimal') return;
    if (minimalPool.length <= 4) return;

    setMinimalVisibleIdx([0, 1, 2, 3].filter((x) => x < minimalPool.length));
    minimalNextIdxRef.current = 4 % minimalPool.length;
    minimalSwapSlotRef.current = 0;
    setMinimalFadeSlot(null);

    const reduce = prefersReducedMotion();
    const intervalMs = reduce ? 15000 : 12000;
    const interval = window.setInterval(() => {
      // Replace one chip at a time, round-robin slots 0..3
      const slot = minimalSwapSlotRef.current % 4;
      minimalSwapSlotRef.current = (minimalSwapSlotRef.current + 1) % 4;

      if (!reduce) {
        setMinimalFadeSlot(slot);
        if (minimalFadeTimeoutRef.current) window.clearTimeout(minimalFadeTimeoutRef.current);
        minimalFadeTimeoutRef.current = window.setTimeout(() => setMinimalFadeSlot(null), 220);
      }

      setMinimalVisibleIdx((prev) => {
        const visibleCount = Math.min(4, minimalPool.length);
        const base =
          Array.isArray(prev) && prev.length === visibleCount
            ? [...prev]
            : Array.from({ length: visibleCount }, (_, i) => i);

        let candidate = minimalNextIdxRef.current % minimalPool.length;
        let guard = 0;
        while (base.includes(candidate) && guard < minimalPool.length) {
          candidate = (candidate + 1) % minimalPool.length;
          guard += 1;
        }

        minimalNextIdxRef.current = (candidate + 1) % minimalPool.length;
        if (slot < base.length) base[slot] = candidate;
        return base;
      });
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [variant, i18n.language, minimalPool.length]);

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
      // API unavailable — show empty state, no hardcoded fallbacks
      setSuggestions([]);
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
    const pool = minimalPool.length ? minimalPool : [];
    const visibleCount = Math.min(4, pool.length);
    const idx = minimalVisibleIdx.slice(0, visibleCount);
    const minimalSuggestions = idx.map((i) => pool[i]).filter(Boolean);

    return (
      <div
        className={`w-full max-w-5xl mx-auto flex items-center justify-center gap-2 ${className}`}
      >
        {minimalSuggestions.map((item, i) => (
          <button
            key={item.id}
            onClick={() => handleMinimalClick(item.prompt)}
            title={item.text}
            className={`min-w-0 max-w-[calc(25%-0.5rem)] px-3 py-1.5 text-[11px] rounded-full border border-slate-200/70 dark:border-navy-700/70 bg-white/60 dark:bg-navy-900/40 text-slate-600 dark:text-slate-400 hover:text-c-text dark:hover:text-c-text hover:border-c-border-strong dark:hover:border-c-border-strong hover:bg-c-surface-hover dark:hover:bg-c-surface-hover transition-all duration-200 backdrop-blur-sm ${
              minimalFadeSlot === i ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <span className="block min-w-0 truncate">{item.text}</span>
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
        <Sparkles size={14} className="text-c-text-secondary" />
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
                hover:bg-c-surface-hover dark:hover:bg-c-surface-hover
                border border-slate-200 dark:border-navy-700
                hover:border-c-border-strong dark:hover:border-c-border-strong
                rounded-full text-xs
                text-slate-600 dark:text-slate-300
                hover:text-c-text dark:hover:text-c-text
                transition-all duration-200
            "
    >
      <Icon size={12} />
      {suggestion.text}
    </button>
  );
};

export default SmartSuggestions;
