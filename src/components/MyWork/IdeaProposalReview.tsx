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

export const IdeaProposalReview: React.FC<IdeaProposalReviewProps> = ({
  batch,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  onDismiss,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pending = useMemo(
    () => (batch?.proposals || []).filter((p) => p.status === 'pending'),
    [batch]
  );

  const handleAccept = useCallback(
    (id: string) => {
      trackFunnelEvent('ideas_proposal_accepted', { tool: batch?.tool, generatorType: batch?.generatorType });
      onAccept(id);
    },
    [batch, onAccept]
  );

  const handleReject = useCallback(
    (id: string) => {
      trackFunnelEvent('ideas_proposal_rejected', { tool: batch?.tool, generatorType: batch?.generatorType });
      onReject(id);
    },
    [batch, onReject]
  );

  if (!batch || pending.length === 0) return null;

  return (
    <div className="border border-violet-300/30 dark:border-violet-700/30 rounded-2xl bg-gradient-to-b from-violet-50/60 to-white dark:from-violet-950/30 dark:to-navy-950 overflow-hidden shadow-lg shadow-violet-500/5">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-violet-200/30 dark:border-violet-800/30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/15 flex items-center justify-center">
            <Sparkles size={12} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
              {isPl ? 'Propozycje AI' : 'AI Proposals'}
            </div>
            <div className="text-[9px] text-slate-500 dark:text-slate-400">
              {isPl ? `${pending.length} do przeglądu` : `${pending.length} to review`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              onAcceptAll();
              trackFunnelEvent('ideas_proposal_accepted', { tool: batch.tool, generatorType: batch.generatorType, batch: true });
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
          >
            <Check size={10} />
            {isPl ? 'Akceptuj wszystkie' : 'Accept all'}
          </button>
          <button
            onClick={() => {
              onRejectAll();
              trackFunnelEvent('ideas_proposal_rejected', { tool: batch.tool, generatorType: batch.generatorType, batch: true });
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            <X size={10} />
            {isPl ? 'Odrzuć' : 'Reject all'}
          </button>
          <button
            onClick={onDismiss}
            className="ml-1 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            title={isPl ? 'Zamknij' : 'Dismiss'}
          >
            <X size={12} />
          </button>
        </div>
      </div>

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
  const confidencePercent = Math.round(proposal.confidence * 100);
  const confidenceColor =
    proposal.confidence >= 0.7
      ? 'bg-emerald-500'
      : proposal.confidence >= 0.4
      ? 'bg-amber-500'
      : 'bg-red-500';

  const patchSummary = useMemo(() => {
    const p = proposal.patch;
    const parts: string[] = [];
    if (p.addNodes?.length) parts.push(`+${p.addNodes.length} ${isPl ? 'węzłów' : 'nodes'}`);
    if (p.addEdges?.length) parts.push(`+${p.addEdges.length} ${isPl ? 'połączeń' : 'edges'}`);
    if (p.removeNodeIds?.length) parts.push(`-${p.removeNodeIds.length} ${isPl ? 'węzłów' : 'nodes'}`);
    if (p.removeEdgeIds?.length) parts.push(`-${p.removeEdgeIds.length} ${isPl ? 'połączeń' : 'edges'}`);
    if (p.updateNodes?.length) parts.push(`~${p.updateNodes.length} ${isPl ? 'zmian' : 'updates'}`);
    return parts.join(', ') || (isPl ? 'Zmiana konfiguracji' : 'Config change');
  }, [isPl, proposal.patch]);

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
                <div className={`h-full rounded-full ${confidenceColor}`} style={{ width: `${confidencePercent}%` }} />
              </div>
              <span className="text-[9px] text-slate-400">{confidencePercent}%</span>
            </div>
            <span className="text-[9px] text-slate-400">{patchSummary}</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-3 pb-2.5">
          {/* Patch details */}
          <div className="rounded-lg bg-slate-50/80 dark:bg-navy-900/50 p-2 mb-2 text-[10px] text-slate-600 dark:text-slate-400 font-mono space-y-0.5">
            {proposal.patch.addNodes?.map((n) => (
              <div key={n.id} className="text-emerald-600 dark:text-emerald-400">+ {n.label || n.id}</div>
            ))}
            {proposal.patch.addEdges?.map((e) => (
              <div key={e.id} className="text-emerald-600 dark:text-emerald-400">+ {e.source} → {e.target}</div>
            ))}
            {proposal.patch.removeNodeIds?.map((id) => (
              <div key={id} className="text-red-600 dark:text-red-400">- {id}</div>
            ))}
            {proposal.patch.updateNodes?.map((u) => (
              <div key={u.id} className="text-amber-600 dark:text-amber-400">~ {u.id}</div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onAccept}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/10 transition-colors"
            >
              <Check size={10} />
              {isPl ? 'Akceptuj' : 'Accept'}
            </button>
            <button
              onClick={onReject}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 transition-colors"
            >
              <X size={10} />
              {isPl ? 'Odrzuć' : 'Reject'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdeaProposalReview;
