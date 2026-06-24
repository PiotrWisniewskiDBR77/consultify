/**
 * Execution Analytics Routes — M14 ExecutionHub (Execution) — F7/F8/F4.
 *
 * Read-only analytics surface that exposes the pure, DB-free execution
 * services as HTTP endpoints. Every handler simply validates auth (an org
 * member), reshapes the JSON body into the service inputs, and returns the
 * analysis. There is NO persistence here — the underlying services are pure
 * functions (deterministic, fully unit-tested in isolation), so these routes
 * need no write-gate and touch no database.
 *
 * Endpoints are POST because they accept input payloads to analyse (not
 * resources to fetch):
 *   - POST /predict              executionPredictionService.predictInitiative
 *   - POST /triage               executionTriageService.triageSignals + groupByInitiative
 *   - POST /dependencies/analyze raidDependencyService (cycles / topo / cascade / critical chain)
 *   - POST /capacity/analyze     capacityModelService (utilization / demand / heatmap / overloads)
 *
 * NOT mounted in Gateway.ts yet (wiring is a follow-up step).
 */
import { Response, Router } from 'express';

import { type AuthRequest, isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import {
  predictInitiative,
  type PredictionInputs,
} from '../services/executionPredictionService.js';
import {
  groupByInitiative,
  triageSignals,
  type Signal,
} from '../services/executionTriageService.js';
import {
  cascadeImpact,
  criticalDependencyChain,
  detectCycles,
  topoOrder,
  type DepEdge,
} from '../services/raidDependencyService.js';
import {
  capacityVsDemand,
  computeUtilization,
  overloadAlerts,
  resourceHeatmap,
  type ResourceAllocation,
  type ResourceCapacity,
} from '../services/capacityModelService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// All analytics routes require an authenticated org member. Read-only: no
// write-gate, no DB — the services are pure functions.
router.use(verifyToken, isAuthenticated);

/** Resolve the caller's org or reply 401. Returns null when unauthorized. */
const requireOrg = (req: AuthRequest, res: Response): string | null => {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return orgId;
};

// ================================================================
// F7 — Prediction (leading indicators)
// ================================================================

router.post(
  '/predict',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const inputs = (req.body ?? {}) as PredictionInputs;
    const result = predictInitiative(inputs);
    return res.json(result);
  })
);

// ================================================================
// F7 — Triage (grounded signal prioritization)
// ================================================================

router.post(
  '/triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const signals = Array.isArray(req.body?.signals) ? (req.body.signals as Signal[]) : [];
    const result = triageSignals(signals);
    // Surface the per-initiative grouping too (Map → plain object for JSON).
    const byInitiative = Object.fromEntries(groupByInitiative(signals));
    return res.json({ ...result, byInitiative });
  })
);

// ================================================================
// F8 — Dependency graph analytics
// ================================================================

router.post(
  '/dependencies/analyze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const edges = Array.isArray(req.body?.edges) ? (req.body.edges as DepEdge[]) : [];
    const delayedIds = Array.isArray(req.body?.delayedIds)
      ? (req.body.delayedIds as string[])
      : [];
    // durations arrives as a plain object { id: days }; the service wants a Map.
    const durationsObj =
      req.body?.durations && typeof req.body.durations === 'object'
        ? (req.body.durations as Record<string, number>)
        : {};
    const durations = new Map<string, number>(Object.entries(durationsObj));

    const cycles = detectCycles(edges);
    const topo = topoOrder(edges);
    const cascade = [...cascadeImpact(edges, delayedIds)];
    const criticalChain = criticalDependencyChain(edges, durations);

    return res.json({ cycles, topoOrder: topo, cascade, criticalChain });
  })
);

// ================================================================
// F4 — Capacity model
// ================================================================

router.post(
  '/capacity/analyze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const allocations = Array.isArray(req.body?.allocations)
      ? (req.body.allocations as ResourceAllocation[])
      : [];
    const capacities = Array.isArray(req.body?.capacities)
      ? (req.body.capacities as ResourceCapacity[])
      : [];
    const periods = Array.isArray(req.body?.periods) ? (req.body.periods as string[]) : [];

    const utilization = computeUtilization(allocations, capacities);
    const demand = capacityVsDemand(allocations, capacities);
    const heatmap = resourceHeatmap(allocations, capacities, periods);
    const overloads = overloadAlerts(utilization);

    return res.json({ utilization, demand, heatmap, overloads });
  })
);

export default router;
