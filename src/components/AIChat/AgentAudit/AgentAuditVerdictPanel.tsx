/**
 * AgentAuditVerdictPanel Component
 *
 * Displays Agent Audit Layer results after Deep Thinking completes.
 * Shows quality status, gate explanations, agent reviews, and actionable followups.
 *
 * FLOW-AI-AGENT-AUDIT: Post-DT quality audit visualization
 */

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  HelpCircle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ==========================================
// TYPES
// ==========================================

export type QualityStatus = 'PASS' | 'PASS_WITH_RISKS' | 'FAIL';
export type GateId = 'A' | 'B' | 'C' | 'D';
export type RiskArea =
  | 'cashflow'
  | 'capex'
  | 'safety'
  | 'uptime'
  | 'quality'
  | 'compliance'
  | 'cybersecurity'
  | 'vendor_risk'
  | 'delivery_otif'
  | 'change_management'
  | 'architecture_integrations'
  | 'other';

export interface GateExplanation {
  gate: GateId;
  reason: string;
  triggeredBy?: {
    agentId?: string;
    area?: RiskArea;
    severity?: 'low' | 'medium' | 'high';
    claim?: string;
  };
}

export interface SourceUsed {
  type: 'dt_section' | 'kb_snippet' | 'web_source';
  section?: string;
  quote?: string;
  kbId?: string;
  docId?: string;
  title?: string;
  version?: string;
  snippet?: string;
  score?: number;
  url?: string;
  domain?: string;
}

export interface Finding {
  area: RiskArea;
  severity: 'low' | 'medium' | 'high';
  claim: string;
  evidenceFromDT: string[];
  sourcesUsed: SourceUsed[];
  missingDataQuestions: string[];
  suggestedDeepening: string;
}

export interface AgentReview {
  agentId: string;
  agentVersion?: string;
  verdict: 'ok' | 'risk' | 'blocker';
  overreach: 'none' | 'suspected' | 'hard';
  overreachReason?: string;
  observations: string[];
  challengedAssumptions: string[];
  impactIfIgnored?: string;
  whenItFails?: string;
  topQuestions: string[];
  findings: Finding[];
  conflicts: Array<{
    withAgentId: string;
    aboutArea: RiskArea;
    conflictStatement: string;
  }>;
}

export interface ActionableFollowup {
  id: string;
  owner: 'user' | 'deep_thinking';
  question: string;
  whyCritical: string;
}

export interface OrchestratorVerdict {
  qualityStatus: QualityStatus;
  gatesTriggered: GateId[];
  gateExplanations: GateExplanation[];
  agentsSummary: Array<{ agentId: string; agentVersion: string }>;
  sourcesSummary: {
    counts: { dt_section: number; kb_snippet: number; web_source: number };
    kb: Array<{ kbId: string; docId: string; title: string; version?: string }>;
    web: Array<{ url: string; title?: string; domain?: string }>;
  };
  criticalRisks: Finding[];
  actionableFollowups: ActionableFollowup[];
  directedLoop: {
    iteration: 1 | 2;
    deepThinkingPrompt: string;
  } | null;
}

export interface AgentDefinition {
  id: string;
  displayName: { pl: string; en: string };
  description: { pl: string; en: string };
}

interface AgentAuditVerdictPanelProps {
  verdict: OrchestratorVerdict;
  reviews: AgentReview[];
  orchestratorRunId: string;
  agentRegistry: Record<string, AgentDefinition>;
  language?: string;
  onAcceptRisk?: (runId: string) => Promise<void>;
  onTriggerDirectedLoop?: (prompt: string) => void;
  isAcceptingRisk?: boolean;
  className?: string;
}

// ==========================================
// HELPER COMPONENTS
// ==========================================

const StatusBadge: React.FC<{ status: QualityStatus }> = ({ status }) => {
  const config = {
    PASS: {
      icon: ShieldCheck,
      label: 'PASS',
      className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
    },
    PASS_WITH_RISKS: {
      icon: ShieldAlert,
      label: 'PASS WITH RISKS',
      className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    },
    FAIL: {
      icon: XCircle,
      label: 'FAIL',
      className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
    },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${className}`}>
      <Icon size={14} />
      {label}
    </div>
  );
};

const GateBadge: React.FC<{ gate: GateId }> = ({ gate }) => {
  const config: Record<GateId, { label: string; className: string }> = {
    A: { label: 'Gate A: Critical Finance', className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
    B: { label: 'Gate B: Consensus Risk', className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
    C: { label: 'Gate C: Missing Data', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
    D: { label: 'Gate D: Overreach', className: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  };

  const { label, className } = config[gate];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${className}`}>
      {label}
    </span>
  );
};

const SeverityBadge: React.FC<{ severity: 'low' | 'medium' | 'high' }> = ({ severity }) => {
  const config = {
    low: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  };

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${config[severity]}`}>
      {severity}
    </span>
  );
};

const SourceItem: React.FC<{ source: SourceUsed; index: number }> = ({ source, index }) => {
  if (source.type === 'dt_section') {
    return (
      <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
        <FileText size={12} className="flex-shrink-0 mt-0.5 text-slate-400" />
        <div>
          <span className="font-medium">DT Report</span>
          {source.quote && (
            <span className="text-slate-500 dark:text-slate-400">: "{source.quote.slice(0, 120)}..."</span>
          )}
        </div>
      </div>
    );
  }

  if (source.type === 'kb_snippet') {
    return (
      <div className="text-[11px] text-slate-600 dark:text-slate-300">
        <div className="flex items-start gap-1.5">
          <Shield size={12} className="flex-shrink-0 mt-0.5 text-blue-500" />
          <div>
            <span className="font-medium">KB</span>
            <span className="text-slate-500 dark:text-slate-400">
              : {source.title || 'Knowledge Base'}
              {source.version && ` (v${source.version})`}
              {typeof source.score === 'number' && ` · ${(source.score * 100).toFixed(0)}%`}
            </span>
          </div>
        </div>
        {source.snippet && (
          <div className="mt-1 ml-5 px-2 py-1 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded text-[10px] leading-snug">
            {source.snippet.slice(0, 200)}...
          </div>
        )}
      </div>
    );
  }

  if (source.type === 'web_source' && source.url) {
    return (
      <div className="text-[11px] flex items-center gap-1.5">
        <ExternalLink size={12} className="flex-shrink-0 text-indigo-500" />
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 hover:text-primary-700 underline truncate"
        >
          {source.title || source.domain || source.url}
        </a>
      </div>
    );
  }

  return null;
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const AgentAuditVerdictPanel: React.FC<AgentAuditVerdictPanelProps> = ({
  verdict,
  reviews,
  orchestratorRunId,
  agentRegistry,
  language = 'pl',
  onAcceptRisk,
  onTriggerDirectedLoop,
  isAcceptingRisk = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeAgentId, setActiveAgentId] = useState<string>(reviews[0]?.agentId || '');
  const [showFollowups, setShowFollowups] = useState(false);

  const activeReview = reviews.find((r) => r.agentId === activeAgentId) || reviews[0];
  const isPl = language.startsWith('pl');

  const getAgentLabel = (agentId: string) => {
    const def = agentRegistry[agentId];
    if (!def) return agentId;
    return isPl ? def.displayName.pl : def.displayName.en;
  };

  const getRiskAreaLabel = (area: RiskArea): string => {
    const labels: Record<RiskArea, { pl: string; en: string }> = {
      cashflow: { pl: 'Cashflow', en: 'Cashflow' },
      capex: { pl: 'CAPEX', en: 'CAPEX' },
      safety: { pl: 'Bezpieczeństwo', en: 'Safety' },
      uptime: { pl: 'Dostępność', en: 'Uptime' },
      quality: { pl: 'Jakość', en: 'Quality' },
      compliance: { pl: 'Compliance', en: 'Compliance' },
      cybersecurity: { pl: 'Cyberbezpieczeństwo', en: 'Cybersecurity' },
      vendor_risk: { pl: 'Ryzyko dostawców', en: 'Vendor Risk' },
      delivery_otif: { pl: 'OTIF/Dostawa', en: 'Delivery/OTIF' },
      change_management: { pl: 'Zarządzanie zmianą', en: 'Change Management' },
      architecture_integrations: { pl: 'Architektura/Integracje', en: 'Architecture/Integrations' },
      other: { pl: 'Inne', en: 'Other' },
    };
    return isPl ? labels[area].pl : labels[area].en;
  };

  return (
    <div className={`bg-slate-50 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/50 dark:hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Shield size={18} />
          </div>
          <div className="text-left">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('agentAudit.title', 'Agent Audit Layer')}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {reviews.length} {t('agentAudit.reviewers', 'reviewers')} · {verdict.gatesTriggered.length} {t('agentAudit.gatesTriggered', 'gates triggered')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={verdict.qualityStatus} />
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-navy-700">
          {/* Gates Section */}
          {verdict.gatesTriggered.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700">
              <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {t('agentAudit.triggeredGates', 'Triggered Quality Gates')}
              </h5>
              <div className="space-y-2">
                {verdict.gateExplanations.map((ge, idx) => (
                  <div key={`${ge.gate}-${idx}`} className="flex items-start gap-2">
                    <GateBadge gate={ge.gate} />
                    <p className="text-xs text-slate-600 dark:text-slate-300 flex-1">
                      {ge.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Critical Risks */}
          {verdict.criticalRisks.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-red-50/50 dark:bg-red-900/10">
              <h5 className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                {t('agentAudit.criticalRisks', 'Critical Risks')} ({verdict.criticalRisks.length})
              </h5>
              <div className="space-y-2">
                {verdict.criticalRisks.slice(0, 5).map((risk, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <SeverityBadge severity={risk.severity} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {getRiskAreaLabel(risk.area)}:
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-300 ml-1">
                        {risk.claim}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent Tabs */}
          {reviews.length > 0 && (
            <div className="px-4 py-3">
              <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {t('agentAudit.agentReviews', 'Agent Reviews')}
              </h5>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {reviews.map((review) => {
                  const isActive = review.agentId === activeAgentId;
                  const isRejected = review.overreach === 'hard';
                  return (
                    <button
                      key={review.agentId}
                      onClick={() => setActiveAgentId(review.agentId)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        isActive
                          ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                          : isRejected
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 line-through'
                          : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                      }`}
                    >
                      {getAgentLabel(review.agentId)}
                      {isRejected && ' (rejected)'}
                    </button>
                  );
                })}
              </div>

              {/* Active Review Details */}
              {activeReview && (
                <div className="bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {getAgentLabel(activeReview.agentId)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded ${
                        activeReview.verdict === 'ok' ? 'bg-green-100 text-green-700' :
                        activeReview.verdict === 'risk' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {activeReview.verdict.toUpperCase()}
                      </span>
                      {activeReview.overreach !== 'none' && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                          Overreach: {activeReview.overreach}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Impact & When It Fails */}
                  {(activeReview.impactIfIgnored || activeReview.whenItFails) && (
                    <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs">
                      {activeReview.impactIfIgnored && (
                        <p className="text-amber-800 dark:text-amber-200">
                          <strong>{t('agentAudit.impactIfIgnored', 'Impact if ignored')}:</strong> {activeReview.impactIfIgnored}
                        </p>
                      )}
                      {activeReview.whenItFails && (
                        <p className="text-amber-800 dark:text-amber-200 mt-1">
                          <strong>{t('agentAudit.whenItFails', 'When it fails')}:</strong> {activeReview.whenItFails}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Findings */}
                  {activeReview.findings.length > 0 && (
                    <div className="mb-3">
                      <h6 className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                        {t('agentAudit.findings', 'Findings')} ({activeReview.findings.length})
                      </h6>
                      <div className="space-y-2">
                        {activeReview.findings.slice(0, 5).map((finding, idx) => (
                          <div key={idx} className="p-2 bg-slate-50 dark:bg-navy-900 rounded border border-slate-200 dark:border-navy-700">
                            <div className="flex items-start gap-2 mb-1">
                              <SeverityBadge severity={finding.severity} />
                              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                {getRiskAreaLabel(finding.area)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-200 mb-1">
                              {finding.claim}
                            </p>
                            {finding.suggestedDeepening && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                → {finding.suggestedDeepening}
                              </p>
                            )}
                            {finding.sourcesUsed.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-navy-700 space-y-1">
                                {finding.sourcesUsed.slice(0, 3).map((source, sIdx) => (
                                  <SourceItem key={sIdx} source={source} index={sIdx} />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Questions */}
                  {activeReview.topQuestions.length > 0 && (
                    <div>
                      <h6 className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                        <HelpCircle size={12} />
                        {t('agentAudit.topQuestions', 'Top Questions')}
                      </h6>
                      <ul className="space-y-1">
                        {activeReview.topQuestions.map((q, idx) => (
                          <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                            <span className="text-slate-400">•</span>
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actionable Followups */}
          {verdict.actionableFollowups.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700">
              <button
                onClick={() => setShowFollowups(!showFollowups)}
                className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-primary-600"
              >
                <CheckCircle2 size={14} />
                {t('agentAudit.actionableFollowups', 'Actionable Followups')} ({verdict.actionableFollowups.length})
                {showFollowups ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showFollowups && (
                <div className="mt-2 space-y-2">
                  {verdict.actionableFollowups.map((followup) => (
                    <div key={followup.id} className="p-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded text-xs">
                      <p className="text-slate-700 dark:text-slate-200 font-medium">{followup.question}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                        {followup.whyCritical}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {verdict.qualityStatus === 'FAIL' && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-slate-100 dark:bg-navy-800/50">
              <div className="flex flex-wrap items-center gap-3">
                {onAcceptRisk && (
                  <button
                    onClick={() => onAcceptRisk(orchestratorRunId)}
                    disabled={isAcceptingRisk}
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAcceptingRisk ? t('agentAudit.accepting', 'Accepting...') : t('agentAudit.acceptRisk', 'Accept Risk & Proceed')}
                  </button>
                )}
                {verdict.directedLoop && onTriggerDirectedLoop && (
                  <button
                    onClick={() => onTriggerDirectedLoop(verdict.directedLoop!.deepThinkingPrompt)}
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                  >
                    {t('agentAudit.triggerDeepening', 'Trigger Directed Deepening')} (Loop {verdict.directedLoop.iteration}/2)
                  </button>
                )}
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {t('agentAudit.auditTrailNote', 'Actions are recorded in the audit trail.')}
                </p>
              </div>
            </div>
          )}

          {/* Sources Summary */}
          <div className="px-4 py-2 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/20">
            <div className="flex items-center gap-4 text-[10px] text-slate-500 dark:text-slate-400">
              <span>Sources: {verdict.sourcesSummary.counts.dt_section} DT</span>
              <span>{verdict.sourcesSummary.counts.kb_snippet} KB</span>
              <span>{verdict.sourcesSummary.counts.web_source} Web</span>
              <span className="ml-auto">Run: {orchestratorRunId.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentAuditVerdictPanel;
