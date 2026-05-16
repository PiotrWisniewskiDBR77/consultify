import type {
  CanvasDocumentKind,
  CanvasDocumentState,
  CanvasLifecycleState,
  CanvasProjectionStatus,
  CanvasSaveState,
  CanvasStarterId,
  CanvasWorkflowRun,
} from '@/types/canvasWorkspace';

import { normalizeCanvasArtifactBlocks } from './canvasArtifactBlocks';

interface WorkCanvasDraftLike {
  id?: unknown;
  draftId?: unknown;
  title?: unknown;
  kind?: unknown;
  content?: unknown;
  contentMd?: unknown;
  blocks?: unknown;
  canonicalFormat?: unknown;
  markdownProjectionStatus?: unknown;
  projectionError?: unknown;
  saveState?: unknown;
  lifecycleState?: unknown;
  updatedAt?: unknown;
  linkedIdeaId?: unknown;
  linkedNoteId?: unknown;
  linkedInitiativeId?: unknown;
  researchSessionId?: unknown;
  workflowRuns?: unknown;
  provenance?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asSaveState(value: unknown, fallback: CanvasSaveState): CanvasSaveState {
  return value === 'saving' || value === 'saved' || value === 'failed' || value === 'unsaved'
    ? value
    : fallback;
}

function asLifecycleState(value: unknown, fallback: CanvasLifecycleState): CanvasLifecycleState {
  if (value === 'proposed') return 'in_review';
  return value === 'in_review' || value === 'approved' || value === 'draft' ? value : fallback;
}

function asProjectionStatus(
  value: unknown,
  fallback: CanvasProjectionStatus
): CanvasProjectionStatus {
  return value === 'stale' || value === 'failed' || value === 'missing' || value === 'synced'
    ? value
    : fallback;
}

function asDocumentKind(value: unknown, fallback: CanvasDocumentKind): CanvasDocumentKind {
  return value === 'markdown' ||
    value === 'research' ||
    value === 'decision' ||
    value === 'plan' ||
    value === 'checklist' ||
    value === 'sheet' ||
    value === 'deck' ||
    value === 'table' ||
    value === 'presentation' ||
    value === 'report' ||
    value === 'document'
    ? value
    : fallback;
}

function workflowRunsFrom(value: unknown): CanvasWorkflowRun[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CanvasWorkflowRun => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Record<string, unknown>;
    return (
      typeof record.id === 'string' &&
      typeof record.draftId === 'string' &&
      typeof record.conversationId === 'string' &&
      Array.isArray(record.steps)
    );
  });
}

function workflowRunsFromDraft(draft: WorkCanvasDraftLike): CanvasWorkflowRun[] {
  const direct = workflowRunsFrom(draft.workflowRuns);
  if (direct.length > 0) return direct;
  if (draft.provenance && typeof draft.provenance === 'object') {
    return workflowRunsFrom((draft.provenance as Record<string, unknown>).workflowRuns);
  }
  return [];
}

export function mapDraftResponseToCanvasDocumentState(
  draft: WorkCanvasDraftLike | null | undefined,
  fallback: CanvasDocumentState
): CanvasDocumentState {
  if (!draft) return fallback;

  const contentMd =
    typeof draft.contentMd === 'string'
      ? draft.contentMd
      : typeof draft.content === 'string'
        ? draft.content
        : fallback.contentMd;

  return {
    ...fallback,
    draftId: asString(draft.id) || asString(draft.draftId) || fallback.draftId,
    title: asString(draft.title) || fallback.title,
    kind: asDocumentKind(draft.kind, fallback.kind),
    contentMd,
    blocks: normalizeCanvasArtifactBlocks(draft.blocks ?? fallback.blocks),
    canonicalFormat: draft.canonicalFormat === 'json' ? 'json' : 'markdown',
    saveState: asSaveState(draft.saveState, fallback.saveState),
    lifecycleState: asLifecycleState(draft.lifecycleState, fallback.lifecycleState),
    markdownProjectionStatus: asProjectionStatus(
      draft.markdownProjectionStatus,
      fallback.markdownProjectionStatus
    ),
    projectionError:
      typeof draft.projectionError === 'string' ? draft.projectionError : fallback.projectionError,
    updatedAt: asString(draft.updatedAt) || fallback.updatedAt,
    researchSessionId: asString(draft.researchSessionId) || fallback.researchSessionId,
    linkedIdeaId: asString(draft.linkedIdeaId) || fallback.linkedIdeaId,
    linkedNoteId: asString(draft.linkedNoteId) || fallback.linkedNoteId,
    linkedInitiativeId: asString(draft.linkedInitiativeId) || fallback.linkedInitiativeId,
    workflowRuns: workflowRunsFromDraft(draft),
  };
}

export function starterIdToCanvasKind(starterId: CanvasStarterId): CanvasDocumentKind {
  if (starterId === 'research') return 'research';
  if (starterId === 'decision') return 'decision';
  if (starterId === 'plan') return 'plan';
  return 'document';
}
