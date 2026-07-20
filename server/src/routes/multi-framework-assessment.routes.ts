/**
 * Multi-Framework Assessment Routes
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

// Real live schema (verified against Postgres, migrations 000_initdb_core_tables.sql +
// 042_multi_framework_assessment.sql backfill) has `name` (TEXT NOT NULL) and
// `framework` (single TEXT, CHECK-constrained) — NOT the `title` / `frameworks` (plural
// JSON array) columns this file previously used, which do not exist on the table and
// caused every request to fail with "column does not exist".
const ALLOWED_FRAMEWORKS = ['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'] as const;
// CHECK (status IN ('DRAFT','IN_PROGRESS','COMPLETED','ARCHIVED')) — uppercase only.
const DEFAULT_STATUS = 'DRAFT';

// `created_by` is a UUID column; the seeded/acceptance users have non-UUID ids
// (e.g. `odbior--user-0001`), which would blow up the INSERT with an invalid-uuid
// cast error. Populate it only when the caller id is a real UUID, else leave NULL.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v?: string): string | null => (v && UUID_RE.test(v) ? v : null);

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    res.json(
      (await dbAll(
        `SELECT id, name, framework, overall_score, status, created_at
    FROM multi_framework_assessments WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId]
      )) || []
    );
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Accept `name`/`framework` (real column names) but tolerate legacy
    // `title`/`frameworks` request bodies from older callers.
    const { name, title, framework, frameworks } = req.body;
    const resolvedName = name || title || 'MFA Assessment';
    const requestedFramework =
      framework || (Array.isArray(frameworks) ? frameworks[0] : frameworks);
    const resolvedFramework = ALLOWED_FRAMEWORKS.includes(requestedFramework)
      ? requestedFramework
      : 'DRD';
    const id = uuidv4();
    const result = await dbRun(
      `INSERT INTO multi_framework_assessments (id, organization_id, name, framework, status)
    VALUES (?, ?, ?, ?, ?)`,
      [id, req.user?.organizationId, resolvedName, resolvedFramework, DEFAULT_STATUS]
    );
    if (!result.success) {
      res.status(500).json({ error: 'Failed to create assessment', details: result.error });
      return;
    }
    res.status(201).json({ success: true, id });
  })
);

router.get(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessment = await dbAll(`SELECT * FROM multi_framework_assessments WHERE id = ?`, [
      req.params.id,
    ]);
    if (!assessment?.length) return res.status(404).json({ error: 'Not found' });
    res.json(assessment[0]);
  })
);

// ---------------------------------------------------------------------------
// CRUD endpoints consumed by the FE store (src/store/useMultiFrameworkStore.ts).
// These previously did not exist → every create/update/delete/duplicate 404'd.
// Contract is fixed by the FE caller; this is a 404 repair, not a new feature.
// ---------------------------------------------------------------------------

// Duplicate MUST be registered before the generic `/:projectId/:framework` POST,
// otherwise Express would match `/<id>/duplicate` as projectId=<id>,
// framework='duplicate' (an invalid framework → 400).
router.post(
  '/:id/duplicate',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const rows = await dbAll(
      `SELECT project_id, name, framework, data, category_scores, overall_score
       FROM multi_framework_assessments WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    if (!rows?.length) return res.status(404).json({ error: 'Not found' });
    const src = rows[0];

    const newId = uuidv4();
    const newName = req.body?.name || `${src.name} (Copy)`;
    const createdBy = uuidOrNull(req.user?.id);
    const result = await dbRun(
      `INSERT INTO multi_framework_assessments
         (id, project_id, organization_id, name, framework, status, data, category_scores, created_by, version)
       VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, 1)`,
      [
        newId,
        src.project_id,
        orgId,
        newName,
        src.framework,
        DEFAULT_STATUS,
        JSON.stringify(src.data ?? {}),
        JSON.stringify(src.category_scores ?? {}),
        createdBy,
      ]
    );
    if (!result.success) {
      res.status(500).json({ error: 'Failed to duplicate assessment', details: result.error });
      return;
    }
    res.status(201).json({ success: true, id: newId, framework: src.framework });
  })
);

// Create an assessment scoped to a project + framework (FE createAssessment()).
router.post(
  '/:projectId/:framework',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId, framework } = req.params;
    if (!ALLOWED_FRAMEWORKS.includes(framework as (typeof ALLOWED_FRAMEWORKS)[number])) {
      res.status(400).json({ error: `Invalid framework: ${framework}` });
      return;
    }
    const { name, data } = req.body || {};
    const id = uuidv4();
    const createdBy = uuidOrNull(req.user?.id);
    const result = await dbRun(
      `INSERT INTO multi_framework_assessments
         (id, project_id, organization_id, name, framework, status, data, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?)`,
      [
        id,
        projectId,
        req.user?.organizationId,
        name || 'MFA Assessment',
        framework,
        DEFAULT_STATUS,
        JSON.stringify(data ?? {}),
        createdBy,
      ]
    );
    if (!result.success) {
      res.status(500).json({ error: 'Failed to create assessment', details: result.error });
      return;
    }
    res.status(201).json({ success: true, id, framework });
  })
);

// Update assessment data/name; always bumps version. Org-scoped.
router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { data, name } = req.body || {};
    const result = await dbRun(
      `UPDATE multi_framework_assessments
         SET data = COALESCE(?::jsonb, data),
             name = COALESCE(?, name),
             version = COALESCE(version, 1) + 1,
             updated_at = now()
       WHERE id = ? AND organization_id = ?`,
      [data !== undefined ? JSON.stringify(data) : null, name ?? null, req.params.id, orgId]
    );
    if (!result.success) {
      res.status(500).json({ error: 'Failed to update assessment', details: result.error });
      return;
    }
    if (!result.changes) return res.status(404).json({ error: 'Not found' });

    const rows = await dbAll(
      `SELECT version, overall_score, updated_at
       FROM multi_framework_assessments WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    const row = rows?.[0] || {};
    res.json({
      success: true,
      version: row.version,
      overall_score: row.overall_score,
      updated_at: row.updated_at,
    });
  })
);

// Delete an assessment. Org-scoped.
router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const result = await dbRun(
      `DELETE FROM multi_framework_assessments WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    );
    if (!result.success) {
      res.status(500).json({ error: 'Failed to delete assessment', details: result.error });
      return;
    }
    if (!result.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  })
);

export default router;
