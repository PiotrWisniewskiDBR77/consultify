import { Check, Loader2, Play, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { usePortfolioStore } from '@/store/portfolioSlice';
import type { TeresaChatProposal } from '@/types';

type ProposalAction = 'approve' | 'reject' | 'execute';

interface TeresaProposalCardProps {
  proposal: TeresaChatProposal;
  onNavigate?: (proposal: TeresaChatProposal) => void;
  onProposalUpdated?: (proposal: TeresaChatProposal) => void;
  onLifecycleMessage?: (message: string) => void;
}

const STATUS_STYLES: Record<TeresaChatProposal['state'], { badge: string; label: string }> = {
  proposal: {
    badge:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
    label: 'Proposal ready',
  },
  pending_approval: {
    badge:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
    label: 'Awaiting approval',
  },
  approved: {
    badge:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
    label: 'Approved',
  },
  executing: {
    badge:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    label: 'Executing',
  },
  completed: {
    badge:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300',
    label: 'Completed',
  },
  rejected: {
    badge:
      'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
    label: 'Rejected',
  },
};

function unwrapProposalResponse(payload: any): TeresaChatProposal | null {
  if (!payload) return null;
  if (payload?.data?.proposal) return payload.data.proposal as TeresaChatProposal;
  if (payload?.proposalId) return payload as TeresaChatProposal;
  if (payload?.data?.proposalId) return payload.data as TeresaChatProposal;
  return null;
}

export const TeresaProposalCard: React.FC<TeresaProposalCardProps> = ({
  proposal,
  onNavigate,
  onProposalUpdated,
  onLifecycleMessage,
}) => {
  const { t } = useTranslation();
  const [currentProposal, setCurrentProposal] = useState<TeresaChatProposal>(proposal);
  const [busyAction, setBusyAction] = useState<ProposalAction | null>(null);

  useEffect(() => {
    setCurrentProposal(proposal);
  }, [proposal]);

  const statusConfig = useMemo(
    () => STATUS_STYLES[currentProposal.state] || STATUS_STYLES.proposal,
    [currentProposal.state]
  );

  const applyProposalUpdate = (
    nextProposal: TeresaChatProposal | null,
    fallbackMessage?: string
  ) => {
    if (!nextProposal) return;
    setCurrentProposal(nextProposal);
    onProposalUpdated?.(nextProposal);
    if (!onProposalUpdated && fallbackMessage) {
      onLifecycleMessage?.(fallbackMessage);
    }
  };

  const handleAction = async (action: ProposalAction) => {
    setBusyAction(action);
    try {
      if (action === 'approve') {
        const response = await Api.approveTeresaProposal(currentProposal.proposalId);
        applyProposalUpdate(
          unwrapProposalResponse(response),
          t('aiChat.teresaProposal.approved', 'Teresa proposal approved.')
        );
        usePortfolioStore.getState().triggerRefresh();
        return;
      }

      if (action === 'reject') {
        const response = await Api.rejectTeresaProposal(currentProposal.proposalId);
        applyProposalUpdate(
          unwrapProposalResponse(response),
          t('aiChat.teresaProposal.rejected', 'Teresa proposal rejected.')
        );
        usePortfolioStore.getState().triggerRefresh();
        return;
      }

      const response = await Api.executeTeresaProposal(currentProposal.proposalId);
      const nextProposal = unwrapProposalResponse(response);
      applyProposalUpdate(
        nextProposal,
        t('aiChat.teresaProposal.executed', 'Teresa handoff executed.')
      );
      usePortfolioStore.getState().triggerRefresh();
    } catch (error) {
      onLifecycleMessage?.(
        error instanceof Error
          ? error.message
          : t('aiChat.teresaProposal.failed', 'Teresa proposal action failed.')
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-primary-200/70 bg-white/90 p-4 shadow-sm dark:border-primary-900/60 dark:bg-navy-900/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
            Teresa proposal
          </div>
          <div className="text-sm font-semibold text-navy-900 dark:text-slate-100">
            {currentProposal.title}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {currentProposal.summary}
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusConfig.badge}`}
        >
          {t(`aiChat.teresaProposal.state.${currentProposal.state}`, statusConfig.label)}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-navy-700 dark:bg-navy-950/60 dark:text-slate-300">
        <div className="font-medium text-slate-700 dark:text-slate-200">
          {currentProposal.targetLabel} · {currentProposal.handoffIntent}
        </div>
        {currentProposal.previewLines.length > 0 && (
          <div className="mt-2 space-y-1">
            {currentProposal.previewLines.map((line, index) => (
              <div key={`${currentProposal.proposalId}-${index}`}>{line}</div>
            ))}
          </div>
        )}
        {currentProposal.resultRef && (
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Ref: {currentProposal.resultRef}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {currentProposal.allowedActions.includes('approve') && (
          <button
            onClick={() => handleAction('approve')}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {busyAction === 'approve' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} />
            )}
            {t('aiChat.teresaProposal.approve', 'Approve')}
          </button>
        )}

        {currentProposal.allowedActions.includes('reject') && (
          <button
            onClick={() => handleAction('reject')}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {busyAction === 'reject' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <X size={13} />
            )}
            {t('aiChat.teresaProposal.reject', 'Reject')}
          </button>
        )}

        {currentProposal.allowedActions.includes('execute') && (
          <button
            onClick={() => handleAction('execute')}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-3 py-1.5 text-xs font-medium text-c-bg transition-colors hover:bg-c-text-secondary disabled:opacity-60"
          >
            {busyAction === 'execute' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} />
            )}
            {t('aiChat.teresaProposal.execute', 'Execute')}
          </button>
        )}

        {currentProposal.allowedActions.includes('navigate') && (
          <button
            onClick={() => onNavigate?.(currentProposal)}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:opacity-60 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300 dark:hover:bg-primary-900/35"
          >
            {t('aiChat.teresaProposal.navigate', 'Open target')}
          </button>
        )}
      </div>
    </div>
  );
};
