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
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import {
  type AuditProgramStatus,
  computeCompletion,
  createProgram,
  deleteProgram,
  generateSurveys,
  getProgram,
  isLegacyProgramWriteEnabled,
  listPrograms,
  updateProgram,
} from '../services/auditProgramService.js';
import logger from '../utils/Logger.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// ---------------------------------------------------------------------------
// AUD-MVP-OWNER-001 — legacy CRUD-write retirement.
//
// `audit_programs` had two independent writer families hitting the same live
// table: this router's create/update/delete (createProgram/updateProgram/
// deleteProgram in auditProgramService.ts) and the Audits kernel
// (server/src/routes/audits/programs.routes.ts + services/audits/
// programService.ts, mounted at /api/audits/programs). The kernel is now the
// canonical writer for NEW/changed program identity. This router's ENTIRE
// write surface — the CRUD trio (POST /programs, PATCH /programs/:id,
// DELETE /programs/:id) AND generate-surveys's bookkeeping UPDATE
// (POST /programs/:id/generate-surveys, which calls updateProgram() to
// persist config.surveysGenerated/generatedAssignmentIds/generation) — is
// retired to a fixed, machine-checkable refusal before the request ever
// touches the DB. The task's acceptance bar is a writer inventory of exactly
// 1; leaving generate-surveys's UPDATE reachable would have kept this
// service as a second writer of the canonical table, and there is no
// legitimate way to reach that UPDATE anymore once create/update/delete all
// refuse (no legacy-created program can exist to fan out). Reads
// (GET /programs, GET /programs/:id, GET /programs/:id/completion) keep
// working so the default-ON legacy AuditsHub list view is unaffected.
//
// Governed by auditProgramService.isLegacyProgramWriteEnabled()
// (AUDIT_PROGRAM_LEGACY_WRITES_ENABLED env var, default OFF = disabled =
// SAFE). This is a reversible kill-switch, not a deletion: flipping the env
// var back to 'true' restores the pre-retirement behavior without a code
// revert, in case the kernel path turns out not to be ready somewhere.
// ---------------------------------------------------------------------------
const LEGACY_WRITE_DISABLED_BODY = {
  error:
    'Legacy audit-program writes are retired. The Audits kernel ' +
    '(/api/audits/programs) is now the canonical writer for audit_programs; ' +
    'this endpoint is read-only.',
  code: 'AUDIT_PROGRAM_LEGACY_WRITE_DISABLED',
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sendLegacyWriteDisabled(res: any): void {
  res.status(410).json(LEGACY_WRITE_DISABLED_BODY);
}

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
router.post('/programs', async (req: AuthRequest, res) => {
  if (!isLegacyProgramWriteEnabled()) return sendLegacyWriteDisabled(res);
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
router.patch('/programs/:id', async (req: AuthRequest, res) => {
  if (!isLegacyProgramWriteEnabled()) return sendLegacyWriteDisabled(res);
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

// ---------------------------------------------------------------------------
// POST /programs/:id/generate-surveys — bulk-create interview assignments for
// every selected template × assignee, reusing the interview assignment service
// (#19). Idempotent: a program already generated returns alreadyGenerated:true.
// Robust to partial failures — reports created/failed counts + per-pair errors.
//
// AUD-MVP-OWNER-001 (lead decision, 2026-08-16): initially left unblocked as
// a "bookkeeping-only" exception (it never creates a new program identity),
// but the task's acceptance bar is a writer inventory of exactly 1 — leaving
// this UPDATE reachable kept the legacy service writing the canonical table,
// so the inventory was 2. It is also incoherent to keep one legacy write path
// open on a resource whose create/update/delete already refuse: nothing can
// legitimately reach a state where fan-out should run through the legacy
// service anymore. Gated behind the same flag/response shape as the CRUD
// trio; reversible the same way (AUDIT_PROGRAM_LEGACY_WRITES_ENABLED=true).
// ---------------------------------------------------------------------------
router.post('/programs/:id/generate-surveys', async (req: AuthRequest, res) => {
  if (!isLegacyProgramWriteEnabled()) return sendLegacyWriteDisabled(res);
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
});

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
router.delete('/programs/:id', async (req: AuthRequest, res) => {
  if (!isLegacyProgramWriteEnabled()) return sendLegacyWriteDisabled(res);
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
