import type {
  CanvasDocumentKind,
  CanvasDocumentState,
  CanvasLifecycleState,
  CanvasProjectionStatus,
  CanvasSaveState,
  CanvasStarterId,
} from '@/types/canvasWorkspace';

interface WorkCanvasDraftLike {
  id?: unknown;
  draftId?: unknown;
  title?: unknown;
  kind?: unknown;
  content?: unknown;
  contentMd?: unknown;
  canonicalFormat?: unknown;
  markdownProjectionStatus?: unknown;
  projectionError?: unknown;
  saveState?: unknown;
  lifecycleState?: unknown;
  updatedAt?: unknown;
  linkedIdeaId?: unknown;
  linkedNoteId?: unknown;
  linkedInitiativeId?: unknown;
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
  return value === 'research' ||
    value === 'decision' ||
    value === 'plan' ||
    value === 'table' ||
    value === 'presentation' ||
    value === 'report' ||
    value === 'document'
    ? value
    : fallback;
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
    linkedIdeaId: asString(draft.linkedIdeaId) || fallback.linkedIdeaId,
    linkedNoteId: asString(draft.linkedNoteId) || fallback.linkedNoteId,
    linkedInitiativeId: asString(draft.linkedInitiativeId) || fallback.linkedInitiativeId,
  };
}

export function starterIdToCanvasKind(starterId: CanvasStarterId): CanvasDocumentKind {
  if (starterId === 'research') return 'research';
  if (starterId === 'decision') return 'decision';
  if (starterId === 'plan') return 'plan';
  return 'document';
}
