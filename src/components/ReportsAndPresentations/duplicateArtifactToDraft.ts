/**
 * D2 "Duplikuj / Użyj jako szablonu" (KROK 10) — Claude-Artifacts "Remix" analog.
 *
 * From the Outputs Library, duplicate a document/sheet artifact into a brand-new
 * Work Canvas draft (copy of the content + mapped kind) and open it in the chat
 * split-view canvas for editing. The original artifact is never touched.
 *
 * Decision (mirrors D-C-2 from notebookExpandToDocument): COPY with provenance,
 * no live-sync. The new draft is a snapshot; provenance records where it came
 * from (`source: 'outputs-duplicate'`, `duplicatedFrom`, `sourceTitle`).
 *
 * PRESENTATION decision: decks are not markdown Work Canvas drafts (no canvas
 * draft origin / no GFM body), so v1 does NOT support duplicating presentations
 * here — the row action is gated to document/sheet kinds. (Use-as-template for
 * decks already exists via the "Save as template" → wizard clone path.)
 *
 * Pure helpers (kind mapping + request building + deep-link) live here so they
 * are unit-testable without mounting OutputsAggregateTabContent.
 */

import i18n from '@/i18n';

/** Artifact kinds that can be duplicated into a Work Canvas draft. */
export type DuplicableArtifactKind = 'document' | 'sheet';

/** Work Canvas draft kinds the duplicate maps onto. */
export type CanvasDraftKind = 'document' | 'table';

export interface DuplicateArtifactInput {
  /** Outputs row kind. Only 'document' | 'sheet' are duplicable (see PRESENTATION decision). */
  kind: DuplicableArtifactKind;
  /**
   * Origin record id of the artifact. For canvas-origin document/sheet artifacts
   * this is the `work_canvas_drafts.id` (originRuntime = 'native_artifact'), which
   * is the markdown content source we copy from.
   */
  originRecordId: string;
  /** Stable artifact id (registry) — recorded in provenance for lineage. */
  artifactId?: string;
  /** Display title of the source artifact. */
  title: string;
}

export interface DuplicateArtifactResult {
  draftId: string;
  /** Canonical deep-link consumed by UnifiedChatPanel (workPanel + canvasDraftId). */
  chatUrl: string;
}

/** Map an Outputs artifact kind to the Work Canvas draft kind. */
export function mapArtifactKindToDraftKind(kind: DuplicableArtifactKind): CanvasDraftKind {
  return kind === 'sheet' ? 'table' : 'document';
}

/**
 * Localized copy-title suffix, e.g. "(kopia)" / "(copy)".
 *
 * Mirrors the `reports.copySuffix` locale key (public/locales/{pl,en}/translation.json).
 * Resolved directly from `isPolish` via `i18n.t(..., { lng })` with an inline
 * `defaultValue` fallback, so this pure helper stays correct even when the i18next
 * HTTP backend hasn't loaded resources yet (e.g. unit tests without a live instance).
 */
export function duplicateTitleSuffix(isPolish: boolean): string {
  return i18n.t('reports.copySuffix', {
    lng: isPolish ? 'pl' : 'en',
    defaultValue: isPolish ? '(kopia)' : '(copy)',
  });
}

function authToken(): string {
  return typeof window !== 'undefined' ? window.localStorage.getItem('token') || '' : '';
}

/**
 * Fetch the markdown content of a document/sheet artifact whose origin is a
 * Work Canvas draft. Returns `{ contentMd, title }`. Throws when the draft is
 * missing or returns no markdown body.
 */
export async function fetchCanvasDraftContent(
  originRecordId: string
): Promise<{ contentMd: string; title: string }> {
  const id = String(originRecordId || '').trim();
  if (!id) throw new Error('Cannot duplicate: artifact has no source record id');

  const token = authToken();
  const response = await fetch(`/api/work-canvas/drafts/${encodeURIComponent(id)}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(json?.error || 'Failed to load the source artifact content'));
  }
  // GET /api/work-canvas/drafts/:id → { success, data: { draft: { contentMd, title } } }
  const draft = json?.data?.draft || json?.data || {};
  const contentMd =
    typeof draft?.contentMd === 'string'
      ? draft.contentMd
      : typeof draft?.content === 'string'
        ? draft.content
        : '';
  if (!contentMd.trim()) {
    throw new Error('The source artifact has no content to duplicate');
  }
  return { contentMd, title: String(draft?.title || '').trim() };
}

/** Build the POST /api/work-canvas/drafts body for a duplicated artifact draft. */
export function buildDuplicateDraftBody(params: {
  input: DuplicateArtifactInput;
  contentMd: string;
  isPolish: boolean;
  sourceTitle?: string;
}): Record<string, unknown> {
  const { input, contentMd, isPolish } = params;
  const baseTitle = String(params.sourceTitle || input.title || '').trim() || 'Untitled';
  const title = `${baseTitle} ${duplicateTitleSuffix(isPolish)}`.trim();
  return {
    kind: mapArtifactKindToDraftKind(input.kind),
    title,
    content: contentMd,
    contentMd,
    canonicalFormat: 'markdown',
    provenance: {
      source: 'outputs-duplicate',
      sourceType: input.kind,
      // The artifact / origin the copy was remixed from (original untouched).
      duplicatedFrom: input.artifactId || input.originRecordId,
      sourceOriginRecordId: input.originRecordId,
      sourceTitle: baseTitle,
    },
  };
}

/** Deep-link consumed by UnifiedChatPanel (`workPanel=1&canvasDraftId=…`). */
export function buildDuplicateChatUrl(draftId: string): string {
  return `/chat?workPanel=1&canvasDraftId=${encodeURIComponent(draftId)}`;
}

/**
 * Fetch the source artifact's markdown, create a NEW Work Canvas draft copying
 * the content + mapped kind, and return the `/chat` deep-link that mounts the
 * duplicate in the split-view canvas. The original artifact is never mutated.
 */
export async function duplicateArtifactToCanvasDraft(
  input: DuplicateArtifactInput,
  options: { isPolish: boolean }
): Promise<DuplicateArtifactResult> {
  const { contentMd, title: sourceTitle } = await fetchCanvasDraftContent(input.originRecordId);

  const token = authToken();
  const response = await fetch('/api/work-canvas/drafts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(
      buildDuplicateDraftBody({
        input,
        contentMd,
        isPolish: options.isPolish,
        sourceTitle: sourceTitle || input.title,
      })
    ),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(json?.error || 'Failed to create the duplicate Canvas draft'));
  }
  const saved = json?.data?.draft || json?.data || {};
  const draftId = String(saved?.draftId || saved?.id || '').trim();
  if (!draftId) {
    throw new Error('Duplicate draft was created but no draft id was returned');
  }
  return { draftId, chatUrl: buildDuplicateChatUrl(draftId) };
}
