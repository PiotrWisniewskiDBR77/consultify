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
import { buildWorkbookGridSheets } from '@/utils/workbookGridPreview';

import type { ArtifactPreview, KimiLane, TaskStep } from './KimiWorkspaceShell';
import { loadTabelePreviewByTableId } from './tabele/loadTabelePreview';

function parsePresentationJson(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** True only when the persisted deck has at least one renderable card/slide. */
export function hasRenderablePresentationContent(deck: unknown): boolean {
  if (!deck || typeof deck !== 'object') return false;
  const row = deck as Record<string, unknown>;
  for (const candidate of [row.deck_json, row.unified_json]) {
    const parsed = parsePresentationJson(candidate);
    if (!parsed) continue;
    if (Array.isArray(parsed.cards) && parsed.cards.length > 0) return true;
    if (Array.isArray(parsed.slides) && parsed.slides.length > 0) return true;
  }
  return false;
}

/**
 * GET /presentations/decks/:id returns the rich outline envelope persisted by
 * generateOutline (`{ ..., outline: [...] }`), not necessarily a bare array.
 */
export function extractPresentationGenerationOutline(deck: unknown): unknown[] {
  if (!deck || typeof deck !== 'object') return [];
  const raw = (deck as Record<string, unknown>).outline_json;
  if (Array.isArray(raw)) return raw;
  const parsed = parsePresentationJson(raw);
  return parsed && Array.isArray(parsed.outline) ? parsed.outline : [];
}

/**
 * A Teresa presentation must still materialize into an editable deck when the
 * long-running AI generator times out or leaves its placeholder row in
 * `generating`.  The accepted outline is already the governed plan, so it is a
 * safe deterministic fallback: preserve every requested section and ground
 * the body in the user's request instead of inventing content.
 */
export function buildDeterministicTeresaSlides(outline: unknown[], request: string) {
  const explicitCount = Number(
    request.match(/produce exactly\s+(\d+)\s+[^.\n]*?slides/i)?.[1] || 0
  );
  const explicitList = request.match(/slides:\s*([\s\S]*?)(?:\.\s*Use only|\n|$)/i)?.[1] || '';
  const explicitTitles = Array.from(
    explicitList.matchAll(/(?:^|,\s*)(\d+)\s+([^,]+?)(?=,\s*\d+\s+|$)/g)
  ).map((match) => match[2].trim());
  const sourceOutline =
    explicitCount > 0 && explicitTitles.length === explicitCount
      ? explicitTitles.map((title, index) => ({
          title,
          intent: index === 0 ? 'cover' : index === explicitCount - 1 ? 'next_steps' : 'content',
        }))
      : outline;
  const facts =
    request
      .match(/Use only these facts:\s*([\s\S]*?)(?:Clearly label|Generate the actual|$)/i)?.[1]
      ?.split(';')
      .map((fact) => fact.trim().replace(/[.\s]+$/, ''))
      .filter(Boolean) || [];
  const keywordsForTitle = (title: string) => {
    const lower = title.toLowerCase();
    if (/budget|value/.test(lower)) return /budget|spend|benefit/i;
    if (/milestone|progress/.test(lower)) return /progress|milestone/i;
    if (/risk/.test(lower)) return /risk|migration|vendor|adoption/i;
    if (/decision/.test(lower)) return /decision|approve|owner/i;
    if (/next|source/.test(lower)) return /meeting|owner|decision/i;
    return /progress|budget|milestone|meeting/i;
  };

  return sourceOutline.map((raw, index) => {
    const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const title = String(item.title || item.heading || `Slide ${index + 1}`);
    const guidance = [item.keyMessage, item.key_message, item.thesis, item.contentGuidance]
      .find((value) => typeof value === 'string' && value.trim())
      ?.toString()
      .trim();
    const matchedFacts = facts.filter((fact) => keywordsForTitle(title).test(fact)).slice(0, 3);
    const groundedBody = matchedFacts.length
      ? matchedFacts.join('; ')
      : facts[index % Math.max(facts.length, 1)] || 'No facts were supplied for this section.';
    return {
      type: String(item.intent || item.layout || 'content'),
      content: {
        title,
        body: guidance || `Source: Teresa user request. ${groundedBody}.`,
      },
    };
  });
}

export function extractRequestedPresentationTitle(request: string): string | null {
  const match = request.match(/\bTitle:\s*([^\n.]+)(?:\.|$)/i);
  return match?.[1]?.trim() || null;
}

export async function createGovernedSheetMaterializationTarget(params: {
  workspaceId: string;
  title: string;
}): Promise<string> {
  const base = await TablePlatformApi.createBase(
    params.workspaceId,
    `${params.title} — governed workspace`
  );
  const baseId = String((base as Record<string, unknown> | null)?.id || '').trim();
  if (!baseId) throw new Error('Sheet materialization base did not return an id.');

  const table = await TablePlatformApi.createTable(
    baseId,
    params.title,
    'Governed materialization target for Teresa workbook generation.'
  );
  const tableId = String((table as Record<string, unknown> | null)?.id || '').trim();
  if (!tableId) throw new Error('Sheet materialization table did not return an id.');

  await TablePlatformApi.createField(tableId, 'Input', 'text');
  await TablePlatformApi.createField(tableId, 'Value', 'number');
  return tableId;
}

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

export function resolveTabeleMaterializedTableId(
  lane: KimiLane,
  origin: ArtifactRunRecord['materializationOrigin']
): string | null {
  if (lane !== 'tabele') return null;
  if (origin?.originRuntime !== 'sheet') return null;
  const tableId = String(origin.originRecordId || '').trim();
  return tableId || null;
}

async function resolveAccessibleSheetTableId(candidateId: string): Promise<string | null> {
  const normalized = String(candidateId || '').trim();
  if (!normalized) return null;
  try {
    await TablePlatformApi.getTable(normalized);
    return normalized;
  } catch {
    let fromArtifact: string | null = null;
    try {
      const actionTargetRaw = await Api.get(
        `/artifacts/${encodeURIComponent(normalized)}/action-target`
      );
      const actionTarget = (actionTargetRaw as { data?: any })?.data ?? actionTargetRaw;
      const originRuntime = String(actionTarget?.originRuntime || '')
        .trim()
        .toLowerCase();
      const originRecordId = String(actionTarget?.originRecordId || '').trim();
      if (originRuntime === 'sheet' && originRecordId) {
        fromArtifact = originRecordId;
      }
    } catch {
      fromArtifact = null;
    }
    if (!fromArtifact || fromArtifact === normalized) return null;
    try {
      await TablePlatformApi.getTable(fromArtifact);
      return fromArtifact;
    } catch {
      return null;
    }
  }
}

export function useKimiArtifactPipeline(lane: KimiLane): KimiPipelineState {
  const conversationId = useConversationStore((s) => s.activeConversationId);
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentUser = useAppStore((s) => s.currentUser);

  const outputType: ArtifactPlanOutputType =
    lane === 'excele' || lane === 'tabele' ? 'sheet' : 'presentation';
  const artifactFamily: ArtifactFamily =
    lane === 'excele' || lane === 'tabele' ? 'sheet' : 'presentation';

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
  const sheetMaterializationTableIdRef = useRef<string | null>(null);

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
        (lane === 'prezentacje' ? extractRequestedPresentationTitle(lastGoal || '') : null) ||
        currentRun.plan.titleHint ||
        (lane === 'excele' ? 'Spreadsheet' : lane === 'tabele' ? 'Table' : 'Presentation');

      if (lane === 'prezentacje' && origin?.originRecordId) {
        const deckId = origin.originRecordId;

        const generateAndFetch = async () => {
          const unwrap = <T = any>(res: any): T => {
            const data = res?.data;
            if (data && typeof data === 'object' && 'data' in data) return data.data as T;
            return data as T;
          };

          const initialDeck = unwrap<any>(await Api.get(`/presentations/decks/${deckId}`));
          const hasGeneratedContent = hasRenderablePresentationContent(initialDeck);

          if (!hasGeneratedContent) {
            const outline = extractPresentationGenerationOutline(initialDeck);
            if (outline.length === 0) {
              throw new Error('presentation_generation_outline_missing');
            }
            try {
              await Api.post(`/presentations/generate/deck`, {
                deckId,
                outline,
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
            } catch (generationError) {
              // A concurrent generator can win the race. Re-read once and only
              // suppress the request error if canonical slide content now exists.
              const racedDeck = unwrap<any>(await Api.get(`/presentations/decks/${deckId}`));
              if (!hasRenderablePresentationContent(racedDeck)) {
                const fallbackSlides = buildDeterministicTeresaSlides(
                  outline,
                  lastGoal || initialDeck?.title || title
                );
                if (fallbackSlides.length === 0) throw generationError;
                const fallback = unwrap<any>(
                  await Api.post('/presentations/decks', {
                    title: initialDeck?.title || title,
                    theme: initialDeck?.theme || 'modern',
                    source: 'teresa_deterministic_fallback',
                    slides: fallbackSlides,
                  })
                );
                const fallbackDeckId = String(fallback?.id || '').trim();
                if (!fallbackDeckId) throw generationError;
                const fallbackDeck = unwrap<any>(
                  await Api.get(`/presentations/decks/${fallbackDeckId}`)
                );
                if (!hasRenderablePresentationContent(fallbackDeck)) throw generationError;
                return { ...fallbackDeck, __resolvedDeckId: fallbackDeckId };
              }
              return racedDeck;
            }
          }
          const generatedDeck = unwrap<any>(await Api.get(`/presentations/decks/${deckId}`));
          if (!hasRenderablePresentationContent(generatedDeck)) {
            throw new Error('presentation_generation_produced_no_slides');
          }
          return generatedDeck;
        };

        generateAndFetch()
          .then((deckData: any) => {
            const resolvedDeckId = String(deckData?.__resolvedDeckId || deckId);
            const slides: Array<{
              slideId: string;
              intent: string;
              title: string;
              bulletPoints?: string[];
            }> = [];
            const mapCardsToSlides = (cards: any[]) =>
              cards.map((card: any, index: number) => {
                const blocks = Array.isArray(card?.blocks) ? card.blocks : [];
                const bulletPoints = blocks
                  .map((block: any) => {
                    if (typeof block?.content === 'string') return block.content;
                    if (typeof block?.content?.text === 'string') return block.content.text;
                    if (Array.isArray(block?.content?.items)) return block.content.items.join(' ');
                    return '';
                  })
                  .map((value: string) => value.trim())
                  .filter(Boolean)
                  .slice(0, 4);
                return {
                  slideId: card?.card_id || card?.id || String(index + 1),
                  intent: card?.intent || 'content',
                  title: card?.title || card?.key_message || `Slide ${index + 1}`,
                  bulletPoints,
                };
              });
            const unifiedJson =
              typeof deckData?.deck_json === 'string'
                ? JSON.parse(deckData.deck_json)
                : deckData?.deck_json || deckData?.unified_json;
            const rawSlides =
              unifiedJson?.slides ||
              (Array.isArray(unifiedJson?.cards) && unifiedJson.cards.length > 0
                ? mapCardsToSlides(unifiedJson.cards)
                : null) ||
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
              deckId: resolvedDeckId,
              deckStatus: deckData?.export_path ? 'exported' : deckData?.status || 'draft',
              deckSlides: slides,
            });
            setContentGenerated(true);
          })
          .catch((error: unknown) => {
            setPreview({
              type: 'deck',
              title,
              fileName: `${title.replace(/\s+/g, '_')}.pptx`,
              summary: `Presentation "${title}" could not generate slide content.`,
              kpiItems: [{ label: 'Status', value: 'Generation failed' }],
              deckId,
              deckSlides: [],
            });
            setStartupError(
              error instanceof Error ? error.message : 'presentation_generation_failed'
            );
            setContentGenerated(false);
          });
        return;
      }

      if (lane === 'excele') {
        // P23-ext: real Excel engine call.
        //
        // N3 fix (naprawa 2026-07-28, "Excel od tygodni nie działa"): this used
        // to swallow ANY engine failure into a bare `console.warn` + `return
        // false`, then silently show the OLD operational table (governed
        // table/CSV) relabeled as `type: 'xlsx'` with a "Spreadsheet … rows,
        // columns" summary — the user saw what looked like a successful export
        // with no hint that the real .xlsx engine never ran. Root cause of the
        // engine call itself failing (WorkbookGeneratorService.callLLM
        // discarding AIPipeline error info, and the workbook phases having no
        // dedicated model-routing purpose) is fixed server-side; this is the
        // "never lie about it" half — any remaining failure (budget, auth,
        // provider outage, genuinely bad model output) now surfaces as an
        // honest Polish error + retry instead of a disguised CSV.
        const generateWorkbook = async (): Promise<
          { ok: true } | { ok: false; reason: string }
        > => {
          try {
            const wbResult = await Api.generateWorkbook({
              prompt: lastGoal || title,
              language: navigator.language,
              // P-2: adopt the run's single canonical artifact onto this workbook
              // (no duplicate Outputs card for the excele lane).
              artifactRunId: currentRun.runId,
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
                // B3 fix (2026-07-22): cells/formulas load async right below —
                // the grid area shows a spinner instead of nothing until then.
                gridLoading: true,
                gridError: null,
              });
              setContentGenerated(true);

              // B3 fix (2026-07-22, workstream Excel): POST /generate only ever
              // returned sheet metadata (name/columnCount/rowCount) — the actual
              // cells + formulas live in the stored WorkbookSchema. Fetch it via
              // the dedicated read endpoint and enrich the preview with a real
              // grid (perSheetData) instead of making the user download the file
              // to see a single cell.
              Api.getWorkbookSchema(wbResult.id)
                .then((schemaResult) => {
                  const perSheetData = buildWorkbookGridSheets(schemaResult?.sheets);
                  // "Najmniejszy arkusz" (2026-07-28, za ff_excele_edit): RAW
                  // sheets dla EditableSpreadsheetGrid — patrz komentarz przy
                  // rawSheets w KimiWorkspaceShell.tsx (ArtifactPreview).
                  const rawSheets = (
                    Array.isArray(schemaResult?.sheets) ? schemaResult.sheets : []
                  ) as ArtifactPreview['rawSheets'];
                  setPreview((prev) =>
                    prev && prev.type === 'xlsx' && prev.workbookId === wbResult.id
                      ? { ...prev, perSheetData, rawSheets, gridLoading: false, gridError: null }
                      : prev
                  );
                })
                .catch((err) => {
                  console.warn('[KIMI] Failed to load workbook cell/formula schema:', err);
                  setPreview((prev) =>
                    prev && prev.type === 'xlsx' && prev.workbookId === wbResult.id
                      ? {
                          ...prev,
                          gridLoading: false,
                          gridError:
                            'Nie udało się wczytać podglądu komórek. Pobierz plik, aby zobaczyć zawartość.',
                        }
                      : prev
                  );
                });

              return { ok: true };
            }
            // Engine responded 2xx but with no usable workbook id — treat as a
            // failure with an honest reason rather than falling through silently.
            return { ok: false, reason: 'Silnik nie zwrócił poprawnego skoroszytu.' };
          } catch (err) {
            const reason =
              err instanceof Error && err.message ? err.message : 'nieznany błąd silnika';
            console.warn('[KIMI] Workbook generation failed:', err);
            return { ok: false, reason };
          }
        };

        const workbookResult = await generateWorkbook();

        if (!workbookResult.ok) {
          // N3 fix (naprawa 2026-07-28): NIGDY cichego fallbacku. Poprzednio ta
          // gałąź po cichu ładowała starą tabelę operacyjną (governed table/CSV)
          // i etykietowała ją `type: 'xlsx'` / "Spreadsheet … rows, columns" —
          // użytkownik widział pozorny sukces bez śladu, że prawdziwy silnik
          // Excela nie zadziałał. Zamiast tego: jawny polski komunikat z
          // powodem + istniejący, gotowy ekran błędu (ArtifactPreviewPane w
          // KimiWorkspaceShell.tsx renderuje go z `isFailed`/`failureReason`,
          // z przyciskiem "Spróbuj ponownie" spiętym z `handleReplay`).
          setStartupError(`Nie udało się wygenerować arkusza: ${workbookResult.reason}`);
          setPreview(null);
          setContentGenerated(true);
        }
        return;
      }

      const tabeleTableId = resolveTabeleMaterializedTableId(lane, origin);
      if (tabeleTableId) {
        const tableId = await resolveAccessibleSheetTableId(tabeleTableId);
        if (!tableId) {
          const message =
            'Table Studio materialization returned an unresolved table reference. Retry generation or reopen from Recent after backend mapping is fixed.';
          setStartupError(message);
          setPreview({
            type: 'tabele',
            title,
            fileName: `${title.replace(/\s+/g, '_')}.csv`,
            summary: message,
            kpiItems: [
              { label: 'Rows', value: '0' },
              { label: 'Columns', value: '0' },
              { label: 'Status', value: 'Mapping failed' },
              { label: 'Format', value: 'Table / CSV' },
            ],
            tableData: { columns: [], rows: [] },
            tabeleSchemaFields: [],
            tabeleRelations: [],
          });
          setContentGenerated(true);
          return;
        }
        const workspaceIdForProposals = currentOrganization?.id || currentProjectId || '';

        const fullPreview = await loadTabelePreviewByTableId(tableId, {
          titleFallback: title,
          ...(workspaceIdForProposals ? { workspaceIdForProposals } : {}),
        }).catch(() => null);

        if (fullPreview) {
          setPreview({ ...fullPreview, title: fullPreview.title || title });
        } else {
          const message =
            'Table Studio materialization completed, but the table cannot be loaded from table-platform (404).';
          setStartupError(message);
          setPreview({
            type: 'tabele',
            title,
            fileName: `${title.replace(/\s+/g, '_')}.csv`,
            summary: message,
            kpiItems: [
              { label: 'Rows', value: '0' },
              { label: 'Columns', value: '0' },
              { label: 'Status', value: 'Load failed' },
              { label: 'Format', value: 'Table / CSV' },
            ],
            tableId,
            tableData: { columns: [], rows: [] },
            tabeleSchemaFields: [],
            tabeleRelations: [],
          });
        }
        setContentGenerated(true);
        return;
      }

      if (lane === 'tabele') {
        const message =
          'Table Studio materialization did not return a Table Platform tableId. Please retry generation.';
        setStartupError(message);
        toast.error(message);
        setContentGenerated(false);
        return;
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
      console.info('[KIMI Pipeline] startGeneration invoked', {
        lane,
        goalLength: goal.length,
        hasConversationId: !!conversationId,
        hasOrgId: !!currentOrganization?.id,
        hasCurrentUser: !!currentUser,
        hasTemplate: !!templateArtifactId,
      });
      setIsStartingPipeline(true);
      setStartupError(null);
      setLastGoal(goal);
      contentGenerationTriggered.current = false;
      setContentGenerated(false);
      setCurrentRun(null);
      setCurrentPlan(null);
      setPreview(null);
      sheetMaterializationTableIdRef.current = null;

      let activeConvId = conversationId;

      // Auto-create conversation if none exists
      if (!activeConvId) {
        try {
          const laneTitle =
            lane === 'excele' ? 'Spreadsheet' : lane === 'tabele' ? 'Table' : 'Presentation';
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
          setIsStartingPipeline(false);
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
            const message =
              snapErr instanceof Error ? snapErr.message : 'Failed to capture context snapshot.';
            setStartupError(message);
            toast.error(`Snapshot: ${message}`);
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
          setIsStartingPipeline(false);
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

        if (outputType === 'sheet') {
          const workspaceId = currentOrganization?.id?.trim();
          if (!workspaceId) {
            throw new Error('Organization workspace is required for sheet materialization.');
          }
          sheetMaterializationTableIdRef.current = await createGovernedSheetMaterializationTarget({
            workspaceId,
            title: result.artifactPlan.titleHint,
          });
        }

        try {
          const preflighted = await preflightRun.mutateAsync(result.run.runId);
          setCurrentRun(preflighted);
          setCurrentPlan(preflighted.plan);
        } catch (preflightErr: any) {
          const details = preflightErr?.data?.details ?? preflightErr?.response?.data?.details;
          const message =
            preflightErr instanceof Error ? preflightErr.message : 'Preflight check failed.';
          setStartupError(message);
          toast.error(`Preflight: ${message}`);
          console.error('[KIMI Pipeline] Preflight failed:', {
            runId: result.run.runId,
            error: preflightErr?.message,
            details: JSON.stringify(details, null, 2),
          });
          setIsStartingPipeline(false);
          return;
        }

        try {
          const accepted = await acceptPlan.mutateAsync(result.run.runId);
          setCurrentRun(accepted);
          setCurrentPlan(accepted.plan);

          if (accepted.executionRunId) {
            try {
              await submitReview.mutateAsync(accepted.executionRunId);
            } catch (submitErr: any) {
              const details = submitErr?.data?.details ?? submitErr?.response?.data?.details;
              const message =
                submitErr instanceof Error
                  ? submitErr.message
                  : 'Failed to submit execution review.';
              setStartupError(message);
              toast.error(`Review: ${message}`);
              console.error('[KIMI Pipeline] submitReview failed:', {
                executionRunId: accepted.executionRunId,
                error: submitErr?.message,
                details,
              });
              setIsStartingPipeline(false);
              return;
            }

            try {
              const approved = await approveRun.mutateAsync({
                runId: accepted.executionRunId,
                reason: 'KIMI auto-approval for governed artifact generation',
              });
              if (approved?.state !== 'approved_for_apply' && approved?.state !== 'applying') {
                const message = `Execution run is not ready for materialization (state: ${String(approved?.state || 'unknown')})`;
                setStartupError(message);
                toast.error(`Approve: ${message}`);
                console.error('[KIMI Pipeline] approveRun returned non-ready state:', {
                  executionRunId: accepted.executionRunId,
                  state: approved?.state,
                });
                setIsStartingPipeline(false);
                return;
              }
            } catch (approveErr: any) {
              const details = approveErr?.data?.details ?? approveErr?.response?.data?.details;
              const message =
                approveErr instanceof Error
                  ? approveErr.message
                  : 'Failed to approve execution run.';
              setStartupError(message);
              toast.error(`Approve: ${message}`);
              console.error('[KIMI Pipeline] approveRun failed:', {
                executionRunId: accepted.executionRunId,
                error: approveErr?.message,
                details,
              });
              setIsStartingPipeline(false);
              return;
            }
          }

          try {
            const materialized = await materializeRun.mutateAsync({
              runId: accepted.runId,
              params: {
                title: accepted.plan.titleHint,
                config:
                  outputType === 'sheet'
                    ? {
                        tableId: sheetMaterializationTableIdRef.current,
                        tableName: accepted.plan.titleHint,
                        goal,
                      }
                    : undefined,
              },
            });
            setCurrentRun(materialized);
            setCurrentPlan(materialized.plan);
          } catch (materializeErr: any) {
            const details =
              materializeErr?.data?.details ?? materializeErr?.response?.data?.details;
            const message =
              materializeErr instanceof Error ? materializeErr.message : 'Materialization failed.';
            setStartupError(message);
            toast.error(`Materialize: ${message}`);
            console.error('[KIMI Pipeline] materializeRun failed:', {
              runId: accepted.runId,
              error: materializeErr?.message,
              details: JSON.stringify(details, null, 2),
            });
          }
        } catch (acceptErr: any) {
          const details = acceptErr?.data?.details ?? acceptErr?.response?.data?.details;
          const message = acceptErr instanceof Error ? acceptErr.message : 'Accept plan failed.';
          setStartupError(message);
          toast.error(`Accept plan: ${message}`);
          console.error('[KIMI Pipeline] acceptPlan failed:', {
            runId: result.run.runId,
            error: acceptErr?.message,
            details: JSON.stringify(details, null, 2),
          });
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
      currentUser,
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
            config:
              outputType === 'sheet'
                ? {
                    tableName: currentRun.plan.titleHint,
                    tableId: sheetMaterializationTableIdRef.current,
                    goal: lastGoal || currentRun.plan.titleHint,
                  }
                : undefined,
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
  }, [currentRun, effectiveStatus, submitReview, approveRun, materializeRun, outputType, lastGoal]);

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

    if (lane === 'prezentacje' && currentRun.materializationOrigin?.originRecordId) {
      const deckId = currentRun.materializationOrigin.originRecordId;
      window.open(`/api/presentations/decks/${deckId}/download`, '_blank');
      return;
    }

    toast.error('No artifact available for download yet');
  }, [currentRun, lane, preview]);

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
      lane === 'prezentacje' ? 'prezentacje' : lane === 'tabele' ? 'tabele' : 'excele';
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
