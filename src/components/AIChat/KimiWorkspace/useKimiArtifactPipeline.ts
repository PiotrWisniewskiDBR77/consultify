/**
 * useKimiArtifactPipeline — hooks that wire KIMI workspace views
 * to the real V8 artifact run pipeline (create → preflight → accept → review → materialize).
 *
 * Maps pipeline states to TaskStep[] for the progress bar and manages preview state.
 * After materialization, triggers content generation and builds real preview URLs.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Api } from '@/services/api';
import * as TablePlatformApi from '@/services/api/tablePlatform.api';
import { useAppStore } from '@/store/useAppStore';
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
    runStatus === 'cancelled' ||
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
    case 'cancelled':
      return 'cancelled';
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
  { id: 'generate', label: 'Generate content' },
] as const;

function mapRunToSteps(
  effectiveStatus: ArtifactRunRecord['runStatus'] | null,
  hasSnapshot: boolean,
  hasPlan: boolean,
  contentGenerated: boolean
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
    steps.push({ id: 'generate', label: 'Generate content', status: 'pending' });
    return steps;
  }

  if (effectiveStatus === 'applying') {
    steps.push({ id: 'approve', label: 'Approve execution', status: 'completed' });
    steps.push({ id: 'materialize', label: 'Materialize artifact', status: 'running' });
    steps.push({ id: 'generate', label: 'Generate content', status: 'pending' });
    return steps;
  }

  if (effectiveStatus === 'completed') {
    steps.push({ id: 'approve', label: 'Approve execution', status: 'completed' });
    steps.push({ id: 'materialize', label: 'Materialize artifact', status: 'completed' });
    steps.push({
      id: 'generate',
      label: 'Generate content',
      status: contentGenerated ? 'completed' : 'running',
    });
    return steps;
  }

  if (effectiveStatus === 'failed' || effectiveStatus === 'cancelled') {
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

async function fetchWorkbookPreview(
  workbookId: string
): Promise<{
  sheetNames: string[];
  kpiItems: Array<{ label: string; value: string }>;
  downloadUrl: string;
} | null> {
  try {
    const res = await fetch(`/api/workbook/${workbookId}/download`, { method: 'HEAD' });
    if (!res.ok) return null;
    return null; // workbook exists, preview built from generation response
  } catch {
    return null;
  }
}

async function fetchSheetPreviewData(
  tableId: string
): Promise<{
  sheetNames: string[];
  kpiItems: Array<{ label: string; value: string }>;
  rows: Array<Record<string, unknown>>;
  columns: string[];
}> {
  try {
    const [tableInfo, recordsResult] = await Promise.all([
      TablePlatformApi.getTable(tableId),
      TablePlatformApi.listRecords(tableId, { pageSize: 50 }),
    ]);

    const records = Array.isArray(recordsResult?.records)
      ? recordsResult.records
      : Array.isArray(recordsResult)
        ? recordsResult
        : [];

    const columns: string[] = [];
    if (records.length > 0) {
      const firstRow = records[0]?.data || records[0] || {};
      for (const key of Object.keys(firstRow)) {
        if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
          columns.push(key);
        }
      }
    }

    const tableName = tableInfo?.name || 'Sheet1';
    const rowCount = recordsResult?.total ?? records.length;

    return {
      sheetNames: [tableName],
      kpiItems: [
        { label: 'Rows', value: String(rowCount) },
        { label: 'Columns', value: String(columns.length) },
      ],
      rows: records.slice(0, 50).map((r: any) => r?.data || r || {}),
      columns,
    };
  } catch {
    return { sheetNames: ['Sheet1'], kpiItems: [], rows: [], columns: [] };
  }
}

export interface KimiPipelineState {
  taskSteps: TaskStep[];
  totalSteps: number;
  completedSteps: number;
  isGenerating: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  failureReason: string | null;
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
  const { activeConversationId } = useConversationStore();
  const conversationId = activeConversationId;
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  const outputType: ArtifactPlanOutputType =
    lane === 'wordy' ? 'report' : lane === 'excele' ? 'sheet' : 'presentation';
  const artifactFamily: ArtifactFamily =
    lane === 'wordy' ? 'document' : lane === 'excele' ? 'sheet' : 'presentation';

  const { data: snapshots } = useV8Snapshots(
    conversationId ? conversationId : undefined
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
  const [contentGenerated, setContentGenerated] = useState(false);
  const [lastGoal, setLastGoal] = useState('');
  const contentGenerationTriggered = useRef(false);

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
        !!currentPlan,
        contentGenerated
      ),
    [effectiveStatus, latestSnapshot?.snapshotId, currentPlan, contentGenerated]
  );

  const completedSteps = taskSteps.filter((s) => s.status === 'completed').length;
  const isGenerating =
    (!!currentRun && effectiveStatus !== 'completed' && effectiveStatus !== 'failed' && effectiveStatus !== 'cancelled') ||
    (effectiveStatus === 'completed' && !contentGenerated);
  const isCompleted = effectiveStatus === 'completed' && contentGenerated;
  const isFailed = effectiveStatus === 'failed' || effectiveStatus === 'cancelled';

  useEffect(() => {
    if (effectiveStatus !== 'completed' || !currentRun || contentGenerationTriggered.current) {
      return;
    }
    contentGenerationTriggered.current = true;

    const runContentGeneration = async () => {
      const origin = currentRun.materializationOrigin;
      const title =
        currentRun.plan.titleHint ||
        (lane === 'wordy' ? 'Document' : lane === 'excele' ? 'Spreadsheet' : 'Presentation');

      if (lane === 'prezentacje' && origin?.originRecordId) {
        const deckId = origin.originRecordId;

        const generateAndFetch = async () => {
          try {
            await Api.post(`/presentations/generate/deck`, {
              deckId,
              outline: [],
              setup: { goal: lastGoal, selectedTemplate: '' },
            });
          } catch {
            // generation may already be done or endpoint may not match — continue to fetch
          }
          return Api.get(`/presentations/decks/${deckId}`);
        };

        generateAndFetch()
          .then((deckData: any) => {
            const slides: Array<{
              slideId: string;
              intent: string;
              title: string;
              bulletPoints?: string[];
            }> = [];
            const unifiedJson =
              typeof deckData?.deck_json === 'string'
                ? JSON.parse(deckData.deck_json)
                : deckData?.deck_json || deckData?.unified_json;
            const rawSlides = unifiedJson?.slides || [];
            for (const s of rawSlides) {
              const blocks = s.blocks || s.content_blocks || [];
              const bulletPoints = blocks
                .filter((b: any) => b.type === 'bullet_list' || b.type === 'text')
                .flatMap((b: any) => (Array.isArray(b.items) ? b.items : [b.text || b.content]))
                .filter(Boolean)
                .slice(0, 4);
              slides.push({
                slideId: s.slide_id || s.id || String(slides.length),
                intent: s.intent || s.layout || 'content',
                title: s.title || s.heading || `Slide ${slides.length + 1}`,
                bulletPoints,
              });
            }
            const deckStatus = deckData?.status || deckData?.export_path ? 'exported' : 'draft';
            setPreview({
              type: 'deck',
              title,
              fileName: `${title.replace(/\s+/g, '_')}.pptx`,
              summary: `Presentation "${title}" — ${slides.length} slides.`,
              kpiItems: [
                { label: 'Slides', value: String(slides.length) },
                { label: 'Format', value: 'PPTX / PDF' },
                {
                  label: 'Status',
                  value:
                    deckStatus === 'exported' || deckData?.export_path ? 'Exported' : 'Draft',
                },
              ],
              deckId,
              deckStatus: deckData?.export_path ? 'exported' : (deckData?.status || 'draft'),
              deckSlides: slides,
            });
            setContentGenerated(true);
          })
          .catch(() => {
            setPreview({
              type: 'deck',
              title,
              fileName: `${title.replace(/\s+/g, '_')}.pptx`,
              summary: `Presentation "${title}" generated.`,
              kpiItems: [{ label: 'Status', value: 'Ready' }],
              deckId,
              deckSlides: [],
            });
            setContentGenerated(true);
          });
        return;
      }

      if (lane === 'wordy' && origin?.originRecordId) {
        const reportId = origin.originRecordId;
        Api.post(`/report-builder/${reportId}/generate`, { regenerateAll: false })
          .then(() => {
            const pdfUrl = `/api/report-builder/${reportId}/export/pdf`;
            setPreview({
              type: 'pdf',
              title,
              url: pdfUrl,
              fileName: `${title.replace(/\s+/g, '_')}.pdf`,
            });
            setContentGenerated(true);
          })
          .catch(() => {
            setPreview({
              type: 'pdf',
              title,
              url: `/api/report-builder/${reportId}/export/pdf`,
              fileName: `${title.replace(/\s+/g, '_')}.pdf`,
            });
            setContentGenerated(true);
          });
        return;
      }

      if (lane === 'excele') {
        // P23-ext: Try intelligent workbook generation first, fallback to table export
        const generateWorkbook = async () => {
          try {
            const wbResult = await Api.generateWorkbook({
              prompt: lastGoal || title,
              language: navigator.language,
            });
            if (wbResult?.id) {
              const qualityLabel =
                wbResult.qualityScore != null ? `${wbResult.qualityScore.toFixed(1)}/5` : 'N/A';

              setPreview({
                type: 'xlsx',
                title: wbResult.title || title,
                fileName: wbResult.fileName || `${title.replace(/\s+/g, '_')}.xlsx`,
                summary: `Workbook "${wbResult.title}" — ${wbResult.sheets?.length || 1} sheets. Quality: ${qualityLabel}`,
                kpiItems: [
                  { label: 'Sheets', value: String(wbResult.sheets?.length || 1) },
                  { label: 'Quality', value: qualityLabel },
                  { label: 'Size', value: `${Math.round((wbResult.fileSize || 0) / 1024)} KB` },
                  ...(wbResult.sheets || []).map((s: any) => ({
                    label: s.name,
                    value: `${s.rowCount} rows × ${s.columnCount} cols`,
                  })),
                ],
                sheetNames: (wbResult.sheets || []).map((s: any) => s.name),
                workbookId: wbResult.id,
                downloadUrl: wbResult.downloadUrl,
                qualityScore: wbResult.qualityScore,
                pipelineLog: wbResult.pipelineLog,
              });
              setContentGenerated(true);
              return true;
            }
          } catch (err) {
            console.warn('[KIMI] Workbook generation failed, falling back to table export:', err);
          }
          return false;
        };

        const workbookGenerated = await generateWorkbook();

        if (!workbookGenerated && origin?.originRecordId) {
          const tableId = origin.originRecordId;
          fetchSheetPreviewData(tableId)
            .then((data) => {
              setPreview({
                type: 'xlsx',
                title,
                fileName: `${title.replace(/\s+/g, '_')}.xlsx`,
                summary: `Spreadsheet "${title}" — ${data.kpiItems.find((k) => k.label === 'Rows')?.value || '0'} rows, ${data.kpiItems.find((k) => k.label === 'Columns')?.value || '0'} columns.`,
                kpiItems: data.kpiItems,
                sheetNames: data.sheetNames,
                tableData: { columns: data.columns, rows: data.rows },
              });
              setContentGenerated(true);
            })
            .catch(() => {
              setPreview({
                type: 'xlsx',
                title,
                fileName: `${title.replace(/\s+/g, '_')}.xlsx`,
                summary: `Spreadsheet "${title}" generated.`,
                kpiItems: [],
                sheetNames: ['Sheet1'],
              });
              setContentGenerated(true);
            });
        } else if (!workbookGenerated) {
          setPreview({
            type: 'xlsx',
            title,
            fileName: `${title.replace(/\s+/g, '_')}.xlsx`,
            summary: `Spreadsheet "${title}" generated.`,
            kpiItems: [],
            sheetNames: ['Sheet1'],
          });
          setContentGenerated(true);
        }
        return;
      }

      if (lane === 'wordy') {
        setPreview({
          type: 'pdf',
          title,
          fileName: `${title.replace(/\s+/g, '_')}.pdf`,
        });
      } else {
        setPreview({
          type: 'deck',
          title,
          fileName: `${title.replace(/\s+/g, '_')}.pptx`,
          summary: `Presentation "${title}" generated.`,
          kpiItems: [{ label: 'Status', value: 'Ready' }],
          deckSlides: [],
        });
      }
      setContentGenerated(true);
    };

    void runContentGeneration();
  }, [effectiveStatus, currentRun, lane, lastGoal]);

  const startGeneration = useCallback(
    async (goal: string, templateArtifactId?: string) => {
      if (!conversationId) {
        toast.error('No active conversation. Start a chat first.');
        return;
      }

      setLastGoal(goal);
      contentGenerationTriggered.current = false;
      setContentGenerated(false);

      try {
        let snapshotId = latestSnapshot?.snapshotId;
        if (!snapshotId) {
          // Fetch recent user artifacts to include as context refs for AI awareness
          let artifactRefs: Array<{
            artifactId: string;
            artifactType: string;
            artifactModule: string;
            relationship: string;
          }> = [];
          try {
            const recentArtifacts = await Api.get('/artifacts', { params: { limit: 5 } });
            const items = Array.isArray(recentArtifacts)
              ? recentArtifacts
              : (recentArtifacts as any)?.data || [];
            artifactRefs = items.slice(0, 5).map((a: any) => ({
              artifactId: a.artifactId || a.artifact_id,
              artifactType: a.outputType || a.output_type || 'report',
              artifactModule: 'outputs_library',
              relationship: 'reference' as const,
            }));
          } catch {
            // Non-critical; proceed with empty refs
          }

          const sourceContextRefs: Array<{
            sourceId: string;
            scopeType: string;
            sourceKind: string;
            freshnessAt: string | null;
          }> = [];
          if (currentOrganization?.id) {
            sourceContextRefs.push({
              sourceId: currentOrganization.id,
              scopeType: 'organization',
              sourceKind: 'organization_profile',
              freshnessAt: new Date().toISOString(),
            });
          }
          if (currentProjectId) {
            sourceContextRefs.push({
              sourceId: currentProjectId,
              scopeType: 'organization',
              sourceKind: 'project',
              freshnessAt: new Date().toISOString(),
            });
          }
          const snap = await captureSnapshot.mutateAsync({
            workspaceId: conversationId,
            projectId: currentProjectId || null,
            conversationId,
            executionRunId: null,
            artifactRefs,
            effectiveScopeRef: 'workspace',
            resolvedRoleRef: 'member',
            consumerClass: 'chat',
            privacyMode: false,
            sourceContextRefs,
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
          ...(templateArtifactId ? { templateArtifactId } : {}),
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
            config:
              outputType === 'sheet'
                ? { tableId: '' }
                : outputType === 'presentation'
                  ? { templateId: '' }
                  : undefined,
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
    contentGenerationTriggered.current = false;
    setCurrentRun(null);
    setCurrentPlan(null);
    setPreview(null);
    setContentGenerated(false);
    if (lastGoal) {
      void startGeneration(lastGoal);
    }
  }, [lastGoal, startGeneration]);

  const handleRemix = useCallback(() => {
    contentGenerationTriggered.current = false;
    setCurrentRun(null);
    setCurrentPlan(null);
    setPreview(null);
    setContentGenerated(false);
  }, []);

  const handleDownload = useCallback(async () => {
    // P23-ext: Check for workbook download first
    if (lane === 'excele' && preview && (preview as any).workbookId) {
      Api.downloadWorkbook((preview as any).workbookId);
      return;
    }

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
      window.open(`/api/report-builder/${reportId}/export/docx`, '_blank');
      return;
    }

    if (lane === 'prezentacje' && currentRun.materializationOrigin?.originRecordId) {
      const deckId = currentRun.materializationOrigin.originRecordId;
      window.open(`/api/presentations/decks/${deckId}/download`, '_blank');
      return;
    }

    toast.error('No artifact available for download yet');
  }, [currentRun, lane]);

  const failureReason = isFailed
    ? (currentRun as any)?.failureReason ?? (currentRun as any)?.failurePackage?.message ?? null
    : null;

  const myWorkNotified = useRef(false);
  useEffect(() => {
    if (!isCompleted || myWorkNotified.current || !currentRun) return;
    myWorkNotified.current = true;

    const origin = currentRun.materializationOrigin;
    const artifactPath = origin?.originRecordId
      ? `/${lane === 'wordy' ? 'wordy' : lane === 'prezentacje' ? 'prezentacje' : 'excele'}?artifactId=${origin.originRecordId}`
      : null;

    Api.post('/mywork/items', {
      type: 'artifact_completion',
      title: currentRun.plan?.titleHint || 'Artifact completed',
      description: `${lane} pipeline completed`,
      linkPath: artifactPath,
      artifactRunId: currentRun.runId,
    }).catch(() => {
      // Non-critical; My Work notification is best-effort
    });
  }, [isCompleted, currentRun, lane]);

  return {
    taskSteps,
    totalSteps: PIPELINE_STEPS.length,
    completedSteps,
    isGenerating,
    isCompleted,
    isFailed,
    failureReason,
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
