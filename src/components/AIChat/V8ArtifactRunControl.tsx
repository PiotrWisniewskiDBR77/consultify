import {
  CheckCircle2,
  FileOutput,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  useV8AcceptArtifactRunPlan,
  useV8CreateArtifactRunFromChat,
  useV8MaterializeArtifactRun,
  useV8RetryArtifactRun,
} from '@/hooks/useV8ArtifactRuns';
import type {
  ArtifactFamily,
  ArtifactPlanOutputType,
  ArtifactRunPlan,
  ArtifactRunRecord,
} from '@/hooks/useV8ArtifactRuns';
import { useV8Gate } from '@/hooks/useV8Gate';
import { useV8Snapshots } from '@/hooks/useV8Chat';

interface V8ArtifactRunControlProps {
  conversationId: string | null;
  defaultGoal?: string;
}

const OUTPUT_OPTIONS: Array<{
  outputType: ArtifactPlanOutputType;
  artifactFamily: ArtifactFamily;
  label: string;
}> = [
  { outputType: 'report', artifactFamily: 'document', label: 'Document' },
];

function formatRunStatus(status: ArtifactRunRecord['runStatus']): string {
  switch (status) {
    case 'proposal_created':
      return 'Proposal created';
    case 'retry_requested':
      return 'Retry requested';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Planned';
  }
}

function formatPlanLabel(plan: ArtifactRunPlan | null): string {
  if (!plan) return '';
  return `${plan.outputType} · ${plan.visibilityScope}`;
}

export function V8ArtifactRunControl({
  conversationId,
  defaultGoal = '',
}: V8ArtifactRunControlProps) {
  const { t } = useTranslation();
  const { showV8Chat } = useV8Gate();
  const { data: snapshots, isLoading: snapshotsLoading } = useV8Snapshots(
    showV8Chat && conversationId ? conversationId : undefined,
  );
  const createRun = useV8CreateArtifactRunFromChat();
  const acceptPlan = useV8AcceptArtifactRunPlan();
  const materializeRun = useV8MaterializeArtifactRun();
  const retryRun = useV8RetryArtifactRun();

  const snapshotItems = Array.isArray(snapshots) ? snapshots : [];
  const latestSnapshot = snapshotItems.length > 0 ? snapshotItems[snapshotItems.length - 1] : null;
  const [isOpen, setIsOpen] = useState(false);
  const [goal, setGoal] = useState(defaultGoal);
  const [selectedOutputType, setSelectedOutputType] = useState<ArtifactPlanOutputType>('report');
  const [currentRun, setCurrentRun] = useState<ArtifactRunRecord | null>(null);
  const [currentPlan, setCurrentPlan] = useState<ArtifactRunPlan | null>(null);

  useEffect(() => {
    setIsOpen(false);
    setGoal(defaultGoal);
    setSelectedOutputType('report');
    setCurrentRun(null);
    setCurrentPlan(null);
  }, [conversationId, defaultGoal]);

  const selectedOutput = useMemo(
    () => OUTPUT_OPTIONS.find((option) => option.outputType === selectedOutputType) ?? OUTPUT_OPTIONS[0],
    [selectedOutputType],
  );

  if (!showV8Chat || !conversationId) return null;

  const isBusy =
    createRun.isPending ||
    acceptPlan.isPending ||
    materializeRun.isPending ||
    retryRun.isPending;
  const canPlan = Boolean(latestSnapshot?.snapshotId) && goal.trim().length > 0 && !isBusy;
  const canAccept =
    currentRun?.runStatus === 'planned' || currentRun?.runStatus === 'retry_requested';
  const canMaterialize =
    currentRun?.runStatus === 'proposal_created' &&
    currentRun?.plan.outputType === 'report' &&
    !currentRun.artifactId;

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
      toast.success(
        t('v8.artifactRun.planCreated', 'Artifact plan created from governed chat'),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.planFailed', 'Failed to create artifact plan'),
      );
    }
  };

  const handleAccept = async () => {
    if (!currentRun?.runId) return;
    try {
      const updated = await acceptPlan.mutateAsync(currentRun.runId);
      setCurrentRun(updated);
      setCurrentPlan(updated.plan);
      toast.success(
        t('v8.artifactRun.accepted', 'Artifact plan accepted and proposal created'),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.acceptFailed', 'Failed to accept artifact plan'),
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
          : t('v8.artifactRun.retryFailed', 'Failed to retry artifact plan'),
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
        },
      });
      setCurrentRun(completed);
      setCurrentPlan(completed.plan);
      toast.success(
        t('v8.artifactRun.materialized', 'Artifact run materialized into a canonical output'),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('v8.artifactRun.materializeFailed', 'Failed to materialize artifact run'),
      );
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="v8-artifact-run-button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={!latestSnapshot?.snapshotId && !snapshotsLoading}
        className={`relative p-1.5 rounded-lg transition-colors ${
          isOpen
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-700 dark:hover:text-slate-200'
        } disabled:cursor-not-allowed disabled:opacity-50`}
        title={
          latestSnapshot?.snapshotId
            ? t('v8.artifactRun.trigger', 'Create governed output plan')
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
                  ? t('v8.artifactRun.snapshotReady', 'Uses the latest V8 context snapshot from this conversation.')
                  : t('v8.artifactRun.snapshotMissing', 'This conversation needs a V8 snapshot before output planning can start.')}
              </div>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
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

          <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('v8.artifactRun.outputType', 'Output type')}
          </label>
          <select
            data-testid="v8-artifact-run-output-type"
            value={selectedOutputType}
            onChange={(event) => setSelectedOutputType(event.target.value as ArtifactPlanOutputType)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {OUTPUT_OPTIONS.map((option) => (
              <option key={option.outputType} value={option.outputType}>
                {t(`v8.artifactRun.option.${option.outputType}`, option.label)}
              </option>
            ))}
          </select>

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
              'Describe what output should be generated from this conversation.',
            )}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              data-testid="v8-artifact-run-plan"
              onClick={handlePlan}
              disabled={!canPlan}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                  {formatRunStatus(currentRun.runStatus)}
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
              {currentRun.failureReason && (
                <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-300">
                  {currentRun.failureReason}
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
