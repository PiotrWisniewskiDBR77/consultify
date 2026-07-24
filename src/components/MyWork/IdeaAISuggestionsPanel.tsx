/**
 * IdeaAISuggestionsPanel — V3 Pro AI Suggestions panel.
 *
 * Real AI suggestions grounded in company context (assessments, interviews, KPIs).
 * Categories: branch suggestions, row suggestions, risk flags, framework recommendations,
 * topics, findings, next steps.
 * Natural language input for on-demand queries.
 */
import {
  AlertTriangle,
  ArrowRight,
  BellOff,
  ChevronDown,
  ChevronUp,
  Download,
  GitBranch,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageSquare,
  MessageSquareWarning,
  Search,
  Send,
  Sparkles,
  Target,
  Wrench,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ToolsPanelShell } from '@/components/shared/WorkspaceTools';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { CanvasToolType } from './ideaSelectionTypes';

const MM_GENERATOR_ACTIONS = [
  {
    action: 'mm_ai_expand',
    iconEl: Sparkles,
    labelPl: 'Rozwiń mapę (AI)',
    labelEn: 'Expand map (AI)',
  },
  {
    action: 'mm_ai_suggest',
    iconEl: Lightbulb,
    labelPl: 'Zasugeruj gałęzie',
    labelEn: 'Suggest branches',
  },
  { action: 'mm_ai_gap_analysis', iconEl: Search, labelPl: 'Analiza luk', labelEn: 'Gap analysis' },
  {
    action: 'mm_ai_cluster',
    iconEl: GitBranch,
    labelPl: 'Auto-klasteryzacja',
    labelEn: 'Auto-clustering',
  },
  {
    action: 'mm_ai_summarize',
    iconEl: Target,
    labelPl: 'Podsumowanie mapy',
    labelEn: 'Map summary',
  },
  {
    action: 'mm_ai_auto_connect',
    iconEl: Target,
    labelPl: 'Auto cross-links',
    labelEn: 'Auto cross-links',
  },
];

// P1-5: ta sekcja nazywa sie „AI Generators", a wczesniej dispatchowala
// `wb_add_cluster/theme/outcome` — czyli wstawiala PUSTE elementy z etykieta
// „Cluster"/„Theme", NIE wolajac modelu. Etykiety obiecywaly „Auto-klasteryzacja"
// / „Wyodrębnij tematy", wiec byl to falsz (Z1 §3 zakaz 7: funkcja bez wywolania
// modelu nie nazywa sie „AI"). Teraz kazda pozycja dispatchuje realny generator
// `wb_ai_*`, ktory idzie przez `generateAIProposal` (LLM + model propozycji:
// podglad → akceptuj/odrzuc). Puste wstawki (Dodaj karteczke/decyzje/akcje) to
// narzedzia tworzenia z LEWEGO raila, nie generatory AI — nie maja tu miejsca.
const WB_GENERATOR_ACTIONS = [
  {
    action: 'wb_ai_find_themes',
    iconEl: Target,
    labelPl: 'Wyodrębnij tematy (AI)',
    labelEn: 'Find themes (AI)',
  },
  {
    action: 'wb_ai_name_clusters',
    iconEl: GitBranch,
    labelPl: 'Nazwij klastry (AI)',
    labelEn: 'Name clusters (AI)',
  },
  {
    action: 'wb_ai_extract_actions',
    iconEl: ListChecks,
    labelPl: 'Wyodrębnij działania (AI)',
    labelEn: 'Extract action items (AI)',
  },
  {
    action: 'wb_ai_to_map',
    iconEl: Lightbulb,
    labelPl: 'Zamień w mapę (AI)',
    labelEn: 'Convert to map (AI)',
  },
];

function getGeneratorActions(tool?: CanvasToolType) {
  if (tool === 'whiteboard') return WB_GENERATOR_ACTIONS;
  return MM_GENERATOR_ACTIONS;
}

type SuggestionCategory =
  | 'branch_suggestions'
  | 'row_suggestions'
  | 'connection_suggestions'
  | 'risk_flags'
  | 'framework_recommendations'
  | 'topics'
  | 'findings'
  | 'next_steps';

interface AISuggestion {
  id: string;
  category: SuggestionCategory;
  text: string;
  detail?: string;
  confidence?: number;
  source?: string;
  actionType?: string;
  actionPayload?: Record<string, unknown>;
}

interface IdeaAISuggestionsPanelProps {
  open: boolean;
  onClose: () => void;
  /**
   * EditorShell Wave W (W-1) / SPEC-A consolidated panel: render inside the
   * parent's accordion body (drops the panel's own fixed-width / bordered
   * drawer chrome + close button). Additive — default false = legacy sliding
   * drawer unchanged. Mirrors IdeaWorkspaceTools's `embedded` prop.
   */
  embedded?: boolean;
  ideaId: string;
  title: string;
  seedText?: string;
  activeTool?: CanvasToolType;
  isAccepted?: boolean;
  onSendToChat?: (prefillText?: string) => void;
  onInsertToWorkspace?: (items: Array<{ text: string; type: string }>) => void;
  graphNodes?: any[];
  graphEdges?: any[];
  selectedNodeId?: string | null;
}

const CATEGORY_CONFIG: Record<
  SuggestionCategory,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    labelPl: string;
    labelEn: string;
    color: string;
  }
> = {
  branch_suggestions: {
    icon: GitBranch,
    labelPl: 'Sugestie gałęzi',
    labelEn: 'Branch suggestions',
    color: 'text-c-info',
  },
  row_suggestions: {
    icon: Target,
    labelPl: 'Sugestie wierszy',
    labelEn: 'Row suggestions',
    color: 'text-blue-600 dark:text-blue-400',
  },
  connection_suggestions: {
    icon: GitBranch,
    labelPl: 'Połączenia',
    labelEn: 'Connections',
    color: 'text-blue-600 dark:text-blue-400',
  },
  risk_flags: {
    icon: AlertTriangle,
    labelPl: 'Flagi ryzyka',
    labelEn: 'Risk flags',
    color: 'text-danger-600 dark:text-danger-400',
  },
  framework_recommendations: {
    icon: Wrench,
    labelPl: 'Rekomendacje narzędzi',
    labelEn: 'Framework recommendations',
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  topics: {
    icon: Search,
    labelPl: 'Tematy do analizy',
    labelEn: 'Topics to analyze',
    color: 'text-blue-600 dark:text-blue-400',
  },
  findings: {
    icon: Lightbulb,
    labelPl: 'Wnioski / insights',
    labelEn: 'Findings / insights',
    color: 'text-amber-600 dark:text-amber-400',
  },
  next_steps: {
    icon: ListChecks,
    labelPl: 'Następne kroki',
    labelEn: 'Next steps',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
};

const CATEGORY_ORDER: SuggestionCategory[] = [
  'risk_flags',
  'branch_suggestions',
  'row_suggestions',
  'framework_recommendations',
  'topics',
  'findings',
  'next_steps',
  'connection_suggestions',
];

export const IdeaAISuggestionsPanel: React.FC<IdeaAISuggestionsPanelProps> = ({
  open,
  onClose,
  embedded = false,
  ideaId,
  title,
  seedText = '',
  activeTool,
  isAccepted,
  onSendToChat,
  onInsertToWorkspace,
  graphNodes: currentNodes = [],
  graphEdges: currentEdges = [],
  selectedNodeId,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<SuggestionCategory | null>('risk_flags');
  const [companyContextUsed, setCompanyContextUsed] = useState(false);
  const [nlInput, setNlInput] = useState('');
  const [nlLoading, setNlLoading] = useState(false);

  // ── Anti-spam policy ──────────────────────────────────────────────────────
  const COOLDOWN_MS = 60_000;
  const SNOOZE_MS = 5 * 60_000;
  const lastFetchRef = useRef<number>(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`ai-sug-dismissed-${ideaId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [snoozedUntil, setSnoozedUntil] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(`ai-sug-snoozed-${ideaId}`)) || 0;
    } catch {
      return 0;
    }
  });

  const dismissSuggestion = useCallback(
    (id: string) => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        try {
          localStorage.setItem(`ai-sug-dismissed-${ideaId}`, JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [ideaId]
  );

  const snooze = useCallback(() => {
    const until = Date.now() + SNOOZE_MS;
    setSnoozedUntil(until);
    try {
      localStorage.setItem(`ai-sug-snoozed-${ideaId}`, String(until));
    } catch {
      /* ignore */
    }
  }, [ideaId]);

  const isSnoozed = snoozedUntil > Date.now();

  const fetchSuggestions = useCallback(
    async (mode: 'passive' | 'on_demand' = 'passive', prompt?: string) => {
      if (!open || !ideaId) return;

      if (mode === 'passive') {
        const now = Date.now();
        if (now - lastFetchRef.current < COOLDOWN_MS) return;
        if (isSnoozed) return;
        lastFetchRef.current = now;
      }

      const isOnDemand = mode === 'on_demand';
      if (isOnDemand) setNlLoading(true);
      else setLoading(true);

      try {
        const result = await Api.getIdeaAISuggestions(ideaId, {
          context: {
            title,
            seedText,
            currentNodes: currentNodes.map((n: any) => ({
              id: n.id,
              type: n.type,
              label: n.data?.label,
              tags: n.data?.tags,
              semanticType: n.data?.semanticType,
              artifactLinks: n.data?.artifactLinks,
              description: n.data?.description,
              notes: n.data?.notes,
            })),
            currentEdges,
            activeTool: activeTool || 'mindmap',
            ...(selectedNodeId != null && { selectedNodeId }),
          },
          mode,
          prompt,
          language: i18n.language,
        });

        if (isOnDemand && result?.suggestions) {
          setSuggestions((prev) => [...result.suggestions, ...prev]);
        } else if (result?.suggestions) {
          setSuggestions(result.suggestions);
        }
        if (result?.companyContextUsed != null) setCompanyContextUsed(result.companyContextUsed);
      } catch {
        // Fallback handled by backend
      } finally {
        setLoading(false);
        setNlLoading(false);
      }
    },
    [
      activeTool,
      currentEdges,
      currentNodes,
      i18n.language,
      ideaId,
      isSnoozed,
      open,
      seedText,
      title,
    ]
  );

  useEffect(() => {
    if (!open) return;
    fetchSuggestions('passive');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ideaId]);

  const grouped = useMemo(() => {
    const map: Record<SuggestionCategory, AISuggestion[]> = {
      branch_suggestions: [],
      row_suggestions: [],
      connection_suggestions: [],
      risk_flags: [],
      framework_recommendations: [],
      topics: [],
      findings: [],
      next_steps: [],
    };
    for (const s of suggestions) {
      if (dismissedIds.has(s.id)) continue;
      if (map[s.category]) map[s.category].push(s);
    }
    return map;
  }, [dismissedIds, suggestions]);

  const handleSendToChat = useCallback(
    (text: string) => {
      onSendToChat?.(text);
    },
    [onSendToChat]
  );

  const handleInsert = useCallback(
    (suggestion: AISuggestion) => {
      trackFunnelEvent('ideas_ai_suggestion_inserted', {
        category: suggestion.category,
        ideaId,
        tool: activeTool,
      });
      onInsertToWorkspace?.([{ text: suggestion.text, type: suggestion.category }]);
    },
    [activeTool, ideaId, onInsertToWorkspace]
  );

  const handleNlSubmit = useCallback(() => {
    if (!nlInput.trim()) return;
    fetchSuggestions('on_demand', nlInput.trim());
    setNlInput('');
  }, [fetchSuggestions, nlInput]);

  // Legacy sliding-drawer path is gated by `open`. In embedded (consolidated
  // accordion panel) mode the parent only mounts this section when its
  // accordion item is open, so visibility is the parent's responsibility —
  // don't self-hide here (mirrors IdeaWorkspaceTools).
  if (!embedded && !open) return null;

  return (
    <ToolsPanelShell
      title={t('myWorkIdeas.aiSuggestionsPanel.aiSuggestions')}
      subtitle={t('myWorkIdeas.aiSuggestionsPanel.companyContextAi')}
      icon={
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-c-info/20 to-c-info/15 flex items-center justify-center">
          <MessageSquareWarning size={14} className="text-c-info" />
        </div>
      }
      embedded={embedded}
      onClose={onClose}
    >
      <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
          {title || t('myWorkIdeas.aiSuggestionsPanel.idea')}
        </div>
        {companyContextUsed && (
          <div className="mt-1.5 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 rounded-lg px-2 py-1 flex items-center gap-1">
            <Sparkles size={10} />
            {t('myWorkIdeas.aiSuggestionsPanel.suggestionsGroundedCompanyData')}
          </div>
        )}
        {isAccepted === false && (
          <div className="mt-1.5 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-500/10 rounded-lg px-2 py-1">
            {t('myWorkIdeas.aiSuggestionsPanel.acceptChallengeUnlockFullSuggestions')}
          </div>
        )}
        {isSnoozed && (
          <div className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-500/10 rounded-lg px-2 py-1 flex items-center gap-1">
            <BellOff size={10} />
            {t('myWorkIdeas.aiSuggestionsPanel.suggestionsSnoozed5Min')}
          </div>
        )}
        {!isSnoozed && suggestions.length > 0 && (
          <button
            onClick={snooze}
            className="mt-1.5 text-[10px] text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            <BellOff size={10} />
            {t('myWorkIdeas.aiSuggestionsPanel.snooze5Min')}
          </button>
        )}
      </div>

      <div className="px-3 py-2 flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 px-1 py-8 justify-center">
            <Loader2 size={14} className="animate-spin text-c-info" />
            {t('myWorkIdeas.aiSuggestionsPanel.generatingSuggestionsFromCompanyContext')}
          </div>
        ) : (
          <div className="space-y-1">
            {CATEGORY_ORDER.map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              const items = grouped[cat];
              if (items.length === 0) return null;
              const isExpanded = expandedCategory === cat;
              const CatIcon = config.icon;

              return (
                <div key={cat}>
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <CatIcon size={14} className={config.color} />
                    <span className={`text-[11px] font-bold flex-1 text-left ${config.color}`}>
                      {isPl ? config.labelPl : config.labelEn}
                    </span>
                    <span className="text-[9px] text-slate-600 mr-1">{items.length}</span>
                    {isExpanded ? (
                      <ChevronUp size={12} className="text-slate-600" />
                    ) : (
                      <ChevronDown size={12} className="text-slate-600" />
                    )}
                  </button>

                  {isExpanded && items.length > 0 && (
                    <div className="ml-2 space-y-1 pb-1">
                      {items.map((sug) => (
                        <div
                          key={sug.id}
                          className="rounded-xl border border-slate-200/40 dark:border-white/[0.04] bg-white/40 dark:bg-white/[0.02] p-2.5"
                        >
                          <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                            {sug.text}
                          </div>
                          {sug.detail && (
                            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                              {sug.detail}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {sug.confidence != null && (
                              <div className="flex items-center gap-1">
                                <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${sug.confidence >= 0.7 ? 'bg-emerald-500' : sug.confidence >= 0.4 ? 'bg-amber-500' : 'bg-danger-500'}`}
                                    style={{ width: `${Math.round(sug.confidence * 100)}%` }}
                                  />
                                </div>
                                <span className="text-[8px] text-slate-600">
                                  {Math.round(sug.confidence * 100)}%
                                </span>
                              </div>
                            )}
                            {sug.source && (
                              <span className="text-[8px] text-slate-600 bg-slate-100 dark:bg-navy-800 px-1.5 py-0.5 rounded">
                                {sug.source}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 mt-2">
                            <button
                              onClick={() => handleSendToChat(sug.text)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-white/[0.04] hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors"
                            >
                              <MessageSquare size={9} />
                              {t('myWorkIdeas.aiSuggestionsPanel.toChat')}
                            </button>
                            {onInsertToWorkspace && (
                              <button
                                onClick={() => handleInsert(sug)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-c-info bg-c-info/10 hover:bg-c-info/20 transition-colors"
                              >
                                <Download size={9} />
                                {t('myWorkIdeas.aiSuggestionsPanel.insert')}
                              </button>
                            )}
                            <button
                              onClick={() => dismissSuggestion(sug.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-slate-600 hover:text-danger-500 hover:bg-danger-500/10 transition-colors ml-auto"
                              title={t('myWorkIdeas.aiSuggestionsPanel.dismiss')}
                            >
                              <XCircle size={9} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {suggestions.length === 0 && !loading && (
              <div className="text-center py-8 text-[11px] text-slate-600">
                {t('myWorkIdeas.aiSuggestionsPanel.noSuggestionsDescribeAcceptChallenge')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Natural language input */}
      <div className="px-3 py-3 border-t border-slate-200/30 dark:border-white/[0.04] space-y-2">
        <div className="flex items-center gap-1.5">
          <input
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNlSubmit()}
            placeholder={t('myWorkIdeas.aiSuggestionsPanel.askAiAboutIdea')}
            className="flex-1 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-c-focus"
          />
          <button
            onClick={handleNlSubmit}
            disabled={!nlInput.trim() || nlLoading}
            className="p-2 rounded-xl bg-c-info/10 text-c-info hover:bg-c-info/20 transition-colors disabled:opacity-40"
          >
            {nlLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>

        {onSendToChat && (
          <button
            onClick={() => onSendToChat()}
            className="w-full rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={12} />
            {t('myWorkIdeas.aiSuggestionsPanel.openAiChat')}
          </button>
        )}

        {/* Deep AI generators (moved from IdeaWorkspaceTools) */}
        <div className="pt-3 border-t border-slate-200/30 dark:border-white/[0.04]">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600 mb-2">
            {t('myWorkIdeas.aiSuggestionsPanel.aiGenerators')}
          </div>
          <div className="space-y-1">
            {getGeneratorActions(activeTool).map((gen) => {
              const Icon = gen.iconEl;
              return (
                <button
                  key={gen.action}
                  onClick={() => {
                    trackFunnelEvent('my_idea_suggested', {
                      action: gen.action,
                      tool: activeTool || 'mindmap',
                    });
                    window.dispatchEvent(
                      new CustomEvent('idea-workspace-quick-action', {
                        detail: { action: gen.action },
                      })
                    );
                  }}
                  disabled={!isAccepted}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-c-info/5 transition-colors disabled:opacity-40"
                >
                  <Icon size={12} className="text-c-info shrink-0" />
                  {isPl ? gen.labelPl : gen.labelEn}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </ToolsPanelShell>
  );
};

export default IdeaAISuggestionsPanel;
