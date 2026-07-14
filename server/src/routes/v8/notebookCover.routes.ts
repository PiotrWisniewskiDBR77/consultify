/**
 * M04 Living Notebook — Cover image route (Agent 4 / Editor PRO).
 *
 * Exposes `PUT /pages/:id/cover` for setting or clearing a notebook page cover.
 * Mounted under the existing v8 notebook surface, i.e. the full path is:
 *
 *     PUT /api/v8/notebook/pages/:id/cover
 *
 * Body: { coverUrl: string | null }
 *   - non-empty string  → set cover (remote URL or data: URL from NoteCoverPicker)
 *   - null | ''         → clear cover
 *
 * Registration is centralised by the CTO/orchestrator (anti-clobber rule): this
 * module exports `registerNotebookCoverRoutes(router)` instead of mutating the
 * shared v8 route index. See the registration snippet in the agent report.
 *
 * Self-contained: it re-implements the small org/visibility access check rather
 * than importing the module-private helper from `my-work.routes.ts`.
 */

import type { Response, Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

/** Max stored cover size — data: URLs can be large; cap to keep rows sane (~6MB). */
const MAX_COVER_URL_LENGTH = 8_000_000;

interface NotebookAccessRow {
  organization_id?: string | null;
  visibility?: string | null;
  owner_user_id?: string | null;
  project_id?: string | null;
}

/** Replicates `canAccessNotebookRow` from my-work.routes.ts (kept private there). */
async function canAccessNotebookRow(
  userId: string,
  orgId: string,
  row: NotebookAccessRow | null
): Promise<boolean> {
  if (!row) return false;
  if (String(row.organization_id || '') !== String(orgId)) return false;

  const visibility = String(row.visibility || 'private').toLowerCase();
  const ownerId = String(row.owner_user_id || '');
  const projectId = row.project_id || null;

  if (visibility === 'private') {
    return ownerId === String(userId);
  }

  if (visibility === 'project' && projectId) {
    if (ownerId === String(userId)) return true;
    const member = await queryHelpers.queryOne<{ ok: number }>(
      `SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
      [projectId, userId]
    );
    return Boolean(member);
  }

  return ownerId === String(userId);
}

/** True when notebook_pages currently has a cover_url column (migration applied). */
async function hasCoverColumn(): Promise<boolean> {
  try {
    const cols = await getTableColumns('notebook_pages');
    for (const name of cols) {
      if (String(name).toLowerCase() === 'cover_url') return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Register `PUT /pages/:id/cover` on the supplied router. Call from the v8
 * notebook router so the path resolves to `/api/v8/notebook/pages/:id/cover`.
 */
export function registerNotebookCoverRoutes(router: Router): Router {
  // Read the current cover for a page. Separate from the main notebook list
  // endpoint (whose SELECT is an explicit allow-list we do not own), so the
  // cover round-trips across reload without touching my-work.routes.ts.
  router.get(
    '/pages/:id/cover',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId, userId } = getV8Context(req);
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res
          .status(400)
          .json({ error: 'Missing page id', code: 'NOTEBOOK_PAGE_ID_REQUIRED' });
      }
      if (!(await hasCoverColumn())) {
        // No column yet → treat as "no cover" rather than erroring.
        return res.json({ data: { id, coverUrl: null }, meta: { version: 'v8' as const } });
      }

      const row = await queryHelpers.queryOne<NotebookAccessRow & { cover_url?: string | null }>(
        `SELECT organization_id, visibility, owner_user_id, project_id, cover_url
           FROM notebook_pages
          WHERE id = ?
          LIMIT 1`,
        [id]
      );

      if (!row) {
        return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
      }
      if (!(await canAccessNotebookRow(userId, organizationId, row))) {
        return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
      }

      return res.json({
        data: { id, coverUrl: row.cover_url ?? null },
        meta: { version: 'v8' as const },
      });
    })
  );

  router.put(
    '/pages/:id/cover',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId, userId } = getV8Context(req);
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res
          .status(400)
          .json({ error: 'Missing page id', code: 'NOTEBOOK_PAGE_ID_REQUIRED' });
      }

      // Degrade gracefully if the migration has not run yet — never 500.
      if (!(await hasCoverColumn())) {
        return res.status(503).json({
          error: 'Cover storage not yet available',
          code: 'NOTEBOOK_COVER_NOT_READY',
        });
      }

      const rawCover = (req.body ?? {}).coverUrl;
      let coverUrl: string | null;
      if (rawCover == null || rawCover === '') {
        coverUrl = null;
      } else if (typeof rawCover === 'string') {
        if (rawCover.length > MAX_COVER_URL_LENGTH) {
          return res
            .status(400)
            .json({ error: 'Cover image too large', code: 'NOTEBOOK_COVER_TOO_LARGE' });
        }
        coverUrl = rawCover;
      } else {
        return res
          .status(400)
          .json({ error: 'coverUrl must be a string or null', code: 'NOTEBOOK_COVER_INVALID' });
      }

      const row = await queryHelpers.queryOne<NotebookAccessRow>(
        `SELECT organization_id, visibility, owner_user_id, project_id
           FROM notebook_pages
          WHERE id = ?
          LIMIT 1`,
        [id]
      );

      if (!row) {
        return res.status(404).json({ error: 'Not found', code: 'NOTEBOOK_PAGE_NOT_FOUND' });
      }
      if (!(await canAccessNotebookRow(userId, organizationId, row))) {
        return res.status(403).json({ error: 'Forbidden', code: 'NOTEBOOK_PAGE_FORBIDDEN' });
      }

      await queryHelpers.run(
        `UPDATE notebook_pages
            SET cover_url = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [coverUrl, id]
      );

      return res.json({
        data: { id, coverUrl },
        meta: { version: 'v8' as const },
      });
    })
  );

  return router;
}

export default registerNotebookCoverRoutes;
