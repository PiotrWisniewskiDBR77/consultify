/**
 * M04 Living Notebook — Daily "Today" cockpit HTTP surface.
 *
 * Registered onto the v8 `/notebook` sub-router via {@link registerNotebookTodayRoutes},
 * so the effective path is:
 *   GET /api/v8/notebook/today — daily aggregate for the signed-in owner
 *
 * Response shape:
 *   { data: { pinned, recent, toReview, freshCaptures } }
 * each an array of lightweight page summaries (id, title, icon, status,
 * pinned, captureSource, verificationStatus, updatedAt), capped at ~8 rows.
 *
 * Org + owner scope follows the existing v8/notebook.routes.ts &
 * notebookTopics.routes.ts pattern (getV8Context + per-row org/owner SQL).
 * Columns are probed defensively because notebook_pages picks up optional
 * columns (status/pinned/capture_source/verification_status) via lazy DDL.
 *
 * Owned by AGENT 2. CTO wires registration centrally (see report).
 */

import type { Response, Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as queryHelpers from '../../utils/queryHelpers.js';

const SECTION_LIMIT = 8;

export interface NotebookTodayPage {
  id: string;
  title: string;
  icon: string | null;
  status: string;
  pinned: boolean;
  captureSource: string | null;
  verificationStatus: string;
  updatedAt: string | null;
}

/** Map a raw notebook_pages row to the lightweight Today summary shape. */
function toTodayPage(row: any): NotebookTodayPage {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    icon: row.icon ?? null,
    status: String(row.status ?? 'active'),
    pinned: Boolean(Number(row.pinned ?? 0)),
    captureSource: row.capture_source ?? null,
    verificationStatus: String(row.verification_status ?? 'unverified'),
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * Discover which optional columns exist so the SELECT degrades on schemas
 * where lazy DDL has not yet added them (mirrors notebook.routes.ts).
 */
async function probeColumns(): Promise<Set<string>> {
  try {
    const cols = await queryHelpers.queryAll<any>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'notebook_pages'`,
      []
    );
    return new Set((cols || []).map((c: any) => String(c.column_name)));
  } catch {
    return new Set<string>();
  }
}

export function registerNotebookTodayRoutes(router: Router): Router {
  // ── Daily "Today" cockpit aggregate ─────────────────────────────────────────
  router.get(
    '/today',
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const { organizationId, userId } = getV8Context(req);

      const cols = await probeColumns();
      const has = (c: string) => cols.size === 0 || cols.has(c);
      const sel = (c: string, fallback: string) => (has(c) ? c : `${fallback} AS ${c}`);

      // Defensive projection — only reference optional columns that exist.
      const projection = [
        'id',
        'title',
        has('icon') ? 'icon' : 'NULL AS icon',
        sel('status', "'active'"),
        sel('pinned', '0'),
        has('capture_source') ? 'capture_source' : 'NULL AS capture_source',
        sel('verification_status', "'unverified'"),
        'updated_at',
      ].join(', ');

      const scope = 'organization_id = ? AND owner_user_id = ?';
      const baseParams = [organizationId, userId];

      // 1) Pinned — owner's pinned notes, most-recently-touched first.
      const pinnedWhere = has('pinned') ? `${scope} AND pinned = 1` : `${scope} AND 1 = 0`;

      // 4) Fresh captures — pages that entered via a capture source.
      const captureWhere = has('capture_source')
        ? `${scope} AND capture_source IS NOT NULL AND capture_source <> ''`
        : `${scope} AND 1 = 0`;

      // 3) To review (Stale) — disputed verification OR active notes untouched
      //    for a while. Falls back gracefully when columns are absent.
      const staleClauses: string[] = [];
      if (has('verification_status')) {
        staleClauses.push("lower(coalesce(verification_status, '')) = 'disputed'");
      }
      if (has('status')) {
        staleClauses.push(
          "(lower(coalesce(status, 'active')) = 'active' AND updated_at < (now() - interval '14 days'))"
        );
      }
      const toReviewWhere = staleClauses.length
        ? `${scope} AND (${staleClauses.join(' OR ')})`
        : `${scope} AND 1 = 0`;

      const safeQuery = async (where: string): Promise<NotebookTodayPage[]> => {
        try {
          const rows = await queryHelpers.queryAll<any>(
            `SELECT ${projection}
               FROM notebook_pages
              WHERE ${where}
              ORDER BY updated_at DESC
              LIMIT ${SECTION_LIMIT}`,
            baseParams
          );
          return (rows || []).map(toTodayPage);
        } catch {
          // Never 500 the cockpit — a missing section degrades to empty.
          return [];
        }
      };

      const [pinned, recent, toReview, freshCaptures] = await Promise.all([
        safeQuery(pinnedWhere),
        safeQuery(scope), // 2) Recent — most-recently-updated, any status.
        safeQuery(toReviewWhere),
        safeQuery(captureWhere),
      ]);

      return res.json({ data: { pinned, recent, toReview, freshCaptures } });
    })
  );

  return router;
}

export default registerNotebookTodayRoutes;
