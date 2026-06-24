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
import {
  buildExecutionIntelligence,
  type IntelligenceInitiative,
} from '../services/executionIntelligenceService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';

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

// ================================================================
// M14 — Execution Intelligence (server-side fusion → cockpit UI-binding)
// ================================================================

/**
 * GET /:projectId/intelligence
 *
 * Org-scoped, DB-backed: gathers the project's initiatives + open BLOCKED task
 * counts + open RISK counts, then fuses EVM (SPI/CPI) + heuristic prediction +
 * grounded triage via the pure executionIntelligenceService. Returns the
 * forward-looking read the ExecutionHub cockpit binds to (predictions / triage /
 * summary). Read-only — no write-gate.
 */
router.get(
  '/:projectId/intelligence',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    const { projectId } = req.params;
    // Org-wide when no concrete project is selected (cockpit often runs org-scoped,
    // currentProjectId === null). Sentinel 'all'/'null' mirrors getInitiatives(undefined).
    const orgWide = !projectId || projectId === 'all' || projectId === 'null';
    const projFilter = orgWide ? '' : 'project_id = ? AND ';

    // SELECT * (not named columns) — the initiatives schema drifts across envs
    // (e.g. progress/actual_cost may be absent); the service reads fields defensively.
    const initiativesSql = `
      SELECT *
      FROM initiatives
      WHERE ${projFilter}organization_id = ?
    `;
    const initiatives =
      ((await queryHelpers.queryAll(
        initiativesSql,
        orgWide ? [orgId] : [projectId, orgId]
      )) as IntelligenceInitiative[] | undefined) || [];

    // Open BLOCKED task counts per initiative.
    const blockedSql = `
      SELECT initiative_id, COUNT(*) AS cnt
      FROM tasks
      WHERE ${projFilter}organization_id = ?
        AND UPPER(COALESCE(status, '')) = 'BLOCKED'
        AND initiative_id IS NOT NULL
      GROUP BY initiative_id
    `;
    const blockedRows =
      ((await queryHelpers.queryAll(
        blockedSql,
        orgWide ? [orgId] : [projectId, orgId]
      )) as Array<{ initiative_id: string; cnt: number | string }> | undefined) || [];

    // Open high-severity RISK counts per initiative (RAID risks, still open).
    const riskSql = `
      SELECT initiative_id, COUNT(*) AS cnt
      FROM raid_items
      WHERE organization_id = ?
        AND initiative_id IN (SELECT id FROM initiatives WHERE ${projFilter}organization_id = ?)
        AND UPPER(type) = 'RISK'
        AND UPPER(COALESCE(status, 'OPEN')) IN ('OPEN', 'IN_PROGRESS')
        AND initiative_id IS NOT NULL
      GROUP BY initiative_id
    `;
    const riskRows =
      ((await queryHelpers.queryAll(
        riskSql,
        orgWide ? [orgId, orgId] : [orgId, projectId, orgId]
      )) as Array<{ initiative_id: string; cnt: number | string }> | undefined) || [];

    const toCountMap = (
      rows: Array<{ initiative_id: string; cnt: number | string }>
    ): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const r of rows) {
        if (r.initiative_id != null) out[String(r.initiative_id)] = Number(r.cnt) || 0;
      }
      return out;
    };

    const result = buildExecutionIntelligence(
      {
        initiatives,
        blockedTaskCountByInitiative: toCountMap(blockedRows),
        openHighRiskCountByInitiative: toCountMap(riskRows),
      },
      Date.now()
    );

    return res.json(result);
  })
);

export default router;
