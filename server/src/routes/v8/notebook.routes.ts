/**
 * P07-B — Notebook canon HTTP surface (search operators, handoff builder, attachment lifecycle, contract).
 * Mounted at `/api/v8/notebook` (separate from `my-work.routes.ts` notebook CRUD).
 */
import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as notebookHandoffService from '../../services/v8/notebookHandoffService.js';
import * as notebookSearchService from '../../services/v8/notebookSearchService.js';
import {
  P07_ACCEPTANCE_CHECKLIST,
  P07_DEGRADED_SCENARIOS,
  P07_ATTACHMENT_LIFECYCLE_STATES,
  P07_ATTACHMENT_ERROR_TAXONOMY,
  P07_PROVENANCE_LANGUAGE,
  P07_PROVENANCE_RULES,
  P07_CAPTURE_ENTRIES,
  P07_NON_GOALS,
  P07_ANTI_DUPLICATE_RULES,
  P07_NOTEBOOK_CANON_CONTRACT,
  P07_HANDOFF_TARGETS,
  P07_SEARCH_BASELINE,
} from '../../services/v8/notebookCanon.js';

const router = Router();

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
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
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
      hasAttachmentsExplicit !== undefined ? hasAttachmentsExplicit : extractedFilters.has_attachments;

    const filters: notebookSearchService.NotebookSearchFilters = {
      ...extractedFilters,
      q: cleanQuery || undefined,
      status: req.query.status != null ? String(req.query.status) : extractedFilters.status,
      maturity: req.query.maturity != null ? String(req.query.maturity) : extractedFilters.maturity,
      type: req.query.type != null ? String(req.query.type) : extractedFilters.type,
      owner: req.query.owner != null ? String(req.query.owner) : extractedFilters.owner,
      visibility: req.query.visibility != null ? String(req.query.visibility) : extractedFilters.visibility,
      capture_source:
        req.query.capture_source != null
          ? String(req.query.capture_source)
          : extractedFilters.capture_source,
      tags,
      has_attachments,
      date_range,
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
    const { organizationId } = getV8Context(req);
    const { noteId, suggestion } = req.body ?? {};
    if (!noteId || typeof noteId !== 'string') {
      return res.status(400).json({ error: 'noteId required', code: 'P07_NOTEBOOK_NOTE_ID_REQUIRED' });
    }
    const payload = await notebookHandoffService.buildRadarHandoff(
      noteId,
      organizationId,
      suggestion && typeof suggestion === 'object' ? suggestion : {}
    );
    return res.status(201).json({ data: payload, meta: notebookMeta({ handoff: 'radar' }) });
  })
);

router.post(
  '/handoff/inicjatywy',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { noteId, seed } = req.body ?? {};
    if (!noteId || typeof noteId !== 'string') {
      return res.status(400).json({ error: 'noteId required', code: 'P07_NOTEBOOK_NOTE_ID_REQUIRED' });
    }
    const payload = await notebookHandoffService.buildInitiativeHandoff(
      noteId,
      organizationId,
      seed && typeof seed === 'object' ? seed : {}
    );
    return res.status(201).json({ data: payload, meta: notebookMeta({ handoff: 'inicjatywy' }) });
  })
);

router.post(
  '/handoff/teresa',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { noteId, context } = req.body ?? {};
    if (!noteId || typeof noteId !== 'string') {
      return res.status(400).json({ error: 'noteId required', code: 'P07_NOTEBOOK_NOTE_ID_REQUIRED' });
    }
    const payload = await notebookHandoffService.buildTeresaHandoff(
      noteId,
      organizationId,
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
      return res.status(400).json({ error: 'target must be radar|inicjatywy|teresa', code: 'P07_HANDOFF_TARGET' });
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

export default router;
