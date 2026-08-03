/**
 * ClosureSection — EXE-008 Closure/Evidence gate
 *
 * Lets the initiative owner request closure, attach evidence (task/milestone/
 * decision references), see a server-computed readiness checklist, submit
 * for approval, and lets an approver return or approve the request.
 *
 * The backend is the single source of truth for readiness/state — this
 * section never infers "done" locally. In particular the approve action
 * follows a strict "no premature success" contract: a 200 from POST
 * .../approve is NOT shown as success until a fresh GET (read-back)
 * confirms status === 'done'. When the mutation returns an intermediate
 * status ('approved_pending_transition' | 'transition_failed') the UI
 * polls GET (which self-heals server-side) a few times instead of lying
 * about the outcome.
 *
 * @see docs/ui-standards/02-components/initiative-sections.md
 */

import { AlertTriangle, Check, CheckCircle2, Circle, Loader2, ShieldCheck, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

/**
 * Client-generated key for retry-safe POSTs — mirrors the pattern used by
 * TasksMilestonesSection/RaidSection so a transport-level retry of an
 * in-flight create/action request doesn't create a duplicate server-side.
 */
const generateClientRequestId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `creq-${Date.now()}-${Math.random().toString(36).slice(2)}`;

type ClosureStatus =
  | 'draft'
  | 'submitted'
  | 'returned'
  | 'approved_pending_transition'
  | 'transition_failed'
  | 'done';

interface ClosureRequestSummary {
  id: string;
  status: ClosureStatus;
  approvalStatus?: string | null;
  requestedBy?: string | null;
  requestedAt?: string | null;
  closureRationale?: string | null;
  outcomeSummary?: string | null;
  exceptionsWaivers?: string | null;
  approverId?: string | null;
  approvedAt?: string | null;
  returnedAt?: string | null;
  reviewRationale?: string | null;
  transitionAuditRef?: string | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

type ClosureRequestDetail = ClosureRequestSummary;

interface EvidenceItem {
  id: string;
  evidenceType: 'task' | 'milestone' | 'decision';
  evidenceRefId: string;
  notes?: string | null;
  addedBy?: string | null;
  addedAt?: string | null;
}

interface ReadinessItem {
  key: string;
  label: string;
  satisfied: boolean;
}

interface ReadinessResult {
  items: ReadinessItem[];
  ready: boolean;
  incompleteTaskCount: number;
  incompleteMilestoneCount: number;
}

/**
 * EXE-09 — durable closure→Results/Finance delivery receipt. Read-only here;
 * the backend (closureDeliveryReceiptService.ts) is the only writer. Never
 * inferred locally — mirrors this file's own "no premature success" rule for
 * the closure request itself (see file header).
 */
type LegStatus = 'PENDING' | 'DELIVERING' | 'DELIVERED' | 'FAILED' | 'NEEDS_DECISION';

interface ClosureReceipt {
  id: string;
  resultsStatus: Exclude<LegStatus, 'NEEDS_DECISION'>;
  resultsLastError?: string | null;
  financeStatus: LegStatus;
  financeLastError?: string | null;
}

const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

export const ClosureSection: React.FC<InitiativeSectionProps> = ({
  expanded,
  onToggle,
  readonly,
}) => {
  const { t } = useTranslation();
  const { initiativeId, users } = useInitiativeContext();

  const resolveUserName = useCallback(
    (userId?: string | null): string => {
      if (!userId) return '—';
      const u = users.find((x) => String(x.id) === String(userId));
      if (!u) return userId;
      return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || userId;
    },
    [users]
  );

  // ── List + detail state ────────────────────────────────────────────────
  const [requests, setRequests] = useState<ClosureRequestSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClosureRequestDetail | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [receipt, setReceipt] = useState<ClosureReceipt | null>(null);
  const [retryingReceipt, setRetryingReceipt] = useState(false);

  // ── Editable closure fields (draft/returned only) ──────────────────────
  const [rationale, setRationale] = useState('');
  const [outcome, setOutcome] = useState('');
  const [exceptions, setExceptions] = useState('');
  const initializedFieldsForRequestId = useRef<string | null>(null);

  // ── Evidence add form ───────────────────────────────────────────────────
  const [evType, setEvType] = useState<'task' | 'milestone' | 'decision'>('task');
  const [evRefId, setEvRefId] = useState('');
  const [evNotes, setEvNotes] = useState('');
  const [addingEvidence, setAddingEvidence] = useState(false);

  // ── Action states ───────────────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notReadyChecklist, setNotReadyChecklist] = useState<ReadinessItem[] | null>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnRationale, setReturnRationale] = useState('');
  const [returning, setReturning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // ── Fetchers ─────────────────────────────────────────────────────────────
  const fetchList = useCallback(async (): Promise<ClosureRequestSummary[]> => {
    if (!initiativeId) return [];
    const res = await Api.get(`/initiatives/${initiativeId}/closure-requests`);
    const list: ClosureRequestSummary[] = Array.isArray(res?.closureRequests)
      ? res.closureRequests
      : [];
    setRequests(list);
    return list;
  }, [initiativeId]);

  const fetchDetail = useCallback(
    async (requestId: string): Promise<ClosureRequestDetail | null> => {
      if (!initiativeId) return null;
      const [detailRes, readinessRes, receiptRes] = await Promise.all([
        Api.get(`/initiatives/${initiativeId}/closure-requests/${requestId}`),
        Api.get(`/initiatives/${initiativeId}/closure-requests/${requestId}/readiness`),
        // EXE-09 — best-effort: an org/environment without this route deployed
        // yet (or a closure request that never reached done) must not break
        // the rest of the section. `receipt: null` is a normal, expected
        // response shape, not an error.
        Api.get(`/initiatives/${initiativeId}/closure-receipt`).catch(() => null),
      ]);
      const cr: ClosureRequestDetail | null = detailRes?.closureRequest || null;
      setDetail(cr);
      setEvidence(Array.isArray(detailRes?.evidence) ? detailRes.evidence : []);
      setReadiness(
        readinessRes
          ? {
              items: Array.isArray(readinessRes.items) ? readinessRes.items : [],
              ready: !!readinessRes.ready,
              incompleteTaskCount: Number(readinessRes.incompleteTaskCount || 0),
              incompleteMilestoneCount: Number(readinessRes.incompleteMilestoneCount || 0),
            }
          : null
      );
      setReceipt(receiptRes?.receipt ?? null);
      setNotReadyChecklist(null);
      return cr;
    },
    [initiativeId]
  );

  const handleRetryReceipt = useCallback(async () => {
    if (!initiativeId || retryingReceipt) return;
    setRetryingReceipt(true);
    try {
      const res = await Api.post(`/initiatives/${initiativeId}/closure-receipt/retry`, {});
      setReceipt(res?.receipt ?? null);
      toast.success(t('initiatives.closureSection.receipt.retryTriggered', 'Retry triggered'));
    } catch (e: any) {
      toast.error(
        e?.data?.error ||
          e?.message ||
          t('initiatives.closureSection.receipt.retryError', 'Failed to trigger retry')
      );
    } finally {
      setRetryingReceipt(false);
    }
  }, [initiativeId, retryingReceipt, t]);

  const refreshAfterAction = useCallback(
    async (preferredId?: string | null) => {
      const list = await fetchList();
      const nextId = preferredId || list[0]?.id || null;
      setActiveId(nextId);
      if (nextId) {
        await fetchDetail(nextId);
      } else {
        setDetail(null);
        setEvidence([]);
        setReadiness(null);
      }
    },
    [fetchList, fetchDetail]
  );

  // Initial load — on mount and whenever the initiative changes.
  useEffect(() => {
    if (!initiativeId) return;
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      try {
        const list = await fetchList();
        if (cancelled) return;
        const topId = list[0]?.id || null;
        setActiveId(topId);
        if (topId) {
          setLoadingDetail(true);
          try {
            await fetchDetail(topId);
          } catch {
            if (!cancelled) {
              toast.error(
                t(
                  'initiatives.closureSection.toast.loadDetailError',
                  'Failed to load closure request'
                )
              );
            }
          } finally {
            if (!cancelled) setLoadingDetail(false);
          }
        } else {
          setDetail(null);
          setEvidence([]);
          setReadiness(null);
        }
      } catch {
        if (!cancelled) {
          toast.error(
            t('initiatives.closureSection.toast.loadListError', 'Failed to load closure requests')
          );
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiativeId]);

  // Seed the editable fields once per request id (don't clobber user typing
  // on our own background refreshes of the same request).
  useEffect(() => {
    if (!detail) return;
    if (initializedFieldsForRequestId.current === detail.id) return;
    initializedFieldsForRequestId.current = detail.id;
    setRationale(detail.closureRationale || '');
    setOutcome(detail.outcomeSummary || '');
    setExceptions(detail.exceptionsWaivers || '');
  }, [detail]);

  const canEditFields =
    !readonly && !!detail && (detail.status === 'draft' || detail.status === 'returned');

  const exceptionsRequired = useMemo(
    () => !!readiness && readiness.incompleteTaskCount + readiness.incompleteMilestoneCount > 0,
    [readiness]
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleRequestClosure = useCallback(async () => {
    if (!initiativeId || creating) return;
    setCreating(true);
    try {
      const res = await Api.post(`/initiatives/${initiativeId}/closure-requests`, {
        idempotencyKey: generateClientRequestId(),
      });
      toast.success(
        t('initiatives.closureSection.toast.requestCreated', 'Closure request created')
      );
      await refreshAfterAction(res?.id || null);
    } catch (e: any) {
      toast.error(
        e?.data?.error ||
          e?.message ||
          t(
            'initiatives.closureSection.toast.requestCreateError',
            'Failed to create closure request'
          )
      );
    } finally {
      setCreating(false);
    }
  }, [initiativeId, creating, refreshAfterAction, t]);

  const handleAddEvidence = useCallback(async () => {
    if (!initiativeId || !activeId || addingEvidence) return;
    const refId = evRefId.trim();
    if (!refId) return;
    setAddingEvidence(true);
    try {
      await Api.post(`/initiatives/${initiativeId}/closure-requests/${activeId}/evidence`, {
        evidenceType: evType,
        evidenceRefId: refId,
        notes: evNotes.trim() || undefined,
        idempotencyKey: generateClientRequestId(),
      });
      toast.success(t('initiatives.closureSection.toast.evidenceAdded', 'Evidence added'));
      setEvRefId('');
      setEvNotes('');
      await fetchDetail(activeId);
    } catch (e: any) {
      toast.error(
        e?.data?.error ||
          e?.message ||
          t(
            'initiatives.closureSection.toast.evidenceAddError',
            'Failed to add evidence — check the reference id'
          )
      );
    } finally {
      setAddingEvidence(false);
    }
  }, [initiativeId, activeId, addingEvidence, evType, evRefId, evNotes, fetchDetail, t]);

  const handleSubmit = useCallback(async () => {
    if (!initiativeId || !activeId || submitting) return;
    setSubmitting(true);
    setNotReadyChecklist(null);
    try {
      await Api.post(`/initiatives/${initiativeId}/closure-requests/${activeId}/submit`, {
        closureRationale: rationale.trim() || undefined,
        outcomeSummary: outcome.trim() || undefined,
        exceptionsWaivers: exceptions.trim() || undefined,
      });
      toast.success(t('initiatives.closureSection.toast.submitted', 'Submitted for approval'));
      await refreshAfterAction(activeId);
    } catch (e: any) {
      if (e?.data?.code === 'CLOSURE_NOT_READY') {
        const checklist: ReadinessItem[] = Array.isArray(e?.data?.details?.checklist)
          ? e.data.details.checklist
          : [];
        setNotReadyChecklist(checklist);
        toast.error(
          t(
            'initiatives.closureSection.toast.notReady',
            'Closure is not ready yet — see the checklist below'
          )
        );
      } else {
        toast.error(
          e?.data?.error ||
            e?.message ||
            t('initiatives.closureSection.toast.submitError', 'Failed to submit for approval')
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [initiativeId, activeId, submitting, rationale, outcome, exceptions, refreshAfterAction, t]);

  const handleReturn = useCallback(async () => {
    if (!initiativeId || !activeId || returning) return;
    const trimmed = returnRationale.trim();
    if (!trimmed) return;
    setReturning(true);
    try {
      await Api.post(`/initiatives/${initiativeId}/closure-requests/${activeId}/return`, {
        reviewRationale: trimmed,
      });
      toast.success(t('initiatives.closureSection.toast.returned', 'Sent back for revisions'));
      setShowReturnForm(false);
      setReturnRationale('');
      await refreshAfterAction(activeId);
    } catch (e: any) {
      toast.error(
        e?.data?.error ||
          e?.message ||
          t('initiatives.closureSection.toast.returnError', 'Failed to return the closure request')
      );
    } finally {
      setReturning(false);
    }
  }, [initiativeId, activeId, returning, returnRationale, refreshAfterAction, t]);

  // Self-healing poll: GET .../closure-requests/:id transitions
  // approved_pending_transition/transition_failed -> done server-side on
  // read. Poll a few times instead of claiming success from the mutation
  // response alone.
  const pollUntilDone = useCallback(
    (requestId: string, attempt: number) => {
      pollTimerRef.current = setTimeout(async () => {
        try {
          const cr = await fetchDetail(requestId);
          await fetchList();
          if (cr?.status === 'done') {
            setProcessing(false);
            toast.success(
              t('initiatives.closureSection.toast.approvedDone', 'Closure approved and finalized')
            );
            return;
          }
          if (attempt >= 5) {
            setProcessing(false);
            toast(
              t(
                'initiatives.closureSection.toast.stillProcessing',
                'Still processing — refresh in a moment to check status'
              )
            );
            return;
          }
          pollUntilDone(requestId, attempt + 1);
        } catch {
          setProcessing(false);
        }
      }, 1500);
    },
    [fetchDetail, fetchList, t]
  );

  const handleApprove = useCallback(async () => {
    if (!initiativeId || !activeId || approving) return;
    setApproving(true);
    try {
      const res = await Api.post(
        `/initiatives/${initiativeId}/closure-requests/${activeId}/approve`,
        {
          idempotencyKey: generateClientRequestId(),
        }
      );
      const mutationStatus = res?.status;
      if (mutationStatus === 'done') {
        // No premature success — read back from the server before telling
        // the user it's finalized.
        const cr = await fetchDetail(activeId);
        await fetchList();
        if (cr?.status === 'done') {
          toast.success(
            t('initiatives.closureSection.toast.approvedDone', 'Closure approved and finalized')
          );
        } else {
          setProcessing(true);
          pollUntilDone(activeId, 0);
        }
      } else if (
        mutationStatus === 'approved_pending_transition' ||
        mutationStatus === 'transition_failed'
      ) {
        setProcessing(true);
        pollUntilDone(activeId, 0);
      } else {
        await refreshAfterAction(activeId);
      }
    } catch (e: any) {
      const code = e?.data?.code;
      if (code === 'STALE_VERSION') {
        toast.error(
          t(
            'initiatives.closureSection.toast.staleVersion',
            'Initiative changed since this request was created — reload and try again'
          )
        );
      } else if (code === 'CLOSURE_APPROVER_ROLE_REQUIRED' || e?.status === 403) {
        toast.error(
          t(
            'initiatives.closureSection.toast.approverRoleRequired',
            'You do not have permission to approve this closure request'
          )
        );
      } else if (code === 'CLOSURE_TRANSITION_REJECTED') {
        toast.error(
          t(
            'initiatives.closureSection.toast.transitionRejected',
            'The transition to closed was rejected — check the initiative state'
          )
        );
      } else {
        toast.error(
          e?.data?.error ||
            e?.message ||
            t('initiatives.closureSection.toast.approveError', 'Failed to approve closure')
        );
      }
    } finally {
      setApproving(false);
    }
  }, [
    initiativeId,
    activeId,
    approving,
    fetchDetail,
    fetchList,
    pollUntilDone,
    refreshAfterAction,
    t,
  ]);

  const handleReload = useCallback(() => {
    if (activeId) void refreshAfterAction(activeId);
    else void refreshAfterAction(null);
  }, [activeId, refreshAfterAction]);

  // ── Render helpers ───────────────────────────────────────────────────────

  const statusLabel = useCallback(
    (status?: ClosureStatus | null): string => {
      switch (status) {
        case 'draft':
          return t('initiatives.closureSection.status.draft', 'Draft');
        case 'submitted':
          return t('initiatives.closureSection.status.submitted', 'Submitted');
        case 'returned':
          return t('initiatives.closureSection.status.returned', 'Returned');
        case 'approved_pending_transition':
        case 'transition_failed':
          return t('initiatives.closureSection.status.processing', 'Processing');
        case 'done':
          return t('initiatives.closureSection.status.done', 'Done');
        default:
          return status || '—';
      }
    },
    [t]
  );

  const statusBadgeClass = (status?: ClosureStatus | null): string => {
    switch (status) {
      case 'done':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
      case 'submitted':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
      case 'returned':
        return 'bg-danger-500/15 text-danger-600 dark:text-danger-400';
      case 'approved_pending_transition':
      case 'transition_failed':
        return 'bg-c-info/15 text-c-info';
      default:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-400';
    }
  };

  // EXE-09 — one combined label for the two independent legs. "Delivered"
  // requires BOTH legs terminal-success; NEEDS_DECISION on Finance alone
  // (Results delivered) is its own distinct state, not folded into either
  // "delivered" or "failed" — it is neither: nothing to retry, but not done.
  const receiptSummary = useMemo((): {
    label: string;
    badgeClass: string;
    icon: 'check' | 'spinner' | 'alert' | 'circle';
    canRetry: boolean;
  } | null => {
    if (!receipt) return null;
    const { resultsStatus, financeStatus } = receipt;
    const anyDelivering = resultsStatus === 'DELIVERING' || financeStatus === 'DELIVERING';
    const anyPending = resultsStatus === 'PENDING' || financeStatus === 'PENDING';
    const anyFailed = resultsStatus === 'FAILED' || financeStatus === 'FAILED';
    const financeNeedsDecision = financeStatus === 'NEEDS_DECISION';
    const bothDelivered = resultsStatus === 'DELIVERED' && financeStatus === 'DELIVERED';
    const onlyResultsDelivered = resultsStatus === 'DELIVERED' && financeNeedsDecision;

    if (bothDelivered) {
      return {
        label: t('initiatives.closureSection.receipt.delivered', 'Delivered to Results & Finance'),
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        icon: 'check',
        canRetry: false,
      };
    }
    if (anyFailed) {
      return {
        label: t('initiatives.closureSection.receipt.failed', 'Delivery failed — retry available'),
        badgeClass: 'bg-danger-500/15 text-danger-600 dark:text-danger-400',
        icon: 'alert',
        canRetry: true,
      };
    }
    if (anyDelivering || anyPending) {
      return {
        label: t(
          'initiatives.closureSection.receipt.delivering',
          'Delivering to Results & Finance…'
        ),
        badgeClass: 'bg-c-info/15 text-c-info',
        icon: 'spinner',
        canRetry: false,
      };
    }
    if (onlyResultsDelivered) {
      return {
        label: t(
          'initiatives.closureSection.receipt.needsDecision',
          'Results delivered — Finance mapping needs a product decision'
        ),
        badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        icon: 'circle',
        canRetry: false,
      };
    }
    // Results delivered, Finance neither delivered nor needs-decision yet —
    // shouldn't normally linger here, but render as "partially delivered"
    // rather than silently showing nothing.
    return {
      label: t('initiatives.closureSection.receipt.partial', 'Partially delivered'),
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      icon: 'circle',
      // FAILED was handled above; TypeScript correctly narrows both legs here.
      canRetry: false,
    };
  }, [receipt, t]);

  const evidenceTypeLabel = (evT: string): string => {
    switch (evT) {
      case 'task':
        return t('initiatives.closureSection.evidenceType.task', 'Task');
      case 'milestone':
        return t('initiatives.closureSection.evidenceType.milestone', 'Milestone');
      case 'decision':
        return t('initiatives.closureSection.evidenceType.decision', 'Decision');
      default:
        return evT;
    }
  };

  return (
    <CollapsibleSection
      id="closure"
      title={t('initiatives.closureSection.title', 'Closure')}
      icon={<ShieldCheck size={18} className="text-emerald-500 dark:text-emerald-400" />}
      iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        detail ? (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusBadgeClass(detail.status)}`}
          >
            {statusLabel(detail.status)}
          </span>
        ) : null
      }
    >
      <div className="space-y-4">
        {loadingList ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            {t('initiatives.closureSection.loadingList', 'Loading closure requests…')}
          </p>
        ) : !activeId ? (
          <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/40 p-4 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('initiatives.closureSection.noRequest', 'No closure request yet.')}
            </p>
            {!readonly && (
              <button
                onClick={() => void handleRequestClosure()}
                disabled={creating}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {creating && <Loader2 size={12} className="animate-spin" />}
                {t('initiatives.closureSection.requestClosure', 'Request closure')}
              </button>
            )}
          </div>
        ) : loadingDetail && !detail ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            {t('initiatives.closureSection.loadingDetail', 'Loading closure request…')}
          </p>
        ) : detail ? (
          <>
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                {t('initiatives.closureSection.requestedBy', 'Requested by')}:{' '}
                <span className="text-slate-700 dark:text-slate-200">
                  {resolveUserName(detail.requestedBy)}
                </span>
              </span>
              <span>
                {t('initiatives.closureSection.requestedAt', 'Requested at')}:{' '}
                {formatDateTime(detail.requestedAt || detail.createdAt)}
              </span>
            </div>

            {/* Returned banner */}
            {detail.status === 'returned' && detail.reviewRationale && (
              <div className="rounded-xl border border-danger-500/30 bg-danger-500/5 p-3 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-danger-500" />
                <div>
                  <div className="text-xs font-semibold text-danger-600 dark:text-danger-400">
                    {t('initiatives.closureSection.returnedTitle', 'Returned for revisions')}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {detail.reviewRationale}
                  </div>
                </div>
              </div>
            )}

            {/* Processing banner */}
            {(processing ||
              detail.status === 'approved_pending_transition' ||
              detail.status === 'transition_failed') && (
              <div className="rounded-xl border border-c-info/30 bg-c-info/5 p-3 flex items-center gap-2">
                <Loader2 size={14} className="shrink-0 animate-spin text-c-info" />
                <span className="text-xs text-c-info">
                  {t(
                    'initiatives.closureSection.processing',
                    'Processing the transition to closed…'
                  )}
                </span>
              </div>
            )}

            {/* Readiness checklist */}
            {readiness && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('initiatives.closureSection.readinessTitle', 'Readiness checklist')}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      readiness.ready
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {readiness.ready
                      ? t('initiatives.closureSection.readyToSubmit', 'Ready to submit')
                      : t('initiatives.closureSection.notReady', 'Not ready')}
                  </span>
                </div>
                <ul className="space-y-1">
                  {readiness.items.map((item) => (
                    <li key={item.key} className="flex items-center gap-2 text-xs">
                      {item.satisfied ? (
                        <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                      ) : (
                        <Circle size={13} className="shrink-0 text-slate-400 dark:text-slate-500" />
                      )}
                      <span
                        className={
                          item.satisfied
                            ? 'text-slate-600 dark:text-slate-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Explicit "what's missing" from a failed submit attempt */}
            {notReadyChecklist && notReadyChecklist.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={13} />
                  {t('initiatives.closureSection.missingBeforeSubmit', 'Missing before submit')}
                </div>
                <ul className="space-y-1">
                  {notReadyChecklist
                    .filter((item) => !item.satisfied)
                    .map((item) => (
                      <li key={item.key} className="flex items-center gap-2 text-xs">
                        <X size={12} className="shrink-0 text-danger-500" />
                        <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Evidence */}
            <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 p-3 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('initiatives.closureSection.evidenceTitle', 'Evidence')}
                </span>
                {evidence.length > 0 && (
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
                    {evidence.length}
                  </span>
                )}
              </div>
              {evidence.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('initiatives.closureSection.evidenceEmpty', 'No evidence attached yet')}
                </p>
              ) : (
                <ul className="divide-y divide-slate-200/40 dark:divide-navy-700/40 rounded-lg border border-slate-200/60 dark:border-navy-700/40">
                  {evidence.map((ev) => (
                    <li key={ev.id} className="px-2.5 py-1.5 text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500 dark:text-slate-400">
                          {evidenceTypeLabel(ev.evidenceType)}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 truncate">
                          {ev.evidenceRefId}
                        </span>
                      </div>
                      {ev.notes && (
                        <div className="text-slate-500 dark:text-slate-400">{ev.notes}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canEditFields && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <select
                    value={evType}
                    onChange={(e) => setEvType(e.target.value as 'task' | 'milestone' | 'decision')}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-xs"
                  >
                    <option value="task">{evidenceTypeLabel('task')}</option>
                    <option value="milestone">{evidenceTypeLabel('milestone')}</option>
                    <option value="decision">{evidenceTypeLabel('decision')}</option>
                  </select>
                  <input
                    value={evRefId}
                    onChange={(e) => setEvRefId(e.target.value)}
                    placeholder={t(
                      'initiatives.closureSection.evidenceRefIdPlaceholder',
                      'Reference id'
                    )}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-xs"
                  />
                  <input
                    value={evNotes}
                    onChange={(e) => setEvNotes(e.target.value)}
                    placeholder={t(
                      'initiatives.closureSection.evidenceNotesPlaceholder',
                      'Notes (optional)'
                    )}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-xs"
                  />
                  <button
                    onClick={() => void handleAddEvidence()}
                    disabled={addingEvidence || !evRefId.trim()}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-navy-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50 whitespace-nowrap inline-flex items-center gap-1.5"
                  >
                    {addingEvidence && <Loader2 size={12} className="animate-spin" />}
                    {t('initiatives.closureSection.addEvidence', 'Add evidence')}
                  </button>
                </div>
              )}
            </div>

            {/* Closure fields */}
            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                  {t('initiatives.closureSection.closureRationale', 'Closure rationale')}
                </label>
                {canEditFields ? (
                  <textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                  />
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {detail.closureRationale || '—'}
                  </p>
                )}
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                  {t('initiatives.closureSection.outcomeSummary', 'Outcome summary')}
                </label>
                {canEditFields ? (
                  <textarea
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                  />
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {detail.outcomeSummary || '—'}
                  </p>
                )}
              </div>
              {(exceptionsRequired || detail.exceptionsWaivers) && (
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-1">
                    {t('initiatives.closureSection.exceptionsWaivers', 'Exceptions / waivers')}
                    {exceptionsRequired && canEditFields && (
                      <span className="text-danger-500 ml-1">
                        {t('initiatives.closureSection.required', '(required)')}
                      </span>
                    )}
                  </label>
                  {canEditFields ? (
                    <textarea
                      value={exceptions}
                      onChange={(e) => setExceptions(e.target.value)}
                      rows={2}
                      placeholder={t(
                        'initiatives.closureSection.exceptionsWaiversHint',
                        'Explain why open tasks/milestones do not block this closure'
                      )}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                    />
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {detail.exceptionsWaivers || '—'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Closure snapshot — done state */}
            {detail.status === 'done' && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} />
                  {t('initiatives.closureSection.snapshotTitle', 'Closure snapshot')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('initiatives.closureSection.approvedBy', 'Approved by')}:{' '}
                  <span className="text-slate-700 dark:text-slate-200">
                    {resolveUserName(detail.approverId)}
                  </span>
                  {' · '}
                  {t('initiatives.closureSection.approvedAt', 'Approved at')}:{' '}
                  {formatDateTime(detail.approvedAt)}
                </div>
                {detail.transitionAuditRef && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                    {t('initiatives.closureSection.transitionRef', 'Transition ref')}:{' '}
                    {detail.transitionAuditRef}
                  </div>
                )}

                {/* EXE-09 — Results/Finance delivery receipt status. Read-only
                    display of durable server state; never claims "delivered"
                    while the backend still reports PENDING/DELIVERING/FAILED. */}
                {receiptSummary && (
                  <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-emerald-500/20">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${receiptSummary.badgeClass}`}
                    >
                      {receiptSummary.icon === 'spinner' && (
                        <Loader2 size={10} className="animate-spin" />
                      )}
                      {receiptSummary.icon === 'check' && <CheckCircle2 size={10} />}
                      {receiptSummary.icon === 'alert' && <AlertTriangle size={10} />}
                      {receiptSummary.icon === 'circle' && <Circle size={10} />}
                      {receiptSummary.label}
                    </span>
                    {!readonly && receiptSummary.canRetry && (
                      <button
                        onClick={() => void handleRetryReceipt()}
                        disabled={retryingReceipt}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-200 dark:border-navy-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50 inline-flex items-center gap-1"
                      >
                        {retryingReceipt && <Loader2 size={10} className="animate-spin" />}
                        {t('initiatives.closureSection.receipt.retry', 'Retry delivery')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {!readonly && canEditFields && (
                <button
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {submitting && <Loader2 size={12} className="animate-spin" />}
                  {t('initiatives.closureSection.submitForApproval', 'Submit for approval')}
                </button>
              )}

              {detail.status === 'submitted' && (
                <>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t('initiatives.closureSection.waitingApproval', 'Waiting for approval')}
                  </span>
                  <button
                    onClick={() => void handleApprove()}
                    disabled={approving || processing}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {approving && <Loader2 size={12} className="animate-spin" />}
                    <Check size={13} />
                    {t('initiatives.closureSection.approve', 'Approve')}
                  </button>
                  <button
                    onClick={() => setShowReturnForm((v) => !v)}
                    disabled={returning}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 dark:border-navy-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-50"
                  >
                    {t('initiatives.closureSection.returnBtn', 'Return')}
                  </button>
                </>
              )}

              <button
                onClick={handleReload}
                className="px-2.5 py-1.5 rounded-md text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              >
                {t('initiatives.closureSection.reload', 'Reload')}
              </button>
            </div>

            {showReturnForm && detail.status === 'submitted' && (
              <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 p-3 space-y-2">
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block">
                  {t('initiatives.closureSection.returnRationale', 'Reason for returning')}
                </label>
                <textarea
                  value={returnRationale}
                  onChange={(e) => setReturnRationale(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowReturnForm(false);
                      setReturnRationale('');
                    }}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    {t('initiatives.closureSection.cancel', 'Cancel')}
                  </button>
                  <button
                    onClick={() => void handleReturn()}
                    disabled={returning || !returnRationale.trim()}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-danger-500 text-white hover:bg-danger-600 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {returning && <Loader2 size={12} className="animate-spin" />}
                    {t('initiatives.closureSection.confirmReturn', 'Confirm return')}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </CollapsibleSection>
  );
};
