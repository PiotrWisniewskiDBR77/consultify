/**
 * P07-B — Notebook canon HTTP surface (search operators, handoff builder, attachment lifecycle, contract).
 * Mounted at `/api/v8/notebook` (separate from `my-work.routes.ts` notebook CRUD).
 */
import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import {
  parseNotebookAttachments,
  resolveNotebookAttachmentFile,
} from '../../services/notebookAttachmentService.js';
import {
  P07_ACCEPTANCE_CHECKLIST,
  P07_ANTI_DUPLICATE_RULES,
  P07_ATTACHMENT_ERROR_TAXONOMY,
  P07_ATTACHMENT_LIFECYCLE_STATES,
  P07_CAPTURE_ENTRIES,
  P07_DEGRADED_SCENARIOS,
  P07_HANDOFF_TARGETS,
  P07_NON_GOALS,
  P07_NOTEBOOK_CANON_CONTRACT,
  P07_PROVENANCE_LANGUAGE,
  P07_PROVENANCE_RULES,
  P07_SEARCH_BASELINE,
} from '../../services/v8/notebookCanon.js';
import * as notebookHandoffService from '../../services/v8/notebookHandoffService.js';
import * as notebookSearchService from '../../services/v8/notebookSearchService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
// Living Notebook — strumienie agentów (rozłączne route-moduły) montowane na tym samym routerze.
import { registerNotebookCoverRoutes } from './notebookCover.routes.js';
import { registerNotebookTodayRoutes } from './notebookToday.routes.js';
import { registerNotebookTopicsRoutes } from './notebookTopics.routes.js';
import { registerNotebookVersionsRoutes } from './notebookVersions.routes.js';

const router = Router();

// Wpięcie strumieni Living Notebook (Topics A1, Daily A2, Cover A4, Versions A5) — ścieżki rozłączne
// (/topics, /today, /pages/:id/cover, /pages/:id/versions), pod /api/v8/notebook/*.
registerNotebookTopicsRoutes(router);
registerNotebookTodayRoutes(router);
registerNotebookCoverRoutes(router);
registerNotebookVersionsRoutes(router);

/** Documented status codes for P07-B notebook clients (contract checklist). */
export const P07_NOTEBOOK_HTTP_STATUSES = [
  200, 201, 400, 401, 403, 404, 409, 412, 429, 503, 504,
] as const;

function notebookMeta(extra?: Record<string, unknown>) {
  return {
    version: 'v8' as const,
    contract: P07_NOTEBOOK_CANON_CONTRACT,
    ...extra,
  };
}

function parseCsvParam(v: unknown): string[] | undefined {
  if (v == null || v === '') return undefined;
  const raw = Array.isArray(v) ? v.join(',') : String(v);
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

function parseBoolQuery(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return undefined;
}

function mergeTags(a?: string[], b?: string[]): string[] | undefined {
  const out = [...(a ?? []), ...(b ?? [])].filter(Boolean);
  return out.length ? [...new Set(out)] : undefined;
}

router.get(
  '/search',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const qRaw = String(req.query.q ?? '');
    const { cleanQuery, extractedFilters } = notebookSearchService.parseOperatorHints(qRaw);

    const explicitTags = parseCsvParam(req.query.tags);
    const tags = mergeTags(extractedFilters.tags, explicitTags);

    const dateFrom = req.query.date_from != null ? String(req.query.date_from) : undefined;
    const dateTo = req.query.date_to != null ? String(req.query.date_to) : undefined;
    const date_range =
      dateFrom || dateTo ? { from: dateFrom, to: dateTo } : extractedFilters.date_range;

    const hasAttachmentsExplicit = parseBoolQuery(req.query.has_attachments);
    const has_attachments =
      hasAttachmentsExplicit !== undefined
        ? hasAttachmentsExplicit
        : extractedFilters.has_attachments;

    const filters: notebookSearchService.NotebookSearchFilters = {
      ...extractedFilters,
      q: cleanQuery || undefined,
      status: req.query.status != null ? String(req.query.status) : extractedFilters.status,
      maturity: req.query.maturity != null ? String(req.query.maturity) : extractedFilters.maturity,
      type: req.query.type != null ? String(req.query.type) : extractedFilters.type,
      owner: req.query.owner != null ? String(req.query.owner) : extractedFilters.owner,
      visibility:
        req.query.visibility != null ? String(req.query.visibility) : extractedFilters.visibility,
      capture_source:
        req.query.capture_source != null
          ? String(req.query.capture_source)
          : extractedFilters.capture_source,
      tags,
      has_attachments,
      date_range,
      // #18 — orphan cleanup lens (sidebar filter): pages with zero link_graph_edges.
      orphaned: parseBoolQuery(req.query.orphaned),
    };

    const data = await notebookSearchService.searchNotebook(organizationId, userId, filters);
    return res.json({
      data,
      meta: notebookMeta({ operator_hints_parsed: qRaw.length > 0 }),
    });
  })
);

router.post(
  '/handoff/radar',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { noteId, suggestion } = req.body ?? {};
    if (!noteId || typeof noteId !== 'string') {
      return res
        .status(400)
        .json({ error: 'noteId required', code: 'P07_NOTEBOOK_NOTE_ID_REQUIRED' });
    }
    const payload = await notebookHandoffService.buildRadarHandoff(
      noteId,
      organizationId,
      userId,
      suggestion && typeof suggestion === 'object' ? suggestion : {}
    );
    return res.status(201).json({ data: payload, meta: notebookMeta({ handoff: 'radar' }) });
  })
);

router.post(
  '/handoff/inicjatywy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { noteId, seed } = req.body ?? {};
    if (!noteId || typeof noteId !== 'string') {
      return res
        .status(400)
        .json({ error: 'noteId required', code: 'P07_NOTEBOOK_NOTE_ID_REQUIRED' });
    }
    const payload = await notebookHandoffService.buildInitiativeHandoff(
      noteId,
      organizationId,
      userId,
      seed && typeof seed === 'object' ? seed : {}
    );
    return res.status(201).json({ data: payload, meta: notebookMeta({ handoff: 'inicjatywy' }) });
  })
);

router.post(
  '/handoff/teresa',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { noteId, context } = req.body ?? {};
    if (!noteId || typeof noteId !== 'string') {
      return res
        .status(400)
        .json({ error: 'noteId required', code: 'P07_NOTEBOOK_NOTE_ID_REQUIRED' });
    }
    const payload = await notebookHandoffService.buildTeresaHandoff(
      noteId,
      organizationId,
      userId,
      context && typeof context === 'object' ? context : {}
    );
    return res.status(201).json({ data: payload, meta: notebookMeta({ handoff: 'teresa' }) });
  })
);

router.post(
  '/handoff/validate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { target, payload } = req.body ?? {};
    if (target !== 'radar' && target !== 'inicjatywy' && target !== 'teresa') {
      return res
        .status(400)
        .json({ error: 'target must be radar|inicjatywy|teresa', code: 'P07_HANDOFF_TARGET' });
    }
    const obj =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    const result = notebookHandoffService.validateHandoffPayload(target, obj);
    return res.json(result);
  })
);

router.get(
  '/attachment-lifecycle',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      data: {
        states: [...P07_ATTACHMENT_LIFECYCLE_STATES],
        error_taxonomy: P07_ATTACHMENT_ERROR_TAXONOMY,
      },
      meta: notebookMeta(),
    });
  })
);

router.get(
  '/contract',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      data: {
        contract_id: P07_NOTEBOOK_CANON_CONTRACT,
        acceptance_checklist: P07_ACCEPTANCE_CHECKLIST,
        degraded_scenarios: P07_DEGRADED_SCENARIOS,
        attachment_lifecycle_states: [...P07_ATTACHMENT_LIFECYCLE_STATES],
        attachment_error_taxonomy: P07_ATTACHMENT_ERROR_TAXONOMY,
        provenance_language: [...P07_PROVENANCE_LANGUAGE],
        provenance_rules: P07_PROVENANCE_RULES,
        capture_entries: P07_CAPTURE_ENTRIES,
        non_goals: [...P07_NON_GOALS],
        anti_duplicate_rules: P07_ANTI_DUPLICATE_RULES,
        handoff_targets: P07_HANDOFF_TARGETS,
        search_baseline: P07_SEARCH_BASELINE,
      },
      meta: notebookMeta(),
    });
  })
);

// ── Degraded Scenario 4: Preview/readback unavailable ───────────

router.get(
  '/preview/:noteId/attachments/:attachmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const noteId = String(req.params.noteId || '').trim();
    const attachmentId = String(req.params.attachmentId || '').trim();

    if (!noteId || !attachmentId) {
      return res
        .status(400)
        .json({ error: 'noteId and attachmentId required', code: 'P07_PREVIEW_PARAMS_REQUIRED' });
    }

    const row = await dbGet<{
      id: string;
      owner_user_id: string;
      organization_id: string;
      attachments_json: string | null;
    }>(
      `SELECT id, owner_user_id, organization_id, attachments_json
       FROM notebook_pages
       WHERE id = $1 LIMIT 1`,
      [noteId],
      { fallback: false }
    );

    if (!row) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (String(row.organization_id) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }

    const storedFile = await resolveNotebookAttachmentFile(row.attachments_json, attachmentId);

    if (!storedFile) {
      const attachments = parseNotebookAttachments(row.attachments_json);
      const match = attachments.find((a) => a.id === attachmentId);
      return res.json({
        degraded: true,
        scenario: 4,
        userVisibleState: 'attachment visible, preview unavailable',
        nextAction: 'download/open externally',
        attachment: {
          id: attachmentId,
          filename: match?.name ?? null,
          status: 'preview_unavailable',
        },
        downloadUrl: `/api/v8/my-work/notebook/pages/${noteId}/attachments/${attachmentId}/download`,
        meta: notebookMeta(),
      });
    }

    return res.json({
      degraded: false,
      previewAvailable: true,
      mimeType: storedFile.mimeType,
      sizeBytes: storedFile.sizeBytes,
      meta: notebookMeta(),
    });
  })
);

// ── Degraded Scenario 7 + 8: Deeplink resolution ───────────────

router.get(
  '/resolve/:noteId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const noteId = String(req.params.noteId || '').trim();

    if (!noteId) {
      return res
        .status(400)
        .json({ error: 'noteId required', code: 'P07_RESOLVE_NOTE_ID_REQUIRED' });
    }

    const row = await dbGet<{
      id: string;
      title: string;
      status: string;
      owner_user_id: string;
      organization_id: string;
      project_id: string | null;
      visibility: string;
      updated_at: string;
    }>(
      `SELECT id, title, status, owner_user_id, organization_id, project_id, visibility, updated_at
       FROM notebook_pages
       WHERE id = $1 LIMIT 1`,
      [noteId],
      { fallback: false }
    );

    if (!row) {
      return res.status(404).json({
        degraded: true,
        scenario: 7,
        userVisibleState: 'note not found / deleted',
        nextAction: 'search by id + activity pointers',
        searchHint: { q: noteId },
        fallbackUrl: `/api/v8/notebook/search?q=${encodeURIComponent(noteId)}`,
        meta: notebookMeta(),
      });
    }

    const orgMatch = String(row.organization_id) === String(organizationId);
    if (!orgMatch) {
      return res.status(403).json({
        degraded: true,
        scenario: 8,
        userVisibleState: 'link visible, marked degraded(permission)',
        nextAction: 'request access / capture context',
        noteId,
        canRequestAccess: true,
        meta: notebookMeta(),
      });
    }

    const visibility = String(row.visibility || 'private').toLowerCase();
    const isOwner = String(row.owner_user_id) === String(userId);

    if (visibility === 'private' && !isOwner) {
      return res.status(403).json({
        degraded: true,
        scenario: 8,
        userVisibleState: 'link visible, marked degraded(permission)',
        nextAction: 'request access / capture context',
        noteId,
        canRequestAccess: true,
        meta: notebookMeta(),
      });
    }

    if (visibility === 'project' && !isOwner && row.project_id) {
      const cols = await getTableColumns('project_members');
      let isMember = false;
      if (cols?.size) {
        const member = await dbGet<{ ok: number }>(
          `SELECT 1 as ok FROM project_members WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
          [row.project_id, userId],
          { fallback: false }
        );
        isMember = !!member;
      }
      if (!isMember) {
        return res.status(403).json({
          degraded: true,
          scenario: 8,
          userVisibleState: 'link visible, marked degraded(permission)',
          nextAction: 'request access / capture context',
          noteId,
          canRequestAccess: true,
          meta: notebookMeta(),
        });
      }
    }

    return res.json({
      degraded: false,
      note: {
        id: row.id,
        title: row.title,
        status: row.status,
        deeplink: `/api/v8/notebook/resolve/${row.id}`,
      },
      meta: notebookMeta(),
    });
  })
);

// ── Degraded Scenario 9: Concurrent edit conflict ───────────────

router.put(
  '/pages/:noteId/content',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const noteId = String(req.params.noteId || '').trim();
    const { content, expectedVersion } = req.body ?? {};

    if (!noteId) {
      return res
        .status(400)
        .json({ error: 'noteId required', code: 'P07_CONTENT_NOTE_ID_REQUIRED' });
    }
    if (content === undefined || content === null) {
      return res.status(400).json({ error: 'content required', code: 'P07_CONTENT_REQUIRED' });
    }
    if (!expectedVersion) {
      return res
        .status(400)
        .json({ error: 'expectedVersion required', code: 'P07_EXPECTED_VERSION_REQUIRED' });
    }

    const row = await dbGet<{
      id: string;
      owner_user_id: string;
      organization_id: string;
      updated_at: string;
    }>(
      `SELECT id, owner_user_id, organization_id, updated_at
       FROM notebook_pages
       WHERE id = $1 LIMIT 1`,
      [noteId],
      { fallback: false }
    );

    if (!row) {
      return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
    }
    if (String(row.organization_id) !== String(organizationId)) {
      return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
    }
    if (String(row.owner_user_id) !== String(userId)) {
      return res.status(403).json({ error: 'Owner-only', code: 'NOTEBOOK_PAGE_OWNER_ONLY' });
    }

    const currentVersion = row.updated_at;
    if (String(expectedVersion) !== String(currentVersion)) {
      return res.status(409).json({
        degraded: true,
        scenario: 9,
        userVisibleState: 'conflict resolution UI (versions)',
        nextAction: 'explicit conflict resolution — no silent overwrite',
        conflict: {
          yourVersion: expectedVersion,
          serverVersion: currentVersion,
        },
        code: 'P07_CONCURRENT_EDIT_CONFLICT',
        meta: notebookMeta(),
      });
    }

    const contentJson = typeof content === 'string' ? content : JSON.stringify(content);
    const contentText =
      typeof content === 'string' ? content : typeof content?.text === 'string' ? content.text : '';

    await dbRun(
      `UPDATE notebook_pages
       SET content_json = $1, content_text = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND updated_at = $4`,
      [contentJson, contentText, noteId, currentVersion],
      { fallback: false }
    );

    const updated = await dbGet<{ id: string; updated_at: string }>(
      `SELECT id, updated_at FROM notebook_pages WHERE id = $1 LIMIT 1`,
      [noteId],
      { fallback: false }
    );

    return res.json({
      degraded: false,
      success: true,
      noteId,
      version: updated?.updated_at ?? null,
      meta: notebookMeta(),
    });
  })
);

export default router;
