import { AlertCircle, Check, Circle, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  listLifecycleGateDecisions,
  requestTransitionDecision,
  type LifecycleGateDecisionLogEntry,
} from '@/services/initiativeTransitionInboxApi';
import {
  readRegisteredInitiative,
  requestAnalysisDecision,
  startInitiativeAnalysis,
} from '@/services/initiatives-execution/runtimeApi';

import { InitiativeReasonDialog } from './lifecycle/InitiativeReasonDialog';
import {
  type InitiativeLifecycleAction,
  useInitiativeLifecycle,
} from './lifecycle/useInitiativeLifecycle';

const TARGET_STATUS_FOR_PROPOSAL: Record<
  string,
  'PROMOTED' | 'PLANNING' | 'SCHEDULED' | 'EXECUTING' | 'DONE'
> = {
  APPROVED_BACKLOG: 'PLANNING',
  SCHEDULED: 'SCHEDULED',
  IN_EXECUTION: 'EXECUTING',
  DELIVERED: 'DONE',
  EFFECTIVENESS_REVIEWED: 'DONE',
  CLOSED: 'DONE',
};

export interface PmoStageTransitionPanelProps {
  initiativeId: string;
  expectedVersion?: number | null;
  reviewerUserId?: string | null;
  currentUserId?: string | null;
  onApplied?: () => void;
}

export const PmoStageTransitionPanel: React.FC<PmoStageTransitionPanelProps> = ({
  initiativeId,
  expectedVersion,
  reviewerUserId,
  currentUserId,
  onApplied,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const translate = useCallback((key: string, fallback: string) => t(key, fallback), [t]);
  const { actions, loading, loadError, pendingActionId, preflight, run, reload } =
    useInitiativeLifecycle(initiativeId, translate, { enabled: true, onApplied });
  const [log, setLog] = useState<LifecycleGateDecisionLogEntry[]>([]);
  const [logError, setLogError] = useState(false);
  const [reasonAction, setReasonAction] = useState<InitiativeLifecycleAction | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [runtimeExpectedVersion, setRuntimeExpectedVersion] = useState<number | null>(null);

  const loadLog = useCallback(async () => {
    try {
      setLog(await listLifecycleGateDecisions(initiativeId));
      setLogError(false);
    } catch {
      setLog([]);
      setLogError(true);
    }
  }, [initiativeId]);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  const primary = useMemo(
    () =>
      actions.find((action) => action.kind === 'transition' && action.variant !== 'danger') ?? null,
    [actions]
  );
  const directExpectedVersion = Number(expectedVersion);
  const resolvedExpectedVersion =
    Number.isFinite(directExpectedVersion) && directExpectedVersion > 0
      ? directExpectedVersion
      : runtimeExpectedVersion;
  const target = primary?.targetStatus
    ? TARGET_STATUS_FOR_PROPOSAL[primary.targetStatus]
    : undefined;
  const primaryTransition = primary?.targetStatus
    ? preflight?.transitions.find((transition) => transition.targetStatus === primary.targetStatus)
    : undefined;
  const missing = useMemo(() => {
    if (!primaryTransition?.roleAllowed || primaryTransition.conditionSatisfied) return [];
    const seen = new Set<string>();
    return (primaryTransition.blockingItems ?? []).filter((item) => {
      const key = String(item.key || item.label || '').trim();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [primaryTransition]);
  const approvers = primaryTransition?.requiredRoles ?? [];
  const isAnalysisBoundary =
    primary?.targetStatus === 'ANALYZING' || primary?.targetStatus === 'READY_FOR_DECISION';

  useEffect(() => {
    if (
      !isAnalysisBoundary ||
      (Number.isFinite(directExpectedVersion) && directExpectedVersion > 0)
    ) {
      setRuntimeExpectedVersion(null);
      return;
    }
    let active = true;
    setRuntimeExpectedVersion(null);
    void readRegisteredInitiative(initiativeId)
      .then((record) => {
        if (!active) return;
        const version = Number(record?.version);
        setRuntimeExpectedVersion(Number.isFinite(version) && version > 0 ? version : null);
      })
      .catch(() => {
        if (active) setRuntimeExpectedVersion(null);
      });
    return () => {
      active = false;
    };
  }, [directExpectedVersion, initiativeId, isAnalysisBoundary]);

  const hasExpectedVersion =
    Number.isFinite(resolvedExpectedVersion) && Number(resolvedExpectedVersion) > 0;
  const transitionCaseStatus = preflight?.transitionCase?.status ?? 'missing';
  const reviewerIsCurrentActor = Boolean(
    currentUserId && reviewerUserId && currentUserId === reviewerUserId
  );
  const transitionProposalReady = Boolean(
    target &&
    transitionCaseStatus === 'ready' &&
    !reviewerIsCurrentActor &&
    primaryTransition?.proposalAllowed !== false
  );
  const analysisProposalReady = Boolean(
    isAnalysisBoundary && hasExpectedVersion && !reviewerIsCurrentActor
  );
  const proposalBlockedReason = !reviewerUserId
    ? t('initiatives.pmo.requestNeedsReviewer', 'Assign a reviewer first.')
    : reviewerIsCurrentActor
      ? t(
          'initiatives.pmo.selfReviewBlocked',
          'Choose a reviewer other than yourself before requesting this decision.'
        )
      : primaryTransition?.proposalAllowed === false
        ? t(
            'initiatives.pmo.proposalPreflightBlocked',
            'The reviewer authority, source stage or baseline is not ready for this decision.'
          )
        : primary?.disabled
          ? primary.disabledReason ||
            t('initiatives.pmo.conditionsNotMet', 'Complete the transition conditions first.')
          : target && transitionCaseStatus === 'missing'
            ? t(
                'initiatives.pmo.transitionCaseMissing',
                'This initiative is not linked to a transformation case yet, so the decision request cannot be created.'
              )
            : target && transitionCaseStatus === 'ambiguous'
              ? t(
                  'initiatives.pmo.transitionCaseAmbiguous',
                  'This initiative is linked to more than one transformation case. Resolve the lineage before requesting a decision.'
                )
              : target && transitionCaseStatus === 'execution_context_missing'
                ? t(
                    'initiatives.pmo.transitionExecutionContextMissing',
                    'The linked transformation case is missing its canonical execution context, so the decision request cannot be created yet.'
                  )
                : target && transitionCaseStatus === 'source_not_ready'
                  ? t(
                      'initiatives.pmo.transitionSourceNotReady',
                      'The linked transformation case is not at the required scheduling stage yet, so the execution decision cannot be requested.'
                    )
                  : primary && !target && !isAnalysisBoundary
                    ? t(
                        'initiatives.pmo.unsupportedTransitionTarget',
                        'This transition is not supported by the PMO decision request yet.'
                      )
                    : isAnalysisBoundary && !hasExpectedVersion
                      ? t(
                          'initiatives.pmo.versionMissing',
                          'The canonical version is not available for this initiative yet.'
                        )
                      : '';
  const proposalReady = Boolean(
    primary &&
    reviewerUserId &&
    !primary.disabled &&
    (transitionProposalReady || analysisProposalReady)
  );

  const apply = async (action: InitiativeLifecycleAction, reason?: string) => {
    const error = await run(action, reason);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(t('initiatives.pmo.transitionSaved', 'Stage transition saved'));
    await Promise.all([reload(), loadLog()]);
  };

  const requestDecision = async () => {
    if (!primary || !reviewerUserId || !proposalReady) return;
    setRequesting(true);
    try {
      const clientRequestId = crypto.randomUUID();
      if (primary.targetStatus === 'ANALYZING') {
        await startInitiativeAnalysis(initiativeId, {
          expectedVersion: Number(resolvedExpectedVersion),
          clientRequestId,
        });
      } else if (primary.targetStatus === 'READY_FOR_DECISION') {
        await requestAnalysisDecision(initiativeId, {
          expectedVersion: Number(resolvedExpectedVersion),
          clientRequestId,
          decisionId: crypto.randomUUID(),
          authorityId: reviewerUserId,
          dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        });
      } else if (target) {
        await requestTransitionDecision({
          initiativeId,
          reviewerUserId,
          targetStatus: target,
          reason: t(
            'initiatives.pmo.requestReason',
            'Stage transition requested from the initiative card.'
          ),
        });
      }
      toast.success(t('initiatives.pmo.requested', 'Decision requested'));
      await reload();
    } catch (error) {
      toast.error(
        String(
          (error as Error)?.message ||
            t('initiatives.pmo.requestFailed', 'Could not request a decision')
        )
      );
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="pmo-stage-transition-panel">
      <section className="rounded-lg border border-c-border-subtle bg-c-surface p-3">
        <h3 className="text-xs font-semibold text-c-text">
          {t('initiatives.pmo.stageTransition', 'Stage transition')}
        </h3>
        {loading ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-c-text-secondary">
            <Loader2 size={13} className="animate-spin" />
            {t('common.loading', 'Loading…')}
          </p>
        ) : loadError ? (
          <p className="mt-2 text-xs text-c-text-secondary" role="alert">
            {loadError}
          </p>
        ) : primary ? (
          <>
            <p className="mt-1 text-xs text-c-text-secondary">
              {preflight?.currentStatus} → {primary.targetStatus}
            </p>
            <ul className="mt-3 space-y-2">
              {missing.length === 0 ? (
                <li className="flex gap-2 border-l-2 border-c-success pl-2 text-xs text-c-text">
                  <Check size={13} aria-hidden />
                  {t('initiatives.pmo.conditionsMet', 'All server preflight conditions are met')}
                </li>
              ) : (
                missing.map((item) => (
                  <li
                    key={item.key}
                    className="flex gap-2 border-l-2 border-c-warning pl-2 text-xs text-c-text"
                  >
                    <Circle size={11} aria-hidden />
                    <span>{item.label}</span>
                  </li>
                ))
              )}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-c-border-subtle pt-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-c-text-muted">
                  {t('initiatives.pmo.whoApproves', 'Who approves')}
                </dt>
                <dd className="text-right text-c-text">{approvers.join(', ') || '—'}</dd>
              </div>
            </dl>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                disabled={!proposalReady || requesting}
                onClick={() => void requestDecision()}
                className="h-8 rounded-lg border border-c-border bg-c-surface-raised px-3 text-xs font-medium text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:border-c-border-subtle disabled:bg-c-surface-subtle disabled:text-c-text-secondary"
                title={
                  !proposalReady
                    ? proposalBlockedReason ||
                      t(
                        'initiatives.pmo.requestUnavailable',
                        'Complete the conditions and assign a reviewer first'
                      )
                    : undefined
                }
              >
                {requesting
                  ? t('common.saving', 'Saving…')
                  : t('initiatives.pmo.requestDecision', 'Request decision')}
              </button>
              {!proposalReady && proposalBlockedReason ? (
                <p
                  className="text-xs text-c-text-muted"
                  data-testid="pmo-decision-request-blocked-reason"
                >
                  {proposalBlockedReason}
                </p>
              ) : null}
              <button
                type="button"
                disabled={primary.disabled || pendingActionId !== null}
                onClick={() =>
                  primary.requiresReason ? setReasonAction(primary) : void apply(primary)
                }
                className="h-8 rounded-lg border border-c-border bg-c-surface px-3 text-xs font-medium text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:border-c-border-subtle disabled:bg-c-surface-subtle disabled:text-c-text-secondary"
              >
                {t('initiatives.pmo.approveTransition', 'Approve transition')}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-c-text-muted">
            {t(
              'initiatives.pmo.noTransition',
              'No transition is available for your role at this stage.'
            )}
          </p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold text-c-text">
          {t('initiatives.pmo.decisionLog', 'Decision log')}
        </h3>
        {logError ? (
          <p className="mt-2 flex gap-2 text-xs text-c-text-secondary" role="alert">
            <AlertCircle size={13} aria-hidden />
            {t('initiatives.pmo.logUnavailable', 'The immutable decision log could not be loaded.')}
          </p>
        ) : log.length === 0 ? (
          <p className="mt-2 text-xs text-c-text-muted">
            {t('initiatives.pmo.noDecisions', 'No recorded gate decisions.')}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-c-border-subtle">
            {log.map((entry) => (
              <li key={entry.decisionId} className="py-2 text-xs">
                <div className="flex items-center justify-between gap-2 text-c-text">
                  <span>{entry.humanActorName || t('initiatives.pmo.reviewer', 'Reviewer')}</span>
                  <span className="text-c-text-muted">
                    {new Date(entry.decidedAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US')}
                  </span>
                </div>
                <p className="mt-0.5 text-c-text-secondary">
                  {entry.decisionStatus === 'approved'
                    ? t('initiatives.pmo.approved', 'Approved')
                    : t('initiatives.pmo.rejected', 'Rejected')}{' '}
                  · {entry.pmoDomain.replaceAll('_', ' ').toLowerCase()}
                </p>
                <p className="mt-1 text-c-text-muted">{entry.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InitiativeReasonDialog
        open={Boolean(reasonAction)}
        title={t('initiatives.lifecycle.reasonTitle', '{{action}} — provide a reason', {
          action: reasonAction?.label || '',
        })}
        confirmLabel={reasonAction?.label || t('common.save', 'Save')}
        busy={pendingActionId !== null}
        onCancel={() => setReasonAction(null)}
        onConfirm={async (reason) => {
          if (!reasonAction) return;
          await apply(reasonAction, reason);
          setReasonAction(null);
        }}
      />
    </div>
  );
};

export default PmoStageTransitionPanel;
