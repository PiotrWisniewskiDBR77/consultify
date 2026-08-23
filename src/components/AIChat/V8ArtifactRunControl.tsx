import {
  CheckCircle2,
  ExternalLink,
  FileOutput,
  GitBranch,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { TrustStatePreviewSection } from '@/components/ReportsAndPresentations/TrustStatePreviewSection';
import { useTrustState } from '@/components/ReportsAndPresentations/useTrustState';
import {
  CHAT_HEADER_CONTROL_ACTIVE_CLASS,
  CHAT_HEADER_ICON_CONTROL_CLASS,
} from '@/components/AIChat/chatHeaderControlStyles';
import type {
  ArtifactFamily,
  ArtifactPlanOutputType,
  ArtifactRunPlan,
  ArtifactRunRecord,
} from '@/hooks/useV8ArtifactRuns';
import {
  useV8AcceptArtifactRunPlan,
  useV8ArtifactRunHistory,
  useV8CreateArtifactRunFromChat,
  useV8MaterializeArtifactRun,
  useV8PreflightArtifactRun,
  useV8RetryArtifactRun,
} from '@/hooks/useV8ArtifactRuns';
import { useV8CaptureSnapshot, useV8Snapshots } from '@/hooks/useV8Chat';
import {
  useV8ApproveExecutionRun,
  useV8ExecutionProposals,
  useV8ExecutionRun,
  useV8ExecutionTransitions,
  useV8RejectExecutionRun,
  useV8SubmitExecutionReview,
} from '@/hooks/useV8Execution';
import { useV8Gate } from '@/hooks/useV8Gate';

interface V8ArtifactRunControlProps {
  conversationId: string | null;
  defaultGoal?: string;
  snapshotContext?: {
    workspaceId: string | null;
    projectId?: string | null;
    effectiveScopeRef?: string;
    resolvedRoleRef?: string;
    privacyMode?: boolean;
  };
}

const OUTPUT_OPTIONS: Array<{
  outputType: ArtifactPlanOutputType;
  artifactFamily: ArtifactFamily;
  label: string;
}> = [
  { outputType: 'report', artifactFamily: 'document', label: 'Document' },
  { outputType: 'presentation', artifactFamily: 'presentation', label: 'Presentation' },
  { outputType: 'sheet', artifactFamily: 'sheet', label: 'Sheet' },
];

function formatRunStatus(status: ArtifactRunRecord['runStatus']): string {
  switch (status) {
    case 'proposal_created':
      return 'Proposal created';
    case 'awaiting_review':
      return 'Awaiting review';
    case 'approved_for_apply':
      return 'Approved for apply';
    case 'applying':
      return 'Applying';
    case 'rejected':
      return 'Rejected';
    case 'retry_requested':
      return 'Retry requested';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Planned';
  }
}

function deriveEffectiveRunStatus(
  runStatus: ArtifactRunRecord['runStatus'],
  executionState: string | null | undefined
): ArtifactRunRecord['runStatus'] {
  if (
    runStatus === 'completed' ||
    runStatus === 'failed' ||
    runStatus === 'cancelled' ||
    runStatus === 'retry_requested'
  ) {
    return runStatus;
  }

  if (runStatus === 'planned') {
    return 'planned';
  }

  switch (executionState) {
    case 'drafting':
    case 'planning':
      return 'planned';
    case 'proposals_ready':
      return 'proposal_created';
    case 'waiting_for_review':
      return 'awaiting_review';
    case 'approved_for_apply':
      return 'approved_for_apply';
    case 'applying':
      return 'applying';
    case 'rejected':
      return 'rejected';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return runStatus;
  }
}

function formatPlanLabel(plan: ArtifactRunPlan | null): string {
  if (!plan) return '';
  return `${plan.outputType} · ${plan.visibilityScope}`;
}

function formatExecutionState(state: string | null | undefined): string {
  if (!state) return 'Unknown';
  return state.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function V8ArtifactRunControl({
  conversationId,
  defaultGoal = '',
  snapshotContext,
}: V8ArtifactRunControlProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showV8Chat } = useV8Gate();
  const { data: snapshots, isLoading: snapshotsLoading } = useV8Snapshots(
    showV8Chat && conversationId ? conversationId : undefined
  );
  const captureSnapshot = useV8CaptureSnapshot();
  const createRun = useV8CreateArtifactRunFromChat();
  const acceptPlan = useV8AcceptArtifactRunPlan();
  const materializeRun = useV8MaterializeArtifactRun();
  const preflightRun = useV8PreflightArtifactRun();
  const retryRun = useV8RetryArtifactRun();
  const [isOpen, setIsOpen] = useState(false);
  const [goal, setGoal] = useState(defaultGoal);
  const [selectedOutputType, setSelectedOutputType] = useState<ArtifactPlanOutputType>('report');
  const [sheetTableId, setSheetTableId] = useState('');
  const [currentRun, setCurrentRun] = useState<ArtifactRunRecord | null>(null);
  const [currentPlan, setCurrentPlan] = useState<ArtifactRunPlan | null>(null);
  const runHistory = useV8ArtifactRunHistory(currentRun?.runId || undefined);
  const executionRun = useV8ExecutionRun(currentRun?.executionRunId || undefined);
  const executionProposals = useV8ExecutionProposals(currentRun?.executionRunId || undefined);
  const executionTransitions = useV8ExecutionTransitions(currentRun?.executionRunId || undefined);
  const submitExecutionReview = useV8SubmitExecutionReview();
  const approveExecutionRun = useV8ApproveExecutionRun();
  const rejectExecutionRun = useV8RejectExecutionRun();
  const artifactTrustState = useTrustState(currentRun?.artifactId || null, null);

  const snapshotItems = Array.isArray(snapshots) ? snapshots : [];
  const latestSnapshot = snapshotItems.length > 0 ? snapshotItems[snapshotItems.length - 1] : null;

  useEffect(() => {
    setIsOpen(false);
    setGoal(defaultGoal);
    setSelectedOutputType('report');
    setSheetTableId('');
    setCurrentRun(null);
    setCurrentPlan(null);
  }, [conversationId, defaultGoal]);

  const selectedOutput = useMemo(
    () =>
      OUTPUT_OPTIONS.find((option) => option.outputType === selectedOutputType) ??
      OUTPUT_OPTIONS[0],
    [selectedOutputType]
  );
  const effectiveRunStatus = currentRun
    ? deriveEffectiveRunStatus(currentRun.runStatus, executionRun.data?.state)
    : null;

  if (!showV8Chat || !conversationId) return null;

  const canCaptureSnapshot = Boolean(snapshotContext?.workspaceId);
  const isBusy =
    captureSnapshot.isPending ||
    createRun.isPending ||
    acceptPlan.isPending ||
    materializeRun.isPending ||
    preflightRun.isPending ||
    retryRun.isPending ||
    submitExecutionReview.isPending ||
    approveExecutionRun.isPending ||
    rejectExecutionRun.isPending;
  const canPlan = Boolean(latestSnapshot?.snapshotId) && goal.trim().length > 0 && !isBusy;
  const canAccept = effectiveRunStatus === 'planned' || effectiveRunStatus === 'retry_requested';
  const requiresSheetTableTarget = (currentRun?.plan.outputType ?? selectedOutputType) === 'sheet';
  const hasSheetTableTarget = sheetTableId.trim().length > 0;
  const canMaterialize =
    !!currentRun &&
    (effectiveRunStatus === 'approved_for_apply' || effectiveRunStatus === 'applying') &&
    (currentRun?.plan.outputType === 'report' ||
      currentRun?.plan.outputType === 'presentation' ||
      currentRun?.plan.outputType === 'sheet') &&
    (!requiresSheetTableTarget || hasSheetTableTarget) &&
    !currentRun.artifactId;
  const canSubmitReview = executionRun.data?.state === 'proposals_ready';
  const canApproveReview = executionRun.data?.state === 'waiting_for_review';
  const canRejectReview = executionRun.data?.state === 'waiting_for_review';
  const latestTransition =
    executionTransitions.data && executionTransitions.data.length > 0
      ? executionTransitions.data[executionTransitions.data.length - 1]
      : null;

  const handlePlan = async () => {
    if (!latestSnapshot?.snapshotId || !goal.trim()) return;
    try {
      const result = await createRun.mutateAsync({
        conversationId,
        contextSnapshotId: latestSnapshot.snapshotId,
        goal: goal.trim(),
        requestedArtifactFamily: selectedOutput.artifactFamily,
        requestedOutputType: selectedOutput.outputType,
      });
      setCurrentRun(result.run);
      setCurrentPlan(result.artifactPlan);
      toast.success(t('v8.artifactRun.planCreated', 'Artifact plan created from governed chat'));

      // P17-B: run an explicit preflight stage (separately rendered).
      try {
        const preflighted = await preflightRun.mutateAsync(result.run.runId);
        setCurrentRun(preflighted);
        setCurrentPlan(preflighted.plan);
      } catch {
        // Preflight failures are surfaced via the preflight card / API state; keep planning responsive.
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.planFailed', 'Failed to create artifact plan')
      );
    }
  };

  const handleCaptureSnapshot = async () => {
    if (!conversationId || !snapshotContext?.workspaceId) return;
    try {
      await captureSnapshot.mutateAsync({
        workspaceId: snapshotContext.workspaceId,
        projectId: snapshotContext.projectId ?? null,
        conversationId,
        executionRunId: null,
        artifactRefs: [],
        effectiveScopeRef: snapshotContext.effectiveScopeRef || 'workspace',
        resolvedRoleRef: snapshotContext.resolvedRoleRef || 'member',
        consumerClass: 'chat',
        privacyMode: Boolean(snapshotContext.privacyMode),
        sourceContextRefs: [],
      });
      toast.success(
        t('v8.artifactRun.snapshotCaptured', 'Governed V8 snapshot captured for this conversation')
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.snapshotCaptureFailed', 'Failed to capture governed V8 snapshot')
      );
    }
  };

  const handleAccept = async () => {
    if (!currentRun?.runId) return;
    try {
      const updated = await acceptPlan.mutateAsync(currentRun.runId);
      setCurrentRun(updated);
      setCurrentPlan(updated.plan);
      toast.success(t('v8.artifactRun.accepted', 'Artifact plan accepted and proposal created'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.acceptFailed', 'Failed to accept artifact plan')
      );
    }
  };

  const handleRetry = async () => {
    if (!currentRun?.runId) return;
    try {
      const retried = await retryRun.mutateAsync(currentRun.runId);
      setCurrentRun(retried);
      setCurrentPlan(retried.plan);
      toast.success(t('v8.artifactRun.retried', 'Artifact planning retried from chat'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.retryFailed', 'Failed to retry artifact plan')
      );
    }
  };

  const handleMaterialize = async () => {
    if (!currentRun?.runId) return;
    try {
      const completed = await materializeRun.mutateAsync({
        runId: currentRun.runId,
        params: {
          title: currentRun.plan.titleHint,
          config:
            currentRun.plan.outputType === 'sheet'
              ? {
                  tableId: sheetTableId.trim(),
                }
              : undefined,
        },
      });
      setCurrentRun(completed);
      setCurrentPlan(completed.plan);
      toast.success(
        t('v8.artifactRun.materialized', 'Artifact run materialized into a canonical output')
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.materializeFailed', 'Failed to materialize artifact run')
      );
    }
  };

  const handlePreflight = async () => {
    if (!currentRun?.runId) return;
    try {
      const updated = await preflightRun.mutateAsync(currentRun.runId);
      setCurrentRun(updated);
      setCurrentPlan(updated.plan);
      toast.success(t('v8.artifactRun.preflightOk', 'Validation / preflight updated'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.preflightFailed', 'Failed to validate / preflight this run')
      );
    }
  };

  const handleSubmitReview = async () => {
    if (!currentRun?.executionRunId) return;
    try {
      await submitExecutionReview.mutateAsync(currentRun.executionRunId);
      toast.success(t('v8.artifactRun.reviewSubmitted', 'Governed execution submitted for review'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.reviewSubmitFailed', 'Failed to submit governed execution review')
      );
    }
  };

  const handleApproveReview = async () => {
    if (!currentRun?.executionRunId) return;
    try {
      await approveExecutionRun.mutateAsync({
        runId: currentRun.executionRunId,
        reason: 'Approved from governed artifact run control',
      });
      toast.success(t('v8.artifactRun.reviewApproved', 'Governed execution approved'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.reviewApproveFailed', 'Failed to approve governed execution')
      );
    }
  };

  const handleRejectReview = async () => {
    if (!currentRun?.executionRunId) return;
    try {
      await rejectExecutionRun.mutateAsync({
        runId: currentRun.executionRunId,
        reason: 'Rejected from governed artifact run control',
      });
      toast.success(t('v8.artifactRun.reviewRejected', 'Governed execution rejected'));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.reviewRejectFailed', 'Failed to reject governed execution')
      );
    }
  };

  return (
    <div className="relative" data-chat-header-control-variant="icon-action">
      <button
        type="button"
        data-testid="v8-artifact-run-button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={!latestSnapshot?.snapshotId && !snapshotsLoading && !canCaptureSnapshot}
        className={`relative ${CHAT_HEADER_ICON_CONTROL_CLASS} ${isOpen ? CHAT_HEADER_CONTROL_ACTIVE_CLASS : ''}`}
        title={
          latestSnapshot?.snapshotId
            ? t('v8.artifactRun.trigger', 'Create governed output plan')
            : canCaptureSnapshot
              ? t(
                  'v8.artifactRun.captureFirst',
                  'Capture a V8 snapshot to start governed output planning'
                )
              : t('v8.artifactRun.noSnapshot', 'Capture a V8 snapshot before planning an output')
        }
        aria-label={t('v8.artifactRun.trigger', 'Create governed output plan')}
      >
        <FileOutput size={18} strokeWidth={1.75} />
        {currentRun && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
        )}
      </button>

      {isOpen && (
        <div
          data-testid="v8-artifact-run-panel"
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('v8.artifactRun.title', 'Governed output plan')}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {latestSnapshot?.snapshotId
                  ? t(
                      'v8.artifactRun.snapshotReady',
                      'Uses the latest V8 context snapshot from this conversation.'
                    )
                  : canCaptureSnapshot
                    ? t(
                        'v8.artifactRun.snapshotMissingButCapturable',
                        'This conversation needs one governed V8 snapshot before output planning can start.'
                      )
                    : t(
                        'v8.artifactRun.snapshotMissing',
                        'This conversation needs a V8 snapshot before output planning can start.'
                      )}
              </div>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
              onClick={() => setIsOpen(false)}
              aria-label={t('common.close', 'Close')}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {latestSnapshot?.snapshotId
              ? t('v8.artifactRun.latestSnapshot', 'Latest snapshot ready')
              : t('v8.artifactRun.waitingSnapshot', 'No snapshot available yet')}
          </div>

          {!latestSnapshot?.snapshotId && canCaptureSnapshot && (
            <button
              type="button"
              data-testid="v8-artifact-run-capture-snapshot"
              onClick={handleCaptureSnapshot}
              disabled={isBusy}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200 dark:hover:bg-amber-950/35"
            >
              {captureSnapshot.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {t('v8.artifactRun.captureSnapshotAction', 'Capture V8 snapshot')}
            </button>
          )}

          <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('v8.artifactRun.outputType', 'Output type')}
          </label>
          <select
            data-testid="v8-artifact-run-output-type"
            value={selectedOutputType}
            onChange={(event) =>
              setSelectedOutputType(event.target.value as ArtifactPlanOutputType)
            }
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {OUTPUT_OPTIONS.map((option) => (
              <option key={option.outputType} value={option.outputType}>
                {t(`v8.artifactRun.option.${option.outputType}`, option.label)}
              </option>
            ))}
          </select>

          {requiresSheetTableTarget && (
            <>
              <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
                {t('v8.artifactRun.sheetTableId', 'Governed table ID')}
              </label>
              <input
                data-testid="v8-artifact-run-sheet-table-id"
                value={sheetTableId}
                onChange={(event) => setSheetTableId(event.target.value)}
                placeholder={t(
                  'v8.artifactRun.sheetTableIdPlaceholder',
                  'Enter the governed table ID to register/materialize'
                )}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {t(
                  'v8.artifactRun.sheetTableIdHint',
                  'This bounded sheet path materializes into an existing governed table artifact.'
                )}
              </div>
            </>
          )}

          <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('v8.artifactRun.goal', 'Goal')}
          </label>
          <textarea
            data-testid="v8-artifact-run-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={4}
            placeholder={t(
              'v8.artifactRun.goalPlaceholder',
              'Describe what output should be generated from this conversation.'
            )}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              data-testid="v8-artifact-run-plan"
              onClick={handlePlan}
              disabled={!canPlan}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-c-text px-3 py-2 text-sm font-medium text-c-bg transition hover:bg-c-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createRun.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {t('v8.artifactRun.planButton', 'Plan output')}
            </button>
          </div>

          {currentRun && (
            <div
              data-testid="v8-artifact-run-summary"
              className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {currentRun.plan.titleHint}
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  {formatRunStatus(effectiveRunStatus || currentRun.runStatus)}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {formatPlanLabel(currentPlan)}
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {t('v8.artifactRun.executionRun', 'Execution run')}: {currentRun.executionRunId}
              </div>
              {currentRun.proposalId && (
                <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                  {t('v8.artifactRun.proposalReady', 'Proposal ready')}: {currentRun.proposalId}
                </div>
              )}
              {currentRun.artifactId && (
                <div className="mt-1 text-[11px] text-sky-700 dark:text-sky-300">
                  {t('v8.artifactRun.artifactReady', 'Artifact ready')}: {currentRun.artifactId}
                </div>
              )}
              {currentRun.artifactId && artifactTrustState && (
                <div className="mt-2">
                  <TrustStatePreviewSection
                    governance={artifactTrustState}
                    artifactId={currentRun.artifactId}
                  />
                </div>
              )}
              {currentRun.failureReason && (
                <div className="mt-1 text-[11px] text-danger-600 dark:text-danger-300">
                  {currentRun.failureReason}
                </div>
              )}
              {currentRun.failurePackage && (
                <div className="mt-1 text-[11px] text-danger-700 dark:text-danger-200">
                  {t('v8.artifactRun.failureStage', 'Failure stage')}:{' '}
                  {String(currentRun.failurePackage.stage || 'materialize')}
                </div>
              )}

              {currentRun && (
                <div
                  data-testid="v8-artifact-run-preflight"
                  className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/60 dark:bg-amber-950/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
                      <ShieldCheck size={15} />
                      {t('v8.artifactRun.preflightTitle', 'Validation / preflight')}
                    </div>
                    <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      {currentRun.preflight?.state
                        ? String(currentRun.preflight.state).replace(/_/g, ' ')
                        : t('v8.artifactRun.preflightNotRun', 'Not run')}
                    </span>
                  </div>

                  {currentRun.preflight?.checks && currentRun.preflight.checks.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {currentRun.preflight.checks.map((check) => (
                        <div
                          key={check.id}
                          className="flex items-start justify-between gap-3 text-[11px] text-amber-900 dark:text-amber-100"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {check.id.replace(/_/g, ' ')}
                            </div>
                            <div className="mt-0.5 text-amber-800/80 dark:text-amber-200/80">
                              {check.message}
                            </div>
                          </div>
                          <div className="shrink-0 rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            {check.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3">
                    <button
                      type="button"
                      data-testid="v8-artifact-run-preflight-rerun"
                      onClick={handlePreflight}
                      disabled={isBusy || preflightRun.isPending}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-950/35"
                    >
                      {preflightRun.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      {t('v8.artifactRun.preflightAction', 'Run preflight')}
                    </button>
                  </div>
                </div>
              )}

              {runHistory.data && runHistory.data.length > 1 && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                    {t('v8.artifactRun.historyTitle', 'Run history')}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {runHistory.data.map((item, index) => (
                      <div
                        key={item.runId}
                        className="flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        <div className="min-w-0 truncate">
                          {index === 0
                            ? t('v8.artifactRun.historyOriginal', 'Original')
                            : t('v8.artifactRun.historyRetry', 'Retry')}{' '}
                          · {item.runId}
                        </div>
                        <div className="shrink-0 text-slate-600 dark:text-slate-300">
                          {formatRunStatus(item.runStatus)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentRun.executionRunId && executionRun.data && (
                <div
                  data-testid="v8-artifact-run-governance"
                  className="mt-3 rounded-2xl border border-primary-200 bg-primary-50/80 p-3 dark:border-primary-900/60 dark:bg-primary-950/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary-900 dark:text-primary-100">
                      <ShieldCheck size={15} />
                      {t('v8.artifactRun.governedExecution', 'Governed execution')}
                    </div>
                    <span className="rounded-full border border-primary-200 bg-white px-2 py-0.5 text-[11px] font-medium text-primary-700 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-300">
                      {formatExecutionState(executionRun.data.state)}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-primary-800 dark:text-primary-200">
                    <div className="rounded-xl border border-primary-200/80 bg-white/80 px-2 py-1.5 dark:border-primary-900/60 dark:bg-primary-950/40">
                      <div className="opacity-70">
                        {t('v8.artifactRun.proposalsCount', 'Proposals')}
                      </div>
                      <div className="mt-0.5 font-semibold">
                        {executionProposals.data?.length ?? 0}
                      </div>
                    </div>
                    <div className="rounded-xl border border-primary-200/80 bg-white/80 px-2 py-1.5 dark:border-primary-900/60 dark:bg-primary-950/40">
                      <div className="opacity-70">
                        {t('v8.artifactRun.planVersion', 'Plan version')}
                      </div>
                      <div className="mt-0.5 font-semibold">{executionRun.data.planVersion}</div>
                    </div>
                  </div>

                  {latestTransition && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-primary-700 dark:text-primary-300">
                      <GitBranch size={13} />
                      <span>
                        {formatExecutionState(latestTransition.fromState)} {'->'}{' '}
                        {formatExecutionState(latestTransition.toState)}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {canSubmitReview && (
                      <button
                        type="button"
                        data-testid="v8-artifact-run-submit-review"
                        onClick={handleSubmitReview}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-3 py-2 text-xs font-medium text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-300 dark:hover:bg-primary-900/60"
                      >
                        {submitExecutionReview.isPending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <ShieldCheck size={14} />
                        )}
                        {t('v8.artifactRun.submitReviewButton', 'Submit review')}
                      </button>
                    )}
                    {canApproveReview && (
                      <button
                        type="button"
                        data-testid="v8-artifact-run-approve-review"
                        onClick={handleApproveReview}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                      >
                        {approveExecutionRun.isPending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        {t('v8.artifactRun.approveReviewButton', 'Approve review')}
                      </button>
                    )}
                    {canRejectReview && (
                      <button
                        type="button"
                        data-testid="v8-artifact-run-reject-review"
                        onClick={handleRejectReview}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs font-medium text-danger-700 transition hover:bg-danger-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300"
                      >
                        {rejectExecutionRun.isPending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <X size={14} />
                        )}
                        {t('v8.artifactRun.rejectReviewButton', 'Reject review')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {effectiveRunStatus === 'completed' &&
                (currentRun.plan.outputType === 'report' ||
                  currentRun.plan.outputType === 'presentation') &&
                (currentRun.artifactId || currentRun.materializationOrigin?.originRecordId) && (
                  <div className="mt-3">
                    <button
                      type="button"
                      data-testid="v8-artifact-run-open-outputs"
                      onClick={() => {
                        // End of the Teresa spine: a materialized report/deck lands
                        // in the canonical Outputs Library, pre-selected via deep link.
                        const outputId =
                          currentRun.artifactId || currentRun.materializationOrigin?.originRecordId;
                        if (outputId) {
                          navigate(`/presentations?tab=all&artifactId=${outputId}`);
                          setIsOpen(false);
                        }
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-sm font-medium text-brand transition hover:bg-brand/10 dark:border-brand/40 dark:bg-brand/10 dark:text-brand dark:hover:bg-brand/20"
                    >
                      <ExternalLink size={16} />
                      {t('v8.artifactRun.openInOutputs', 'View in Outputs')}
                    </button>
                  </div>
                )}

              <div className="mt-3 flex gap-2">
                {canAccept && (
                  <button
                    type="button"
                    data-testid="v8-artifact-run-accept"
                    onClick={handleAccept}
                    disabled={isBusy}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
                  >
                    {acceptPlan.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    {t('v8.artifactRun.acceptButton', 'Accept plan')}
                  </button>
                )}
                {canMaterialize && (
                  <button
                    type="button"
                    data-testid="v8-artifact-run-materialize"
                    onClick={handleMaterialize}
                    disabled={isBusy}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300"
                  >
                    {materializeRun.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <FileOutput size={16} />
                    )}
                    {t('v8.artifactRun.materializeButton', 'Materialize')}
                  </button>
                )}
                <button
                  type="button"
                  data-testid="v8-artifact-run-retry"
                  onClick={handleRetry}
                  disabled={isBusy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  {retryRun.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  {t('v8.artifactRun.retryButton', 'Retry')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
