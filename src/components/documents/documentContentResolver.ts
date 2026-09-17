/**
 * DOC-0 (DEC-593) — the ONE content adapter of the read-only document viewer.
 *
 * Why one adapter: the same "document" row in the Materials list can be backed by
 * FOUR content registries (KROK0.md §1): `wave5_artifacts` (116),
 * `report_builder_reports` (10), `work_canvas_drafts` (9) and 6 rows with no
 * content at all (404). Three of them are already reachable through the mounted
 * contract `GET /api/artifacts/:id/content` (adapter map in
 * `server/src/services/artifacts/artifactContentResolverService.ts:46-50`);
 * `work_canvas_drafts` is NOT — `wave5ArtifactContentAdapter` reads only
 * `wave5_artifacts`, so those 9 rows 404 there and their markdown lives behind
 * `GET /api/work-canvas/drafts/:id`.
 *
 * This module is the single place that knows both, so the viewer never branches
 * on a registry and a future fifth registry is one more step in one chain.
 *
 * Honesty rule (DEC-595 context): a row whose content cannot be resolved returns
 * a NAMED error code, never an empty document that looks fine. `content_not_found`
 * = the registry has no body for this row (the 6 orphan 404s); `load_failed` =
 * transport/server fault, worth a retry.
 */

import { fetchCanvasDraftContent } from '@/components/ReportsAndPresentations/duplicateArtifactToDraft';
import type { ArtifactContentEnvelopeV1 } from '@/types/artifactContent';

/** Which registry produced the markdown — surfaced in the viewer's Properties. */
export type DocumentContentRegistry = 'artifact_content' | 'work_canvas_drafts';

export type DocumentContentErrorCode =
  | 'missing_identifier'
  | 'content_not_found'
  | 'load_failed';

/** One left-nav section: a heading-level slice of the markdown body. */
export interface DocumentContentSection {
  /** Prefixed with `doc-` so it can never collide with a SPEC-N §2.1 reserved id. */
  id: string;
  /** Heading text; `null` for the preamble before the first heading. */
  label: string | null;
  markdown: string;
}

export type DocumentContentResolution =
  | {
      state: 'ready';
      registry: DocumentContentRegistry;
      title: string | null;
      contentMd: string;
      sections: DocumentContentSection[];
      projectionStatus: string | null;
      canonicalKind: string | null;
    }
  | { state: 'empty'; registry: DocumentContentRegistry; title: string | null }
  | { state: 'error'; errorCode: DocumentContentErrorCode; detail: string | null };

/** What the caller (list row / deep-link) knows about the document to open. */
export interface DocumentContentTarget {
  artifactId: string;
  /** `work_canvas_drafts.id` when the row's primary origin is a canvas draft. */
  originRecordId?: string | null;
  title?: string | null;
}

interface ArtifactContentBody {
  envelope?: Partial<ArtifactContentEnvelopeV1> | null;
}

function authToken(): string {
  if (typeof window === 'undefined' || !window.localStorage) return '';
  try {
    return window.localStorage.getItem('token') || '';
  } catch {
    return '';
  }
}

function authHeaders(): Record<string, string> {
  const token = authToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'section';
}

/**
 * Split the markdown body into left-nav sections on level 1–2 headings.
 * Text before the first heading becomes a preamble section, dropped when empty
 * (a document that opens with a heading gets no blank first nav entry).
 * A body without any heading yields exactly one section, so the nav is never empty.
 */
export function splitMarkdownIntoSections(contentMd: string): DocumentContentSection[] {
  /** A slice before it gets its nav id. */
  interface PendingSection {
    label: string | null;
    markdown: string;
    /** Heading level (1-2); 0 for the preamble before the first heading. */
    level: number;
  }
  const lines = String(contentMd || '').split('\n');
  const sections: PendingSection[] = [];
  let current: { label: string | null; level: number; lines: string[] } = {
    label: null,
    level: 0,
    lines: [],
  };
  let inFence = false;

  for (const line of lines) {
    // A `#` inside a fenced code block is code, not a heading.
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const heading = inFence ? null : /^(#{1,2})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      sections.push({
        label: current.label,
        markdown: current.lines.join('\n').trim(),
        level: current.level,
      });
      current = { label: heading[2].trim(), level: heading[1].length, lines: [] };
      continue;
    }
    current.lines.push(line);
  }
  sections.push({
    label: current.label,
    markdown: current.lines.join('\n').trim(),
    level: current.level,
  });

  const used = new Set<string>();
  // The report projection wraps each block in an EMPTY H2 whose real title is the
  // H1 that follows it (measured on staging row c9a254b7 "Northwind OEE Recovery
  // 2027": 25 headings, 8 of them empty wrappers — the viewer otherwise opens on a
  // blank first section). A lower-level heading after an empty one is that block's
  // title, so the wrapper carries nothing; a same-level heading after an empty one
  // is a genuinely empty section and stays.
  const unwrapped = sections.filter((section, index) => {
    if (section.label === null || section.markdown !== '') return true;
    const next = sections[index + 1];
    return !next || next.level >= section.level;
  });
  // A document that opens with a heading has an empty preamble — dropping it keeps
  // the left nav free of a blank first entry. A body without headings keeps its one
  // section, so the nav is never empty.
  const meaningful = unwrapped.filter(
    (section) => section.label !== null || section.markdown !== ''
  );
  const kept = meaningful.length > 0 ? meaningful : sections;
  return kept.map((section) => {
    const base = `doc-${section.label === null ? 'content' : slugify(section.label)}`;
    let id = base;
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return { ...section, id };
  });
}

function extractErrorCode(body: unknown): string | null {
  const source = body as { error?: unknown; code?: unknown } | null;
  if (!source || typeof source !== 'object') return null;
  const nested = source.error as { code?: unknown } | string | null;
  if (nested && typeof nested === 'object' && typeof nested.code === 'string') return nested.code;
  if (typeof source.code === 'string') return source.code;
  return null;
}

async function fetchArtifactContentEnvelope(
  artifactId: string
): Promise<
  | { ok: true; envelope: ArtifactContentEnvelopeV1 }
  | { ok: false; status: number; code: string | null }
> {
  const response = await fetch(`/api/artifacts/${encodeURIComponent(artifactId)}/content`, {
    headers: authHeaders(),
  });
  const body = (await response.json().catch(() => null)) as ArtifactContentBody | null;
  if (!response.ok) {
    return { ok: false, status: response.status, code: extractErrorCode(body) };
  }
  const envelope = body?.envelope;
  if (!envelope || typeof envelope.contentMd !== 'string') {
    return { ok: false, status: response.status, code: 'ARTIFACT_CONTENT_INVALID_ENVELOPE' };
  }
  return { ok: true, envelope: envelope as ArtifactContentEnvelopeV1 };
}

async function fetchCanvasContent(
  originRecordId: string
): Promise<{ ok: true; contentMd: string; title: string } | { ok: false }> {
  try {
    const draft = await fetchCanvasDraftContent(originRecordId);
    return { ok: true, contentMd: draft.contentMd, title: draft.title };
  } catch {
    return { ok: false };
  }
}

function ready(params: {
  registry: DocumentContentRegistry;
  title: string | null;
  contentMd: string;
  projectionStatus?: string | null;
  canonicalKind?: string | null;
}): DocumentContentResolution {
  const contentMd = params.contentMd;
  if (!contentMd.trim()) return { state: 'empty', registry: params.registry, title: params.title };
  return {
    state: 'ready',
    registry: params.registry,
    title: params.title,
    contentMd,
    sections: splitMarkdownIntoSections(contentMd),
    projectionStatus: params.projectionStatus ?? null,
    canonicalKind: params.canonicalKind ?? null,
  };
}

/**
 * Resolve a document row's markdown through the single chain:
 *   1. `GET /api/artifacts/:id/content` (wave5 / report_builder / presentation / sheet),
 *   2. fallback `GET /api/work-canvas/drafts/:id` for canvas-origin rows,
 *   3. otherwise a named error — never a silently empty document.
 */
export async function resolveDocumentContent(
  target: DocumentContentTarget
): Promise<DocumentContentResolution> {
  const artifactId = String(target?.artifactId || '').trim();
  const originRecordId = String(target?.originRecordId || '').trim();
  const fallbackTitle = String(target?.title || '').trim() || null;

  if (!artifactId && !originRecordId) {
    return { state: 'error', errorCode: 'missing_identifier', detail: null };
  }

  let primaryFailure: { status: number; code: string | null } | null = null;
  /** True when a registry HAS the row but its body is blank (≠ the orphan 404s). */
  let blankEnvelope = false;

  if (artifactId) {
    try {
      const result = await fetchArtifactContentEnvelope(artifactId);
      if (result.ok) {
        const envelope = result.envelope;
        const contentMd = typeof envelope.contentMd === 'string' ? envelope.contentMd : '';
        if (contentMd.trim()) {
          return ready({
            registry: 'artifact_content',
            title: fallbackTitle,
            contentMd,
            projectionStatus: envelope.projection?.status ?? envelope.markdownProjectionStatus ?? null,
            canonicalKind: envelope.canonicalKind ?? null,
          });
        }
        // Body resolved but blank → the canvas registry may still hold the markdown.
        blankEnvelope = true;
      } else {
        primaryFailure = { status: result.status, code: result.code };
      }
    } catch (error) {
      primaryFailure = { status: 0, code: error instanceof Error ? error.message : null };
    }
  }

  if (originRecordId) {
    const canvas = await fetchCanvasContent(originRecordId);
    if (canvas.ok) {
      return ready({
        registry: 'work_canvas_drafts',
        title: canvas.title || fallbackTitle,
        contentMd: canvas.contentMd,
      });
    }
  }

  if (blankEnvelope) {
    return { state: 'empty', registry: 'artifact_content', title: fallbackTitle };
  }

  // A transport fault or a 5xx is retryable → `load_failed`. A 4xx means no
  // registry can serve this row → `content_not_found` (the DEC-595 orphans).
  const serverFault =
    primaryFailure !== null && (primaryFailure.status === 0 || primaryFailure.status >= 500);
  return {
    state: 'error',
    errorCode: serverFault ? 'load_failed' : 'content_not_found',
    detail: primaryFailure?.code ?? null,
  };
}
