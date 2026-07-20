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
    const requestedFramework = framework || (Array.isArray(frameworks) ? frameworks[0] : frameworks);
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

export default router;
