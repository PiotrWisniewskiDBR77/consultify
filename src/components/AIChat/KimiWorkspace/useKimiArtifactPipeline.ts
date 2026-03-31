/**
 * useKimiArtifactPipeline — hooks that wire KIMI workspace views
 * to the real V8 artifact run pipeline (create → preflight → accept → review → materialize).
 *
 * Maps pipeline states to TaskStep[] for the progress bar and manages preview state.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import type {
  ArtifactFamily,
  ArtifactPlanOutputType,
  ArtifactRunPlan,
  ArtifactRunRecord,
} from '@/hooks/useV8ArtifactRuns';
import {
  useV8AcceptArtifactRunPlan,
  useV8CreateArtifactRunFromChat,
  useV8MaterializeArtifactRun,
  useV8PreflightArtifactRun,
  useV8RetryArtifactRun,
} from '@/hooks/useV8ArtifactRuns';
import { useV8CaptureSnapshot, useV8Snapshots } from '@/hooks/useV8Chat';
import {
  useV8ApproveExecutionRun,
  useV8ExecutionRun,
  useV8SubmitExecutionReview,
} from '@/hooks/useV8Execution';
import { useV8Gate } from '@/hooks/useV8Gate';
import { useConversationStore } from '@/store/useConversationStore';
import { downloadSheetArtifactXlsx } from '@/utils/sheetArtifactOpen';

import type { ArtifactPreview, KimiLane, TaskStep } from './KimiWorkspaceShell';

function deriveEffectiveStatus(
  runStatus: ArtifactRunRecord['runStatus'],
  executionState: string | null | undefined
): ArtifactRunRecord['runStatus'] {
  if (
    runStatus === 'completed' ||
    runStatus === 'failed' ||
    runStatus === 'retry_requested'
  ) {
    return runStatus;
  }
  if (runStatus === 'planned') return 'planned';

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
    default:
      return runStatus;
  }
}

const PIPELINE_STEPS = [
  { id: 'snapshot', label: 'Capture context snapshot' },
  { id: 'plan', label: 'Create artifact plan' },
  { id: 'preflight', label: 'Validate preflight checks' },
  { id: 'accept', label: 'Accept plan & create proposal' },
  { id: 'review', label: 'Submit for review' },
  { id: 'approve', label: 'Approve execution' },
  { id: 'materialize', label: 'Materialize artifact' },
] as const;

function mapRunToSteps(
  effectiveStatus: ArtifactRunRecord['runStatus'] | null,
  hasSnapshot: boolean,
  hasPlan: boolean
): TaskStep[] {
  if (!hasSnapshot && !hasPlan && !effectiveStatus) {
    return PIPELINE_STEPS.map((s) => ({ id: s.id, label: s.label, status: 'pending' as const }));
  }

  const steps: TaskStep[] = [];

  steps.push({
    id: 'snapshot',
    label: 'Capture context snapshot',
    status: hasSnapshot ? 'completed' : 'running',
  });

  if (!hasPlan) {
    steps.push(
      ...PIPELINE_STEPS.slice(1).map((s) => ({
        id: s.id,
        label: s.label,
        status: 'pending' as const,
      }))
    );
    return steps;
  }

  steps.push({ id: 'plan', label: 'Create artifact plan', status: 'completed' });

  if (!effectiveStatus || effectiveStatus === 'planned') {
    steps.push({ id: 'preflight', label: 'Validate preflight checks', status: 'running' });
    steps.push(
      ...PIPELINE_STEPS.slice(3).map((s) => ({
        id: s.id,
        label: s.label,
        status: 'pending' as const,
      }))
    );
    return steps;
  }

  steps.push({ id: 'preflight', label: 'Validate preflight checks', status: 'completed' });

  if (effectiveStatus === 'proposal_created') {
    steps.push({ id: 'accept', label: 'Accept plan & create proposal', status: 'running' });
    steps.push(
      ...PIPELINE_STEPS.slice(4).map((s) => ({
        id: s.id,
        label: s.label,
        status: 'pending' as const,
      }))
    );
    return steps;
  }

  steps.push({ id: 'accept', label: 'Accept plan & create proposal', status: 'completed' });

  if (effectiveStatus === 'awaiting_review') {
    steps.push({ id: 'review', label: 'Submit for review', status: 'running' });
    steps.push(
      ...PIPELINE_STEPS.slice(5).map((s) => ({
        id: s.id,
        label: s.label,
        status: 'pending' as const,
      }))
    );
    return steps;
  }

  steps.push({ id: 'review', label: 'Submit for review', status: 'completed' });

  if (effectiveStatus === 'approved_for_apply') {
    steps.push({ id: 'approve', label: 'Approve execution', status: 'completed' });
    steps.push({ id: 'materialize', label: 'Materialize artifact', status: 'running' });
    return steps;
  }

  if (effectiveStatus === 'applying') {
    steps.push({ id: 'approve', label: 'Approve execution', status: 'completed' });
    steps.push({ id: 'materialize', label: 'Materialize artifact', status: 'running' });
    return steps;
  }

  if (effectiveStatus === 'completed') {
    steps.push({ id: 'approve', label: 'Approve execution', status: 'completed' });
    steps.push({ id: 'materialize', label: 'Materialize artifact', status: 'completed' });
    return steps;
  }

  if (effectiveStatus === 'failed') {
    const failIdx = steps.length;
    steps.push(
      ...PIPELINE_STEPS.slice(failIdx).map((s) => ({
        id: s.id,
        label: s.label,
        status: 'failed' as const,
      }))
    );
    return steps;
  }

  steps.push(
    ...PIPELINE_STEPS.slice(steps.length).map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending' as const,
    }))
  );
  return steps;
}

export interface KimiPipelineState {
  taskSteps: TaskStep[];
  totalSteps: number;
  completedSteps: number;
  isGenerating: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  preview: ArtifactPreview | null;
  currentRun: ArtifactRunRecord | null;
  isBusy: boolean;

  startGeneration: (goal: string) => Promise<void>;
  advancePipeline: () => Promise<void>;
  handleReplay: () => void;
  handleRemix: () => void;
  handleDownload: () => Promise<void>;
}

export function useKimiArtifactPipeline(lane: KimiLane): KimiPipelineState {
  const { showV8Chat } = useV8Gate();
  const { activeConversationId } = useConversationStore();
  const conversationId = activeConversationId;

  const outputType: ArtifactPlanOutputType = lane === 'wordy' ? 'report' : 'sheet';
  const artifactFamily: ArtifactFamily = lane === 'wordy' ? 'document' : 'sheet';

  const { data: snapshots } = useV8Snapshots(
    showV8Chat && conversationId ? conversationId : undefined
  );
  const captureSnapshot = useV8CaptureSnapshot();
  const createRun = useV8CreateArtifactRunFromChat();
  const acceptPlan = useV8AcceptArtifactRunPlan();
  const materializeRun = useV8MaterializeArtifactRun();
  const preflightRun = useV8PreflightArtifactRun();
  const retryRun = useV8RetryArtifactRun();
  const submitReview = useV8SubmitExecutionReview();
  const approveRun = useV8ApproveExecutionRun();

  const [currentRun, setCurrentRun] = useState<ArtifactRunRecord | null>(null);
  const [currentPlan, setCurrentPlan] = useState<ArtifactRunPlan | null>(null);
  const [preview, setPreview] = useState<ArtifactPreview | null>(null);

  const snapshotItems = Array.isArray(snapshots) ? snapshots : [];
  const latestSnapshot =
    snapshotItems.length > 0
      ? (snapshotItems[snapshotItems.length - 1] as { snapshotId?: string })
      : null;

  const executionRun = useV8ExecutionRun(currentRun?.executionRunId || undefined);

  const effectiveStatus = currentRun
    ? deriveEffectiveStatus(currentRun.runStatus, executionRun.data?.state)
    : null;

  const isBusy =
    captureSnapshot.isPending ||
    createRun.isPending ||
    acceptPlan.isPending ||
    materializeRun.isPending ||
    preflightRun.isPending ||
    retryRun.isPending ||
    submitReview.isPending ||
    approveRun.isPending;

  const taskSteps = useMemo(
    () =>
      mapRunToSteps(
        effectiveStatus,
        !!latestSnapshot?.snapshotId,
        !!currentPlan
      ),
    [effectiveStatus, latestSnapshot?.snapshotId, currentPlan]
  );

  const completedSteps = taskSteps.filter((s) => s.status === 'completed').length;
  const isGenerating =
    !!currentRun && effectiveStatus !== 'completed' && effectiveStatus !== 'failed';
  const isCompleted = effectiveStatus === 'completed';
  const isFailed = effectiveStatus === 'failed';

  useEffect(() => {
    if (isCompleted && currentRun) {
      const title = currentRun.plan.titleHint || (lane === 'wordy' ? 'Document' : 'Spreadsheet');
      if (lane === 'wordy') {
        setPreview({
          type: 'pdf',
          title,
          fileName: `${title.replace(/\s+/g, '_')}.pdf`,
          pageCount: undefined,
        });
      } else {
        const origin = currentRun.materializationOrigin;
        setPreview({
          type: 'xlsx',
          title,
          fileName: `${title.replace(/\s+/g, '_')}.xlsx`,
          summary: `Spreadsheet "${title}" generated successfully.`,
          kpiItems: [],
          sheetNames: ['Sheet1'],
        });
      }
    }
  }, [isCompleted, currentRun, lane]);

  const startGeneration = useCallback(
    async (goal: string) => {
      if (!conversationId) {
        toast.error('No active conversation. Start a chat first.');
        return;
      }

      try {
        let snapshotId = latestSnapshot?.snapshotId;
        if (!snapshotId) {
          const snap = await captureSnapshot.mutateAsync({
            workspaceId: conversationId,
            projectId: null,
            conversationId,
            executionRunId: null,
            artifactRefs: [],
            effectiveScopeRef: 'workspace',
            resolvedRoleRef: 'member',
            consumerClass: 'chat',
            privacyMode: false,
            sourceContextRefs: [],
          });
          snapshotId = (snap as { snapshotId?: string })?.snapshotId;
        }

        if (!snapshotId) {
          toast.error('Failed to capture context snapshot.');
          return;
        }

        const result = await createRun.mutateAsync({
          conversationId,
          contextSnapshotId: snapshotId,
          goal: goal.trim(),
          requestedArtifactFamily: artifactFamily,
          requestedOutputType: outputType,
        });
        setCurrentRun(result.run);
        setCurrentPlan(result.artifactPlan);

        try {
          const preflighted = await preflightRun.mutateAsync(result.run.runId);
          setCurrentRun(preflighted);
          setCurrentPlan(preflighted.plan);
        } catch {
          // preflight failures surface via state
        }

        try {
          const accepted = await acceptPlan.mutateAsync(result.run.runId);
          setCurrentRun(accepted);
          setCurrentPlan(accepted.plan);
        } catch {
          // accept failures surface via state
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to start artifact generation'
        );
      }
    },
    [
      conversationId,
      latestSnapshot,
      captureSnapshot,
      createRun,
      preflightRun,
      acceptPlan,
      artifactFamily,
      outputType,
    ]
  );

  const advancePipeline = useCallback(async () => {
    if (!currentRun) return;

    try {
      if (effectiveStatus === 'proposal_created') {
        const accepted = await acceptPlan.mutateAsync(currentRun.runId);
        setCurrentRun(accepted);
        setCurrentPlan(accepted.plan);
        return;
      }

      if (effectiveStatus === 'awaiting_review' && currentRun.executionRunId) {
        await submitReview.mutateAsync(currentRun.executionRunId);
        return;
      }

      if (
        (effectiveStatus === 'approved_for_apply' || effectiveStatus === 'applying') &&
        !currentRun.artifactId
      ) {
        const completed = await materializeRun.mutateAsync({
          runId: currentRun.runId,
          params: {
            title: currentRun.plan.titleHint,
            config: outputType === 'sheet' ? { tableId: '' } : undefined,
          },
        });
        setCurrentRun(completed);
        setCurrentPlan(completed.plan);
        return;
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to advance pipeline'
      );
    }
  }, [currentRun, effectiveStatus, acceptPlan, submitReview, materializeRun, outputType]);

  const handleReplay = useCallback(() => {
    setCurrentRun(null);
    setCurrentPlan(null);
    setPreview(null);
  }, []);

  const handleRemix = useCallback(() => {
    setPreview(null);
    toast.success('Modify your prompt and regenerate');
  }, []);

  const handleDownload = useCallback(async () => {
    if (!currentRun) return;

    if (lane === 'excele' && currentRun.materializationOrigin?.originRecordId) {
      const ok = await downloadSheetArtifactXlsx(
        currentRun.materializationOrigin.originRecordId
      );
      if (!ok) toast.error('Download failed');
      return;
    }

    if (lane === 'wordy' && currentRun.materializationOrigin?.originRecordId) {
      const reportId = currentRun.materializationOrigin.originRecordId;
      window.open(`/api/report-builder/reports/${reportId}/export/pdf`, '_blank');
      return;
    }

    toast.error('No artifact available for download yet');
  }, [currentRun, lane]);

  return {
    taskSteps,
    totalSteps: PIPELINE_STEPS.length,
    completedSteps,
    isGenerating,
    isCompleted,
    isFailed,
    preview,
    currentRun,
    isBusy,
    startGeneration,
    advancePipeline,
    handleReplay,
    handleRemix,
    handleDownload,
  };
}
