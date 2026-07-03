/**
 * AIWhatIfScenarios — Generates alternative paths and risks for selected nodes.
 * Triggered from the tools panel or context menu.
 */
import { AlertTriangle, GitBranch, Loader2, Route, Sparkles, X, Zap } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

interface WhatIfScenario {
  id: string;
  title: string;
  description: string;
  type: 'opportunity' | 'risk' | 'alternative';
  impact: 'high' | 'medium' | 'low';
}

interface AIWhatIfScenariosProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  selectedNodeLabel: string;
  selectedNodeId: string;
  branchKey: string;
  allNodes: Array<{ id: string; data: any }>;
  locked: boolean;
  onApplyScenario: (scenario: WhatIfScenario) => void;
}

export const AIWhatIfScenarios: React.FC<AIWhatIfScenariosProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  selectedNodeLabel,
  selectedNodeId,
  branchKey,
  allNodes,
  locked,
  onApplyScenario,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([]);
  const [loading, setLoading] = useState(false);

  const generateScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const existingLabels = allNodes
        .filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'))
        .map((n) => n.data?.label)
        .filter(Boolean);

      const res = await Api.getMyIdeaAISuggestions(ideaId, {
        seedText: `What-if analysis for "${selectedNodeLabel}" in context of "${ideaTitle}". Existing ideas: ${existingLabels.slice(0, 15).join(', ')}. Generate alternative paths, risks, and opportunities.`,
        mapNodes: allNodes.map((n) => ({
          id: n.id,
          type: 'idea',
          data: { label: n.data?.label, branchKey: n.data?.branchKey },
        })),
        activeTool: 'mindmap',
        language: i18n.language,
      });

      if (res?.suggestions && Array.isArray(res.suggestions)) {
        setScenarios(
          res.suggestions.slice(0, 6).map((s: any, idx: number) => ({
            id: s.id || `wif-${idx}`,
            title: s.text || 'Scenario',
            description: s.detail || '',
            type:
              s.category === 'risk_flags'
                ? 'risk'
                : s.category === 'findings'
                  ? 'alternative'
                  : 'opportunity',
            impact:
              s.confidence && s.confidence > 0.7 ? 'high' : s.confidence > 0.4 ? 'medium' : 'low',
          }))
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate scenarios');
    } finally {
      setLoading(false);
    }
  }, [allNodes, i18n.language, ideaId, ideaTitle, selectedNodeLabel]);

  if (!open) return null;

  const typeConfig = {
    opportunity: {
      icon: Sparkles,
      color: 'text-c-success',
      bg: 'bg-c-success',
      label: isPl ? 'Szansa' : 'Opportunity',
    },
    risk: {
      icon: AlertTriangle,
      color: 'text-c-danger',
      bg: 'bg-c-danger',
      label: isPl ? 'Ryzyko' : 'Risk',
    },
    alternative: {
      icon: Route,
      color: 'text-c-info',
      bg: 'bg-c-info',
      label: isPl ? 'Alternatywa' : 'Alternative',
    },
  };

  const impactBadge = {
    high: 'bg-c-danger text-c-danger dark:bg-c-danger dark:text-c-danger',
    medium: 'bg-c-warning text-c-warning dark:bg-c-warning dark:text-c-warning',
    low: 'bg-c-surface-raised text-c-text-secondary dark:bg-c-surface dark:text-c-text-muted',
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-c-bg">
      <div className="w-full max-w-lg rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch size={14} className="text-c-text-secondary" />
              <h3 className="text-sm font-bold text-c-text dark:text-c-text">
                {isPl ? 'Co jeśli...?' : 'What if...?'}
              </h3>
            </div>
            <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mt-1">
              {isPl
                ? `Scenariusze dla: "${selectedNodeLabel}"`
                : `Scenarios for: "${selectedNodeLabel}"`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {scenarios.length === 0 && !loading && (
            <div className="text-center py-8">
              <Route size={32} className="text-c-text-secondary dark:text-c-text-muted mx-auto mb-3" />
              <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mb-4">
                {isPl
                  ? 'Wygeneruj alternatywne ścieżki, ryzyka i szanse.'
                  : 'Generate alternative paths, risks and opportunities.'}
              </p>
              <button
                onClick={generateScenarios}
                disabled={loading || locked}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised dark:bg-c-surface text-[11px] font-bold text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-all disabled:opacity-40"
              >
                <Sparkles size={14} />
                {isPl ? 'Generuj scenariusze' : 'Generate scenarios'}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-c-text-secondary" />
              <span className="text-[11px] text-c-text-secondary">
                {isPl ? 'Analizuję...' : 'Analyzing...'}
              </span>
            </div>
          )}

          {scenarios.length > 0 && (
            <div className="space-y-2">
              {scenarios.map((scenario) => {
                const cfg = typeConfig[scenario.type];
                const Icon = cfg.icon;
                return (
                  <div
                    key={scenario.id}
                    className={`p-3 rounded-xl border border-c-border-subtle dark:border-c-border ${cfg.bg}`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon size={14} className={`mt-0.5 shrink-0 ${cfg.color}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-c-text dark:text-c-text">
                            {scenario.title}
                          </span>
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${impactBadge[scenario.impact]}`}
                          >
                            {scenario.impact.toUpperCase()}
                          </span>
                        </div>
                        {scenario.description && (
                          <p className="text-[10px] text-c-text-secondary dark:text-c-text-muted mt-1 leading-relaxed">
                            {scenario.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[9px] font-medium ${cfg.color}`}>{cfg.label}</span>
                          <button
                            onClick={() => {
                              onApplyScenario(scenario);
                              toast.success(isPl ? 'Dodano do mapy' : 'Added to map', {
                                duration: 800,
                              });
                            }}
                            disabled={locked}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors disabled:opacity-40"
                          >
                            <Zap size={9} />
                            {isPl ? 'Dodaj do mapy' : 'Add to map'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={generateScenarios}
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-medium text-c-text-secondary hover:text-c-text-secondary dark:text-c-text-muted dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors disabled:opacity-40 mt-2"
              >
                <Sparkles size={10} />
                {isPl ? 'Generuj ponownie' : 'Regenerate'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIWhatIfScenarios;
