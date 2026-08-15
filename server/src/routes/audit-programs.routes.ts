/**
 * audit-programs.routes — CRUD for the Audit Orchestrator (owner flagged
 * direction ⭐⭐⭐, audit tasks #19 / #19d / #19e).
 *
 * An "audit program" is the orchestration record above individual interview
 * assignments: an objective + a set of templates + a set of assignees, optionally
 * seeded from a preset (e.g. ISO 27001). See auditProgramService.ts for the full
 * rationale and the honest MVP boundary (this layer persists the *definition*;
 * bulk survey generation is a documented next step).
 *
 * Mounted at /api/audit (see Gateway.ts), so the effective paths are:
 *   GET    /api/audit/programs        — list (newest first, org-scoped)
 *   POST   /api/audit/programs        — create
 *   GET    /api/audit/programs/:id     — read one
 *   PATCH  /api/audit/programs/:id     — update
 *   DELETE /api/audit/programs/:id     — delete
 *
 * Same auth/rbac middleware stack as interview.routes.ts + insightSourceBaskets.
 */

import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess, requireRole } from '../middleware/rbac.middleware.js';
import {
  type AuditProgramStatus,
  computeCompletion,
  createProgram,
  deleteProgram,
  generateSurveys,
  getProgram,
  listPrograms,
  updateProgram,
} from '../services/auditProgramService.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// Base beta policy: every organization member may read programs, while writes
// require a role that can coordinate audit work. This intentionally does not
// claim the fine-grained segregation-of-duties model of the Method kernel.
const requireAuditProgramManager = requireRole(
  'consultant',
  'manager',
  'admin',
  'owner',
  'superadmin'
);

// ---------------------------------------------------------------------------
// Auth context — mirror insightSourceBaskets.routes.ts.
// ---------------------------------------------------------------------------
function authContext(req: AuthRequest): { organizationId: string; userId: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (req as any).user || {};
  return {
    organizationId: String(req.organizationId || user.organizationId || user.organization_id || ''),
    userId: String(req.userId || user.id || user.userId || ''),
  };
}

// ---------------------------------------------------------------------------
// GET /programs — paginated list for org (newest first). Accepts ?limit&offset
// and returns { programs, total, limit, offset } (#19e).
// ---------------------------------------------------------------------------
router.get('/programs', async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  try {
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
    const offset = req.query.offset !== undefined ? Number(req.query.offset) : undefined;
    // L-02: server-side search/filter. Accept ?search (alias ?q) + ?status so the
    // hub filters the full org-scoped set instead of just the fetched page.
    const searchRaw = req.query.search ?? req.query.q;
    const search = searchRaw !== undefined ? String(searchRaw) : undefined;
    const status =
      req.query.status !== undefined
        ? (String(req.query.status) as AuditProgramStatus | 'all')
        : undefined;
    const result = await listPrograms(organizationId, { limit, offset, search, status });
    return res.json(result);
  } catch (error) {
    logger.error('[audit-programs] list failed', { error });
    return res.status(500).json({ error: 'Failed to list audit programs' });
  }
});

// ---------------------------------------------------------------------------
// POST /programs — create
// ---------------------------------------------------------------------------
router.post('/programs', requireAuditProgramManager, async (req: AuthRequest, res) => {
  const { organizationId, userId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (req.body || {}) as Record<string, any>;

  const name = String(body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Program name is required' });

  try {
    const program = await createProgram(organizationId, userId, {
      name,
      description: body.description ?? null,
      objective: body.objective ?? null,
      status: body.status,
      preset: body.preset ?? null,
      config: body.config && typeof body.config === 'object' ? body.config : {},
    });
    return res.status(201).json({ program });
  } catch (error) {
    logger.error('[audit-programs] create failed', { error });
    return res.status(500).json({ error: 'Failed to create audit program' });
  }
});

// ---------------------------------------------------------------------------
// GET /programs/:id — read one
// ---------------------------------------------------------------------------
router.get('/programs/:id', async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  try {
    const program = await getProgram(organizationId, req.params.id);
    if (!program) return res.status(404).json({ error: 'Audit program not found' });
    return res.json({ program });
  } catch (error) {
    logger.error('[audit-programs] read failed', { error });
    return res.status(500).json({ error: 'Failed to read audit program' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /programs/:id — update
// ---------------------------------------------------------------------------
router.patch('/programs/:id', requireAuditProgramManager, async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (req.body || {}) as Record<string, any>;

  if (body.name !== undefined && !String(body.name).trim()) {
    return res.status(400).json({ error: 'Program name cannot be empty' });
  }

  try {
    // SEC (mass-assignment) — `config` is free-form wizard state, but a few keys
    // on it are SERVER-MANAGED bookkeeping written only by generateSurveys():
    // `surveysGenerated` (the fan-out idempotency flag), `generatedAssignmentIds`
    // and `generation` (the completion-rollup denominator). A client PATCH must
    // not forge them — otherwise a caller could flip surveysGenerated=true to
    // permanently block their program's survey fan-out, or inflate completion %.
    // Strip them from the incoming body and re-seed from the existing row so the
    // wizard can still round-trip the rest of its config.
    let sanitizedConfig = body.config;
    if (body.config !== undefined && body.config && typeof body.config === 'object') {
      const existing = await getProgram(organizationId, req.params.id);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { surveysGenerated, generatedAssignmentIds, generation, ...clientConfig } =
        body.config as Record<string, unknown>;
      sanitizedConfig = {
        ...clientConfig,
        surveysGenerated: existing?.config.surveysGenerated,
        generatedAssignmentIds: existing?.config.generatedAssignmentIds,
        generation: existing?.config.generation,
      };
    }

    const program = await updateProgram(organizationId, req.params.id, {
      name: body.name,
      description: body.description,
      objective: body.objective,
      status: body.status,
      preset: body.preset,
      config: sanitizedConfig,
    });
    if (!program) return res.status(404).json({ error: 'Audit program not found' });
    return res.json({ program });
  } catch (error) {
    logger.error('[audit-programs] update failed', { error });
    return res.status(500).json({ error: 'Failed to update audit program' });
  }
});

// Reopen is explicit rather than a magic client PATCH. A closed/archived
// program returns to draft so a manager must deliberately review it before
// generating new assignments again.
router.post('/programs/:id/reopen', requireAuditProgramManager, async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  try {
    const existing = await getProgram(organizationId, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Audit program not found' });
    if (existing.status !== 'completed' && existing.status !== 'archived') {
      return res.status(409).json({ error: 'Only completed or archived programs can be reopened' });
    }
    const program = await updateProgram(organizationId, req.params.id, { status: 'draft' });
    return res.json({ program });
  } catch (error) {
    logger.error('[audit-programs] reopen failed', { error });
    return res.status(500).json({ error: 'Failed to reopen audit program' });
  }
});

// ---------------------------------------------------------------------------
// POST /programs/:id/generate-surveys — bulk-create interview assignments for
// every selected template × assignee, reusing the interview assignment service
// (#19). Idempotent: a program already generated returns alreadyGenerated:true.
// Robust to partial failures — reports created/failed counts + per-pair errors.
// ---------------------------------------------------------------------------
router.post(
  '/programs/:id/generate-surveys',
  requireAuditProgramManager,
  async (req: AuthRequest, res) => {
    const { organizationId, userId } = authContext(req);
    if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
    try {
      const result = await generateSurveys(organizationId, userId, req.params.id);
      if (!result) return res.status(404).json({ error: 'Audit program not found' });
      return res.json(result);
    } catch (error) {
      logger.error('[audit-programs] generate-surveys failed', { error });
      return res.status(500).json({ error: 'Failed to generate surveys' });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /programs/:id/completion — completion rollup over the program's generated
// assignments (#19e). Returns { generated, total, done, percent, byStatus }.
// ---------------------------------------------------------------------------
router.get('/programs/:id/completion', async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  try {
    const completion = await computeCompletion(organizationId, req.params.id);
    if (!completion) return res.status(404).json({ error: 'Audit program not found' });
    return res.json({ completion });
  } catch (error) {
    logger.error('[audit-programs] completion failed', { error });
    return res.status(500).json({ error: 'Failed to compute completion' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /programs/:id — delete
// ---------------------------------------------------------------------------
router.delete('/programs/:id', requireAuditProgramManager, async (req: AuthRequest, res) => {
  const { organizationId } = authContext(req);
  if (!organizationId) return res.status(400).json({ error: 'Missing organization context' });
  try {
    const deleted = await deleteProgram(organizationId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Audit program not found' });
    return res.json({ success: true });
  } catch (error) {
    logger.error('[audit-programs] delete failed', { error });
    return res.status(500).json({ error: 'Failed to delete audit program' });
  }
});

export default router;
