/**
 * ExecutionProposalMessage
 *
 * First-class chat bubble renderer for the V8 governed proposal / execution
 * message family (`execution_proposal`, `execution_progress`, `execution_result`).
 *
 * This component implements the user-visible contract defined in
 * `docs/product/CHAT_V8_ACTIONS_AND_APPROVALS.md` and
 * `docs/product/CHAT_V8_RESPONSE_MODEL.md`: proposals are rendered as explicit
 * first-class proposal messages in the thread rather than as hidden side-effects
 * inside a generic `actions` field.
 *
 * Design choices:
 *  - Additive only. If metadata is missing or malformed, we fall back to a
 *    neutral summary card using `msg.content` so existing threads never break.
 *  - Lifecycle vocabulary is the V8 canonical one (`proposed`, `pending_review`,
 *    `approved`, `rejected`, `executing`, `executed`, `failed`, `audited`).
 *  - Action handlers are optional — the message still renders in read-only
 *    mode when no approve/reject hooks are provided, which is the correct
 *    behavior for historical conversations being revisited.
 */

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  FileSearch,
  Gavel,
  Loader2,
  PlayCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { usePermissions } from '../../hooks/usePermissions';
import { useProposalLifecycle } from '../../store/useProposalLifecycleStore';
import { ChatMessage, V8LifecycleState } from '../../types';
import { TrustPanel } from './TrustPanel';

// ============================================================================
// Types
// ============================================================================

export type ExecutionMessageType = 'execution_proposal' | 'execution_progress' | 'execution_result';
type TrustBundle = unknown;

export interface ExecutionProposalMessageProps {
  msg: ChatMessage;
  isCompact?: boolean;
  isRtl?: boolean;

  /**
   * Optional approve/reject hooks. When omitted the card renders in read-only
   * mode (e.g. revisiting a closed proposal from history).
   */
  onApprove?: (proposalId: string, msg: ChatMessage) => void;
  onReject?: (proposalId: string, msg: ChatMessage, reason?: string) => void;
  onExecute?: (proposalId: string, msg: ChatMessage) => void;

  /**
   * Optional handler for inspecting the underlying execution run / audit log.
   */
  onInspect?: (proposalId: string, msg: ChatMessage) => void;

  /**
   * Busy flags so the parent can disable buttons while a background request
   * is in flight.
   */
  isApproveBusy?: boolean;
  isRejectBusy?: boolean;
  isExecuteBusy?: boolean;
}

interface ProposalMetadata {
  proposalId?: string;
  runId?: string;
  lifecycleState?: V8LifecycleState;
  planSummary?: string;
  stepCount?: number;
  risk?: 'low' | 'medium' | 'high' | string;
  steps?: Array<{ id?: string; label?: string; description?: string }>;
  reviewer?: { userId?: string; name?: string } | null;
  rejectionReason?: string | null;
  expiresAt?: string | null;
  /** Pass-through preview produced by the execution planner. */
  preview?: string | null;
}

interface ProposalStepListProps {
  steps: Array<{ id?: string; label?: string; description?: string }>;
  isRtl: boolean;
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => string;
}

const ProposalStepList: React.FC<ProposalStepListProps> = ({ steps, isRtl, t }) => {
  if (steps.length === 0) return null;

  return (
    <ol
      className={`mt-2 space-y-1 list-decimal ${isRtl ? 'pr-5' : 'pl-5'} text-[12px] text-slate-600 dark:text-slate-300`}
    >
      {steps.slice(0, 8).map((step, i) => (
        <li key={step.id || i}>
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {String(step.label || t('chatProposal.step.untitled', 'Step'))}
          </span>
          {step.description ? (
            <span className="text-slate-500 dark:text-slate-400">
              {' — '}
              {String(step.description)}
            </span>
          ) : null}
        </li>
      ))}
      {steps.length > 8 ? (
        <li className="list-none text-slate-600 dark:text-slate-500 italic">
          {t('chatProposal.step.more', '…and {{count}} more', {
            count: steps.length - 8,
          } as any)}
        </li>
      ) : null}
    </ol>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function extractProposalMetadata(msg: ChatMessage): ProposalMetadata {
  const raw = ((msg as any).metadata || {}) as Record<string, unknown>;
  const proposal = (raw.executionProposal || raw.proposal || raw) as Record<string, unknown>;
  return {
    proposalId: (proposal?.proposalId || proposal?.id || raw.proposalId) as string | undefined,
    runId: (proposal?.runId || raw.runId) as string | undefined,
    lifecycleState: (proposal?.lifecycleState || raw.lifecycleState) as
      | V8LifecycleState
      | undefined,
    planSummary: (proposal?.planSummary || proposal?.summary || raw.planSummary) as
      | string
      | undefined,
    stepCount:
      typeof proposal?.stepCount === 'number'
        ? (proposal.stepCount as number)
        : Array.isArray(proposal?.steps)
          ? (proposal!.steps as unknown[]).length
          : undefined,
    risk: (proposal?.risk || raw.risk) as string | undefined,
    steps: Array.isArray(proposal?.steps)
      ? (proposal!.steps as Array<{ id?: string; label?: string; description?: string }>)
      : undefined,
    reviewer: (proposal?.reviewer || raw.reviewer || null) as ProposalMetadata['reviewer'],
    rejectionReason: (proposal?.rejectionReason || raw.rejectionReason || null) as string | null,
    expiresAt: (proposal?.expiresAt || raw.expiresAt || null) as string | null,
    preview: (proposal?.preview || raw.preview || null) as string | null,
  };
}

interface LifecycleVisual {
  label: string;
  Icon: React.ComponentType<{ size?: number | string; className?: string }>;
  pillClassName: string;
  cardAccentClassName: string;
}

function lifecycleVisual(
  state: V8LifecycleState | undefined,
  messageType: ExecutionMessageType,
  t: (k: string, d?: string) => string
): LifecycleVisual {
  const effective: V8LifecycleState =
    state ||
    (messageType === 'execution_result'
      ? 'executed'
      : messageType === 'execution_progress'
        ? 'executing'
        : 'pending_review');

  switch (effective) {
    case 'proposed':
      return {
        label: t('chatProposal.state.proposed', 'Proposal drafted'),
        Icon: Gavel,
        pillClassName:
          'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-navy-700',
        cardAccentClassName: 'border-slate-200 dark:border-navy-700',
      };
    case 'pending_review':
      return {
        label: t('chatProposal.state.pendingReview', 'Awaiting review'),
        Icon: Clock3,
        pillClassName:
          'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900/40',
        cardAccentClassName: 'border-amber-200 dark:border-amber-900/40',
      };
    case 'approved':
      return {
        label: t('chatProposal.state.approved', 'Approved'),
        Icon: ShieldCheck,
        pillClassName:
          'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900/40',
        cardAccentClassName: 'border-emerald-200 dark:border-emerald-900/40',
      };
    case 'executing':
      return {
        label: t('chatProposal.state.executing', 'Executing'),
        Icon: Loader2,
        pillClassName:
          'bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-900/40',
        cardAccentClassName: 'border-sky-200 dark:border-sky-900/40',
      };
    case 'executed':
      return {
        label: t('chatProposal.state.executed', 'Executed'),
        Icon: CheckCircle2,
        pillClassName:
          'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900/40',
        cardAccentClassName: 'border-emerald-200 dark:border-emerald-900/40',
      };
    case 'failed':
      return {
        label: t('chatProposal.state.failed', 'Execution failed'),
        Icon: AlertTriangle,
        pillClassName:
          'bg-danger-50 dark:bg-danger-900/30 text-danger-800 dark:text-danger-200 border-danger-200 dark:border-danger-900/40',
        cardAccentClassName: 'border-danger-200 dark:border-danger-900/40',
      };
    case 'audited':
      return {
        label: t('chatProposal.state.audited', 'Audited'),
        Icon: FileSearch,
        pillClassName:
          'bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-secondary border-c-border dark:border-c-border',
        cardAccentClassName: 'border-c-border dark:border-c-border',
      };
    case 'closed':
      return {
        label: t('chatProposal.state.closed', 'Closed'),
        Icon: FileSearch,
        pillClassName:
          'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-700',
        cardAccentClassName: 'border-slate-200 dark:border-navy-700',
      };
    case 'rejected':
      return {
        label: t('chatProposal.state.rejected', 'Rejected'),
        Icon: X,
        pillClassName:
          'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-700',
        cardAccentClassName: 'border-slate-200 dark:border-navy-700',
      };
    default:
      return {
        label: t('chatProposal.state.unknown', 'Proposal'),
        Icon: Gavel,
        pillClassName:
          'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-navy-700',
        cardAccentClassName: 'border-slate-200 dark:border-navy-700',
      };
  }
}

function riskVisual(
  risk: string | undefined,
  t: (k: string, d?: string) => string
): { label: string; className: string } | null {
  if (!risk) return null;
  const normalized = String(risk).toLowerCase();
  if (normalized === 'high') {
    return {
      label: t('chatProposal.risk.high', 'High risk'),
      className:
        'bg-danger-50 dark:bg-danger-900/30 text-danger-800 dark:text-danger-200 border-danger-200 dark:border-danger-900/40',
    };
  }
  if (normalized === 'medium' || normalized === 'med') {
    return {
      label: t('chatProposal.risk.medium', 'Medium risk'),
      className:
        'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900/40',
    };
  }
  if (normalized === 'low') {
    return {
      label: t('chatProposal.risk.low', 'Low risk'),
      className:
        'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900/40',
    };
  }
  return null;
}

// ============================================================================
// Component
// ============================================================================

export const ExecutionProposalMessage: React.FC<ExecutionProposalMessageProps> = ({
  msg,
  isCompact = false,
  isRtl = false,
  onApprove,
  onReject,
  onExecute,
  onInspect,
  isApproveBusy = false,
  isRejectBusy = false,
  isExecuteBusy = false,
}) => {
  const { t: rawT } = useTranslation();
  // Adapter: tighten `TFunction` into the simple `(k, d?) => string` shape
  // the local helpers expect. Keeps strict-mode TS happy without forcing us
  // to re-type every helper to know about i18next's complex return unions.
  const t = React.useCallback(
    (key: string, defaultValue?: string, options?: Record<string, unknown>): string => {
      if (options !== undefined) {
        return String(rawT(key, { defaultValue, ...options }));
      }
      return String(rawT(key, defaultValue as string));
    },
    [rawT]
  );
  // Wave A7.4 — gate routing-trace view to admin / super-admin.
  const { isAdmin, isSuperAdmin } = usePermissions();
  const showOperatorDetail = isAdmin || isSuperAdmin;

  const messageType = ((msg as any).type || 'execution_proposal') as ExecutionMessageType;
  const meta = extractProposalMetadata(msg);

  // V8 / Wave A6 — prefer the *fresh* lifecycle state from the unified cache
  // (seeded from `GET /ai/conversations/:id/proposals`) over the metadata
  // snapshot that was frozen at write time. Falls back to the snapshot when
  // the cache hasn't been seeded yet.
  const freshProposal = useProposalLifecycle(meta.proposalId);
  const effectiveLifecycleState: V8LifecycleState | undefined =
    freshProposal?.lifecycleState || meta.lifecycleState;
  const effectiveRejectionReason = freshProposal?.rejectionReason ?? meta.rejectionReason ?? null;

  // V8 / Wave A7 (Gap #10 — Output trust as one contract).
  //
  // Prefer the freshest trust bundle from the unified proposal cache
  // (seeded from `GET /ai/conversations/:id/proposals` — which returns
  // the latest bundle across the proposal's message chain). Fall back to
  // the metadata snapshot frozen at write time so historical conversations
  // still render a bubble even before the cache is seeded.
  const effectiveTrustBundle: TrustBundle | null | undefined =
    (freshProposal?.trustBundle as TrustBundle | null | undefined) ??
    ((msg as any).metadata?.trustBundle as TrustBundle | undefined) ??
    null;

  const visual = lifecycleVisual(effectiveLifecycleState, messageType, t);
  const risk = riskVisual(meta.risk, t);

  const planSummary =
    meta.planSummary && meta.planSummary.trim().length > 0
      ? meta.planSummary.trim()
      : (msg.content || '').trim();
  const proposalSteps: Array<{ id?: string; label?: string; description?: string }> = Array.isArray(
    meta.steps
  )
    ? meta.steps
    : [];
  const renderStructuredSteps = (): any =>
    React.createElement(ProposalStepList, { steps: proposalSteps, isRtl, t });

  const canApprove =
    typeof onApprove === 'function' &&
    !!meta.proposalId &&
    (!effectiveLifecycleState ||
      effectiveLifecycleState === 'proposed' ||
      effectiveLifecycleState === 'pending_review');
  const canReject =
    typeof onReject === 'function' &&
    !!meta.proposalId &&
    (!effectiveLifecycleState ||
      effectiveLifecycleState === 'proposed' ||
      effectiveLifecycleState === 'pending_review');
  const canExecute =
    typeof onExecute === 'function' && !!meta.proposalId && effectiveLifecycleState === 'approved';

  const textSize = isCompact ? 'text-xs' : 'text-sm';
  return (
    <div
      className={`flex flex-col space-y-1.5 group items-start`}
      data-testid="execution-proposal-message"
      data-proposal-id={meta.proposalId || undefined}
      data-lifecycle-state={effectiveLifecycleState || undefined}
      data-message-type={messageType}
    >
      <div className={`flex gap-2 ${isCompact ? 'gap-2' : 'gap-3'}`} dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Avatar */}
        <div
          className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full flex items-center justify-center shrink-0 mt-0.5 border bg-c-surface-raised dark:bg-c-surface-raised border-c-border dark:border-c-border`}
          aria-hidden="true"
        >
          <Gavel size={isCompact ? 12 : 14} className="text-c-text-secondary dark:text-c-text-secondary" />
        </div>

        <div className="flex flex-col max-w-[85%] w-full">
          <div
            role="group"
            aria-label={t('chatProposal.ariaLabel', 'Governed execution proposal')}
            className={`relative rounded-xl border px-3 py-2 shadow-sm bg-white dark:bg-navy-900 ${visual.cardAccentClassName} ${textSize} ${isRtl ? 'text-right' : 'text-left'}`}
          >
            {/* Header row: lifecycle state + risk */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span
                className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-medium ${visual.pillClassName}`}
              >
                <visual.Icon
                  size={10}
                  className={effectiveLifecycleState === 'executing' ? 'animate-spin' : ''}
                />
                {visual.label}
              </span>
              {risk && (
                <span
                  className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-medium ${risk.className}`}
                >
                  <AlertTriangle size={10} />
                  {risk.label}
                </span>
              )}
              {typeof meta.stepCount === 'number' && meta.stepCount > 0 && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {t('chatProposal.stepCount', '{{count}} steps', {
                    count: meta.stepCount,
                    defaultValue_one: '1 step',
                    defaultValue_other: '{{count}} steps',
                  } as any)}
                </span>
              )}
              {meta.expiresAt && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {t('chatProposal.expiresAt', 'Expires {{when}}', {
                    when: new Date(meta.expiresAt).toLocaleString(),
                  } as any)}
                </span>
              )}
            </div>

            {/* Plan summary */}
            {planSummary && (
              <div className={`text-slate-700 dark:text-slate-200 whitespace-pre-wrap ${textSize}`}>
                {planSummary}
              </div>
            )}

            {/* Structured steps */}
            {renderStructuredSteps()}

            {/* Rejection reason (terminal state) */}
            {effectiveLifecycleState === 'rejected' && effectiveRejectionReason && (
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 italic">
                {t('chatProposal.rejectionReason', 'Reason')}: {effectiveRejectionReason}
              </div>
            )}

            {/* Reviewer attribution */}
            {meta.reviewer?.name &&
              (effectiveLifecycleState === 'approved' ||
                effectiveLifecycleState === 'rejected' ||
                effectiveLifecycleState === 'executed' ||
                effectiveLifecycleState === 'audited' ||
                effectiveLifecycleState === 'closed') && (
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {t('chatProposal.reviewer', 'Reviewed by {{name}}', {
                    name: meta.reviewer.name,
                  } as any)}
                </div>
              )}

            {/*
              V8 / Wave A7 — Canonical trust panel inside the proposal bubble.
              Renders the newest bundle (cache → metadata fallback). Empty /
              missing bundles produce no output so historical proposals and
              unseeded caches are unaffected.
            */}
            {effectiveTrustBundle && (
              <TrustPanel
                bundle={effectiveTrustBundle}
                isCompact
                isRtl={isRtl}
                showOperatorDetail={showOperatorDetail}
                messageId={msg.id || null}
                className="mt-2"
              />
            )}

            {/* Action row */}
            {(canApprove || canReject || canExecute || typeof onInspect === 'function') && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {canApprove && (
                  <button
                    type="button"
                    onClick={() => meta.proposalId && onApprove?.(meta.proposalId, msg)}
                    disabled={isApproveBusy || isRejectBusy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isApproveBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    {t('chatProposal.action.approve', 'Approve')}
                  </button>
                )}
                {canReject && (
                  <button
                    type="button"
                    onClick={() => meta.proposalId && onReject?.(meta.proposalId, msg)}
                    disabled={isApproveBusy || isRejectBusy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-300 dark:border-navy-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRejectBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <X size={12} />
                    )}
                    {t('chatProposal.action.reject', 'Reject')}
                  </button>
                )}
                {canExecute && (
                  <button
                    type="button"
                    onClick={() => meta.proposalId && onExecute?.(meta.proposalId, msg)}
                    disabled={isApproveBusy || isRejectBusy || isExecuteBusy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border bg-sky-600 text-white border-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExecuteBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <PlayCircle size={12} />
                    )}
                    {t('chatProposal.action.execute', 'Execute')}
                  </button>
                )}
                {typeof onInspect === 'function' && meta.proposalId && (
                  <button
                    type="button"
                    onClick={() => onInspect(meta.proposalId!, msg)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    <PlayCircle size={12} />
                    {t('chatProposal.action.inspect', 'View run')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Timestamp row — subtle, kept consistent with regular bubbles */}
          <div className="text-[10px] text-slate-600 dark:text-slate-500 mt-0.5 pl-1">
            {new Date(
              (msg.timestamp as string | Date) || (msg as any).createdAt || Date.now()
            ).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionProposalMessage;
