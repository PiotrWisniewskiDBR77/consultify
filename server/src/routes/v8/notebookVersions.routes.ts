/**
 * M04 Living Notebook — Agent 5: version-history HTTP surface.
 * Mounted at `/api/v8/notebook` (alongside notebook.routes.ts) by v8/index.
 *
 * Endpoints (org-scoped, owner-or-org access via the page row):
 *   GET  /pages/:id/versions               — list snapshots (newest first)
 *   POST /pages/:id/versions               — snapshot the current page content
 *   POST /pages/:id/versions/:vid/restore  — write a version back onto the page
 *                                            (snapshots current state first)
 *
 * Persistence: `notebook_page_versions` (see 20260620_4000_notebook_versions.ts).
 * Degrades to 503 if the versions table is absent, rather than throwing 500.
 */

import type { Response, Router as RouterType } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

/** Stable contract id for clients parsing version-history responses. */
export const NOTEBOOK_VERSIONS_CONTRACT = 'notebook_versions_v1';

const MAX_LIMIT = 100;

interface NotebookPageRow {
  id: string;
  owner_user_id?: string;
  organization_id?: string;
  visibility?: string;
  project_id?: string | null;
  title?: string;
  content_json?: string;
  content_text?: string | null;
}

const safeJson = (v: unknown): string => {
  if (typeof v === 'string') {
    try {
      JSON.parse(v);
      return v;
    } catch {
      return JSON.stringify({ raw: v });
    }
  }
  try {
    return JSON.stringify(v ?? {});
  } catch {
    return '{}';
  }
};

const parseMaybeJson = (raw: unknown): unknown => {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }
  return {};
};

/** True if the requester may read/mutate the page (owner, or org-project member by row). */
async function canAccessPage(
  row: NotebookPageRow | null,
  orgId: string,
  userId: string
): Promise<boolean> {
  if (!row) return false;
  if (String(row.organization_id ?? '') !== String(orgId)) return false;
  if (String(row.owner_user_id ?? '') === String(userId)) return true;
  const vis = String(row.visibility || 'private').toLowerCase();
  const projectId = row.project_id ? String(row.project_id) : null;
  if (vis !== 'project' || !projectId) return false;
  const pm = await queryHelpers.queryOne<{ ok: number }>(
    `SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
    [projectId, userId]
  );
  return Boolean((pm as any)?.ok);
}

async function loadPage(pageId: string): Promise<NotebookPageRow | null> {
  return queryHelpers.queryOne<NotebookPageRow>(
    `SELECT id, owner_user_id, organization_id, visibility, project_id, title, content_json, content_text
       FROM notebook_pages WHERE id = ? LIMIT 1`,
    [pageId]
  );
}

async function versionsTableReady(res: Response): Promise<boolean> {
  try {
    const cols = await getTableColumns('notebook_page_versions');
    if (cols && cols.size > 0) return true;
  } catch {
    // fall through to degraded response
  }
  res.status(503).json({
    error: 'Version history is not available yet (migration pending).',
    code: 'NOTEBOOK_VERSIONS_UNAVAILABLE',
    meta: { version: 'v8', contract: NOTEBOOK_VERSIONS_CONTRACT },
  });
  return false;
}

/** Write a snapshot row from a page; returns the created version id. */
async function insertSnapshot(
  page: NotebookPageRow,
  orgId: string,
  userId: string
): Promise<string> {
  const id = uuidv4();
  await queryHelpers.queryRun(
    `INSERT INTO notebook_page_versions
       (id, page_id, organization_id, title, content_json, content_text, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      page.id,
      orgId,
      String(page.title || ''),
      safeJson(page.content_json ?? '{}'),
      page.content_text ?? null,
      userId,
    ]
  );
  return id;
}

function mapVersionRow(row: any) {
  return {
    id: String(row.id),
    pageId: String(row.page_id),
    title: row.title == null ? '' : String(row.title),
    contentJson: parseMaybeJson(row.content_json),
    contentText: row.content_text == null ? null : String(row.content_text),
    createdAt: row.created_at ?? null,
    createdBy: row.created_by == null ? null : String(row.created_by),
  };
}

/**
 * Register version-history routes on the supplied router.
 * The router is mounted under `/api/v8/notebook` by v8/index.
 */
export function registerNotebookVersionsRoutes(router: RouterType): RouterType {
  // ── List versions ──────────────────────────────────────────────────────────
  router.get(
    '/pages/:id/versions',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId, userId } = getV8Context(req);
      const pageId = String(req.params.id || '').trim();
      if (!pageId) {
        res.status(400).json({ error: 'page id is required' });
        return;
      }
      if (!(await versionsTableReady(res))) return;

      const page = await loadPage(pageId);
      if (!(await canAccessPage(page, organizationId, userId))) {
        res.status(404).json({ error: 'Notebook page not found' });
        return;
      }

      const limit = Math.max(1, Math.min(MAX_LIMIT, Number(req.query.limit) || 50));
      const rows =
        (await queryHelpers.queryAll<any>(
          `SELECT id, page_id, title, content_json, content_text, created_at, created_by
             FROM notebook_page_versions
            WHERE page_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?`,
          [pageId, limit]
        )) || [];

      res.json({
        data: rows.map(mapVersionRow),
        meta: { version: 'v8', contract: NOTEBOOK_VERSIONS_CONTRACT, count: rows.length },
      });
    })
  );

  // ── Create snapshot of current content ──────────────────────────────────────
  router.post(
    '/pages/:id/versions',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId, userId } = getV8Context(req);
      const pageId = String(req.params.id || '').trim();
      if (!pageId) {
        res.status(400).json({ error: 'page id is required' });
        return;
      }
      if (!(await versionsTableReady(res))) return;

      const page = await loadPage(pageId);
      if (!(await canAccessPage(page, organizationId, userId))) {
        res.status(404).json({ error: 'Notebook page not found' });
        return;
      }

      // Allow the client to snapshot in-flight (unsaved) content by passing a body;
      // otherwise snapshot what's currently persisted on the page.
      const body = (req.body || {}) as {
        contentJson?: unknown;
        contentText?: unknown;
        title?: unknown;
      };
      const snapshotPage: NotebookPageRow = {
        ...(page as NotebookPageRow),
        title: body.title != null ? String(body.title) : page!.title,
        content_json: body.contentJson != null ? safeJson(body.contentJson) : page!.content_json,
        content_text:
          body.contentText != null ? String(body.contentText) : (page!.content_text ?? null),
      };

      const versionId = await insertSnapshot(snapshotPage, organizationId, userId);
      res.status(201).json({
        data: { id: versionId, pageId },
        meta: { version: 'v8', contract: NOTEBOOK_VERSIONS_CONTRACT },
      });
    })
  );

  // ── Restore a prior version onto the page ───────────────────────────────────
  router.post(
    '/pages/:id/versions/:vid/restore',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId, userId } = getV8Context(req);
      const pageId = String(req.params.id || '').trim();
      const versionId = String(req.params.vid || '').trim();
      if (!pageId || !versionId) {
        res.status(400).json({ error: 'page id and version id are required' });
        return;
      }
      if (!(await versionsTableReady(res))) return;

      const page = await loadPage(pageId);
      if (!(await canAccessPage(page, organizationId, userId))) {
        res.status(404).json({ error: 'Notebook page not found' });
        return;
      }

      const version = await queryHelpers.queryOne<any>(
        `SELECT id, page_id, title, content_json, content_text
           FROM notebook_page_versions WHERE id = ? AND page_id = ? LIMIT 1`,
        [versionId, pageId]
      );
      if (!version) {
        res.status(404).json({ error: 'Version not found' });
        return;
      }

      // Snapshot the current state first, so restore is itself reversible.
      const backupId = await insertSnapshot(page as NotebookPageRow, organizationId, userId);

      const cols = await getTableColumns('notebook_pages');
      const hasUpdatedAt = cols?.has?.('updated_at');
      await queryHelpers.queryRun(
        `UPDATE notebook_pages
            SET title = ?, content_json = ?, content_text = ?${hasUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : ''}
          WHERE id = ?`,
        [
          String(version.title || ''),
          safeJson(version.content_json ?? '{}'),
          version.content_text ?? null,
          pageId,
        ]
      );

      res.json({
        data: {
          pageId,
          restoredFrom: versionId,
          backupVersionId: backupId,
          title: String(version.title || ''),
          contentJson: parseMaybeJson(version.content_json),
          contentText: version.content_text == null ? null : String(version.content_text),
        },
        meta: { version: 'v8', contract: NOTEBOOK_VERSIONS_CONTRACT },
      });
    })
  );

  return router;
}

const router = Router();
registerNotebookVersionsRoutes(router);

export default router;
