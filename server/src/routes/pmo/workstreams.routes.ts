/**
 * Workstreams Routes (PMO)
 *
 * This file implements the workstreams API used by the PMO UI.
 * It intentionally provides both:
 * - Project-scoped endpoints: `/projects/:projectId/workstreams`
 * - Workstream-scoped endpoints: `/workstreams/:workstreamId/*`
 *
 * Mounted in `Gateway.ts` under `/api` root for legacy compatibility.
 */
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

type AuthReq = {
  user?: { id: string; organizationId: string; role?: string };
  can?: (capability: string) => boolean;
} & any;

const getOrgId = (req: AuthReq): string => String(req.user?.organizationId || '');

const WorkstreamCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  ownerId: z.string().optional(),
});

const WorkstreamPatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  sortOrder: z.number().int().optional(),
});

async function ensureWorkstreamsSchema(): Promise<void> {
  // Best-effort self-heal: some environments rely on migrations that may not be applied.
  // This keeps the API functional even when DB_MANAGED_SCHEMA is used without running `server/migrations`.
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS workstreams (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        color TEXT DEFAULT '#3B82F6',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_workstreams_project ON workstreams(project_id)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_workstreams_owner ON workstreams(owner_id)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_workstreams_status ON workstreams(status)`);
    await dbRun(
      `CREATE INDEX IF NOT EXISTS idx_initiatives_workstream ON initiatives(workstream_id)`
    );
  } catch (e: any) {
    // If schema can't be created (e.g. read-only DB), routes can still respond with graceful errors.
    logger.warn('[WorkstreamsRoutes] ensureWorkstreamsSchema failed:', e?.message || e);
  }
}

// All routes require auth.
//
// FIX (MAT-007/009, 2026-08-01): this guard was previously attached with a
// pathless `router.use(verifyToken)`. Because this router is mounted at the
// '/api' ROOT (see Gateway.ts: `app.use('/api', workstreamsRoutes)`, ahead of
// e.g. `/api/presentations`), a pathless .use() ran for EVERY /api/* request
// that reached this middleware layer and 401'd unauthenticated traffic to
// ANY route mounted after it — including the intentionally public
// `/api/presentations/shared/:token` viewer (see
// `createBetaGate(['/shared/', '/embed/'])` in Gateway.ts, which explicitly
// carves that path out of auth). This matches the exact bug class already
// fixed in transactionReadiness.routes.ts (2026-07-20) — the guard MUST stay
// scoped to this router's own two path segments only.
router.use('/projects/:projectId/workstreams', verifyToken);
router.use('/workstreams', verifyToken);

// -------------------------------
// Project-scoped endpoints
// -------------------------------

/**
 * GET /api/projects/:projectId/workstreams
 * List workstreams for a project with basic stats.
 */
router.get(
  '/projects/:projectId/workstreams',
  asyncHandler(async (req: AuthReq, res) => {
    await ensureWorkstreamsSchema();
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const project = await dbGet(`SELECT id FROM projects WHERE id = ? AND organization_id = ?`, [
      projectId,
      orgId,
    ]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const rows =
      (await dbAll(
        `
        SELECT
          w.*,
          COALESCE(u.first_name || ' ' || u.last_name, NULL) as owner_name,
          COUNT(i.id) as initiative_count,
          COALESCE(AVG(COALESCE(i.progress, 0)), 0) as avg_progress,
          SUM(CASE WHEN i.status IN ('DONE','COMPLETED') THEN 1 ELSE 0 END) as completed_count
        FROM workstreams w
        LEFT JOIN users u ON u.id = w.owner_id
        LEFT JOIN initiatives i ON i.workstream_id = w.id
        WHERE w.project_id = ?
        GROUP BY w.id, u.first_name, u.last_name
        ORDER BY w.sort_order ASC, w.created_at ASC
      `,
        [projectId]
      )) || [];

    const unassigned = await dbGet<{ c: number }>(
      `SELECT COUNT(*)::int as c FROM initiatives WHERE project_id = ? AND organization_id = ? AND (workstream_id IS NULL OR workstream_id = '')`,
      [projectId, orgId]
    );

    return res.json({
      workstreams: rows.map((r: any) => ({
        id: r.id,
        projectId: r.project_id,
        name: r.name,
        description: r.description,
        ownerId: r.owner_id,
        ownerName: r.owner_name,
        status: r.status,
        color: r.color,
        sortOrder: r.sort_order,
        progress: Math.round(Number(r.avg_progress || 0)),
        initiativeCount: Number(r.initiative_count || 0),
        completedCount: Number(r.completed_count || 0),
      })),
      unassignedInitiatives: unassigned?.c || 0,
    });
  })
);

/**
 * POST /api/projects/:projectId/workstreams
 * Create a workstream under a project.
 */
router.post(
  '/projects/:projectId/workstreams',
  validateBody(WorkstreamCreateSchema),
  asyncHandler(async (req: AuthReq, res) => {
    await ensureWorkstreamsSchema();
    const orgId = getOrgId(req);
    const userId = String(req.user?.id || '');
    const { projectId } = req.params;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    if (req.can && !req.can('manage_workstreams')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const project = await dbGet(`SELECT id FROM projects WHERE id = ? AND organization_id = ?`, [
      projectId,
      orgId,
    ]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const id = uuidv4();
    const now = new Date().toISOString();
    const { name, description, color, ownerId } = req.body;
    await dbRun(
      `
      INSERT INTO workstreams (id, project_id, name, description, owner_id, status, color, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, 0, ?, ?)
    `,
      [
        id,
        projectId,
        String(name),
        description || null,
        ownerId || null,
        color || '#3B82F6',
        now,
        now,
      ]
    );

    logger.info(`[WorkstreamsRoutes] Created workstream ${id} (project=${projectId}) by ${userId}`);
    return res.status(201).json({ id });
  })
);

// -------------------------------
// Workstream-scoped endpoints
// -------------------------------

/**
 * GET /api/workstreams/:workstreamId
 */
router.get(
  '/workstreams/:workstreamId',
  asyncHandler(async (req: AuthReq, res) => {
    await ensureWorkstreamsSchema();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const ws = await dbGet(
      `
      SELECT w.*, p.organization_id
      FROM workstreams w
      JOIN projects p ON p.id = w.project_id
      WHERE w.id = ?
    `,
      [req.params.workstreamId]
    );
    if (!ws || String((ws as any).organization_id) !== orgId) {
      return res.status(404).json({ error: 'Workstream not found' });
    }
    return res.json({ workstream: ws });
  })
);

/**
 * PATCH /api/workstreams/:workstreamId
 */
router.patch(
  '/workstreams/:workstreamId',
  validateBody(WorkstreamPatchSchema),
  asyncHandler(async (req: AuthReq, res) => {
    await ensureWorkstreamsSchema();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.can && !req.can('manage_workstreams')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const ws = await dbGet(
      `
      SELECT w.id, p.organization_id
      FROM workstreams w
      JOIN projects p ON p.id = w.project_id
      WHERE w.id = ?
    `,
      [req.params.workstreamId]
    );
    if (!ws || String((ws as any).organization_id) !== orgId) {
      return res.status(404).json({ error: 'Workstream not found' });
    }

    const patch = req.body || {};
    const updates: string[] = [];
    const params: any[] = [];
    if (patch.name !== undefined) {
      updates.push('name = ?');
      params.push(String(patch.name));
    }
    if (patch.description !== undefined) {
      updates.push('description = ?');
      params.push(patch.description || null);
    }
    if (patch.color !== undefined) {
      updates.push('color = ?');
      params.push(patch.color || null);
    }
    if (patch.ownerId !== undefined) {
      updates.push('owner_id = ?');
      params.push(patch.ownerId || null);
    }
    if (patch.status !== undefined) {
      updates.push('status = ?');
      params.push(patch.status);
    }
    if (patch.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      params.push(Number(patch.sortOrder));
    }
    if (updates.length === 0) return res.json({ success: true });
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(req.params.workstreamId);

    await dbRun(`UPDATE workstreams SET ${updates.join(', ')} WHERE id = ?`, params);
    return res.json({ success: true });
  })
);

/**
 * DELETE /api/workstreams/:workstreamId
 */
router.delete(
  '/workstreams/:workstreamId',
  asyncHandler(async (req: AuthReq, res) => {
    await ensureWorkstreamsSchema();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.can && !req.can('manage_workstreams')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const ws = await dbGet(
      `
      SELECT w.id, p.organization_id
      FROM workstreams w
      JOIN projects p ON p.id = w.project_id
      WHERE w.id = ?
    `,
      [req.params.workstreamId]
    );
    if (!ws || String((ws as any).organization_id) !== orgId) {
      return res.status(404).json({ error: 'Workstream not found' });
    }

    // Unassign initiatives first (keep initiatives)
    await dbRun(`UPDATE initiatives SET workstream_id = NULL WHERE workstream_id = ?`, [
      req.params.workstreamId,
    ]);
    await dbRun(`DELETE FROM workstreams WHERE id = ?`, [req.params.workstreamId]);
    return res.json({ success: true });
  })
);

/**
 * GET /api/workstreams/:workstreamId/progress
 * Used by `WorkstreamBoard` expanded view.
 */
router.get(
  '/workstreams/:workstreamId/progress',
  asyncHandler(async (req: AuthReq, res) => {
    await ensureWorkstreamsSchema();
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const ws = await dbGet(
      `
      SELECT w.*, p.organization_id
      FROM workstreams w
      JOIN projects p ON p.id = w.project_id
      WHERE w.id = ?
    `,
      [req.params.workstreamId]
    );
    if (!ws || String((ws as any).organization_id) !== orgId) {
      return res.status(404).json({ error: 'Workstream not found' });
    }

    const initiatives =
      (await dbAll(
        `
        SELECT id, COALESCE(title, name) as title, status, progress, planned_end_date, end_date
        FROM initiatives
        WHERE workstream_id = ?
        ORDER BY COALESCE(planned_end_date, end_date) ASC NULLS LAST, updated_at DESC
      `,
        [req.params.workstreamId]
      )) || [];

    const progressAvg =
      initiatives.length > 0
        ? Math.round(
            initiatives.reduce((s: number, i: any) => s + Number(i.progress || 0), 0) /
              initiatives.length
          )
        : 0;
    const completed = initiatives.filter((i: any) =>
      ['DONE', 'COMPLETED'].includes(String(i.status))
    ).length;

    return res.json({
      workstream: {
        id: (ws as any).id,
        name: (ws as any).name,
        status: (ws as any).status,
      },
      initiatives: {
        items: initiatives,
        count: initiatives.length,
        completed,
        progressAvg,
      },
    });
  })
);

export default router;
