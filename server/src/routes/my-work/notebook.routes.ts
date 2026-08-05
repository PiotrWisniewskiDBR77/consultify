/**
 * Notebook sub-router — extracted from my-work.routes.ts
 *
 * Handles /notebook/pages CRUD, file uploads, attachments, conversions,
 * AI-based action extraction, topic suggestions, and classification.
 * Mounted under /api/my-work by the parent aggregator.
 */

import type { Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { enrichPage } from '../../services/notebookAIEnrichService.js';
import {
  addNotebookAttachmentsToPage,
  NotebookAttachmentMutationError,
  parseNotebookAttachments,
  removeNotebookAttachmentFromPage,
  resolveNotebookAttachmentFile,
  toPublicNotebookAttachments,
} from '../../services/notebookAttachmentService.js';
import {
  canAccessNotebook,
  canMutateNotebook,
  defaultNotebookId,
  isTeamMember,
  normalizeContextSharing,
  normalizeScope,
  toPublicNotebook,
} from '../../services/notebookContainerService.js';
import notebookService from '../../services/notebookService.js';
import {
  resolveStoredNotebookSourceFile,
  toPublicNotebookCaptureMetadata,
} from '../../services/notebookSourceFileService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns, hasColumn } from '../../utils/dbSchema.js';
import { decodeHtmlEntities, deepDecodeHtmlEntities } from '../../utils/htmlEntities.js';
import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { requireTables, requireUser } from './_helpers.js';

const router = Router();

// ── Local helpers ────────────────────────────────────────────────────────────

const parseTagsArray = (input: unknown): string[] => {
  if (Array.isArray(input)) return input.map((x) => String(x).trim()).filter(Boolean);
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      // ignore
    }
    if (s.includes(','))
      return s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    return [s];
  }
  return [];
};

type NotebookVisibility = 'private' | 'project';

const safeJsonString = (v: unknown, fallback: string) => {
  if (typeof v === 'string') {
    try {
      JSON.parse(v);
      return v;
    } catch {
      // fall through
    }
  }
  try {
    return JSON.stringify(v ?? JSON.parse(fallback));
  } catch {
    return fallback;
  }
};

const canAccessNotebookRow = async (
  userId: string,
  orgId: string,
  row: {
    owner_user_id?: string;
    ownerUserId?: string;
    organization_id?: string;
    organizationId?: string;
    visibility?: string;
    project_id?: string;
    projectId?: string | null;
  }
): Promise<boolean> => {
  if (!row) return false;
  if (String(row.organization_id ?? row.organizationId ?? '') !== String(orgId)) return false;
  const owner = String(row.owner_user_id ?? row.ownerUserId ?? '');
  const vis = String(row.visibility || 'private').toLowerCase() as NotebookVisibility;
  const projectId = row.project_id
    ? String(row.project_id)
    : row.projectId
      ? String(row.projectId)
      : null;

  if (owner === userId) return true;
  if (vis !== 'project' || !projectId) return false;

  const pm = await queryHelpers.queryOne<{ ok: number }>(
    `SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
    [projectId, userId]
  );
  return Boolean((pm as any)?.ok);
};

const parseCaptureMetadata = (raw: string | null | undefined) =>
  toPublicNotebookCaptureMetadata(raw);
const parseAttachments = (raw: string | null | undefined) => toPublicNotebookAttachments(raw);

function buildLegacyNotebookSelect(cols: Set<string>, alias = 'np'): string {
  const p = alias ? `${alias}.` : '';
  const safe = (col: string, as: string, fallback: string) =>
    cols.has(col) ? `${p}${col} as ${as}` : `${fallback} as ${as}`;
  return [
    `${p}id`,
    `${p}owner_user_id as "ownerUserId"`,
    `${p}organization_id as "organizationId"`,
    `${p}project_id as "projectId"`,
    `${p}visibility`,
    `${p}title`,
    `${p}content_json as "contentJson"`,
    `${p}content_text as "contentText"`,
    `${p}tags_json as tags`,
    safe('maturity', 'maturity', "'seed'"),
    safe('icon', 'icon', 'NULL'),
    safe('summary', 'summary', 'NULL'),
    `coalesce(${cols.has('status') ? `${p}status` : 'NULL'}, 'active') as status`,
    `coalesce(${cols.has('pinned') ? `${p}pinned` : 'NULL'}, 0) as pinned`,
    `coalesce(${cols.has('verification_status') ? `${p}verification_status` : 'NULL'}, 'unverified') as "verificationStatus"`,
    `coalesce(${cols.has('review_cadence') ? `${p}review_cadence` : 'NULL'}, 'monthly') as "reviewCadence"`,
    safe('stale_at', '"staleAt"', 'NULL'),
    safe('last_reviewed_at', '"lastReviewedAt"', 'NULL'),
    safe('capture_source', '"captureSource"', 'NULL'),
    safe('capture_metadata', '"captureMetadataJson"', 'NULL'),
    safe('attachments_json', '"attachmentsJson"', "'[]'"),
    safe('converted_to_json', '"convertedToJson"', 'NULL'),
    `${p}created_at as "createdAt"`,
    `${p}updated_at as "updatedAt"`,
  ].join(',\n          ');
}

// ── Multer configs ───────────────────────────────────────────────────────────

const notebookUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain' ||
      file.mimetype === 'text/markdown' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel';
    if (ok) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF, XLSX, TXT, MD allowed'));
  },
});
const notebookAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

// ── Routes ───────────────────────────────────────────────────────────────────

// ── Notebook containers (Notatniki, L1) ──────────────────────────────────────

/**
 * GET /api/my-work/notebooks — notebooks the user can access (own + team).
 * Each row carries page_count for the list view.
 */
router.get(
  '/notebooks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebooks']))) return;

    const rows = await queryHelpers.queryAll<any>(
      `SELECT n.id, n.owner_user_id, n.organization_id, n.title, n.icon, n.scope,
              n.team_id, n.context_sharing, n.created_at, n.updated_at,
              (SELECT COUNT(*) FROM notebook_pages np WHERE np.notebook_id = n.id) AS page_count
         FROM notebooks n
        WHERE n.organization_id = ?
          AND ( n.owner_user_id = ?
                OR ( lower(coalesce(n.scope, 'personal')) = 'team'
                     AND n.team_id IN (SELECT team_id FROM team_members WHERE user_id = ?) ) )
        ORDER BY n.updated_at DESC`,
      [orgId, userId, userId]
    );
    res.json({ notebooks: (rows || []).map(toPublicNotebook) });
  })
);

/**
 * POST /api/my-work/notebooks — create a notebook.
 * Body: { title, icon?, scope?: 'personal'|'team', teamId?, contextSharing?: 'private'|'org_context' }
 */
router.post(
  '/notebooks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebooks']))) return;

    // Z139 (full scope): undo the global sanitizer's HTML-entity escaping
    // before storing the title, mirroring contentJson/contentText below —
    // otherwise the title (rendered as plain text in lists) shows literal
    // `&amp;` and re-saving compounds it further.
    const title = decodeHtmlEntities(String(req.body?.title || '').trim());
    if (!title) return res.status(400).json({ error: 'title is required' });

    const scope = normalizeScope(req.body?.scope);
    const contextSharing = normalizeContextSharing(req.body?.contextSharing);
    const icon = typeof req.body?.icon === 'string' ? req.body.icon : null;

    let teamId: string | null = null;
    if (scope === 'team') {
      teamId = req.body?.teamId ? String(req.body.teamId) : '';
      if (!teamId) return res.status(400).json({ error: 'teamId is required for scope=team' });
      if (!(await isTeamMember(teamId, userId))) {
        return res.status(403).json({ error: 'Not a team member' });
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO notebooks
         (id, owner_user_id, organization_id, title, icon, scope, team_id, context_sharing, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, orgId, title, icon, scope, teamId, contextSharing, now, now]
    );

    const row = await queryHelpers.queryOne<any>(
      `SELECT n.*, 0 AS page_count FROM notebooks n WHERE n.id = ? LIMIT 1`,
      [id]
    );
    res.status(201).json(toPublicNotebook(row));
  })
);

/** GET /api/my-work/notebooks/:id — single notebook (access-checked). */
router.get(
  '/notebooks/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebooks']))) return;
    const id = String(req.params.id);

    const row = await queryHelpers.queryOne<any>(
      `SELECT n.*, (SELECT COUNT(*) FROM notebook_pages np WHERE np.notebook_id = n.id) AS page_count
         FROM notebooks n WHERE n.id = ? LIMIT 1`,
      [id]
    );
    if (!row || !(await canAccessNotebook(userId, orgId, row))) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    res.json(toPublicNotebook(row));
  })
);

/**
 * PUT /api/my-work/notebooks/:id — update container metadata (owner only).
 * Body: any of { title, icon, scope, teamId, contextSharing }.
 */
router.put(
  '/notebooks/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebooks']))) return;
    const id = String(req.params.id);

    const existing = await queryHelpers.queryOne<any>(
      `SELECT * FROM notebooks WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Notebook not found' });
    if (!canMutateNotebook(userId, orgId, existing)) {
      return res.status(403).json({ error: 'Only the owner can modify this notebook' });
    }

    const body = req.body || {};
    const sets: string[] = [];
    const params: unknown[] = [];

    if (typeof body.title === 'string') {
      const t = body.title.trim();
      if (t) {
        sets.push('title = ?');
        params.push(t);
      }
    }
    if ('icon' in body) {
      sets.push('icon = ?');
      params.push(typeof body.icon === 'string' ? body.icon : null);
    }
    if ('contextSharing' in body) {
      sets.push('context_sharing = ?');
      params.push(normalizeContextSharing(body.contextSharing));
    }
    if ('scope' in body) {
      const scope = normalizeScope(body.scope);
      let teamId: string | null = null;
      if (scope === 'team') {
        teamId = body.teamId ? String(body.teamId) : String(existing.team_id || '');
        if (!teamId) return res.status(400).json({ error: 'teamId is required for scope=team' });
        if (!(await isTeamMember(teamId, userId))) {
          return res.status(403).json({ error: 'Not a team member' });
        }
      }
      sets.push('scope = ?');
      params.push(scope);
      sets.push('team_id = ?');
      params.push(teamId);
    } else if ('teamId' in body) {
      const teamId = body.teamId ? String(body.teamId) : null;
      if (teamId && !(await isTeamMember(teamId, userId))) {
        return res.status(403).json({ error: 'Not a team member' });
      }
      sets.push('team_id = ?');
      params.push(teamId);
    }

    if (!sets.length) return res.status(400).json({ error: 'No updatable fields' });
    sets.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    await queryHelpers.queryRun(`UPDATE notebooks SET ${sets.join(', ')} WHERE id = ?`, params);

    const row = await queryHelpers.queryOne<any>(
      `SELECT n.*, (SELECT COUNT(*) FROM notebook_pages np WHERE np.notebook_id = n.id) AS page_count
         FROM notebooks n WHERE n.id = ? LIMIT 1`,
      [id]
    );
    res.json(toPublicNotebook(row));
  })
);

/** DELETE /api/my-work/notebooks/:id — owner only; refuses when non-empty. */
router.delete(
  '/notebooks/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebooks']))) return;
    const id = String(req.params.id);

    const existing = await queryHelpers.queryOne<any>(
      `SELECT * FROM notebooks WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Notebook not found' });
    if (!canMutateNotebook(userId, orgId, existing)) {
      return res.status(403).json({ error: 'Only the owner can delete this notebook' });
    }

    const cnt = await queryHelpers.queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM notebook_pages WHERE notebook_id = ?`,
      [id]
    );
    const pageCount = Number((cnt as any)?.c || 0);
    if (pageCount > 0) {
      return res.status(409).json({ error: 'Notebook is not empty', pageCount });
    }

    await queryHelpers.queryRun(`DELETE FROM notebooks WHERE id = ?`, [id]);
    res.status(204).send();
  })
);

/**
 * GET /api/my-work/notebook/pages?notebookId?&projectId?&q?&status?&pinned?&sort?&limit?&offset?
 */
router.get(
  '/notebook/pages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;
    const nbCols = await getTableColumns('notebook_pages');

    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const notebookId = req.query.notebookId ? String(req.query.notebookId) : null;
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const statusFilter = req.query.status ? String(req.query.status).trim().toLowerCase() : '';
    const pinnedFilter = req.query.pinned !== undefined ? String(req.query.pinned) : '';
    const sortParam = req.query.sort ? String(req.query.sort).trim().toLowerCase() : 'updated';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
    const offsetRaw = Number(req.query.offset);
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const where: string[] = ['np.organization_id = ?'];
    const params: any[] = [orgId];

    if (projectId) {
      where.push('np.project_id = ?');
      params.push(projectId);
    }

    if (notebookId && nbCols.has('notebook_id')) {
      where.push('np.notebook_id = ?');
      params.push(notebookId);
    }

    if (statusFilter && ['inbox', 'active', 'converted', 'archived'].includes(statusFilter)) {
      where.push("lower(coalesce(np.status, 'active')) = ?");
      params.push(statusFilter);
    }

    if (pinnedFilter === '1') {
      where.push('np.pinned = 1');
    } else if (pinnedFilter === '0') {
      where.push('(np.pinned = 0 OR np.pinned IS NULL)');
    }

    // FTS hardening: only use the tsvector path when `search_vector` actually exists.
    // On staging the column may be missing (FTS migration not applied) — querying it
    // would 500 with `column np.search_vector does not exist`. We degrade to LIKE
    // instead and report it, never throw. (Agent 3 — search/RAG repair.)
    let searchDegraded = false;
    if (q) {
      const isPg = process.env.DB_TYPE === 'postgres';
      const ftsAvailable = isPg ? await hasColumn('notebook_pages', 'search_vector') : false;
      if (isPg && ftsAvailable) {
        const ftsQuery = q.replace(/'/g, "''").trim();
        where.push(`np.search_vector @@ plainto_tsquery('simple', ?)`);
        params.push(ftsQuery);
      } else {
        if (isPg && !ftsAvailable) searchDegraded = true; // FTS column not provisioned
        where.push(
          `(lower(np.title) LIKE ? OR lower(coalesce(np.content_text,'')) LIKE ? OR lower(coalesce(np.tags_json,'')) LIKE ?)`
        );
        const like = `%${q}%`;
        params.push(like, like, like);
      }
    }

    const orderClauses: Record<string, string> = {
      updated: 'np.pinned DESC, np.updated_at DESC',
      created: 'np.pinned DESC, np.created_at DESC',
      title: 'np.pinned DESC, np.title ASC',
    };
    const orderBy = orderClauses[sortParam] || orderClauses.updated;

    const runListQuery = (whereClauses: string[], whereParams: any[]) =>
      queryHelpers.queryAll<any>(
        `
        SELECT
          ${buildLegacyNotebookSelect(nbCols, 'np')}
        FROM notebook_pages np
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY ${orderBy}
      `,
        whereParams
      );

    let rows: any[] = [];
    try {
      rows = (await runListQuery(where, params)) || [];
    } catch (err: any) {
      // Last-resort FTS guard: if the search_vector column is missing despite the
      // hasColumn check (cache drift / generated-column edge), retry without the FTS
      // predicate rather than 500. Re-throw anything that is NOT a missing-column error.
      const msg = String(err?.message || err || '');
      const isMissingFts =
        /search_vector/i.test(msg) && /does not exist|undefined column|42703/i.test(msg);
      if (q && isMissingFts) {
        searchDegraded = true;
        const like = `%${q}%`;
        const fallbackWhere = ['np.organization_id = ?'];
        const fallbackParams: any[] = [orgId];
        if (projectId) {
          fallbackWhere.push('np.project_id = ?');
          fallbackParams.push(projectId);
        }
        if (notebookId && nbCols.has('notebook_id')) {
          fallbackWhere.push('np.notebook_id = ?');
          fallbackParams.push(notebookId);
        }
        if (statusFilter && ['inbox', 'active', 'converted', 'archived'].includes(statusFilter)) {
          fallbackWhere.push("lower(coalesce(np.status, 'active')) = ?");
          fallbackParams.push(statusFilter);
        }
        if (pinnedFilter === '1') fallbackWhere.push('np.pinned = 1');
        else if (pinnedFilter === '0') fallbackWhere.push('(np.pinned = 0 OR np.pinned IS NULL)');
        fallbackWhere.push(
          `(lower(np.title) LIKE ? OR lower(coalesce(np.content_text,'')) LIKE ? OR lower(coalesce(np.tags_json,'')) LIKE ?)`
        );
        fallbackParams.push(like, like, like);
        logger.warn('[NotebookSearch] search_vector missing — degraded to LIKE search');
        rows = (await runListQuery(fallbackWhere, fallbackParams)) || [];
      } else {
        throw err;
      }
    }

    // Surface FTS degradation without changing the array response shape (clients
    // expect a bare array). Consumers may read this to show a "basic search" hint.
    if (searchDegraded) res.setHeader('X-Notebook-Search-Degraded', 'fts-unavailable');

    const accessibleRows: any[] = [];
    for (const row of rows) {
      if (await canAccessNotebookRow(userId, orgId, row)) {
        accessibleRows.push(row);
      }
    }
    const pagedRows = accessibleRows.slice(offset, offset + limit);

    const parseConvertedTo = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };
    res.json(
      pagedRows.map((r: any) => ({
        ...r,
        tags: parseTagsArray(r.tags),
        pinned: Boolean(r.pinned),
        captureSource: r.captureSource ?? null,
        captureMetadata: parseCaptureMetadata(r.captureMetadataJson),
        attachments: parseAttachments(r.attachmentsJson),
        convertedTo: parseConvertedTo(r.convertedToJson),
        convertedToJson: undefined,
        captureMetadataJson: undefined,
        attachmentsJson: undefined,
        contentJson: (() => {
          try {
            return r.contentJson ? JSON.parse(r.contentJson) : { type: 'doc', content: [] };
          } catch {
            return { type: 'doc', content: [] };
          }
        })(),
      }))
    );
  })
);

/**
 * POST /api/my-work/notebook/pages
 */
router.post(
  '/notebook/pages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;
    const nbCols = await getTableColumns('notebook_pages');

    // Z139 (full scope): decode before storing, mirroring contentJson/contentText.
    const title = decodeHtmlEntities(String(req.body?.title || '').trim());
    if (!title) return res.status(400).json({ error: 'title is required' });

    const projectId = req.body?.projectId ? String(req.body.projectId) : null;
    const visibility = (
      req.body?.visibility
        ? String(req.body.visibility).toLowerCase()
        : projectId
          ? 'project'
          : 'private'
    ) as NotebookVisibility;

    if (visibility === 'project' && !projectId) {
      return res.status(400).json({ error: 'projectId is required for visibility=project' });
    }

    if (visibility === 'project' && projectId) {
      const pm = await queryHelpers.queryOne<{ ok: number }>(
        `SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
        [projectId, userId]
      );
      if (!pm) return res.status(403).json({ error: 'Not a project member' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const tags = JSON.stringify(parseTagsArray(req.body?.tags));
    const contentJson = safeJsonString(
      deepDecodeHtmlEntities(req.body?.contentJson),
      JSON.stringify({ type: 'doc', content: [] })
    );
    const contentText =
      typeof req.body?.contentText === 'string' ? decodeHtmlEntities(req.body.contentText) : null;
    const icon = typeof req.body?.icon === 'string' ? req.body.icon : null;
    const maturity = typeof req.body?.maturity === 'string' ? req.body.maturity : 'seed';
    const status =
      typeof req.body?.status === 'string' && ['inbox', 'active'].includes(req.body.status)
        ? req.body.status
        : 'active';
    const sourcePack =
      req.body?.sourcePack &&
      typeof req.body.sourcePack === 'object' &&
      !Array.isArray(req.body.sourcePack)
        ? req.body.sourcePack
        : {};
    const actionContract =
      req.body?.actionContract &&
      typeof req.body.actionContract === 'object' &&
      !Array.isArray(req.body.actionContract)
        ? req.body.actionContract
        : {};
    const evidenceRefs = Array.isArray(req.body?.evidenceRefs)
      ? req.body.evidenceRefs.map((ref: unknown) => String(ref || '').trim()).filter(Boolean)
      : [];
    const captureMetadata = {
      sourceType: req.body?.sourceType ? String(req.body.sourceType) : null,
      sourceId: req.body?.sourceId ? String(req.body.sourceId) : null,
      sourcePack,
      actionContract,
      evidenceRefs,
    };

    const insertColumns = [
      'id',
      'owner_user_id',
      'organization_id',
      'project_id',
      'visibility',
      'title',
      'content_json',
      'content_text',
      'tags_json',
      'icon',
      'maturity',
      'status',
      'created_at',
      'updated_at',
    ];
    const insertValues: unknown[] = [
      id,
      userId,
      orgId,
      projectId,
      visibility,
      title,
      contentJson,
      contentText,
      tags,
      icon,
      maturity,
      status,
      now,
      now,
    ];
    if (nbCols.has('capture_source')) {
      insertColumns.push('capture_source');
      insertValues.push(req.body?.captureSource ?? null);
    }
    if (nbCols.has('capture_metadata')) {
      insertColumns.push('capture_metadata');
      insertValues.push(JSON.stringify(captureMetadata));
    }

    // Assign the page to its notebook container (L1). Honor an explicit
    // notebookId (access-checked) or fall back to the owner's default notebook.
    if (nbCols.has('notebook_id')) {
      const requestedNotebookId = req.body?.notebookId ? String(req.body.notebookId) : '';
      let targetNotebookId: string;
      if (requestedNotebookId) {
        const nb = await queryHelpers.queryOne<any>(
          `SELECT * FROM notebooks WHERE id = ? LIMIT 1`,
          [requestedNotebookId]
        );
        if (!nb || !(await canAccessNotebook(userId, orgId, nb))) {
          return res.status(403).json({ error: 'No access to target notebook' });
        }
        targetNotebookId = requestedNotebookId;
      } else {
        targetNotebookId = defaultNotebookId(orgId, userId);
        // Ensure the default notebook row exists (idempotent) so the FK is valid.
        await queryHelpers.queryRun(
          `INSERT INTO notebooks
             (id, owner_user_id, organization_id, title, icon, scope, team_id, context_sharing, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
          [
            targetNotebookId,
            userId,
            orgId,
            'Moje notatki',
            null,
            'personal',
            null,
            'private',
            now,
            now,
          ]
        );
      }
      insertColumns.push('notebook_id');
      insertValues.push(targetNotebookId);
    }

    await queryHelpers.queryRun(
      `INSERT INTO notebook_pages
        (${insertColumns.join(', ')})
       VALUES (${insertColumns.map(() => '?').join(', ')})`,
      insertValues
    );

    const row = await queryHelpers.queryOne<any>(
      `SELECT
        ${buildLegacyNotebookSelect(nbCols, '')}
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );

    const parseConvertedTo = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };
    res.status(201).json({
      ...row,
      tags: parseTagsArray((row as any)?.tags),
      pinned: Boolean(row?.pinned),
      captureSource: row?.captureSource ?? null,
      captureMetadata: parseCaptureMetadata(row?.captureMetadataJson),
      attachments: parseAttachments(row?.attachmentsJson),
      convertedTo: parseConvertedTo(row?.convertedToJson),
      convertedToJson: undefined,
      captureMetadataJson: undefined,
      attachmentsJson: undefined,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

// V4-NOTE-01: Capture connector — upload PDF/XLSX/TXT → extract text → create notebook page
router.post(
  '/notebook/upload',
  notebookUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;
    const nbCols = await getTableColumns('notebook_pages');
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'File required (PDF, XLSX, TXT, MD)' });

    let captureResult: { pageId: string };
    try {
      captureResult = await notebookService.capture(orgId, userId, {
        source: 'upload',
        fileBuffer: file.buffer,
        fileMimetype: file.mimetype,
        fileOriginalname: file.originalname,
      });
    } catch (e: any) {
      logger.warn('[MyWork] Notebook upload capture failed:', e?.message);
      return res.status(422).json({ error: 'File extraction failed', detail: e?.message });
    }

    const row = await queryHelpers.queryOne<any>(
      `SELECT ${buildLegacyNotebookSelect(nbCols, '')}
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [captureResult.pageId]
    );
    const parseCT = (r: any) =>
      r?.convertedToJson
        ? (() => {
            try {
              return JSON.parse(r.convertedToJson);
            } catch {
              return null;
            }
          })()
        : null;
    res.status(201).json({
      ...row,
      tags: parseTagsArray((row as any)?.tags),
      pinned: false,
      captureSource: row?.captureSource ?? null,
      captureMetadata: parseCaptureMetadata(row?.captureMetadataJson),
      attachments: parseAttachments(row?.attachmentsJson),
      convertedTo: parseCT(row),
      captureMetadataJson: undefined,
      attachmentsJson: undefined,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch (_) {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

/**
 * GET /api/my-work/notebook/pages/:id
 */
router.get(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;
    const nbCols = await getTableColumns('notebook_pages');

    const id = String(req.params.id || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `SELECT
        ${buildLegacyNotebookSelect(nbCols, '')}
       FROM notebook_pages
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!(await canAccessNotebookRow(userId, orgId, row)))
      return res.status(403).json({ error: 'Forbidden' });

    const parseConvertedTo = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };
    res.json({
      id: row.id,
      ownerUserId: row.ownerUserId ?? null,
      organizationId: row.organizationId ?? null,
      projectId: row.project_id || null,
      visibility: row.visibility,
      title: row.title,
      contentText: row.contentText,
      tags: parseTagsArray(row.tags),
      maturity: row.maturity || 'seed',
      icon: row.icon || null,
      summary: row.summary || null,
      status: row.status,
      pinned: Boolean(row.pinned),
      verificationStatus: row.verificationStatus ?? 'unverified',
      reviewCadence: row.reviewCadence ?? 'monthly',
      staleAt: row.staleAt ?? null,
      lastReviewedAt: row.lastReviewedAt ?? null,
      captureSource: row.captureSource ?? null,
      captureMetadata: parseCaptureMetadata(row.captureMetadataJson),
      attachments: parseAttachments(row.attachmentsJson),
      convertedTo: parseConvertedTo(row.convertedToJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

router.get(
  '/notebook/pages/:id/source-file',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `SELECT
        id,
        owner_user_id,
        organization_id,
        project_id,
        visibility,
        capture_source as "captureSource",
        capture_metadata as "captureMetadataJson"
       FROM notebook_pages
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!(await canAccessNotebookRow(userId, orgId, row)))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(row.captureSource || '').toLowerCase() !== 'upload') {
      return res.status(404).json({ error: 'Source file not found' });
    }

    const storedFile = await resolveStoredNotebookSourceFile(row.captureMetadataJson);
    if (!storedFile) {
      return res.status(404).json({ error: 'Source file not found' });
    }

    res.setHeader('Content-Type', storedFile.mimeType || 'application/octet-stream');
    return res.download(storedFile.filePath, storedFile.fileName);
  })
);

router.post(
  '/notebook/pages/:id/attachments',
  notebookAttachmentUpload.array('files', 10),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const files = ((req.files as Express.Multer.File[] | undefined) || []).filter(Boolean);
    if (files.length === 0) return res.status(400).json({ error: 'Files required' });

    const nbCols = await getTableColumns('notebook_pages');
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id${nbCols.has('attachments_json') ? ', attachments_json as "attachmentsJson"' : ''}
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    try {
      await addNotebookAttachmentsToPage({
        organizationId: orgId,
        pageId: id,
        files: files.map((file) => ({
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
        })),
        userId,
      });
    } catch (error) {
      return res
        .status(error instanceof NotebookAttachmentMutationError ? error.status : 400)
        .json({
          error: error instanceof Error ? error.message : 'Attachment upload failed',
          code:
            error instanceof NotebookAttachmentMutationError
              ? error.code
              : 'NOTEBOOK_ATTACHMENT_UPLOAD_FAILED',
        });
    }

    const row = await queryHelpers.queryOne<any>(
      `SELECT
        ${buildLegacyNotebookSelect(nbCols, '')}
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );

    const parseCT = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    return res.status(201).json({
      ...row,
      tags: parseTagsArray(row?.tags),
      pinned: Boolean(row?.pinned),
      verificationStatus: row?.verificationStatus ?? 'unverified',
      reviewCadence: row?.reviewCadence ?? 'monthly',
      staleAt: row?.staleAt ?? null,
      lastReviewedAt: row?.lastReviewedAt ?? null,
      captureSource: row?.captureSource ?? null,
      captureMetadata: parseCaptureMetadata(row?.captureMetadataJson),
      attachments: parseAttachments(row?.attachmentsJson),
      convertedTo: parseCT(row?.convertedToJson),
      convertedToJson: undefined,
      captureMetadataJson: undefined,
      attachmentsJson: undefined,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

router.get(
  '/notebook/pages/:id/attachments/:attachmentId/download',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;
    const nbCols = await getTableColumns('notebook_pages');

    const id = String(req.params.id || '').trim();
    const attachmentId = String(req.params.attachmentId || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, project_id, visibility${nbCols.has('attachments_json') ? ', attachments_json as "attachmentsJson"' : ''}
       FROM notebook_pages
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!(await canAccessNotebookRow(userId, orgId, row)))
      return res.status(403).json({ error: 'Forbidden' });

    const storedFile = await resolveNotebookAttachmentFile(row.attachmentsJson, attachmentId);
    if (!storedFile) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    res.setHeader('Content-Type', storedFile.mimeType || 'application/octet-stream');
    return res.download(storedFile.filePath, storedFile.fileName);
  })
);

router.delete(
  '/notebook/pages/:id/attachments/:attachmentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;
    const nbCols = await getTableColumns('notebook_pages');

    const id = String(req.params.id || '').trim();
    const attachmentId = String(req.params.attachmentId || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id${nbCols.has('attachments_json') ? ', attachments_json as "attachmentsJson"' : ''}
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    if (
      !parseNotebookAttachments(existing.attachmentsJson).some(
        (attachment) => attachment.id === attachmentId
      )
    ) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    try {
      await removeNotebookAttachmentFromPage({
        pageId: id,
        attachmentId,
      });
    } catch (error) {
      return res
        .status(error instanceof NotebookAttachmentMutationError ? error.status : 400)
        .json({
          error: error instanceof Error ? error.message : 'Attachment delete failed',
          code:
            error instanceof NotebookAttachmentMutationError
              ? error.code
              : 'NOTEBOOK_ATTACHMENT_DELETE_FAILED',
        });
    }

    const row = await queryHelpers.queryOne<any>(
      `SELECT ${buildLegacyNotebookSelect(nbCols, '')}
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    const parseCT = (raw: string | null) => {
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    return res.json({
      ...row,
      tags: parseTagsArray(row?.tags),
      pinned: Boolean(row?.pinned),
      verificationStatus: row?.verificationStatus ?? 'unverified',
      reviewCadence: row?.reviewCadence ?? 'monthly',
      staleAt: row?.staleAt ?? null,
      lastReviewedAt: row?.lastReviewedAt ?? null,
      captureSource: row?.captureSource ?? null,
      captureMetadata: parseCaptureMetadata(row?.captureMetadataJson),
      attachments: parseAttachments(row?.attachmentsJson),
      convertedTo: parseCT(row?.convertedToJson),
      convertedToJson: undefined,
      captureMetadataJson: undefined,
      attachmentsJson: undefined,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

/**
 * PUT /api/my-work/notebook/pages/:id
 * Owner-only updates.
 */
router.put(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;
    const nbCols = await getTableColumns('notebook_pages');

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, project_id, visibility, updated_at
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    /**
     * ★ M02-018 — OPTIMISTIC CONCURRENCY ON THE LEGACY PATH TOO.
     *
     * `/api/v8/my-work/notebook/pages/:id` has honoured `expectedUpdatedAt`
     * since MW-08; this handler did not read the field at all. That mattered
     * because it is not a dormant legacy route: the client falls back here
     * whenever V8 is off (`Api.shouldLockLegacyMyWorkNotebookMode`, which
     * treats 404/`V8_DISABLED` as "use legacy from now on"), i.e. exactly the
     * state a fresh or unflagged organization runs in. Reproduced against real
     * Postgres: two writers reading the same version both got HTTP 200 and the
     * second silently overwrote the first — the same page edited in two tabs
     * loses one side's work with no conflict, no warning, no trace.
     *
     * The guard has two halves and needs both (see the inline note below):
     * a comparison here for a STALE token, and an atomic conditional UPDATE at
     * the end of the handler for the RACE between this read and that write.
     * An unparseable token is rejected (400) rather than treated as "no version
     * supplied", which would let a garbage string bypass the guard entirely.
     *
     * Autosave that omits the field keeps its documented last-write-wins
     * behaviour, so this cannot break the happy path.
     */
    const expectedUpdatedAt =
      req.body?.expectedUpdatedAt !== undefined && req.body?.expectedUpdatedAt !== null
        ? String(req.body.expectedUpdatedAt)
        : null;
    // Two checks, two different failures — both are required.
    //
    //   (1) HERE: the caller's token vs the server's own read. Catches a STALE
    //       edit ("you were looking at an older version"). The conditional
    //       UPDATE below cannot catch this, because its predicate is built from
    //       `existing.updated_at` — the server's read — not from the client
    //       string, so a stale token would sail straight through it.
    //   (2) AT THE WRITE: the same predicate applied atomically. Catches the
    //       RACE that (1) structurally cannot see — two callers who both read
    //       the same version pass (1) together, and only one row can then match.
    if (expectedUpdatedAt) {
      const expected = new Date(expectedUpdatedAt).getTime();
      if (!Number.isFinite(expected)) {
        return res.status(400).json({
          error: 'expectedUpdatedAt must be a valid timestamp',
          code: 'INVALID_EXPECTED_UPDATED_AT',
        });
      }
      const current = existing.updated_at ? new Date(existing.updated_at).getTime() : NaN;
      if (Number.isFinite(current) && expected !== current) {
        const freshCols = await getTableColumns('notebook_pages');
        const fresh = await queryHelpers.queryOne<any>(
          `SELECT ${buildLegacyNotebookSelect(freshCols, '')}
           FROM notebook_pages WHERE id = ? LIMIT 1`,
          [id]
        );
        return res.status(409).json({
          error: 'Page was modified elsewhere',
          code: 'NOTEBOOK_PAGE_CONFLICT',
          data: fresh ?? null,
        });
      }
    }

    const setParts: string[] = [];
    const params: any[] = [];
    const set = (col: string, val: any) => {
      setParts.push(`${col} = ?`);
      params.push(val);
    };

    if (typeof req.body?.title === 'string')
      set('title', decodeHtmlEntities(String(req.body.title).trim()));
    if (req.body?.tags !== undefined)
      set('tags_json', JSON.stringify(parseTagsArray(req.body.tags)));
    if (req.body?.contentJson !== undefined)
      set(
        'content_json',
        safeJsonString(
          deepDecodeHtmlEntities(req.body.contentJson),
          JSON.stringify({ type: 'doc', content: [] })
        )
      );
    if (typeof req.body?.contentText === 'string')
      set('content_text', decodeHtmlEntities(req.body.contentText));
    if (typeof req.body?.maturity === 'string') set('maturity', req.body.maturity);
    if (typeof req.body?.icon === 'string') set('icon', req.body.icon);
    if (typeof req.body?.summary === 'string') set('summary', req.body.summary);
    if (
      typeof req.body?.status === 'string' &&
      ['inbox', 'active', 'converted', 'archived'].includes(req.body.status)
    )
      set('status', req.body.status);
    if (
      typeof req.body?.verificationStatus === 'string' &&
      ['unverified', 'verified', 'disputed'].includes(req.body.verificationStatus)
    )
      set('verification_status', req.body.verificationStatus);
    if (
      typeof req.body?.reviewCadence === 'string' &&
      ['weekly', 'monthly', 'quarterly', 'never'].includes(req.body.reviewCadence)
    )
      set('review_cadence', req.body.reviewCadence);
    if (req.body?.staleAt === null || (typeof req.body?.staleAt === 'string' && req.body.staleAt))
      set('stale_at', req.body.staleAt || null);
    if (req.body?.lastReviewedAt !== undefined)
      set('last_reviewed_at', req.body.lastReviewedAt || null);

    if (req.body?.projectId !== undefined) {
      const nextProjectId = req.body.projectId ? String(req.body.projectId) : null;
      set('project_id', nextProjectId);
      const nextVis = nextProjectId ? 'project' : 'private';
      set('visibility', nextVis);
    }
    if (req.body?.convertedTo !== undefined) {
      set(
        'converted_to_json',
        safeJsonString(Array.isArray(req.body.convertedTo) ? req.body.convertedTo : [], '[]')
      );
    }

    const selectNotebookFull = `
      SELECT ${buildLegacyNotebookSelect(nbCols, '')}
      FROM notebook_pages WHERE id = ? LIMIT 1`;

    const formatNotebookRow = (r: any) => {
      const parseCT = (raw: string | null) => {
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };
      return {
        ...r,
        tags: parseTagsArray(r?.tags),
        pinned: Boolean(r?.pinned),
        verificationStatus: r?.verificationStatus ?? 'unverified',
        reviewCadence: r?.reviewCadence ?? 'monthly',
        staleAt: r?.staleAt ?? null,
        lastReviewedAt: r?.lastReviewedAt ?? null,
        captureSource: r?.captureSource ?? null,
        captureMetadata: parseCaptureMetadata(r?.captureMetadataJson),
        attachments: parseAttachments(r?.attachmentsJson),
        convertedTo: parseCT(r?.convertedToJson),
        convertedToJson: undefined,
        captureMetadataJson: undefined,
        attachmentsJson: undefined,
        contentJson: (() => {
          try {
            return r?.contentJson ? JSON.parse(r.contentJson) : { type: 'doc', content: [] };
          } catch {
            return { type: 'doc', content: [] };
          }
        })(),
      };
    };

    if (setParts.length === 0) {
      const row = await queryHelpers.queryOne<any>(selectNotebookFull, [id]);
      return res.json(formatNotebookRow(row));
    }

    /**
     * ★ M02-018 — ATOMIC CONDITIONAL WRITE.
     *
     * The version the caller edited from is part of the WHERE clause, together
     * with the tenant and the owner, so the database — not the application —
     * decides who wins. Two writers holding the same `expectedUpdatedAt` race
     * to the same row: exactly one UPDATE matches, the other affects zero rows
     * and gets 409. An application-side comparison before the UPDATE cannot do
     * this: between the read and the write both callers still see the old
     * version and both proceed.
     *
     * Mirrors the V8 sibling (`server/src/routes/v8/my-work.routes.ts`),
     * including its two dialect traps:
     *   * `updated_at` is TIMESTAMP WITHOUT TIME ZONE and node-postgres parses
     *     it in the process timezone, so the value is rebound as the same naive
     *     local literal — binding a Date/ISO string shifts it by the offset;
     *   * Postgres compares with millisecond truncation, because the token the
     *     client echoes back has been through JSON and loses sub-millisecond
     *     precision, which would otherwise reject every first autosave.
     */
    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id, orgId, userId);

    const isPostgres =
      process.env.DB_TYPE === 'postgres' ||
      /^postgres(?:ql)?:/i.test(String(process.env.DATABASE_URL || ''));

    if (expectedUpdatedAt) {
      if (isPostgres && existing.updated_at instanceof Date) {
        const value = existing.updated_at as Date;
        const part = (n: number, width = 2) => String(n).padStart(width, '0');
        params.push(
          `${value.getFullYear()}-${part(value.getMonth() + 1)}-${part(value.getDate())} ` +
            `${part(value.getHours())}:${part(value.getMinutes())}:${part(value.getSeconds())}.` +
            part(value.getMilliseconds(), 3)
        );
      } else {
        params.push(expectedUpdatedAt);
      }
    }

    const versionPredicate = isPostgres
      ? "date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', CAST(? AS timestamp))"
      : 'updated_at = ?';

    const update = await queryHelpers.queryRun(
      `UPDATE notebook_pages SET ${setParts.join(', ')}
        WHERE id = ? AND organization_id = ? AND owner_user_id = ?${
          expectedUpdatedAt ? ` AND ${versionPredicate}` : ''
        }`,
      params
    );

    if (!update.changes) {
      // Ownership and tenancy were already verified against `existing`, so with
      // a version supplied a zero-row write means the version moved — someone
      // saved between this caller's read and this write. Hand back the fresh
      // state so the client can merge instead of guessing.
      if (expectedUpdatedAt) {
        const fresh = await queryHelpers.queryOne<any>(selectNotebookFull, [id]);
        return res.status(409).json({
          error: 'Page was modified elsewhere',
          code: 'NOTEBOOK_PAGE_CONFLICT',
          data: fresh ? formatNotebookRow(fresh) : null,
        });
      }
      // No version supplied (autosave keeps its documented last-write-wins
      // contract): zero rows can then only mean the row is gone or no longer
      // this owner's. Calling that a conflict would be a lie.
      return res.status(404).json({ error: 'Not found' });
    }

    const row = await queryHelpers.queryOne<any>(selectNotebookFull, [id]);
    res.json(formatNotebookRow(row));
    // Fire-and-forget AI enrichment (auto-tags + topic links)
    if (req.body?.contentText || req.body?.contentJson) {
      void enrichPage(id).catch(() => {});
    }
  })
);

/**
 * DELETE /api/my-work/notebook/pages/:id
 * Owner-only delete.
 */
router.delete(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    await queryHelpers.queryRun(`DELETE FROM notebook_pages WHERE id = ?`, [id]);
    res.status(204).send();
  })
);

/**
 * PUT /api/my-work/notebook/pages/:id/pin
 * Toggle pinned state.
 */
router.put(
  '/notebook/pages/:id/pin',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, coalesce(pinned, 0) as pinned FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    const newPinned = existing.pinned ? 0 : 1;
    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newPinned, id]
    );

    res.json({ id, pinned: Boolean(newPinned) });
  })
);

/**
 * PUT /api/my-work/notebook/pages/:id/status
 * Change note status (inbox/active/converted/archived).
 */
router.put(
  '/notebook/pages/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const status = String(req.body?.status || '')
      .trim()
      .toLowerCase();
    if (!['inbox', 'active', 'converted', 'archived'].includes(status)) {
      return res
        .status(400)
        .json({ error: 'Invalid status. Must be inbox|active|converted|archived' });
    }

    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    );

    res.json({ id, status });
  })
);

/**
 * POST /api/my-work/notebook/pages/:id/convert
 * Legacy endpoint — delegates to V8 notebookConversionService (single source of truth).
 */
router.post(
  '/notebook/pages/:id/convert',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const pageId = String(req.params.id || '').trim();
    const target = String(req.body?.target || '')
      .trim()
      .toLowerCase();
    if (
      !['task', 'decision', 'initiative', 'report', 'presentation', 'assessment'].includes(target)
    ) {
      return res
        .status(400)
        .json({ error: 'target must be task|decision|initiative|report|presentation|assessment' });
    }

    try {
      const { convertNotebookPage: v8Convert } =
        await import('../../services/notebookConversionService.js');
      const result = await v8Convert({
        pageId,
        orgId,
        userId,
        target: target as
          | 'task'
          | 'decision'
          | 'initiative'
          | 'report'
          | 'presentation'
          | 'assessment',
        title: typeof req.body?.title === 'string' ? req.body.title : undefined,
        description: typeof req.body?.description === 'string' ? req.body.description : undefined,
        assessmentType:
          typeof req.body?.assessmentType === 'string'
            ? (String(req.body.assessmentType).toUpperCase() as
                | 'DRD'
                | 'SIRI'
                | 'ADMA'
                | 'CMMI'
                | 'LEAN')
            : undefined,
      });
      return res.status(201).json(result);
    } catch (err: any) {
      const status = err?.status || 500;
      const code = err?.code || 'NOTEBOOK_CONVERT_FAILED';
      return res.status(status).json({ error: err?.message || 'Conversion failed', code });
    }
  })
);

/**
 * POST /api/my-work/notebook/pages/:id/extract-actions
 * AI-based action item extraction via SSE.
 */
router.post(
  '/notebook/pages/:id/extract-actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const pageId = String(req.params.id || '').trim();
    const page = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, title, content_text
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [pageId]
    );
    if (!page) return res.status(404).json({ error: 'Not found' });
    if (String(page.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(page.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    const noteContent = String(page.content_text || page.title || '').trim();
    if (!noteContent) return res.status(400).json({ error: 'Note has no content to analyze' });

    const language = String(req.body?.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    if (req.socket) {
      req.socket.setTimeout(120_000);
      req.socket.setNoDelay(true);
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emit = (type: string, data: any) => {
      try {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      } catch {}
    };

    emit('stage', {
      stage: 'extracting',
      label: isPl ? 'Analizuję notatkę...' : 'Analyzing note...',
    });

    try {
      const { llmService } = await import('../../services/ai/llmService.js');
      const modelRouter = (await import('../../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({
        capability: 'chat',
        organizationId: orgId,
        options: { tier: 'STANDARD' },
      });

      const prompt = isPl
        ? `Przeanalizuj poniższą notatkę i wyodrębnij konkretne akcje (action items) do wykonania.\n\nNotatka: "${noteContent.slice(0, 3000)}"\n\nDla każdej akcji podaj:\n- title: krótki tytuł\n- suggestedOwner: sugerowany właściciel (lub null)\n- suggestedDue: sugerowany termin jako opis (np. "do końca tygodnia") lub null\n- priority: high|medium|low\n\nOdpowiedz JSON array: [{"title":"...","suggestedOwner":null,"suggestedDue":null,"priority":"medium"}]\nTylko JSON, bez markdown.`
        : `Analyze the following note and extract concrete action items.\n\nNote: "${noteContent.slice(0, 3000)}"\n\nFor each action provide:\n- title: short task title\n- suggestedOwner: suggested owner (or null)\n- suggestedDue: suggested due description (e.g. "end of week") or null\n- priority: high|medium|low\n\nRespond as JSON array: [{"title":"...","suggestedOwner":null,"suggestedDue":null,"priority":"medium"}]\nOnly JSON, no markdown.`;

      const result = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl
          ? 'Jesteś asystentem do analizy notatek. Odpowiadasz tylko JSON.'
          : 'You are a note analysis assistant. You respond only with valid JSON.',
        messages: [{ role: 'user', content: prompt }],
      });

      let items: any[] = [];
      try {
        const raw = String((result as any)?.content || '[]');
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        items = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
      } catch {
        items = [];
      }

      emit('actions', { items });
      emit('done', { count: items.length });
      res.end();
    } catch (err: any) {
      logger.error('[NotebookExtractActions] Error:', err);
      emit('error', { message: err?.message || 'Extraction failed' });
      res.end();
    }
  })
);

/**
 * POST /api/my-work/notebook/pages/:id/suggest-topics
 * AI suggests topics worth analyzing for the note (company + tags context).
 */
router.post(
  '/notebook/pages/:id/suggest-topics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const pageId = String(req.params.id || '').trim();
    const page = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, title, content_text, tags_json
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [pageId]
    );
    if (!page) return res.status(404).json({ error: 'Not found' });
    if (String(page.organization_id || '') !== String(orgId))
      return res.status(403).json({ error: 'Forbidden' });
    if (String(page.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    const title = String(page.title || '').trim();
    const contentText = String(page.content_text || '')
      .trim()
      .slice(0, 2000);
    const tags = parseTagsArray(page.tags_json);
    const tagsStr = tags.join(', ');

    const excludedTopics: string[] = Array.isArray(req.body?.excludedTopics)
      ? req.body.excludedTopics
      : [];
    const language = String(req.body?.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    let topics: string[] = [];
    // L-06 parity with /classify: declare HOW topics were produced so no consumer
    // misrepresents the heuristic fallback as AI. 'ai' on the LLM path, 'heuristic'
    // when the model is unavailable and we fall back to keyword scaffolding.
    let method: 'ai' | 'heuristic' = 'ai';

    try {
      const { llmService } = await import('../../services/ai/llmService.js');
      const modelRouter = (await import('../../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({
        capability: 'chat',
        organizationId: orgId,
        options: { tier: 'STANDARD' },
      });

      const excludeHint =
        excludedTopics.length > 0
          ? isPl
            ? `\nNIE sugeruj tych tematów (już odrzucone): ${excludedTopics.join(', ')}`
            : `\nDo NOT suggest these (already dismissed): ${excludedTopics.join(', ')}`
          : '';

      const prompt = isPl
        ? `Jesteś asystentem strategicznym. Na podstawie notatki użytkownika (tytuł, treść, tagi) zaproponuj 3-5 tematów wartych przeanalizowania w kontekście firmy. Tematy powinny być konkretne, praktyczne i powiązane z przedmiotem notatki.

Notatka:
Tytuł: ${title}
Tagi: ${tagsStr}
Treść (fragment): ${contentText || '(brak)'}
${excludeHint}

Odpowiedz TYLKO jako JSON array stringów: ["temat 1", "temat 2", ...]
Bez markdown, bez numeracji, tylko tablica JSON.`
        : `You are a strategic assistant. Based on the user's note (title, content, tags) suggest 3-5 topics worth analyzing in a business context. Topics should be concrete, practical, and related to the note subject.

Note:
Title: ${title}
Tags: ${tagsStr}
Content (excerpt): ${contentText || '(none)'}
${excludeHint}

Respond ONLY as a JSON array of strings: ["topic 1", "topic 2", ...]
No markdown, no numbering, just a JSON array.`;

      const result = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl
          ? 'Odpowiadasz tylko poprawnym JSON array stringów.'
          : 'You respond only with a valid JSON array of strings.',
        messages: [{ role: 'user', content: prompt }],
      });

      try {
        const raw = String((result as any)?.content || '[]');
        const jsonMatch = raw.match(/\[[\s\S]*?\]/);
        topics = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
        if (!Array.isArray(topics)) topics = [];
        topics = topics
          .filter((t) => typeof t === 'string' && t.trim().length > 0)
          .map((t) => String(t).trim());
      } catch {
        topics = [];
      }
    } catch (err: any) {
      logger.error('[NotebookSuggestTopics] Error:', err);
      method = 'heuristic';
      const fallback: string[] = [];
      if (title) {
        const words = title.split(/\s+/).filter((w) => w.length > 2);
        if (words.length > 0) {
          fallback.push(isPl ? `Jak mierzyć ${words[0]}?` : `How to measure ${words[0]}?`);
          fallback.push(
            isPl
              ? `Ryzyka w ${words.slice(0, 2).join(' ')}`
              : `Risks in ${words.slice(0, 2).join(' ')}`
          );
        }
      }
      tags
        .filter((t) => !excludedTopics.includes(t))
        .slice(0, 3)
        .forEach((t) => {
          fallback.push(isPl ? `Szczegóły: ${t}` : `Details: ${t}`);
        });
      topics =
        fallback.length > 0
          ? fallback
          : isPl
            ? ['Przeanalizuj kontekst', 'Dodaj metryki', 'Benchmark']
            : ['Analyze context', 'Add metrics', 'Benchmark'];
    }

    res.json({ topics, method });
  })
);

/**
 * POST /api/my-work/notebook/pages/:id/classify
 * Heuristic classification — suggests conversion target for mature notes.
 */
router.post(
  '/notebook/pages/:id/classify',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    const pageId = String(req.params.id || '').trim();

    if (!(await requireTables(res, ['notebook_pages']))) return;

    // `maturity` may be absent on environments where the column was never provisioned.
    // Select it conditionally so the classify endpoint never 500s on schema drift.
    const hasMaturity = await hasColumn('notebook_pages', 'maturity');
    let page: any = null;
    try {
      page = await queryHelpers.queryOne<any>(
        `SELECT id, title, content_text${hasMaturity ? ', maturity' : ''}
         FROM notebook_pages
         WHERE id = ? AND owner_user_id = ? AND organization_id = ? LIMIT 1`,
        [pageId, userId, orgId]
      );
    } catch (err: any) {
      logger.error('[NotebookClassify] query failed:', err);
      return res.status(404).json({ error: 'Page not found' });
    }
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const text = String(page.content_text || page.title || '').toLowerCase();

    let suggestedType = 'none';
    let reason = '';

    const decisionKeywords = [
      'decide',
      'decision',
      'approve',
      'reject',
      'choose',
      'option',
      'alternative',
      'decyzja',
      'zdecydować',
      'opcja',
    ];
    const taskKeywords = [
      'todo',
      'action',
      'implement',
      'fix',
      'create',
      'build',
      'do',
      'task',
      'step',
      'zadanie',
      'zrobić',
      'naprawić',
    ];
    const ideaKeywords = [
      'idea',
      'concept',
      'what if',
      'imagine',
      'brainstorm',
      'explore',
      'pomysł',
      'koncept',
    ];

    const decisionScore = decisionKeywords.filter((k) => text.includes(k)).length;
    const taskScore = taskKeywords.filter((k) => text.includes(k)).length;
    const ideaScore = ideaKeywords.filter((k) => text.includes(k)).length;

    const actionItemCount = (
      text.match(/[-•]\s*(create|fix|update|send|review|check|build|implement|add|remove)/gi) || []
    ).length;
    if (actionItemCount >= 2) {
      suggestedType = 'tasks';
      reason = `Found ${actionItemCount} action items`;
    } else if (decisionScore > taskScore && decisionScore > ideaScore && decisionScore >= 2) {
      suggestedType = 'decision';
      reason = 'Contains decision-related language';
    } else if (taskScore > decisionScore && taskScore > ideaScore && taskScore >= 2) {
      suggestedType = 'task';
      reason = 'Contains task-oriented language';
    } else if (ideaScore >= 2) {
      suggestedType = 'idea';
      reason = 'Contains exploratory/idea language';
    }

    // L-06: this is keyword-scoring, NOT an LLM. Declare the method explicitly so
    // no consumer presents it as "AI" — the suggestion is rule-based, not generated.
    res.json({ pageId, suggestedType, reason, maturity: page.maturity, method: 'heuristic' });
  })
);

export default router;
