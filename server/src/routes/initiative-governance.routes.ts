/**
 * Initiative Governance Routes
 * V4-INIT-04, V4-INIT-06, V4-INIT-07
 */

import { type Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { initiativeGovernanceService } from '../services/initiativeGovernanceService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyToken);

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = req.user?.id || req.userId;
  const orgId = req.user?.organizationId || req.organizationId;
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { userId, orgId };
};

/**
 * RES-10: explicit owner marker on every goals response. `goals` /
 * `goal_initiative_links` are Initiatives-owned — distinct from Results'
 * `kpi_scorecards` (kpiScorecardService). Never mix the two contracts.
 */
export const INITIATIVE_GOALS_OWNER_DOMAIN = 'initiatives' as const;

// ── INIT-04: Goals/OKR ──

router.post(
  '/goals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      parentGoalId: z.string().optional(),
      goalType: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      ownerId: z.string().optional(),
      timeFrame: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      targetValue: z.number().optional(),
      unit: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.status(201).json({
      ...(await initiativeGovernanceService.createGoal(id.orgId, p.data)),
      ownerDomain: INITIATIVE_GOALS_OWNER_DOMAIN,
    });
  })
);

router.get(
  '/goals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const parentGoalId = req.query.parentGoalId as string | undefined;
    res.json({
      goals: await initiativeGovernanceService.getGoals(id.orgId, parentGoalId),
      ownerDomain: INITIATIVE_GOALS_OWNER_DOMAIN,
    });
  })
);

router.get(
  '/goals/:goalId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const g = await initiativeGovernanceService.getGoal(id.orgId, req.params.goalId);
    if (!g) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    res.json({ ...g, ownerDomain: INITIATIVE_GOALS_OWNER_DOMAIN });
  })
);

router.put(
  '/goals/:goalId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    // INPUT VALIDATION: previously req.body was passed raw. The service already
    // whitelists + parameterizes columns (no injection), but validate the shape
    // for parity with the other governance writes.
    const s = z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      progress: z.number().optional(),
      currentValue: z.number().optional(),
      ownerId: z.string().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const updated = await initiativeGovernanceService.updateGoal(id.orgId, req.params.goalId, p.data);
    res.json({ ...updated, ownerDomain: INITIATIVE_GOALS_OWNER_DOMAIN });
  })
);

router.get(
  '/goals/:goalId/rollup',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    // TENANT FAIL-CLOSED (RES-10): a goal outside the caller's org resolves to null in
    // the service before any rollup read; surface it as 404 with no payload, mirroring
    // `GET /goals/:goalId` above. Do NOT let the service throw here — the global error
    // handler classifies on `err.statusCode`, so this module's `{ status: 404 }` throws
    // would surface as 500.
    const rollup = await initiativeGovernanceService.getGoalRollup(id.orgId, req.params.goalId);
    if (!rollup) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    res.json({ ...rollup, ownerDomain: INITIATIVE_GOALS_OWNER_DOMAIN });
  })
);

router.post(
  '/goals/:goalId/initiatives',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ initiativeId: z.string(), contributionWeight: z.number().optional() });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const linked = await initiativeGovernanceService.linkGoalToInitiative(
      id.orgId,
      req.params.goalId,
      p.data.initiativeId,
      p.data.contributionWeight
    );
    res.status(201).json({ ...linked, ownerDomain: INITIATIVE_GOALS_OWNER_DOMAIN });
  })
);

router.get(
  '/goals/:goalId/initiatives',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({
      initiatives: await initiativeGovernanceService.getGoalInitiatives(
        id.orgId,
        req.params.goalId
      ),
      ownerDomain: INITIATIVE_GOALS_OWNER_DOMAIN,
    });
  })
);

router.delete(
  '/goals/:goalId/initiatives/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const unlinked = await initiativeGovernanceService.unlinkGoalFromInitiative(
      id.orgId,
      req.params.goalId,
      req.params.initiativeId
    );
    res.json({ ...unlinked, ownerDomain: INITIATIVE_GOALS_OWNER_DOMAIN });
  })
);

// ── INIT-06: AI Blueprints ──

router.post(
  '/blueprints',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      initiativeId: z.string().optional(),
      promptText: z.string().optional(),
      generatedWbs: z.array(z.record(z.string(), z.unknown())).optional(),
      generatedMilestones: z.array(z.record(z.string(), z.unknown())).optional(),
      generatedDeps: z.array(z.record(z.string(), z.unknown())).optional(),
      generatedResources: z.array(z.record(z.string(), z.unknown())).optional(),
      citations: z.array(z.string()).optional(),
      aiModelUsed: z.string().optional(),
      confidence: z.number().optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res.status(201).json(
      await initiativeGovernanceService.createBlueprint(id.orgId, {
        ...p.data,
        createdBy: id.userId,
      })
    );
  })
);

router.get(
  '/blueprints',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const initiativeId = req.query.initiativeId as string | undefined;
    res.json({
      blueprints: await initiativeGovernanceService.getBlueprints(id.orgId, initiativeId),
    });
  })
);

router.post(
  '/blueprints/:blueprintId/apply',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const result = await initiativeGovernanceService.applyBlueprint(
      id.orgId,
      req.params.blueprintId,
      id.userId
    );
    if (!result.ok && result.reason === 'not_found') {
      res.status(404).json({ error: 'Blueprint not found' });
      return;
    }
    if (!result.ok && result.reason === 'initiative_missing') {
      res.status(409).json({ error: 'Blueprint is missing initiative context' });
      return;
    }
    res.json(result);
  })
);

router.post(
  '/blueprints/:blueprintId/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const result = await initiativeGovernanceService.rejectBlueprint(
      id.orgId,
      req.params.blueprintId
    );
    if (!result.ok) {
      res.status(404).json({ error: 'Blueprint not found' });
      return;
    }
    res.json(result);
  })
);

// ── INIT-07: Governance Gates ──

router.post(
  '/initiatives/:initiativeId/gates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({
      gateType: z.string().optional(),
      gateName: z.string(),
      requiredDecisions: z.array(z.string()).optional(),
      requiredRaidStatus: z.record(z.string(), z.unknown()).optional(),
      requiredApprovers: z.array(z.string()).optional(),
    });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    try {
      res.status(201).json(
        await initiativeGovernanceService.createGovernanceGate(id.orgId, {
          ...p.data,
          initiativeId: req.params.initiativeId,
        })
      );
    } catch (err: any) {
      const status = err?.status || 400;
      res.status(status).json({ error: err?.message || 'Failed to create gate' });
    }
  })
);

router.get(
  '/initiatives/:initiativeId/gates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({
      gates: await initiativeGovernanceService.getGovernanceGates(
        id.orgId,
        req.params.initiativeId
      ),
    });
  })
);

router.post(
  '/gates/:gateId/evaluate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const r = await initiativeGovernanceService.evaluateGate(id.orgId, req.params.gateId);
    if (!r) {
      res.status(404).json({ error: 'Gate not found' });
      return;
    }
    res.json(r);
  })
);

router.post(
  '/initiatives/:initiativeId/decisions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    const s = z.object({ decisionId: z.string(), linkType: z.string().optional() });
    const p = s.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    res
      .status(201)
      .json(
        await initiativeGovernanceService.linkDecisionToInitiative(
          id.orgId,
          req.params.initiativeId,
          p.data.decisionId,
          p.data.linkType
        )
      );
  })
);

router.get(
  '/initiatives/:initiativeId/decisions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = requireUser(req, res);
    if (!id) return;
    res.json({
      decisions: await initiativeGovernanceService.getInitiativeDecisions(
        id.orgId,
        req.params.initiativeId
      ),
    });
  })
);

export default router;
