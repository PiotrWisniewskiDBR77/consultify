/**
 * Stage Gate Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all stage gate-related business logic
 */

import type { Response } from 'express';

import _StageGateService, {
  evaluateGate,
  GATE_TYPES,
  getGateType,
  passGate,
  PHASE_ORDER,
} from '../services/stageGateService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as DbPromise from '../utils/DbPromise.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type { PassGateRequest } from '../validators/stageGate.validators.js';

// ==========================================
// TENANT ISOLATION (fix/inbox-failopen-stagegates-20260828, commit 2)
// ==========================================
//
// Every handler below used to resolve `projectId` from the URL with zero
// check that the project belongs to the CALLER's own organization — the
// mount (`Gateway.ts`) only applies a rate limiter + `verifyToken`, and
// `stageGateService.ts` never references `organization_id` at all (grep
// confirmed 0 hits). Live probe: a user in org A (lowest role) could
// `GET /api/stage-gates/proj-victim-b/evaluate/READINESS_GATE` and get back
// the full evaluation of a project belonging to org B; an org-A admin could
// `POST /pass/READINESS_GATE` on it — `req.can('manage_stage_gates')` only
// checks the capability against the CALLER's own organizationId, it never
// resolves which org the target project actually belongs to, so the
// permission check passed despite the project being someone else's.
//
// The fix: resolve `projectId` as `WHERE id = ? AND organization_id = ?`
// with the SERVER-derived `req.user.organizationId` (never a client-supplied
// value) BEFORE any evaluation or write happens, in every handler. A project
// belonging to a different org is indistinguishable from a project that
// doesn't exist — 404, not 403 — so this endpoint can't be used to probe
// which project IDs exist in other tenants either. The role/capability check
// stays, but runs AFTER this ownership check, as defense-in-depth — not as a
// replacement for it.
async function resolveOwnedProject(projectId: string, organizationId: string): Promise<boolean> {
  const row = await queryHelpers.queryOne<{ id: string }>(
    `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
    [projectId, organizationId]
  );
  return !!row;
}

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class StageGateController {
  /**
   * Evaluate gate readiness
   */
  static evaluateGate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId, gateType } = req.params;

      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!(await resolveOwnedProject(projectId, organizationId))) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const result = await evaluateGate(
        projectId,
        gateType as (typeof GATE_TYPES)[keyof typeof GATE_TYPES]
      );

      res.json(result);
    }
  );

  /**
   * Get current gate for project
   */
  static getCurrentGate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;

      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!(await resolveOwnedProject(projectId, organizationId))) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const project = await DbPromise.get<{ current_phase?: string }>(
        `SELECT current_phase FROM projects WHERE id = ?`,
        [projectId]
      );

      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const currentPhase = project.current_phase || 'Context';
      const phaseIndex = PHASE_ORDER.indexOf(currentPhase as (typeof PHASE_ORDER)[number]);

      if (phaseIndex >= PHASE_ORDER.length - 1) {
        res.json({
          currentPhase,
          nextGate: null,
          message: 'Project is in final phase',
        });
        return;
      }

      const nextPhase = PHASE_ORDER[phaseIndex + 1];
      const gateType = getGateType(currentPhase, nextPhase);

      if (!gateType) {
        res.json({ currentPhase, nextGate: null });
        return;
      }

      const evaluation = await evaluateGate(projectId, gateType);

      res.json({
        currentPhase,
        nextPhase,
        ...evaluation,
        gateType: gateType as any,
      });
    }
  );

  /**
   * Pass gate
   */
  static passGate = asyncHandler(
    async (req: AuthenticatedRequest<PassGateRequest>, res: Response): Promise<void> => {
      const { projectId, gateType } = req.params;
      const { notes } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Tenant ownership MUST be established before the role/capability
      // check below — `req.can()` only evaluates the CALLER's own
      // organizationId, so checking it first (as this used to) would grant
      // 403 vs "allowed" purely based on the caller's own role, never
      // noticing the target project belongs to a different org entirely.
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!(await resolveOwnedProject(projectId, organizationId))) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      // Check permission
      if (!req.can || !req.can('manage_stage_gates')) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      // First evaluate
      const evaluation = await evaluateGate(
        projectId,
        gateType as (typeof GATE_TYPES)[keyof typeof GATE_TYPES]
      );

      if (evaluation.status !== 'READY') {
        res.status(400).json({
          error: 'Gate not ready',
          missingElements: evaluation.missingElements,
        });
        return;
      }

      // Pass the gate. Forward the actor role so the service can fail-closed on
      // pilot-restricted (USER/GUEST) callers — defense-in-depth behind the
      // `manage_stage_gates` capability check above.
      const result = await passGate(
        projectId,
        gateType as (typeof GATE_TYPES)[keyof typeof GATE_TYPES],
        userId,
        notes,
        (req as any).userRole ?? req.user?.role ?? null
      );

      res.json(result);
    }
  );

  /**
   * Get gate history for project
   */
  static getGateHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.params;

      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!(await resolveOwnedProject(projectId, organizationId))) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const gates = await queryHelpers.queryAll(
        `SELECT * FROM stage_gates WHERE project_id = ? ORDER BY approved_at DESC`,
        [projectId]
      );

      res.json(gates);
    }
  );
}

export default StageGateController;
