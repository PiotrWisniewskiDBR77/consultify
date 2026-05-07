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
  contentGenerated: boolean,
  isStarting: boolean
): TaskStep[] {
  if (isStarting && !hasPlan && !effectiveStatus) {
    return [
      { id: 'snapshot', label: 'Capture context snapshot', status: 'running' },
      ...PIPELINE_STEPS.slice(1).map((s) => ({
        id: s.id,
        label: s.label,
        status: 'pending' as const,
      })),
    ];
  }

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

async function fetchWorkbookPreview(workbookId: string): Promise<{
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

async function fetchSheetPreviewData(tableId: string): Promise<{
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

  startGeneration: (goal: string, templateArtifactId?: string) => Promise<void>;
  advancePipeline: () => Promise<void>;
  handleReplay: () => void;
  handleRemix: () => void;
  handleDownload: () => Promise<void>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuidLike = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v.trim());

export function useKimiArtifactPipeline(lane: KimiLane): KimiPipelineState {
  const conversationId = useConversationStore((s) => s.activeConversationId);
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentUser = useAppStore((s) => s.currentUser);

  const outputType: ArtifactPlanOutputType =
    lane === 'wordy' ? 'report' : lane === 'excele' || lane === 'tabele' ? 'sheet' : 'presentation';
  const artifactFamily: ArtifactFamily =
    lane === 'wordy'
      ? 'document'
      : lane === 'excele' || lane === 'tabele'
        ? 'sheet'
        : 'presentation';

  const { data: snapshots } = useV8Snapshots(conversationId ? conversationId : undefined);
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
  const [isStartingPipeline, setIsStartingPipeline] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
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
        contentGenerated,
        isStartingPipeline
      ),
    [effectiveStatus, latestSnapshot?.snapshotId, currentPlan, contentGenerated, isStartingPipeline]
  );

  const completedSteps = taskSteps.filter((s) => s.status === 'completed').length;
  const isGenerating =
    isStartingPipeline ||
    (!!currentRun &&
      effectiveStatus !== 'completed' &&
      effectiveStatus !== 'failed' &&
      effectiveStatus !== 'cancelled') ||
    (effectiveStatus === 'completed' && !contentGenerated);
  const isCompleted = effectiveStatus === 'completed' && contentGenerated;
  const isFailed =
    Boolean(startupError) || effectiveStatus === 'failed' || effectiveStatus === 'cancelled';

  useEffect(() => {
    if (effectiveStatus !== 'completed' || !currentRun || contentGenerationTriggered.current) {
      return;
    }
    contentGenerationTriggered.current = true;

    const runContentGeneration = async () => {
      const origin = currentRun.materializationOrigin;
      const title =
        currentRun.plan.titleHint ||
        (lane === 'wordy'
          ? 'Document'
          : lane === 'excele'
            ? 'Spreadsheet'
            : lane === 'tabele'
              ? 'Table'
              : 'Presentation');

      if (lane === 'prezentacje' && origin?.originRecordId) {
        const deckId = origin.originRecordId;

        const generateAndFetch = async () => {
          const unwrap = <T = any>(res: any): T => {
            const data = res?.data;
            if (data && typeof data === 'object' && 'data' in data) return data.data as T;
            return data as T;
          };

          const initialDeck = unwrap<any>(await Api.get(`/presentations/decks/${deckId}`));
          const hasGeneratedContent = Boolean(initialDeck?.deck_json || initialDeck?.unified_json);

          if (!hasGeneratedContent) {
            try {
              await Api.post(`/presentations/generate/deck`, {
                deckId,
                outline: Array.isArray(initialDeck?.outline_json) ? initialDeck.outline_json : [],
                setup: {
                  title: initialDeck?.title || title,
                  templateId:
                    typeof initialDeck?.template_id === 'string' && initialDeck.template_id.trim()
                      ? initialDeck.template_id
                      : undefined,
                  audience: initialDeck?.audience || 'internal',
                  goal: initialDeck?.goal || 'inform',
                  language: initialDeck?.language || 'en',
                  theme: initialDeck?.theme || 'modern',
                  confidentiality: initialDeck?.confidentiality || 'internal',
                  sourceArtifacts: Array.isArray(initialDeck?.source_artifacts)
                    ? initialDeck.source_artifacts
                    : [],
                  sourceType: initialDeck?.source_type || undefined,
                  sourceId: initialDeck?.source_id || undefined,
                },
              });
            } catch {
              // generation may already be done or a legacy payload may still be accepted
            }
          }
          return unwrap<any>(await Api.get(`/presentations/decks/${deckId}`));
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
            const rawSlides =
              unifiedJson?.slides ||
              (Array.isArray(deckData?.outline_json)
                ? deckData.outline_json.map((item: any, index: number) => ({
                    id: item?.slideId || String(index + 1),
                    intent: item?.intent || 'content',
                    title: item?.title || `Slide ${index + 1}`,
                    blocks: item?.keyMessage ? [{ type: 'text', text: item.keyMessage }] : [],
                  }))
                : []);
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
                  value: deckStatus === 'exported' || deckData?.export_path ? 'Exported' : 'Draft',
                },
              ],
              deckId,
              deckStatus: deckData?.export_path ? 'exported' : deckData?.status || 'draft',
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

      if (lane === 'tabele' && origin?.originRecordId) {
        const tableId = origin.originRecordId;
        const workspaceIdForProposals = currentOrganization?.id || currentProjectId || '';

        try {
          const [tableInfo, recordsResult, proposalsResult] = await Promise.all([
            TablePlatformApi.getTable(tableId).catch(() => null),
            TablePlatformApi.listRecords(tableId, { pageSize: 25 }).catch(() => null),
            workspaceIdForProposals
              ? TablePlatformApi.listSchemaProposals(workspaceIdForProposals, 'pending').catch(
                  () => [] as Awaited<ReturnType<typeof TablePlatformApi.listSchemaProposals>>
                )
              : Promise.resolve(
                  [] as Awaited<ReturnType<typeof TablePlatformApi.listSchemaProposals>>
                ),
          ]);

          const fields = Array.isArray(tableInfo?.fields) ? (tableInfo as any).fields : [];
          const proposalByFieldId = new Map<string, string>();
          for (const p of Array.isArray(proposalsResult) ? proposalsResult : []) {
            const targetFieldId = (p as any)?.targetFieldId;
            const proposalId = (p as any)?.id;
            if (typeof targetFieldId === 'string' && typeof proposalId === 'string') {
              proposalByFieldId.set(targetFieldId, proposalId);
            }
          }

          const tabeleSchemaFields = fields.map((f: any) => {
            const proposalId = proposalByFieldId.get(f?.id ?? f?.fieldId ?? '');
            return {
              fieldId: String(f?.id ?? f?.fieldId ?? ''),
              name: String(f?.name ?? ''),
              fieldType: String(f?.type ?? f?.fieldType ?? 'text'),
              governanceState: proposalId ? ('proposed' as const) : ('committed' as const),
              ...(proposalId ? { proposalId } : {}),
            };
          });

          const tabeleRelations = fields
            .filter((f: any) => (f?.type ?? f?.fieldType) === 'relation')
            .map((f: any) => ({
              fieldId: String(f?.id ?? f?.fieldId ?? ''),
              fieldName: String(f?.name ?? ''),
              targetTableId: String(f?.targetTableId ?? f?.relation?.targetTableId ?? ''),
              targetTableName: String(f?.targetTableName ?? f?.relation?.targetTableName ?? ''),
              targetCount: Number(f?.targetCount ?? 0),
            }));

          // Reserve a slot for explainRelation per relation. Sprint 3 / EPIC-2 will
          // resolve these per-record. Failures must NOT block the preview, so we
          // intentionally leave `tabeleRationale` undefined when explain is unavailable.
          let tabeleRationale: ArtifactPreview['tabeleRationale'] = undefined;
          if (tabeleRelations.length > 0) {
            const firstRecord = Array.isArray(recordsResult?.records)
              ? recordsResult.records[0]
              : Array.isArray(recordsResult)
                ? recordsResult[0]
                : null;
            const firstRecordId = (firstRecord as any)?.id;
            if (firstRecordId) {
              try {
                const explained = await TablePlatformApi.explainRelation(tableId, firstRecordId, {
                  max: 12,
                });
                if (explained?.relations && explained.relations.length > 0) {
                  tabeleRationale = {
                    summary: `Explained ${explained.relations.length} relations`,
                    bullets: explained.relations.map(
                      (r: any) => `${r.fieldName} → ${r.targetDisplayName}: ${r.reason}`
                    ),
                    citedSourceIds: explained.relations
                      .map((r: any) => r.targetRecordId)
                      .filter(Boolean),
                    proposalStatus: 'none',
                  };
                }
              } catch {
                tabeleRationale = undefined;
              }
            }
          }

          setPreview({
            type: 'tabele',
            title,
            tableId,
            tabeleSchemaFields,
            tabeleRelations,
            ...(tabeleRationale ? { tabeleRationale } : {}),
          });
        } catch {
          setPreview({
            type: 'tabele',
            title,
            tableId,
            tabeleSchemaFields: [],
            tabeleRelations: [],
          });
        }
        setContentGenerated(true);
        return;
      }

      if (lane === 'wordy') {
        setPreview({
          type: 'pdf',
          title,
          fileName: `${title.replace(/\s+/g, '_')}.pdf`,
        });
      } else if (lane === 'tabele') {
        // Tail fallback: origin missing — render a minimal Tabele preview shell so
        // Sprint 3 / Agent C still has a `'tabele'` shape to bind to.
        setPreview({
          type: 'tabele',
          title,
          tabeleSchemaFields: [],
          tabeleRelations: [],
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
  }, [effectiveStatus, currentRun, lane, lastGoal, currentOrganization?.id, currentProjectId]);

  const startGeneration = useCallback(
    async (goal: string, templateArtifactId?: string) => {
      setIsStartingPipeline(true);
      setStartupError(null);
      setLastGoal(goal);
      contentGenerationTriggered.current = false;
      setContentGenerated(false);
      setCurrentRun(null);
      setCurrentPlan(null);
      setPreview(null);

      let activeConvId = conversationId;

      // Auto-create conversation if none exists
      if (!activeConvId) {
        try {
          const laneTitle =
            lane === 'wordy'
              ? 'Document'
              : lane === 'excele'
                ? 'Spreadsheet'
                : lane === 'tabele'
                  ? 'Table'
                  : 'Presentation';
          await useConversationStore.getState().createConversation({
            title: `${laneTitle}: ${goal.slice(0, 60)}`,
          });
          activeConvId = useConversationStore.getState().activeConversationId;
        } catch {
          // ignore — will be caught below
        }
        if (!activeConvId) {
          setStartupError('Could not create a conversation. Please try again.');
          toast.error('Could not create a conversation. Please try again.');
          return;
        }
      }

      try {
        let snapshotId = latestSnapshot?.snapshotId;
        if (!snapshotId) {
          const orgId = currentOrganization?.id;
          const resolvedWorkspaceId = isUuidLike(currentProjectId)
            ? currentProjectId
            : orgId && orgId.trim().length > 0
              ? orgId
              : activeConvId;

          const resolvedProjectId = isUuidLike(currentProjectId) ? currentProjectId : null;

          const resolvedRoleRef =
            typeof currentUser?.role === 'string' && currentUser.role.trim().length > 0
              ? currentUser.role.trim().toLowerCase()
              : 'member';

          const snapshotParams: Record<string, unknown> = {
            workspaceId: resolvedWorkspaceId,
            projectId: resolvedProjectId,
            conversationId: activeConvId,
            executionRunId: null,
            artifactRefs: [],
            effectiveScopeRef: 'workspace',
            resolvedRoleRef,
            consumerClass: 'chat',
            privacyMode: false,
            sourceContextRefs: [],
          };

          if (orgId && orgId.trim().length > 0) {
            (snapshotParams.sourceContextRefs as Array<Record<string, unknown>>).push({
              sourceId: orgId,
              scopeType: 'organization',
              sourceKind: 'organization_profile',
              freshnessAt: new Date().toISOString(),
            });
          }

          console.debug('[KIMI Pipeline] captureSnapshot params:', snapshotParams);

          try {
            const snap = await captureSnapshot.mutateAsync(snapshotParams);
            snapshotId = (snap as { snapshotId?: string })?.snapshotId;
          } catch (snapErr: any) {
            const details = snapErr?.data?.details ?? snapErr?.response?.data?.details;
            setStartupError(
              snapErr instanceof Error ? snapErr.message : 'Failed to capture context snapshot.'
            );
            console.error('[KIMI Pipeline] Snapshot capture failed:', {
              error: snapErr?.message,
              details: JSON.stringify(details, null, 2),
              params: snapshotParams,
            });
          }
        }

        if (!snapshotId) {
          setStartupError('Failed to capture context snapshot. Try sending a message first.');
          toast.error('Failed to capture context snapshot. Try sending a message first.');
          return;
        }

        const result = await createRun.mutateAsync({
          conversationId: activeConvId,
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

          if (accepted.executionRunId) {
            try {
              await submitReview.mutateAsync(accepted.executionRunId);
            } catch {
              // fallback to interval-driven advance
            }

            try {
              await approveRun.mutateAsync({
                runId: accepted.executionRunId,
                reason: 'KIMI auto-approval for governed artifact generation',
              });
            } catch {
              // fallback to interval-driven advance
            }
          }

          try {
            const materialized = await materializeRun.mutateAsync({
              runId: accepted.runId,
              params: {
                title: accepted.plan.titleHint,
                config: outputType === 'sheet' ? { tableName: accepted.plan.titleHint } : undefined,
              },
            });
            setCurrentRun(materialized);
            setCurrentPlan(materialized.plan);
          } catch {
            // fallback to interval-driven advance
          }
        } catch {
          // accept failures surface via state
        }
      } catch (error) {
        setStartupError(
          error instanceof Error ? error.message : 'Failed to start artifact generation'
        );
        toast.error(error instanceof Error ? error.message : 'Failed to start artifact generation');
      } finally {
        setIsStartingPipeline(false);
      }
    },
    [
      conversationId,
      lane,
      latestSnapshot,
      captureSnapshot,
      createRun,
      preflightRun,
      acceptPlan,
      submitReview,
      approveRun,
      materializeRun,
      artifactFamily,
      outputType,
      currentOrganization?.id,
      currentProjectId,
      currentUser?.role,
    ]
  );

  const advancePipeline = useCallback(async () => {
    if (!currentRun) return;

    try {
      setStartupError(null);

      if (effectiveStatus === 'proposal_created' && currentRun.executionRunId) {
        await submitReview.mutateAsync(currentRun.executionRunId);
        return;
      }

      if (effectiveStatus === 'awaiting_review' && currentRun.executionRunId) {
        await approveRun.mutateAsync({
          runId: currentRun.executionRunId,
          reason: 'KIMI auto-approval for governed artifact generation',
        });
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
            config: outputType === 'sheet' ? { tableName: currentRun.plan.titleHint } : undefined,
          },
        });
        setCurrentRun(completed);
        setCurrentPlan(completed.plan);
        return;
      }
    } catch (error) {
      setStartupError(error instanceof Error ? error.message : 'Failed to advance pipeline');
      toast.error(error instanceof Error ? error.message : 'Failed to advance pipeline');
    }
  }, [currentRun, effectiveStatus, submitReview, approveRun, materializeRun, outputType]);

  const handleReplay = useCallback(() => {
    contentGenerationTriggered.current = false;
    setCurrentRun(null);
    setCurrentPlan(null);
    setPreview(null);
    setContentGenerated(false);
    setStartupError(null);
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
    setStartupError(null);
  }, []);

  const handleDownload = useCallback(async () => {
    // TODO(Sprint 4 / EPIC-4 US-4.4): Wire to
    //   `tabeleArtifactOpen.downloadTabeleArtifactCsv(tableId)`
    // once Agent D creates `src/utils/tabeleArtifactOpen.ts`. Until then, this
    // placeholder prevents Tabele lane from accidentally calling the wrong
    // sheet/deck download path.
    if (lane === 'tabele') {
      console.warn('[Tabele] CSV download wired in Sprint 4');
      return;
    }

    // P23-ext: Check for workbook download first
    if (lane === 'excele' && preview && (preview as any).workbookId) {
      Api.downloadWorkbook((preview as any).workbookId);
      return;
    }

    if (!currentRun) return;

    if (lane === 'excele' && currentRun.materializationOrigin?.originRecordId) {
      const ok = await downloadSheetArtifactXlsx(currentRun.materializationOrigin.originRecordId);
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
    ? (startupError ??
      (currentRun as any)?.failureReason ??
      (currentRun as any)?.failurePackage?.message ??
      null)
    : null;

  const myWorkNotified = useRef(false);
  useEffect(() => {
    if (!isCompleted || myWorkNotified.current || !currentRun) return;
    myWorkNotified.current = true;

    const origin = currentRun.materializationOrigin;
    const laneSegment =
      lane === 'wordy'
        ? 'wordy'
        : lane === 'prezentacje'
          ? 'prezentacje'
          : lane === 'tabele'
            ? 'tabele'
            : 'excele';
    const artifactPath = origin?.originRecordId
      ? `/${laneSegment}?artifactId=${origin.originRecordId}`
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
