/**
 * IdeaProposalReview — Propose→Accept UX for AI patches (V3 SSOT §4.1).
 *
 * Renders a list of AI proposals with rationale, confidence bar,
 * and Accept / Reject actions per item + batch accept/reject.
 */
import { Check, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { AIProposal, AIProposalBatch } from './ideaSelectionTypes';

interface IdeaProposalReviewProps {
  batch: AIProposalBatch | null;
  onAccept: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onDismiss: () => void;
}

function getProposalStatusLabel(proposal: AIProposal, isPl: boolean): string | null {
  if (proposal.generatorStatus === 'cross-tool') {
    return 'cross-tool';
  }
  if (proposal.generatorStatus) {
    return proposal.generatorStatus;
  }
  return proposal.maturity || null;
}

function getProposalStatusTone(proposal: AIProposal): string {
  if (proposal.generatorStatus === 'cross-tool') {
    return 'bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (proposal.generatorStatus === 'partial' || proposal.maturity === 'partial') {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
}

export const IdeaProposalReview: React.FC<IdeaProposalReviewProps> = ({
  batch,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onDismiss,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pending = useMemo(
    () => (batch?.proposals || []).filter((p) => p.status === 'pending'),
    [batch]
  );
  const rolloutGateBlocked = useMemo(
    () => pending.some((p) => p.confidence < 0.35 && (!p.citations || p.citations.length === 0)),
    [pending]
  );

  const handleAccept = useCallback(
    (id: string) => {
      trackFunnelEvent('ideas_proposal_accepted', {
        tool: batch?.tool,
        generatorType: batch?.generatorType,
      });
      onAccept(id);
    },
    [batch, onAccept]
  );

  const handleReject = useCallback(
    (id: string) => {
      trackFunnelEvent('ideas_proposal_rejected', {
        tool: batch?.tool,
        generatorType: batch?.generatorType,
      });
      onReject(id);
    },
    [batch, onReject]
  );

  if (!batch || pending.length === 0) return null;

  return (
    <div className="border border-c-info/20 rounded-2xl bg-gradient-to-b from-c-info/5 to-white dark:to-navy-950 overflow-hidden shadow-lg shadow-c-info/5">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-c-info/15">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-c-info/20 to-c-info/15 flex items-center justify-center">
            <Sparkles size={12} className="text-c-info" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {t('myWorkIdeas.proposalReview.aiProposals')}
            </div>
            <div className="text-[9px] text-slate-500 dark:text-slate-400">
              {t('myWorkIdeas.proposalReview.pendingCount', { value: pending.length })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              onAcceptAll();
              trackFunnelEvent('ideas_proposal_accepted', {
                tool: batch.tool,
                generatorType: batch.generatorType,
                batch: true,
              });
            }}
            disabled={rolloutGateBlocked}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
          >
            <Check size={10} />
            {t('myWorkIdeas.proposalReview.acceptAll')}
          </button>
          <button
            onClick={() => {
              onRejectAll();
              trackFunnelEvent('ideas_proposal_rejected', {
                tool: batch.tool,
                generatorType: batch.generatorType,
                batch: true,
              });
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-danger-600 dark:text-danger-400 bg-danger-500/10 hover:bg-danger-500/20 transition-colors"
          >
            <X size={10} />
            {t('myWorkIdeas.proposalReview.rejectAll')}
          </button>
          <button
            onClick={onDismiss}
            className="ml-1 p-1 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            title={t('myWorkIdeas.proposalReview.dismiss')}
          >
            <X size={12} />
          </button>
        </div>
      </div>
      {rolloutGateBlocked && (
        <div className="px-3 py-2 text-[10px] text-amber-600 dark:text-amber-300 bg-amber-500/5 border-b border-amber-500/10">
          {t('myWorkIdeas.proposalReview.rolloutGateLeastOneProposalHas')}
        </div>
      )}

      {/* Proposals list */}
      <div className="max-h-[320px] overflow-y-auto">
        {pending.map((proposal) => (
          <ProposalItem
            key={proposal.id}
            proposal={proposal}
            expanded={expandedId === proposal.id}
            onToggle={() => setExpandedId((prev) => (prev === proposal.id ? null : proposal.id))}
            onAccept={() => handleAccept(proposal.id)}
            onReject={() => handleReject(proposal.id)}
            isPl={isPl}
          />
        ))}
      </div>
    </div>
  );
};

// ── Single proposal item ──────────────────────────────────────────────────────

const ProposalItem: React.FC<{
  proposal: AIProposal;
  expanded: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onReject: () => void;
  isPl: boolean;
}> = ({ proposal, expanded, onToggle, onAccept, onReject, isPl }) => {
  const { t } = useTranslation();
  const confidencePercent = Math.round(proposal.confidence * 100);
  const confidenceColor =
    proposal.confidence >= 0.7
      ? 'bg-emerald-500'
      : proposal.confidence >= 0.4
        ? 'bg-amber-500'
        : 'bg-danger-500';

  const patchSummary = useMemo(() => {
    const p = proposal.patch;
    const parts: string[] = [];
    if (p.addNodes?.length)
      parts.push(`+${p.addNodes.length} ${t('myWorkIdeas.proposalReview.nodes')}`);
    if (p.addEdges?.length)
      parts.push(`+${p.addEdges.length} ${t('myWorkIdeas.proposalReview.edges')}`);
    if (p.removeNodeIds?.length)
      parts.push(`-${p.removeNodeIds.length} ${t('myWorkIdeas.proposalReview.nodes')}`);
    if (p.removeEdgeIds?.length)
      parts.push(`-${p.removeEdgeIds.length} ${t('myWorkIdeas.proposalReview.edges')}`);
    if (p.updateNodes?.length)
      parts.push(`~${p.updateNodes.length} ${t('myWorkIdeas.proposalReview.updates')}`);
    if (p.moveNodes?.length)
      parts.push(`↔${p.moveNodes.length} ${t('myWorkIdeas.proposalReview.moves')}`);
    if ((p.extensions as any)?.table?.columns?.length) {
      parts.push(
        `${(p.extensions as any).table.columns.length} ${t('myWorkIdeas.proposalReview.tableColumns')}`
      );
    }
    if ((p.extensions as any)?.table?.rows?.length) {
      parts.push(
        `${(p.extensions as any).table.rows.length} ${t('myWorkIdeas.proposalReview.rows')}`
      );
    }
    if (proposal.targetTool) {
      parts.push(`→ ${proposal.targetTool}`);
    }
    return parts.join(', ') || t('myWorkIdeas.proposalReview.configChange');
  }, [isPl, proposal.patch, proposal.targetTool]);
  const statusLabel = getProposalStatusLabel(proposal, isPl);

  return (
    <div className="border-b border-slate-200/20 dark:border-white/[0.04] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
            {proposal.rationale}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-1">
              <div className="w-12 h-1 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                <div
                  className={`h-full rounded-full ${confidenceColor}`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-600">{confidencePercent}%</span>
            </div>
            <span className="text-[9px] text-slate-600">{patchSummary}</span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={12} className="text-slate-600" />
        ) : (
          <ChevronDown size={12} className="text-slate-600" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-2.5">
          {/* Patch details */}
          <div className="rounded-lg bg-slate-50/80 dark:bg-navy-900/50 p-2 mb-2 text-[10px] text-slate-600 dark:text-slate-400 font-mono space-y-0.5">
            {proposal.patch.addNodes?.map((n) => (
              <div key={n.id} className="text-emerald-600 dark:text-emerald-400">
                + {n.label || n.id}
              </div>
            ))}
            {proposal.patch.addEdges?.map((e) => (
              <div key={e.id} className="text-emerald-600 dark:text-emerald-400">
                + {e.source} → {e.target}
              </div>
            ))}
            {proposal.patch.removeNodeIds?.map((id) => (
              <div key={id} className="text-danger-600 dark:text-danger-400">
                - {id}
              </div>
            ))}
            {proposal.patch.updateNodes?.map((u) => (
              <div key={u.id} className="text-amber-600 dark:text-amber-400">
                ~ {u.id}
              </div>
            ))}
            {proposal.patch.moveNodes?.map((move) => (
              <div
                key={`${move.nodeId}-${move.parentId || 'free'}`}
                className="text-sky-600 dark:text-sky-400"
              >
                ↔ {move.nodeId}
                {move.parentId ? ` → ${move.parentId}` : ''}
              </div>
            ))}
            {(proposal.patch.extensions as any)?.table?.rows?.length ? (
              <div className="text-sky-600 dark:text-sky-400">
                table.rows: {(proposal.patch.extensions as any).table.rows.length}
              </div>
            ) : null}
            {(proposal.patch.extensions as any)?.table?.columns?.length ? (
              <div className="text-sky-600 dark:text-sky-400">
                table.columns: {(proposal.patch.extensions as any).table.columns.length}
              </div>
            ) : null}
            {proposal.targetTool ? (
              <div className="text-sky-600 dark:text-sky-400">
                tool switch: {proposal.targetTool}
              </div>
            ) : null}
          </div>

          {(proposal.citations?.length ||
            proposal.maturity ||
            statusLabel ||
            proposal.resultSummary) && (
            <div className="mb-2 space-y-1">
              {statusLabel ? (
                <div className="flex flex-wrap gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${getProposalStatusTone(proposal)}`}
                  >
                    {statusLabel}
                  </span>
                  {proposal.maturity ? (
                    <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[9px] font-semibold text-slate-600 dark:text-slate-300">
                      maturity: {proposal.maturity}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {proposal.resultSummary ? (
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {proposal.resultSummary}
                </div>
              ) : null}
              {proposal.citations?.length ? (
                <div className="flex flex-wrap gap-1">
                  {proposal.citations.slice(0, 4).map((citation, idx) => (
                    <span
                      key={`${citation.label}-${idx}`}
                      className="rounded-full bg-c-info/10 px-2 py-0.5 text-[9px] font-semibold text-c-info"
                    >
                      {citation.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onAccept}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/10 transition-colors"
            >
              <Check size={10} />
              {t('myWorkIdeas.proposalReview.accept')}
            </button>
            <button
              onClick={onReject}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-danger-600 dark:text-danger-400 bg-danger-500/10 hover:bg-danger-500/20 border border-danger-500/10 transition-colors"
            >
              <X size={10} />
              {t('myWorkIdeas.proposalReview.reject')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdeaProposalReview;
