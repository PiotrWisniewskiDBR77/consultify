/**
 * AgentSuggestionCard Component
 *
 * Displays suggested agents for audit review before Deep Thinking starts.
 * Allows user to select/deselect agents and configure audit intent.
 *
 * FLOW-AI-AGENT-AUDIT: Pre-DT agent selection UI
 */

import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Settings2,
  Shield,
  Sparkles,
  User,
  Users,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ==========================================
// TYPES
// ==========================================

export type UserIntent = 'validate' | 'stress_test' | 'approve';
export type AgentKind = 'industry' | 'functional' | 'adversarial';

export interface SuggestedAgent {
  agentId: string;
  type: AgentKind;
  whySelected: string;
  expectedFindings: string[];
  priority: 1 | 2 | 3;
  signals?: string[];
}

export interface AgentDefinition {
  id: string;
  kind: AgentKind;
  displayName: { pl: string; en: string };
  description: { pl: string; en: string };
  defaultRiskAreas: string[];
}

export interface DecisionContext {
  topic: string;
  industry?: string;
  horizon?: string;
  functions?: string[];
  riskFocus?: string[];
}

interface AgentSuggestionCardProps {
  suggestedAgents: SuggestedAgent[];
  selectedAgentIds: string[];
  userIntent: UserIntent;
  maxAgents: 2 | 3 | 4;
  decisionContext: DecisionContext;
  agentRegistry: Record<string, AgentDefinition>;
  language?: string;
  onAgentToggle: (agentId: string) => void;
  onUserIntentChange: (intent: UserIntent) => void;
  onMaxAgentsChange: (max: 2 | 3 | 4) => void;
  onRefreshSuggestions?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

// ==========================================
// HELPER COMPONENTS
// ==========================================

const AgentKindIcon: React.FC<{ kind: AgentKind; className?: string }> = ({
  kind,
  className = '',
}) => {
  const icons = {
    industry: Building2,
    functional: User,
    adversarial: Zap,
  };
  const Icon = icons[kind];
  return <Icon size={14} className={className} />;
};

const AgentKindBadge: React.FC<{ kind: AgentKind; language: string }> = ({ kind, language }) => {
  const isPl = language.startsWith('pl');
  const config = {
    industry: {
      label: isPl ? 'Branża' : 'Industry',
      className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    },
    functional: {
      label: isPl ? 'Funkcja' : 'Function',
      className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    },
    adversarial: {
      label: isPl ? 'Kontrarianin' : 'Adversarial',
      className: 'bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-secondary',
    },
  };

  const { label, className } = config[kind];

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${className}`}
    >
      <AgentKindIcon kind={kind} className="w-3 h-3" />
      {label}
    </span>
  );
};

const PriorityIndicator: React.FC<{ priority: 1 | 2 | 3 }> = ({ priority }) => {
  const dots = Array.from({ length: 3 }, (_, i) => i < priority);
  return (
    <div className="flex items-center gap-0.5" title={`Priority: ${priority}/3`}>
      {dots.map((filled, idx) => (
        <div
          key={idx}
          className={`w-1.5 h-1.5 rounded-full ${
            filled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
      ))}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const AgentSuggestionCard: React.FC<AgentSuggestionCardProps> = ({
  suggestedAgents,
  selectedAgentIds,
  userIntent,
  maxAgents,
  decisionContext,
  agentRegistry,
  language = 'pl',
  onAgentToggle,
  onUserIntentChange,
  onMaxAgentsChange,
  onRefreshSuggestions,
  isRefreshing = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

  const isPl = language.startsWith('pl');

  const getAgentLabel = (agentId: string): string => {
    const def = agentRegistry[agentId];
    if (!def) return agentId;
    return isPl ? def.displayName.pl : def.displayName.en;
  };

  const getAgentDescription = (agentId: string): string => {
    const def = agentRegistry[agentId];
    if (!def) return '';
    return isPl ? def.description.pl : def.description.en;
  };

  const intentLabels: Record<UserIntent, { label: string; description: string }> = {
    validate: {
      label: isPl ? 'Walidacja' : 'Validate',
      description: isPl
        ? 'Standardowa walidacja ryzyk i jakości'
        : 'Standard risk and quality validation',
    },
    stress_test: {
      label: isPl ? 'Stress-test' : 'Stress-test',
      description: isPl
        ? 'Głęboka analiza z agentem kontrariańskim'
        : 'Deep analysis with adversarial agent',
    },
    approve: {
      label: isPl ? 'Zatwierdzenie' : 'Approve',
      description: isPl
        ? 'Szybka walidacja przed zatwierdzeniem'
        : 'Quick validation before approval',
    },
  };

  const selectedCount = selectedAgentIds.length;
  const canSelectMore = selectedCount < maxAgents;

  return (
    <div
      className={`bg-gradient-to-br from-c-surface-raised to-c-surface-raised dark:from-navy-800 dark:to-c-surface-raised rounded-xl border border-c-border dark:border-c-border ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-c-border dark:border-c-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-c-surface-raised dark:bg-c-surface-raised rounded-lg text-c-text-secondary dark:text-c-text-secondary">
              <Users size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t('agentAudit.suggestedReviewers', 'Suggested Reviewers')}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('agentAudit.willAuditAfterDT', 'Will audit the Deep Thinking report')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {selectedCount}/{maxAgents} {t('agentAudit.selected', 'selected')}
            </span>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg transition-colors ${
                showSettings
                  ? 'bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-secondary'
                  : 'hover:bg-c-surface-hover dark:hover:bg-c-surface-hover text-slate-500 dark:text-slate-400'
              }`}
              title={t('agentAudit.settings', 'Settings')}
            >
              <Settings2 size={14} />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-3 pt-3 border-t border-c-border dark:border-c-border space-y-3">
            {/* Intent Selector */}
            <div>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 block mb-1.5">
                {t('agentAudit.auditIntent', 'Audit Intent')}
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(intentLabels) as UserIntent[]).map((intent) => (
                  <button
                    key={intent}
                    onClick={() => onUserIntentChange(intent)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      userIntent === intent
                        ? 'bg-c-text border-c-text text-c-bg'
                        : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                    }`}
                  >
                    {intentLabels[intent].label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {intentLabels[userIntent].description}
              </p>
            </div>

            {/* Max Agents Selector */}
            <div>
              <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300 block mb-1.5">
                {t('agentAudit.maxReviewers', 'Max Reviewers')}
              </label>
              <div className="flex gap-2">
                {([2, 3, 4] as const).map((num) => (
                  <button
                    key={num}
                    onClick={() => onMaxAgentsChange(num)}
                    className={`w-10 h-8 text-xs rounded-lg border transition-colors ${
                      maxAgents === num
                        ? 'bg-c-text border-c-text text-c-bg'
                        : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Refresh Button */}
            {onRefreshSuggestions && (
              <button
                onClick={onRefreshSuggestions}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-c-text-secondary dark:text-c-text-secondary hover:bg-c-surface-hover dark:hover:bg-c-surface-hover rounded-lg transition-colors disabled:opacity-50"
              >
                <Sparkles size={12} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing
                  ? t('agentAudit.refreshing', 'Refreshing...')
                  : t('agentAudit.refreshSuggestions', 'Refresh Suggestions')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Agent List */}
      <div className="p-3 space-y-2">
        {suggestedAgents.map((agent) => {
          const isSelected = selectedAgentIds.includes(agent.agentId);
          const isExpanded = expandedAgentId === agent.agentId;
          const def = agentRegistry[agent.agentId];
          const canToggle = isSelected || canSelectMore;

          return (
            <div
              key={agent.agentId}
              className={`bg-white dark:bg-navy-950 border rounded-lg transition-all ${
                isSelected
                  ? 'border-c-border dark:border-c-border ring-1 ring-c-focus dark:ring-c-focus'
                  : 'border-slate-200 dark:border-navy-700'
              }`}
            >
              <div className="flex items-start gap-2 p-2.5">
                {/* Checkbox */}
                <label className="flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => canToggle && onAgentToggle(agent.agentId)}
                    disabled={!canToggle}
                    className="w-4 h-4 rounded border-slate-300 text-c-text-secondary focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </label>

                {/* Agent Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {getAgentLabel(agent.agentId)}
                    </span>
                    <AgentKindBadge kind={agent.type} language={language} />
                    <PriorityIndicator priority={agent.priority} />
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {agent.whySelected}
                  </p>

                  {/* Expand/Collapse */}
                  <button
                    onClick={() => setExpandedAgentId(isExpanded ? null : agent.agentId)}
                    className="flex items-center gap-1 mt-1.5 text-[11px] text-c-text-secondary dark:text-c-text-secondary hover:underline"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp size={12} />
                        {t('agentAudit.showLess', 'Show less')}
                      </>
                    ) : (
                      <>
                        <ChevronDown size={12} />
                        {t('agentAudit.showMore', 'Show more')}
                      </>
                    )}
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-navy-800 space-y-2">
                      {/* Description */}
                      {def && (
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {getAgentDescription(agent.agentId)}
                        </p>
                      )}

                      {/* Expected Findings */}
                      {agent.expectedFindings.length > 0 && (
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
                            {t('agentAudit.expectedFindings', 'Expected Findings')}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {agent.expectedFindings.map((finding, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 rounded"
                              >
                                {finding}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Risk Areas */}
                      {def?.defaultRiskAreas && def.defaultRiskAreas.length > 0 && (
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
                            {t('agentAudit.riskAreas', 'Risk Areas')}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {def.defaultRiskAreas.map((area, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded"
                              >
                                {area.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Signals */}
                      {agent.signals && agent.signals.length > 0 && (
                        <div>
                          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">
                            {t('agentAudit.detectedSignals', 'Detected Signals')}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {agent.signals.map((signal, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 text-[10px] bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-secondary rounded"
                              >
                                {signal}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selection Indicator */}
                {isSelected && (
                  <CheckCircle2
                    size={16}
                    className="flex-shrink-0 text-c-text-secondary dark:text-c-text-secondary"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-c-border dark:border-c-border bg-c-surface-raised dark:bg-c-surface-raised">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">
          <Shield size={10} className="inline mr-1" />
          {t(
            'agentAudit.noInterference',
            'Agents will audit the final report only — no interference with Deep Thinking process.'
          )}
        </p>
      </div>
    </div>
  );
};

export default AgentSuggestionCard;
