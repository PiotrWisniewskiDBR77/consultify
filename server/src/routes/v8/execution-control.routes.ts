/**
 * V8 execution control bridge — org-scoped reads plus bounded operator mutations
 * for dismiss, detect, timeline update, and budget entry creation.
 * Namespace: /api/v8/execution-control (mounted by v8/index).
 *
 * Delegates to the same services and persistence paths as legacy `/api/execution-control`.
 *
 * @module routes/v8/execution-control.routes
 */

import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  detectDelaySignals,
  getPersistedDelaySignals,
  persistDelaySignals,
} from '../../services/delayDetectionService.js';
import {
  createBudgetEntry,
  detectOverspendSignals,
  getInitiativeBudgetSummary,
  getPortfolioBudgetSummary,
} from '../../services/executionBudgetService.js';
import { getTimelineWarningsSnapshot } from '../../services/executionControlReadService.js';
import {
  BaselineNotApprovedError,
  BaselineVersionConflictError,
  RealizationKeyConflictError,
  recordExecutionRealization,
  recordExecutionRealizationForBaseline,
} from '../../services/executionRealizationService.js';
import { detectRiskSignals } from '../../services/riskDetectionService.js';
import {
  applyManagerSuggestion,
  executeManagerProblemAction,
} from '../../services/v8/managerActionExecutionService.js';
import {
  getExecutionControlTowerItemDetail,
  getExecutionControlTowerQueues,
  V8_EXECUTION_CONTROL_TOWER_CONTRACT,
} from '../../services/v8ExecutionControlTowerService.js';
import { getCapacityTimeline, getOverloadAlerts } from '../../services/workloadCapacityService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();

/** Stable contract id for V8 execution-control read responses. */
export const V8_EXECUTION_CONTROL_READ_CONTRACT = 'execution_control_read_v1';
export const V8_EXECUTION_CONTROL_MUTATION_CONTRACT = 'execution_control_mutation_v1';
export { V8_EXECUTION_CONTROL_TOWER_CONTRACT };

function executionControlMeta() {
  return { version: 'v8' as const, contract: V8_EXECUTION_CONTROL_READ_CONTRACT };
}

function executionControlMutationMeta() {
  return { version: 'v8' as const, contract: V8_EXECUTION_CONTROL_MUTATION_CONTRACT };
}

function executionControlTowerMeta() {
  return { version: 'v8' as const, contract: V8_EXECUTION_CONTROL_TOWER_CONTRACT };
}

const CONTROL_TOWER_QUEUES = new Set(['late', 'at_risk', 'blocked', 'overloaded', 'stale', 'all']);

const firstQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

const DismissAlertSchema = z.object({
  signalId: z.string().min(1),
});

// ★ INI-005 follow-up fix (2026-08-01): `field` used to be a Zod enum that
// INCLUDED 'status', with `value: z.string()` completely unconstrained — i.e.
// `{field:'status', value:'EXECUTING'}` was a legal request that did a raw
// `UPDATE initiatives SET status = ?` with NO transition validation, NO row
// lock, NO GO/NO-GO decision check, NO audit-history row. Unlike the sibling
// `executionControl.routes.ts` variant (admin-only), THIS route is guarded
// only by `requireV8OrgContext` (org-membership) — no role check at all — so
// it was reachable by any authenticated org member. This endpoint's real
// purpose is timeline/date fields (see the allow-list below, same set used
// by the `smooth`/`replan` siblings) — status changes belong exclusively to
// the canonical transition endpoints (PATCH /:id/status, /approve,
// /start-execution, /unblock). This is a lock-down, not a redesign: 'status'
// is removed from what this endpoint will write, full stop; it is NOT routed
// through the transition engine from here.
const TIMELINE_UPDATABLE_FIELDS = [
  'planned_start_date',
  'planned_end_date',
  'start_date',
  'actual_end_date',
  'progress',
] as const;

const TimelineUpdateSchema = z.object({
  initiativeId: z.string().min(1),
  // Intentionally z.string() (not z.enum) here — the allow-list is enforced
  // explicitly in the handler below so a `field:'status'` request gets a
  // clear, pointed 400 instead of a generic Zod "invalid enum value" error.
  field: z.string().min(1),
  value: z.string(),
  reason: z.string().optional(),
});

const DismissDelaySchema = z.object({
  signalId: z.string().min(1),
  entityType: z.enum(['INITIATIVE', 'TASK']),
  entityId: z.string().min(1),
  deviationType: z.string().min(1),
});

const DetectDelaySchema = z.object({
  projectId: z.string().nullable().optional(),
});

const CreateBudgetEntrySchema = z.object({
  initiativeId: z.string().min(1),
  entryType: z.enum(['ACTUAL', 'FORECAST', 'ADJUSTMENT']),
  costType: z.enum(['CAPEX', 'OPEX']),
  category: z.string().optional(),
  amount: z.number(),
  currency: z.string().optional(),
  description: z.string().optional(),
  periodMonth: z.number().min(1).max(12).optional(),
  periodYear: z.number().optional(),
  source: z.string().optional(),
});

// M14 → M15 feed-forward: record a HUMAN-ENTERED realized benefit value from the
// Execution context into `roi_realized_values` (the table Results M15 reads via
// getROIPortfolioSummary). At least one realized delta must be supplied so we never
// persist an empty/auto-fabricated entry.
const RecordRealizationSchema = z
  .object({
    initiativeId: z.string().min(1),
    // ISO date string for the realization period (first day of the period).
    periodMonth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'periodMonth must be an ISO date (YYYY-MM-DD)'),
    realizedRevenueDelta: z.number().finite().nullable().optional(),
    realizedCostDelta: z.number().finite().nullable().optional(),
    realizedSavings: z.number().finite().nullable().optional(),
    varianceNotes: z.string().max(2000).optional(),
  })
  .refine(
    (b) =>
      typeof b.realizedRevenueDelta === 'number' ||
      typeof b.realizedCostDelta === 'number' ||
      typeof b.realizedSavings === 'number',
    {
      message:
        'Provide at least one realized value (realizedRevenueDelta, realizedCostDelta, or realizedSavings)',
      path: ['realizedRevenueDelta'],
    }
  );

// FIN-007: keyed, baseline-bound realization write — a SECOND entrypoint
// into the SAME roi_realized_values table above, never a second ledger.
// Requires the Idempotency-Key header AND a baseline reference so the actual
// can later be reconciled against the EXACT approved Finance baseline the
// caller saw when recording it (see executionRealizationService.ts,
// recordExecutionRealizationForBaseline, for the full contract).
const RecordBaselineRealizationSchema = z
  .object({
    initiativeId: z.string().min(1),
    periodMonth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'periodMonth must be an ISO date (YYYY-MM-DD)'),
    realizedRevenueDelta: z.number().finite().nullable().optional(),
    realizedCostDelta: z.number().finite().nullable().optional(),
    realizedSavings: z.number().finite().nullable().optional(),
    varianceNotes: z.string().max(2000).optional(),
    baselineModelId: z.string().min(1),
    baselineExpectedVersion: z.number().int().min(1),
    evidenceRef: z.string().max(2000).optional(),
  })
  .refine(
    (b) =>
      typeof b.realizedRevenueDelta === 'number' ||
      typeof b.realizedCostDelta === 'number' ||
      typeof b.realizedSavings === 'number',
    {
      message:
        'Provide at least one realized value (realizedRevenueDelta, realizedCostDelta, or realizedSavings)',
      path: ['realizedRevenueDelta'],
    }
  );

const MitigationUpdateSchema = z.object({
  raidItemId: z.string().min(1),
  mitigationPlan: z.string().optional(),
  responseStrategy: z.enum(['AVOID', 'TRANSFER', 'MITIGATE', 'ACCEPT', 'ESCALATE']).optional(),
  mitigationOwnerId: z.string().optional(),
  mitigationDueDate: z.string().optional(),
  mitigationStatus: z.enum(['OPEN', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'CLOSED']).optional(),
});

/**
 * GET /api/v8/execution-control/risk-signals
 * Heuristic risk signals for the V8 org (optional project filter).
 */
router.get(
  '/risk-signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const signals = await detectRiskSignals(organizationId, projectId);
    return res.json({
      data: { signals, count: signals.length },
      meta: executionControlMeta(),
    });
  })
);

router.post(
  '/risk-signals/dismiss',
  validateBody(DismissAlertSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { signalId } = req.body;

    // L-03: signalId is free-form user input and risk_signal_alert ids are
    // deterministic (e.g. `overdue-<initiativeId>`), so a tampered request could
    // target another org's alert id. The conflict target is (id) only, so without
    // an org guard the DO UPDATE would dismiss a cross-org row. Guarding the
    // UPDATE with the existing row's organization_id turns a cross-org collision
    // into a no-op (the INSERT still supplies this org's id for the create path).
    await dbRun(
      `INSERT INTO risk_signal_alerts (id, organization_id, signal_type, severity, title, is_dismissed, dismissed_by, dismissed_at)
       VALUES (?, ?, 'DISMISSED', 'LOW', ?, TRUE, ?, NOW())
       ON CONFLICT (id) DO UPDATE SET is_dismissed = TRUE, dismissed_by = ?, dismissed_at = NOW()
         WHERE risk_signal_alerts.organization_id = ?`,
      [signalId, organizationId, `Dismissed: ${signalId}`, userId, userId, organizationId]
    );

    return res.json({
      data: { success: true, signalId },
      meta: executionControlMutationMeta(),
    });
  })
);

router.patch(
  '/raid/:id/mitigation',
  validateBody(MitigationUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const {
      mitigationPlan,
      responseStrategy,
      mitigationOwnerId,
      mitigationDueDate,
      mitigationStatus,
    } = req.body;

    // Same-org integrity (defense-in-depth): mirror the sibling intervention
    // handlers — verify the RAID item exists in the caller's org before the
    // org-scoped UPDATE. Without this, a bad/foreign id silently 200s as a 0-row
    // no-op instead of surfacing 404.
    const existingRaid = await dbGet<{ id: string }>(
      `SELECT id FROM raid_items WHERE id = ? AND organization_id = ?`,
      [String(req.params.id), organizationId],
      { fallback: true }
    );
    if (!existingRaid?.id) {
      return res
        .status(404)
        .json({ error: 'RAID item not found', code: 'EXECUTION_RAID_NOT_FOUND' });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (mitigationPlan !== undefined) {
      updates.push('mitigation_plan = ?');
      params.push(mitigationPlan);
    }
    if (responseStrategy !== undefined) {
      updates.push('response_strategy = ?');
      params.push(responseStrategy);
    }
    if (mitigationOwnerId !== undefined) {
      updates.push('mitigation_owner_id = ?');
      params.push(mitigationOwnerId);
    }
    if (mitigationDueDate !== undefined) {
      updates.push('mitigation_due_date = ?');
      params.push(mitigationDueDate);
    }
    if (mitigationStatus !== undefined) {
      updates.push('mitigation_status = ?');
      params.push(mitigationStatus);
    }

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ error: 'No fields to update', code: 'EXECUTION_MITIGATION_EMPTY_PATCH' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id, organizationId);

    await dbRun(
      `UPDATE raid_items SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );

    return res.json({
      data: { success: true, raidItemId: String(req.params.id) },
      meta: executionControlMutationMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/control-tower/queues
 * Canonical five-queue read model (P03-B) with drill-down fields on each item.
 */
router.get(
  '/control-tower/queues',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const queueRaw = firstQueryString(req.query.queue);
    const queue =
      queueRaw && CONTROL_TOWER_QUEUES.has(queueRaw)
        ? (queueRaw as 'late' | 'at_risk' | 'blocked' | 'overloaded' | 'stale' | 'all')
        : 'all';
    const windowRaw = firstQueryString(req.query.overloadWindow);
    const overloadWindow = (
      windowRaw && ['day', 'week', 'month'].includes(windowRaw) ? windowRaw : 'week'
    ) as 'day' | 'week' | 'month';

    const payload = await getExecutionControlTowerQueues(organizationId, {
      projectId,
      queue,
      overloadWindow,
    });
    return res.json({
      data: payload,
      meta: executionControlTowerMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/control-tower/items/:entityType/:entityId
 * Drill-down envelope merged across all queues the entity appears in.
 */
router.get(
  '/control-tower/items/:entityType/:entityId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const entityType = String(req.params.entityType || '').toUpperCase();
    if (entityType !== 'INITIATIVE' && entityType !== 'TASK') {
      return res.status(400).json({
        error: 'entityType must be INITIATIVE or TASK',
        code: 'EXECUTION_CONTROL_TOWER_BAD_ENTITY',
      });
    }
    const entityId = String(req.params.entityId || '');
    if (!entityId) {
      return res.status(400).json({
        error: 'entityId required',
        code: 'EXECUTION_CONTROL_TOWER_BAD_ENTITY',
      });
    }

    const detail = await getExecutionControlTowerItemDetail(
      organizationId,
      entityType as 'INITIATIVE' | 'TASK',
      entityId,
      projectId
    );
    if (!detail) {
      return res.status(404).json({
        error: 'Entity not present in control tower queues',
        code: 'EXECUTION_CONTROL_TOWER_ITEM_NOT_FOUND',
      });
    }

    return res.json({
      data: detail,
      meta: executionControlTowerMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/timeline-warnings
 * Top overdue/blocked initiative warnings (legacy-compatible computation).
 */
router.get(
  '/timeline-warnings',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const { warnings, total } = await getTimelineWarningsSnapshot(organizationId, projectId);
    return res.json({
      data: { warnings, total },
      meta: executionControlMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/delay-signals
 * Live or persisted delay signals (`persisted=true` for stored rows).
 */
router.get(
  '/delay-signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const severity = firstQueryString(req.query.severity) as 'WARNING' | 'CRITICAL' | undefined;
    const entityType = firstQueryString(req.query.entityType) as 'INITIATIVE' | 'TASK' | undefined;
    const persisted = firstQueryString(req.query.persisted) === 'true';

    if (persisted) {
      const signals = await getPersistedDelaySignals(organizationId, {
        projectId,
        severity,
        entityType,
      });
      return res.json({
        data: { signals, count: signals.length, source: 'persisted' as const },
        meta: executionControlMeta(),
      });
    }

    const signals = await detectDelaySignals(organizationId, projectId);
    const filtered = signals.filter((s) => {
      if (severity && s.severity !== severity) return false;
      if (entityType && s.entityType !== entityType) return false;
      return true;
    });
    return res.json({
      data: { signals: filtered, count: filtered.length, source: 'live' as const },
      meta: executionControlMeta(),
    });
  })
);

router.post(
  '/delay-signals/dismiss',
  validateBody(DismissDelaySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { signalId, entityType, entityId, deviationType } = req.body;
    const updateRes = await dbRun(
      `UPDATE delay_signals
       SET is_dismissed = TRUE, dismissed_by = ?, dismissed_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [userId, signalId, organizationId]
    );

    if ((updateRes?.changes || 0) === 0) {
      let entityName = String(signalId);
      try {
        if (entityType === 'INITIATIVE') {
          const rows = (await dbAll(
            `SELECT COALESCE(name, title) as entity_name
             FROM initiatives
             WHERE id = ? AND organization_id = ?
             LIMIT 1`,
            [entityId, organizationId]
          )) as Array<{ entity_name?: string | null }>;
          const name = rows?.[0]?.entity_name;
          if (name) entityName = String(name);
        } else {
          const rows = (await dbAll(
            `SELECT title as entity_name
             FROM tasks
             WHERE id = ? AND organization_id = ?
             LIMIT 1`,
            [entityId, organizationId]
          )) as Array<{ entity_name?: string | null }>;
          const name = rows?.[0]?.entity_name;
          if (name) entityName = String(name);
        }
      } catch {
        // Non-blocking fallback to signal id if lookup fails.
      }

      // L-03: defense-in-depth. The prior UPDATE already org-scopes the common
      // path (changes === 0 here means no row for this org), but the ON CONFLICT
      // fallback resolves on (id) alone — without an org guard a cross-org id
      // collision would still flip another org's signal. Guard the DO UPDATE with
      // the existing row's organization_id so a cross-org conflict is a no-op.
      await dbRun(
        `INSERT INTO delay_signals
           (id, organization_id, entity_type, entity_id, entity_name, deviation_type, severity, days_deviation,
            is_dismissed, dismissed_by, dismissed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'WARNING', 0, TRUE, ?, NOW(), NOW(), NOW())
         ON CONFLICT (id)
         DO UPDATE SET is_dismissed = TRUE, dismissed_by = EXCLUDED.dismissed_by, dismissed_at = NOW(), updated_at = NOW()
           WHERE delay_signals.organization_id = ?`,
        [
          signalId,
          organizationId,
          entityType,
          entityId,
          entityName,
          deviationType,
          userId,
          organizationId,
        ]
      );
    }

    return res.json({
      data: { success: true, signalId },
      meta: executionControlMutationMeta(),
    });
  })
);

router.post(
  '/delay-signals/detect',
  validateBody(DetectDelaySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId =
      typeof req.body?.projectId === 'string' && req.body.projectId.trim()
        ? req.body.projectId.trim()
        : undefined;
    const signals = await detectDelaySignals(organizationId, projectId);
    const result = await persistDelaySignals(organizationId, signals);
    return res.json({
      data: {
        success: true,
        detected: signals.length,
        persisted: result.persisted,
        alertsSent: result.alertsSent,
      },
      meta: executionControlMutationMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/capacity/leveling-alerts
 *
 * ★ #77 wiring fix (2026-07-19): this endpoint's name predates a function
 * split in workloadCapacityService (getLevelingAlerts = cross-initiative
 * allocation% leveling vs getOverloadAlerts = hours-based overload with
 * severity/suggestion). The ONLY frontend consumer (ExecutionHub.tsx
 * `V8ExecutionControlApi.getCapacityLevelingAlerts()`, typed as
 * `V8ExecutionCapacityAlert[]` = userId/name/capacityHours/allocatedHours/
 * overloadHours/severity/suggestion) expects the getOverloadAlerts shape.
 * Calling getLevelingAlerts here returned `{overloaded,underutilized,
 * unfilledRoles}` under the `alerts` key — never an array — so
 * normalizeExecutionArrayEnvelope() silently resolved it to `[]` on every
 * request. That emptied capacityAlerts app-wide: Execution health score's
 * "capacity" dimension was pinned at 100 (never reflected real overload),
 * ExecutionSummaryOneLook Kokpit's overallocatedCount stayed 0, and the
 * "Governed capacity alerts" report table always rendered empty. Fixed by
 * calling the function whose shape actually matches the contract.
 */
router.get(
  '/capacity/leveling-alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const alerts = await getOverloadAlerts(organizationId, 'week');
    return res.json({
      data: { alerts },
      meta: executionControlMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/capacity/timeline
 *
 * ★ #77 wiring fix (2026-07-19): getCapacityTimeline() returns
 * `{weekStart, totalCapacity, totalAllocated, utilizationPercent}` but the
 * only frontend consumer (ExecutionHub.tsx GovernedCapacityWeek /
 * V8ExecutionCapacityWeek) reads `{weekStart, capacityHours, allocatedHours,
 * availableHours}` — field names never matched, so every week rendered
 * `undefined` in the "4-week horizon" report table. Map at the route
 * boundary rather than renaming the shared service's output (also consumed
 * by executionControl.routes.ts legacy fallback with the same expectation).
 */
router.get(
  '/capacity/timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeRaw = firstQueryString(req.query.initiativeId);
    const initiativeId = initiativeRaw && initiativeRaw.trim() ? initiativeRaw.trim() : undefined;
    if (initiativeId) {
      const initiative = await dbGet<{ id: string }>(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, organizationId],
        { fallback: true }
      );
      if (!initiative?.id) {
        return res.status(404).json({
          error: `Initiative ${initiativeId} not found`,
          code: 'INITIATIVE_NOT_FOUND',
        });
      }
    }
    const rawWeeks = await getCapacityTimeline(organizationId, initiativeId);
    const weeks = rawWeeks.map((w) => ({
      weekStart: w.weekStart,
      capacityHours: w.totalCapacity,
      allocatedHours: w.totalAllocated,
      availableHours: Math.round((w.totalCapacity - w.totalAllocated) * 10) / 10,
      utilizationPercent: w.utilizationPercent,
    }));
    return res.json({
      data: { weeks },
      meta: executionControlMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/budget/initiative/:initiativeId
 */
router.get(
  '/budget/initiative/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const summary = await getInitiativeBudgetSummary(
      organizationId,
      String(req.params.initiativeId)
    );
    if (!summary) {
      return res
        .status(404)
        .json({ error: 'Initiative not found', code: 'EXECUTION_BUDGET_INITIATIVE_NOT_FOUND' });
    }
    return res.json({
      data: { summary },
      meta: executionControlMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/budget/portfolio
 */
router.get(
  '/budget/portfolio',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const summary = await getPortfolioBudgetSummary(organizationId, projectId);
    return res.json({
      data: { summary },
      meta: executionControlMeta(),
    });
  })
);

router.post(
  '/budget/entries',
  validateBody(CreateBudgetEntrySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const initiativeId =
      typeof req.body?.initiativeId === 'string' && req.body.initiativeId.trim()
        ? req.body.initiativeId.trim()
        : '';
    const initiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId],
      { fallback: true }
    );
    if (!initiative?.id) {
      return res.status(404).json({
        error: `Initiative ${initiativeId} not found`,
        code: 'INITIATIVE_NOT_FOUND',
      });
    }
    // Mass-assignment guard: pass only schema-validated fields (no `...req.body`
    // spread) so a client cannot smuggle protected/unknown columns toward the
    // INSERT. `createdBy` is always the server-derived caller; `organization_id`
    // and the row `id` are set server-side inside createBudgetEntry().
    const body = req.body as z.infer<typeof CreateBudgetEntrySchema>;
    const id = await createBudgetEntry(organizationId, {
      initiativeId,
      entryType: body.entryType,
      costType: body.costType,
      category: body.category,
      amount: body.amount,
      currency: body.currency,
      description: body.description,
      periodMonth: body.periodMonth,
      periodYear: body.periodYear,
      source: body.source,
      createdBy: userId,
    });
    return res.json({
      data: { success: true, id },
      meta: executionControlMutationMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/budget/overspend-signals
 */
router.get(
  '/budget/overspend-signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);
    const signals = await detectOverspendSignals(organizationId, projectId);
    return res.json({
      data: { signals, count: signals.length },
      meta: executionControlMeta(),
    });
  })
);

/**
 * POST /api/v8/execution-control/realizations
 * M14 → M15 feed-forward. Records a HUMAN-ENTERED realized benefit value for an
 * initiative (source='execution') into `roi_realized_values`, the table Results
 * (M15) reads via getROIPortfolioSummary. Role-gated (write access), org-scoped,
 * and 404s on a foreign-org initiative id (mirrors /budget/entries).
 */
router.post(
  '/realizations',
  validateBody(RecordRealizationSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const perm = checkInterventionPermission(req);
    if (!perm.allowed) {
      return res.status(403).json({
        error: 'Write denied',
        code: 'EXECUTION_WRITE_DENIED',
        reason: perm.reason,
        whatNext:
          'Request write access or ask an operator with ADMIN/EDITOR role to record a realization.',
      });
    }
    const { organizationId, userId } = getV8Context(req);
    const body = req.body as z.infer<typeof RecordRealizationSchema>;
    const initiativeId = body.initiativeId.trim();

    // Same-org integrity (mirrors /budget/entries): verify the initiative exists in
    // the caller's org before writing, so a foreign-org id cannot attach realized
    // data to another org's initiative — 404 instead of a silent cross-org write.
    const initiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId],
      { fallback: true }
    );
    if (!initiative?.id) {
      return res.status(404).json({
        error: `Initiative ${initiativeId} not found`,
        code: 'INITIATIVE_NOT_FOUND',
      });
    }

    // Pass only schema-validated fields plus the server-derived recordedBy/org —
    // no `...req.body` spread, so a client cannot smuggle protected columns.
    const entry = await recordExecutionRealization({
      organizationId,
      initiativeId,
      periodMonth: body.periodMonth,
      realizedRevenueDelta: body.realizedRevenueDelta ?? null,
      realizedCostDelta: body.realizedCostDelta ?? null,
      realizedSavings: body.realizedSavings ?? null,
      varianceNotes: body.varianceNotes ?? null,
      recordedBy: userId,
    });

    await auditLog(
      organizationId,
      initiativeId,
      'realization_recorded',
      null,
      JSON.stringify({
        id: entry.id,
        periodMonth: entry.periodMonth,
        realizedRevenueDelta: entry.realizedRevenueDelta,
        realizedCostDelta: entry.realizedCostDelta,
        realizedSavings: entry.realizedSavings,
      }),
      'Realization recorded from execution context',
      userId
    );

    return res.json({
      data: { success: true, entry },
      meta: executionControlMutationMeta(),
    });
  })
);

/**
 * POST /api/v8/execution-control/realizations/baseline
 * FIN-007: keyed, baseline-bound realization write. Same permission gate and
 * org/initiative ownership check as /realizations above; additionally
 * requires an Idempotency-Key header and rejects (fail-closed) when the
 * named baseline is not approved or has moved version since the caller
 * observed it.
 */
router.post(
  '/realizations/baseline',
  validateBody(RecordBaselineRealizationSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const perm = checkInterventionPermission(req);
    if (!perm.allowed) {
      return res.status(403).json({
        error: 'Write denied',
        code: 'EXECUTION_WRITE_DENIED',
        reason: perm.reason,
      });
    }
    const { organizationId, userId } = getV8Context(req);
    const body = req.body as z.infer<typeof RecordBaselineRealizationSchema>;
    const initiativeId = body.initiativeId.trim();

    const operationKey =
      (typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key']) || '';
    if (!operationKey) {
      return res.status(400).json({
        error: 'Idempotency-Key header is required for a baseline-bound realization write',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }

    const initiative = await dbGet<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId],
      { fallback: true }
    );
    if (!initiative?.id) {
      return res.status(404).json({
        error: `Initiative ${initiativeId} not found`,
        code: 'INITIATIVE_NOT_FOUND',
      });
    }

    try {
      const entry = await recordExecutionRealizationForBaseline({
        organizationId,
        initiativeId,
        periodMonth: body.periodMonth,
        realizedRevenueDelta: body.realizedRevenueDelta ?? null,
        realizedCostDelta: body.realizedCostDelta ?? null,
        realizedSavings: body.realizedSavings ?? null,
        varianceNotes: body.varianceNotes ?? null,
        recordedBy: userId,
        baselineModelId: body.baselineModelId,
        baselineExpectedVersion: body.baselineExpectedVersion,
        evidenceRef: body.evidenceRef ?? null,
        operationKey,
      });

      await auditLog(
        organizationId,
        initiativeId,
        'realization_recorded_baseline',
        null,
        JSON.stringify({
          id: entry.id,
          periodMonth: entry.periodMonth,
          baselineModelId: entry.baselineModelId,
          baselineVersion: entry.baselineVersion,
        }),
        'Baseline-bound realization recorded from execution context',
        userId
      );

      return res.status(201).json({
        data: { success: true, entry },
        meta: executionControlMutationMeta(),
      });
    } catch (error) {
      if (error instanceof BaselineNotApprovedError) {
        return res.status(400).json({
          error: error.message,
          code: 'BASELINE_NOT_APPROVED',
        });
      }
      if (error instanceof BaselineVersionConflictError) {
        return res.status(409).json({
          error: error.message,
          code: 'BASELINE_VERSION_CONFLICT',
          serverVersion: error.serverVersion,
        });
      }
      if (error instanceof RealizationKeyConflictError) {
        return res.status(409).json({
          error: error.message,
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      }
      throw error;
    }
  })
);

router.post(
  '/timeline-update',
  validateBody(TimelineUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { initiativeId, field, value, reason } = req.body;

    if (field === 'status') {
      return res.status(400).json({
        error:
          'Status changes are not allowed via /timeline-update. Use PATCH /api/initiatives/:id/status (or /approve, /start-execution, /unblock) instead.',
        code: 'TIMELINE_UPDATE_STATUS_FORBIDDEN',
      });
    }
    if (!(TIMELINE_UPDATABLE_FIELDS as readonly string[]).includes(field)) {
      return res.status(400).json({
        error: `Unsupported field '${field}'. Allowed fields: ${TIMELINE_UPDATABLE_FIELDS.join(', ')}`,
        code: 'TIMELINE_UPDATE_FIELD_NOT_ALLOWED',
      });
    }

    const existing = (await dbAll(
      `SELECT ${field} as current_value FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId]
    )) as { current_value: string | null }[];

    if (!existing || existing.length === 0) {
      return res
        .status(404)
        .json({ error: 'Initiative not found', code: 'EXECUTION_INITIATIVE_NOT_FOUND' });
    }

    const oldValue = existing[0].current_value;

    await dbRun(
      `UPDATE initiatives SET ${field} = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [value, initiativeId, organizationId]
    );

    await dbRun(
      `INSERT INTO execution_audit_log (id, organization_id, initiative_id, field_changed, old_value, new_value, change_reason, changed_by)
       VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, ?, ?, ?)`,
      [organizationId, initiativeId, field, oldValue, value, reason || null, userId]
    );

    return res.json({
      data: { success: true, field, oldValue, newValue: value },
      meta: executionControlMutationMeta(),
    });
  })
);

// ────────────────────────────────────────────────────────────────
// P03-B §2.4.3 — Bounded operator interventions
// ────────────────────────────────────────────────────────────────

const ReassignSchema = z.object({
  entityType: z.enum(['INITIATIVE', 'TASK']),
  entityId: z.string().min(1),
  newOwnerId: z.string().min(1),
  reason: z.string().optional(),
});

const SmoothSchema = z.object({
  entityType: z.enum(['INITIATIVE', 'TASK']),
  entityId: z.string().min(1),
  forecastStartDate: z.string().optional(),
  forecastEndDate: z.string().optional(),
  allocatedHours: z.number().optional(),
  reason: z.string().optional(),
});

const ReplanSchema = z.object({
  entityType: z.enum(['INITIATIVE', 'TASK']),
  entityId: z.string().min(1),
  forecastStartDate: z.string().optional(),
  forecastEndDate: z.string().optional(),
  forecastEffortHours: z.number().optional(),
  reason: z.string().min(1),
  idempotencyKey: z.string().optional(),
});

const EscalateSchema = z.object({
  entityType: z.enum(['INITIATIVE', 'TASK']),
  entityId: z.string().min(1),
  escalationType: z.enum(['RISK', 'DECISION', 'ISSUE', 'DEPENDENCY']),
  title: z.string().min(1),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  dueDate: z.string().optional(),
});

async function auditLog(
  orgId: string,
  initiativeId: string | null,
  field: string,
  oldVal: unknown,
  newVal: unknown,
  reason: string | null,
  userId: string,
  idempotencyKey?: string | null
) {
  try {
    await dbRun(
      `INSERT INTO execution_audit_log (id, organization_id, initiative_id, field_changed, old_value, new_value, change_reason, changed_by, idempotency_key)
       VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        initiativeId,
        field,
        String(oldVal ?? ''),
        String(newVal ?? ''),
        reason,
        userId,
        idempotencyKey ?? null,
      ]
    );
  } catch {
    // best-effort audit
  }
}

function checkInterventionPermission(req: AuthRequest): { allowed: boolean; reason?: string } {
  if (!req.user) {
    return { allowed: false, reason: 'Authentication required' };
  }
  const role = String(req.userRole || req.user?.role || '').toUpperCase();
  if (role === 'VIEWER' || role === 'READONLY') {
    return {
      allowed: false,
      reason: `Role "${role}" does not have write access to execution interventions`,
    };
  }
  return { allowed: true };
}

async function refreshControlTower(
  organizationId: string,
  projectId?: string,
  entityType?: 'INITIATIVE' | 'TASK',
  entityId?: string
) {
  const refreshedAt = new Date().toISOString();
  try {
    const queues = await getExecutionControlTowerQueues(organizationId, {
      projectId,
      queue: 'all',
    });
    let drillDown = null;
    if (entityType && entityId) {
      drillDown = await getExecutionControlTowerItemDetail(
        organizationId,
        entityType,
        entityId,
        projectId
      );
    }
    return { queues, drillDown, stale: false, refreshedAt };
  } catch {
    return {
      queues: null,
      drillDown: null,
      stale: true,
      refreshedAt,
      degradedNote:
        'Partial refresh failure: some views may be stale. Retry or check control tower directly.',
      retryHint: 'GET /api/v8/execution-control/control-tower/queues',
    };
  }
}

/**
 * POST /api/v8/execution-control/interventions/reassign
 * §2.4.3: change owner/team of canonical work item.
 * §2.4.4: returns refreshed queues + drill-down (mandatory readback).
 */
router.post(
  '/interventions/reassign',
  validateBody(ReassignSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const perm = checkInterventionPermission(req);
    if (!perm.allowed) {
      return res.status(403).json({
        error: 'Write denied',
        code: 'EXECUTION_WRITE_DENIED',
        reason: perm.reason,
        whatNext:
          'Request write access or ask an operator with ADMIN/EDITOR role to perform this intervention.',
      });
    }
    const { organizationId, userId } = getV8Context(req);
    const { entityType, entityId, newOwnerId, reason } = req.body;

    if (entityType === 'TASK') {
      const old = (await dbAll(
        `SELECT assignee_id FROM tasks WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { assignee_id: string | null }[];
      if (!old?.length) {
        return res
          .status(404)
          .json({ error: 'Task not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      await dbRun(
        `UPDATE tasks SET assignee_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
        [newOwnerId, entityId, organizationId]
      );
      await auditLog(
        organizationId,
        null,
        'assignee_id',
        old[0].assignee_id,
        newOwnerId,
        reason || null,
        userId
      );
    } else {
      const old = (await dbAll(
        `SELECT owner_execution_id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { owner_execution_id: string | null }[];
      if (!old?.length) {
        return res
          .status(404)
          .json({ error: 'Initiative not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      await dbRun(
        `UPDATE initiatives SET owner_execution_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
        [newOwnerId, entityId, organizationId]
      );
      await auditLog(
        organizationId,
        entityId,
        'owner_execution_id',
        old[0].owner_execution_id,
        newOwnerId,
        reason || null,
        userId
      );
    }

    const readback = await refreshControlTower(organizationId, undefined, entityType, entityId);
    return res.json({
      data: {
        success: true,
        action: 'reassign',
        entityType,
        entityId,
        newOwnerId,
        readback,
      },
      meta: executionControlMutationMeta(),
    });
  })
);

/**
 * POST /api/v8/execution-control/interventions/smooth
 * §2.4.3: move work within bounded schedule window to reduce overload.
 * Mutates forecast dates/allocation on canonical object, preserves baseline.
 */
router.post(
  '/interventions/smooth',
  validateBody(SmoothSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const perm = checkInterventionPermission(req);
    if (!perm.allowed) {
      return res.status(403).json({
        error: 'Write denied',
        code: 'EXECUTION_WRITE_DENIED',
        reason: perm.reason,
        whatNext:
          'Request write access or ask an operator with ADMIN/EDITOR role to perform this intervention.',
      });
    }
    const { organizationId, userId } = getV8Context(req);
    const { entityType, entityId, forecastStartDate, forecastEndDate, allocatedHours, reason } =
      req.body;

    if (entityType === 'TASK') {
      const old = (await dbAll(
        `SELECT due_date, estimated_hours FROM tasks WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { due_date: string | null; estimated_hours: number | null }[];
      if (!old?.length) {
        return res
          .status(404)
          .json({ error: 'Task not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      const sets: string[] = [];
      const params: unknown[] = [];
      if (forecastEndDate) {
        sets.push('due_date = ?');
        params.push(forecastEndDate);
      }
      if (allocatedHours != null) {
        sets.push('estimated_hours = ?');
        params.push(allocatedHours);
      }
      if (sets.length === 0) {
        return res
          .status(400)
          .json({ error: 'No fields to smooth', code: 'EXECUTION_SMOOTH_EMPTY' });
      }
      sets.push('updated_at = NOW()');
      params.push(entityId, organizationId);
      await dbRun(
        `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        params
      );
      await auditLog(
        organizationId,
        null,
        'smooth',
        JSON.stringify(old[0]),
        JSON.stringify({ forecastEndDate, allocatedHours }),
        reason || null,
        userId
      );
    } else {
      const old = (await dbAll(
        `SELECT forecast_start_date, forecast_end_date, planned_start_date, planned_end_date FROM initiatives WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as {
        forecast_start_date: string | null;
        forecast_end_date: string | null;
        planned_start_date: string | null;
        planned_end_date: string | null;
      }[];
      if (!old?.length) {
        return res
          .status(404)
          .json({ error: 'Initiative not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      const sets: string[] = [];
      const params: unknown[] = [];
      if (forecastStartDate) {
        sets.push('forecast_start_date = ?');
        params.push(forecastStartDate);
      }
      if (forecastEndDate) {
        sets.push('forecast_end_date = ?');
        params.push(forecastEndDate);
      }
      if (sets.length === 0) {
        return res
          .status(400)
          .json({ error: 'No fields to smooth', code: 'EXECUTION_SMOOTH_EMPTY' });
      }
      sets.push('updated_at = NOW()');
      params.push(entityId, organizationId);
      await dbRun(
        `UPDATE initiatives SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        params
      );
      await auditLog(
        organizationId,
        entityId,
        'smooth',
        JSON.stringify(old[0]),
        JSON.stringify({ forecastStartDate, forecastEndDate }),
        reason || null,
        userId
      );
    }

    const readback = await refreshControlTower(organizationId, undefined, entityType, entityId);
    return res.json({
      data: { success: true, action: 'smooth', entityType, entityId, readback },
      meta: executionControlMutationMeta(),
    });
  })
);

/**
 * POST /api/v8/execution-control/interventions/replan
 * §2.4.3: update forecast dates/effort; baseline preserved (§2.4.5).
 */
router.post(
  '/interventions/replan',
  validateBody(ReplanSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const perm = checkInterventionPermission(req);
    if (!perm.allowed) {
      return res.status(403).json({
        error: 'Write denied',
        code: 'EXECUTION_WRITE_DENIED',
        reason: perm.reason,
        whatNext:
          'Request write access or ask an operator with ADMIN/EDITOR role to perform this intervention.',
      });
    }
    const { organizationId, userId } = getV8Context(req);
    const {
      entityType,
      entityId,
      forecastStartDate,
      forecastEndDate,
      forecastEffortHours,
      reason,
      idempotencyKey,
    } = req.body;

    if (entityType === 'TASK') {
      const old = (await dbAll(
        `SELECT due_date, estimated_hours FROM tasks WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { due_date: string | null; estimated_hours: number | null }[];
      if (!old?.length) {
        return res
          .status(404)
          .json({ error: 'Task not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      const sets: string[] = [];
      const params: unknown[] = [];
      if (forecastEndDate) {
        sets.push('due_date = ?');
        params.push(forecastEndDate);
      }
      if (forecastEffortHours != null) {
        sets.push('estimated_hours = ?');
        params.push(forecastEffortHours);
      }
      if (sets.length === 0) {
        return res
          .status(400)
          .json({ error: 'No forecast fields to update', code: 'EXECUTION_REPLAN_EMPTY' });
      }
      sets.push('updated_at = NOW()');
      params.push(entityId, organizationId);
      await dbRun(
        `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        params
      );
      await auditLog(
        organizationId,
        null,
        'replan',
        JSON.stringify(old[0]),
        JSON.stringify({ forecastEndDate, forecastEffortHours }),
        reason,
        userId
      );
    } else {
      // Org-scope existence guard MUST run before anything else in this branch —
      // including the idempotency-replay check below. Checking idempotency first
      // (as this used to) let a caller from ANY org probe execution_audit_log for
      // a (entityId, idempotencyKey) pair written by a DIFFERENT org and get a 200
      // idempotent-replay response without ever proving they own that initiative —
      // a cross-tenant existence oracle bypassing the 404 this endpoint otherwise
      // enforces. Found in adversarial review; fixed by reordering, not by adding
      // organization_id to the idempotency SELECT alone (that alone would still
      // 404 correctly, but keeping the existence check first and unconditional is
      // the same defense-in-depth shape every other guard in this file uses).
      const old = (await dbAll(
        `SELECT forecast_start_date, forecast_end_date, planned_start_date, planned_end_date FROM initiatives WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as {
        forecast_start_date: string | null;
        forecast_end_date: string | null;
        planned_start_date: string | null;
        planned_end_date: string | null;
      }[];
      if (!old?.length) {
        return res
          .status(404)
          .json({ error: 'Initiative not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }

      // EXE-06 idempotent retry: a client-supplied idempotencyKey that already
      // produced an execution_audit_log row for this initiative's 'replan' means
      // this request is a replay (e.g. a retried POST) — skip the UPDATE/audit
      // writes and return the same response shape with `idempotent: true`, but
      // still compute a fresh readback since that is a pure read. Only reachable
      // once the org-scope guard above has already confirmed entityId belongs to
      // organizationId, so this SELECT doesn't need its own org predicate to be
      // safe — but include one anyway for defense in depth.
      if (idempotencyKey) {
        const existingAudit = (await dbAll(
          `SELECT id FROM execution_audit_log WHERE initiative_id = ? AND organization_id = ? AND field_changed = 'replan' AND idempotency_key = ?`,
          [entityId, organizationId, idempotencyKey]
        )) as { id: string }[];
        if (existingAudit?.length) {
          const readback = await refreshControlTower(
            organizationId,
            undefined,
            entityType,
            entityId
          );
          return res.json({
            data: {
              success: true,
              action: 'replan',
              entityType,
              entityId,
              readback,
              idempotent: true,
            },
            meta: executionControlMutationMeta(),
          });
        }
      }

      const sets: string[] = [];
      const params: unknown[] = [];
      if (forecastStartDate) {
        sets.push('forecast_start_date = ?');
        params.push(forecastStartDate);
      }
      if (forecastEndDate) {
        sets.push('forecast_end_date = ?');
        params.push(forecastEndDate);
      }
      if (sets.length === 0) {
        return res
          .status(400)
          .json({ error: 'No forecast fields to update', code: 'EXECUTION_REPLAN_EMPTY' });
      }
      sets.push('updated_at = NOW()');
      params.push(entityId, organizationId);
      await dbRun(
        `UPDATE initiatives SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        params
      );
      await auditLog(
        organizationId,
        entityId,
        'replan',
        JSON.stringify(old[0]),
        JSON.stringify({ forecastStartDate, forecastEndDate }),
        reason,
        userId,
        idempotencyKey
      );

      // EXE-06: mirror the replan into initiative_history — the canonical audit
      // trail the front-end actually reads (GET /:id/history "Dziennik zmian").
      // execution_audit_log (above) is not exposed to the client. Best-effort but
      // logged on failure (unlike a silent catch) so audit gaps are visible; a
      // 23505 unique-violation on idempotency_key means a concurrent identical
      // retry already wrote this record — treat that as success, not an error.
      try {
        await dbRun(
          `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes, idempotency_key)
           VALUES (gen_random_uuid()::TEXT, ?, 'reforecast', ?, ?, ?, ?, ?)`,
          [
            entityId,
            JSON.stringify(old[0]),
            JSON.stringify({ forecastStartDate, forecastEndDate }),
            userId,
            reason,
            idempotencyKey ?? null,
          ]
        );
      } catch (err: any) {
        if (err?.code !== '23505') {
          console.error('[execution-control] failed to write reforecast history', {
            initiativeId: entityId,
            error: err?.message || String(err),
          });
        }
      }
    }

    const readback = await refreshControlTower(organizationId, undefined, entityType, entityId);
    return res.json({
      data: { success: true, action: 'replan', entityType, entityId, readback },
      meta: executionControlMutationMeta(),
    });
  })
);

/**
 * POST /api/v8/execution-control/interventions/escalate
 * §2.4.3: create governed follow-up (RAID item) linked to work.
 */
router.post(
  '/interventions/escalate',
  validateBody(EscalateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const perm = checkInterventionPermission(req);
    if (!perm.allowed) {
      return res.status(403).json({
        error: 'Write denied',
        code: 'EXECUTION_WRITE_DENIED',
        reason: perm.reason,
        whatNext:
          'Request write access or ask an operator with ADMIN/EDITOR role to perform this intervention.',
      });
    }
    const { organizationId, userId } = getV8Context(req);
    const { entityType, entityId, escalationType, title, description, ownerId, dueDate } = req.body;

    // Same-org integrity (defense-in-depth): mirror the sibling reassign/smooth/
    // replan handlers — verify the target entity exists in the caller's org before
    // writing. Without this an unknown/foreign INITIATIVE id would stamp the
    // caller's org onto a raid_items row referencing a non-existent (or cross-org)
    // initiative_id, instead of failing fast. The TASK branch already org-scopes
    // its lookup; make it 404 on a missing task rather than escalating against null.
    let initiativeId: string | null;
    if (entityType === 'INITIATIVE') {
      const init = (await dbAll(`SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`, [
        entityId,
        organizationId,
      ])) as { id: string }[];
      if (!init?.length) {
        return res
          .status(404)
          .json({ error: 'Initiative not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      initiativeId = entityId;
    } else {
      const task = (await dbAll(
        `SELECT initiative_id FROM tasks WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { initiative_id: string | null }[];
      if (!task?.length) {
        return res
          .status(404)
          .json({ error: 'Task not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      initiativeId = task[0].initiative_id ?? null;
    }

    const raidId = `raid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await dbRun(
      `INSERT INTO raid_items (id, organization_id, initiative_id, type, title, description, status, owner_id, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, NOW(), NOW())`,
      [
        raidId,
        organizationId,
        initiativeId,
        escalationType,
        title,
        description || null,
        ownerId || userId,
        dueDate || null,
      ]
    );

    await auditLog(
      organizationId,
      initiativeId,
      'escalate',
      null,
      JSON.stringify({ raidId, escalationType, title }),
      `Escalation from ${entityType}:${entityId}`,
      userId
    );

    const readback = await refreshControlTower(organizationId, undefined, entityType, entityId);
    return res.json({
      data: {
        success: true,
        action: 'escalate',
        entityType,
        entityId,
        raidItemId: raidId,
        readback,
      },
      meta: executionControlMutationMeta(),
    });
  })
);

// ────────────────────────────────────────────────────────────────
// P03-F §2.4.4 — Dependency link/unlink with mandatory readback
// ────────────────────────────────────────────────────────────────

const DependencySchema = z.object({
  action: z.enum(['link', 'unlink']),
  fromEntityType: z.enum(['INITIATIVE', 'TASK']),
  fromEntityId: z.string().min(1),
  toEntityType: z.enum(['INITIATIVE', 'TASK']),
  toEntityId: z.string().min(1),
  semantics: z.enum(['blocking', 'waiting_on']),
  reason: z.string().optional(),
});

router.post(
  '/interventions/dependency',
  validateBody(DependencySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const perm = checkInterventionPermission(req);
    if (!perm.allowed) {
      return res.status(403).json({
        error: 'Write denied',
        code: 'EXECUTION_WRITE_DENIED',
        reason: perm.reason,
        whatNext:
          'Request write access or ask an operator with ADMIN/EDITOR role to perform this intervention.',
      });
    }
    const { organizationId, userId } = getV8Context(req);
    const { action, fromEntityType, fromEntityId, toEntityType, toEntityId, semantics, reason } =
      req.body;

    if (fromEntityType === 'TASK' && toEntityType === 'TASK') {
      // Verify both tasks belong to the caller's org before mutating dependencies
      const fromTask = await dbGet<{ organization_id: string }>(
        `SELECT organization_id FROM tasks WHERE id = ?`,
        [fromEntityId]
      );
      const toTask = await dbGet<{ organization_id: string }>(
        `SELECT organization_id FROM tasks WHERE id = ?`,
        [toEntityId]
      );
      if (
        !fromTask ||
        !toTask ||
        String(fromTask.organization_id) !== organizationId ||
        String(toTask.organization_id) !== organizationId
      ) {
        return res.status(403).json({ error: 'Forbidden', code: 'EXECUTION_TASK_ORG_MISMATCH' });
      }
      if (action === 'link') {
        const depId = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await dbRun(
          `INSERT OR IGNORE INTO task_dependencies (id, from_task_id, to_task_id, dependency_type, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [depId, fromEntityId, toEntityId, semantics]
        );
      } else {
        await dbRun(`DELETE FROM task_dependencies WHERE from_task_id = ? AND to_task_id = ?`, [
          fromEntityId,
          toEntityId,
        ]);
      }
    } else if (fromEntityType === 'INITIATIVE' && toEntityType === 'INITIATIVE') {
      // Wave-4 IDOR: mirror the TASK branch's org guard. `initiative_dependencies`
      // stamps the caller's organization_id, but without verifying that both
      // initiative ids actually belong to this org a tampered request could create
      // (or, via DELETE, target) a dependency edge that references another org's
      // initiatives. The FK to initiatives(id) does NOT validate org ownership, so
      // a foreign-org id is still a valid initiatives.id and passes the FK while
      // the row is mis-attributed to the caller's org. Verify both ids are in-org
      // first → a cross-org id becomes a 403 instead of a silent cross-org write.
      const fromInit = await dbGet<{ organization_id: string }>(
        `SELECT organization_id FROM initiatives WHERE id = ?`,
        [fromEntityId]
      );
      const toInit = await dbGet<{ organization_id: string }>(
        `SELECT organization_id FROM initiatives WHERE id = ?`,
        [toEntityId]
      );
      if (
        !fromInit ||
        !toInit ||
        String(fromInit.organization_id) !== organizationId ||
        String(toInit.organization_id) !== organizationId
      ) {
        return res
          .status(403)
          .json({ error: 'Forbidden', code: 'EXECUTION_INITIATIVE_ORG_MISMATCH' });
      }
      if (action === 'link') {
        const depId = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await dbRun(
          `INSERT OR IGNORE INTO initiative_dependencies (id, from_initiative_id, to_initiative_id, type, organization_id, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [depId, fromEntityId, toEntityId, semantics, organizationId]
        );
      } else {
        await dbRun(
          `DELETE FROM initiative_dependencies WHERE from_initiative_id = ? AND to_initiative_id = ? AND organization_id = ?`,
          [fromEntityId, toEntityId, organizationId]
        );
      }
    } else {
      return res.status(400).json({
        error:
          'Cross-type dependencies (INITIATIVE↔TASK) are not supported in bounded dependency interventions',
        code: 'EXECUTION_DEPENDENCY_CROSS_TYPE',
      });
    }

    await auditLog(
      organizationId,
      null,
      `dependency_${action}`,
      JSON.stringify({ fromEntityType, fromEntityId, toEntityType, toEntityId }),
      JSON.stringify({ semantics }),
      reason || null,
      userId
    );

    const readback = await refreshControlTower(organizationId);
    return res.json({
      data: {
        success: true,
        action: `dependency_${action}`,
        fromEntityType,
        fromEntityId,
        toEntityType,
        toEntityId,
        semantics,
        readback,
      },
      meta: executionControlMutationMeta(),
    });
  })
);

// ────────────────────────────────────────────────────────────────
// P03-B §2.4.5 — Baseline / forecast / variance read
// ────────────────────────────────────────────────────────────────

/**
 * GET /api/v8/execution-control/baseline-variance/:initiativeId
 * Returns baseline vs current (forecast) dates + variance.
 * Missing baseline → explicit "missing_baseline" posture (§2.4.5).
 */
router.get(
  '/baseline-variance/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const { initiativeId } = req.params;

    const inits = (await dbAll(
      `SELECT planned_start_date, planned_end_date, forecast_start_date, forecast_end_date,
              start_date, actual_end_date, progress
       FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId]
    )) as {
      planned_start_date: string | null;
      planned_end_date: string | null;
      forecast_start_date: string | null;
      forecast_end_date: string | null;
      start_date: string | null;
      actual_end_date: string | null;
      progress: number | null;
    }[];

    if (!inits?.length) {
      return res
        .status(404)
        .json({ error: 'Initiative not found', code: 'EXECUTION_INITIATIVE_NOT_FOUND' });
    }

    const init = inits[0];

    let snapshots: Array<{ tasks_json: string; snapshot_at: string }> = [];
    try {
      snapshots = ((await dbAll(
        `SELECT tasks_json, snapshot_at FROM task_baseline_snapshots
         WHERE initiative_id = ? AND organization_id = ?
         ORDER BY snapshot_at DESC LIMIT 1`,
        [initiativeId, organizationId]
      )) || []) as Array<{ tasks_json: string; snapshot_at: string }>;
    } catch {
      // table may not exist
    }

    const baselineSnapshot = snapshots.length > 0 ? snapshots[0] : null;
    const hasBaseline = !!(init.planned_start_date || init.planned_end_date);

    const forecastStart = init.forecast_start_date || init.start_date || init.planned_start_date;
    const forecastEnd = init.forecast_end_date || init.actual_end_date || init.planned_end_date;

    let startVarianceDays: number | null = null;
    let endVarianceDays: number | null = null;

    if (hasBaseline && init.planned_start_date && forecastStart) {
      startVarianceDays = Math.round(
        (new Date(forecastStart).getTime() - new Date(init.planned_start_date).getTime()) / 86400000
      );
    }
    if (hasBaseline && init.planned_end_date && forecastEnd) {
      endVarianceDays = Math.round(
        (new Date(forecastEnd).getTime() - new Date(init.planned_end_date).getTime()) / 86400000
      );
    }

    return res.json({
      data: {
        initiativeId,
        posture: hasBaseline ? 'baseline_available' : 'missing_baseline',
        baseline: {
          startDate: init.planned_start_date,
          endDate: init.planned_end_date,
        },
        forecast: {
          startDate: forecastStart,
          endDate: forecastEnd,
        },
        variance: hasBaseline ? { startDays: startVarianceDays, endDays: endVarianceDays } : null,
        progress: init.progress,
        taskBaselineSnapshot: baselineSnapshot
          ? { snapshotAt: baselineSnapshot.snapshot_at, available: true }
          : { available: false },
        degradedNote: hasBaseline
          ? null
          : 'Missing baseline: variance cannot be computed. Set planned dates to establish baseline.',
      },
      meta: executionControlMeta(),
    });
  })
);

// ────────────────────────────────────────────────────────────────
// P03-B §2.4.8 — Degraded posture: control tower health
// ────────────────────────────────────────────────────────────────

/**
 * GET /api/v8/execution-control/control-tower/health
 * Reports degraded posture signals: stale data, missing baselines, etc.
 */
router.get(
  '/control-tower/health',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const projectId = firstQueryString(req.query.projectId);

    const queues = await getExecutionControlTowerQueues(organizationId, {
      projectId,
      queue: 'all',
    });

    const missingBaselineCount = queues.queues.at_risk.filter((i) =>
      i.why.some((w) => w.kind === 'baseline_forecast' && w.detail.includes('Missing baseline'))
    ).length;

    const missingEstimateCount = queues.queues.overloaded.filter((i) =>
      i.why.some((w) => w.kind === 'estimate')
    ).length;

    const staleCount = queues.counts.stale;

    const degradedSignals: Array<{
      type: string;
      message: string;
      count: number;
      severity: 'info' | 'warning' | 'critical';
    }> = [];

    if (missingBaselineCount > 0) {
      degradedSignals.push({
        type: 'missing_baseline',
        message: `${missingBaselineCount} initiative(s) without baseline dates — variance cannot be computed.`,
        count: missingBaselineCount,
        severity: missingBaselineCount > 5 ? 'critical' : 'warning',
      });
    }

    if (missingEstimateCount > 0) {
      degradedSignals.push({
        type: 'missing_estimate',
        message: `${missingEstimateCount} overloaded item(s) lack estimated_hours — overload may be understated.`,
        count: missingEstimateCount,
        severity: 'warning',
      });
    }

    if (staleCount > 0) {
      degradedSignals.push({
        type: 'stale_data',
        message: `${staleCount} item(s) have not been updated in ≥14 days.`,
        count: staleCount,
        severity: staleCount > 10 ? 'critical' : 'warning',
      });
    }

    return res.json({
      data: {
        generatedAt: queues.generatedAt,
        healthy: degradedSignals.length === 0,
        degradedSignals,
        counts: queues.counts,
        posture:
          degradedSignals.length === 0
            ? 'nominal'
            : degradedSignals.some((s) => s.severity === 'critical')
              ? 'degraded_critical'
              : 'degraded_warning',
      },
      meta: executionControlTowerMeta(),
    });
  })
);

// ────────────────────────────────────────────────────────────────
// Manager 6-Lane Cockpit — analysis, decision, execution, verify
// ────────────────────────────────────────────────────────────────

import {
  getAiManageAll,
  getAiRecommendation,
  getAiTriage,
} from '../../services/v8/managerAiService.js';
import { analyzeLane } from '../../services/v8/managerLaneAnalysisService.js';
import { getManagerProblems } from '../../services/v8/managerProblemsService.js';

const VALID_LANES = new Set([
  'action-queue',
  'decisions',
  'blockers',
  'workload',
  'risk',
  'people-change',
]);

const LaneDecisionSchema = z.object({
  suggestionId: z.string().min(1),
  state: z.string().min(1),
  notes: z.string().optional(),
});

const ManagerProblemActionSchema = z.object({
  problemId: z.string().min(1),
  actionId: z.string().min(1),
});

const ManagerSuggestionApplySchema = z.object({
  suggestionId: z.string().min(1),
});

const LaneExecuteSchema = z.object({
  decisionId: z.string().min(1),
});

// QA-2026-06-08 (BUG-18): the manager-lane endpoints below return org-wide overdue
// tasks plus real staff names (PII). They were only org-scoped, so any USER could read
// the whole organisation's action queue. Gate the entire /manager surface behind a
// manager-level capability (SUPERADMIN/OWNER/ADMIN/PROJECT_MANAGER) — a plain USER now
// gets 403 instead of seeing colleagues' assignments.
// M14 D-03 (Piotr 2026-07-18): manager lanes live on a dedicated sub-router so they
// can ALSO be served via a legacy-fallback alias that bypasses ENABLE_V8_GLOBAL / org
// V8 enablement (see Gateway.ts). Same handlers, same org scope, same permission gate.
const managerRouter = Router();
managerRouter.use(requirePermission('manage_workstreams'));

/**
 * GET /api/v8/execution-control/manager/lanes/:laneId/problems
 * Flat list of ManagerProblemRow[] for the given lane — real data from DB.
 */
managerRouter.get(
  '/lanes/:laneId/problems',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const laneId = String(req.params.laneId);
    if (!VALID_LANES.has(laneId)) {
      return res.status(400).json({
        error: `Invalid laneId: ${laneId}`,
        code: 'MANAGER_LANE_INVALID',
      });
    }
    const projectId = firstQueryString(req.query.projectId);
    const problems = await getManagerProblems(organizationId, laneId, projectId);
    return res.json({
      data: { problems, count: problems.length },
      meta: executionControlMeta(),
    });
  })
);

managerRouter.post(
  '/lanes/:laneId/problem-actions/execute',
  validateBody(ManagerProblemActionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const laneId = String(req.params.laneId);
    if (!VALID_LANES.has(laneId)) {
      return res.status(400).json({
        error: `Invalid laneId: ${laneId}`,
        code: 'MANAGER_LANE_INVALID',
      });
    }
    const projectId = firstQueryString(req.query.projectId);
    const { problemId, actionId } = req.body;
    const result = await executeManagerProblemAction({
      organizationId,
      userId,
      laneId,
      problemId,
      actionId,
      projectId,
    });
    return res.json({
      data: result,
      meta: executionControlMutationMeta(),
    });
  })
);

managerRouter.post(
  '/lanes/:laneId/suggestions/apply',
  validateBody(ManagerSuggestionApplySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const laneId = String(req.params.laneId);
    if (!VALID_LANES.has(laneId)) {
      return res.status(400).json({
        error: `Invalid laneId: ${laneId}`,
        code: 'MANAGER_LANE_INVALID',
      });
    }
    const projectId = firstQueryString(req.query.projectId);
    const { suggestionId } = req.body;
    const result = await applyManagerSuggestion({
      organizationId,
      userId,
      laneId,
      suggestionId,
      projectId,
    });
    return res.json({
      data: result,
      meta: executionControlMutationMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/manager/lanes/:laneId/analysis
 * Full 6-section analysis for a lane.
 */
managerRouter.get(
  '/lanes/:laneId/analysis',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const laneId = String(req.params.laneId);
    if (!VALID_LANES.has(laneId)) {
      return res.status(400).json({
        error: `Invalid laneId: ${laneId}`,
        code: 'MANAGER_LANE_INVALID',
      });
    }
    const projectId = firstQueryString(req.query.projectId);
    const analysis = await analyzeLane(organizationId, laneId, projectId);
    return res.json({
      data: analysis,
      meta: executionControlMeta(),
    });
  })
);

/**
 * POST /api/v8/execution-control/manager/lanes/:laneId/decisions
 * Submit a decision on a suggestion.
 */
managerRouter.post(
  '/lanes/:laneId/decisions',
  validateBody(LaneDecisionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const laneId = String(req.params.laneId);
    if (!VALID_LANES.has(laneId)) {
      return res.status(400).json({ error: 'Invalid lane', code: 'MANAGER_LANE_INVALID' });
    }
    const { suggestionId, state, notes } = req.body;
    let decisionId = `ldec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const existing = await dbAll<{ id: string }>(
        `SELECT id
         FROM v8_lane_decisions
         WHERE organization_id = ? AND lane_id = ? AND suggestion_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [organizationId, laneId, suggestionId]
      );
      if (existing[0]?.id) {
        decisionId = existing[0].id;
      }

      // Wave-4 defense-in-depth: decisionId is either freshly server-generated or
      // fetched from an org-scoped lookup above, so an exploitable cross-org id
      // collision is not practically reachable — but consistent with the fixed
      // wave-3 ON CONFLICT pattern, guard the DO UPDATE with the existing row's
      // organization_id so any (id) collision against another org is a no-op.
      await dbRun(
        `INSERT INTO v8_lane_decisions (id, organization_id, lane_id, suggestion_id, state, decided_by, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, decided_by = EXCLUDED.decided_by, notes = EXCLUDED.notes, decided_at = NOW(), updated_at = NOW()
           WHERE v8_lane_decisions.organization_id = ?`,
        [
          decisionId,
          organizationId,
          laneId,
          suggestionId,
          state,
          userId,
          notes || null,
          organizationId,
        ]
      );
    } catch {
      // table may not exist — create it on the fly
      await dbRun(
        `
        CREATE TABLE IF NOT EXISTS v8_lane_decisions (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          lane_id TEXT NOT NULL,
          suggestion_id TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'proposed',
          decided_by TEXT,
          decided_at TIMESTAMPTZ,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `,
        []
      );
      try {
        await dbRun(
          `CREATE UNIQUE INDEX IF NOT EXISTS v8_lane_decisions_org_lane_suggestion_idx
           ON v8_lane_decisions (organization_id, lane_id, suggestion_id)`,
          []
        );
      } catch {
        // best effort for older DBs
      }
      await dbRun(
        `INSERT INTO v8_lane_decisions (id, organization_id, lane_id, suggestion_id, state, decided_by, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON CONFLICT (organization_id, lane_id, suggestion_id)
         DO UPDATE SET state = EXCLUDED.state, decided_by = EXCLUDED.decided_by, notes = EXCLUDED.notes, decided_at = NOW(), updated_at = NOW()`,
        [decisionId, organizationId, laneId, suggestionId, state, userId, notes || null]
      );
    }

    return res.json({
      data: { success: true, decisionId },
      meta: executionControlMutationMeta(),
    });
  })
);

/**
 * POST /api/v8/execution-control/manager/lanes/:laneId/execute
 * Create execution plan from an approved decision.
 */
managerRouter.post(
  '/lanes/:laneId/execute',
  validateBody(LaneExecuteSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const laneId = String(req.params.laneId);
    if (!VALID_LANES.has(laneId)) {
      return res.status(400).json({ error: 'Invalid lane', code: 'MANAGER_LANE_INVALID' });
    }
    const { decisionId } = req.body;
    const planId = `lep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Same-org integrity (defense-in-depth): mirror the sibling handlers — verify
    // the referenced decision exists in the caller's org before creating an
    // execution plan. Without this, an unknown/foreign decisionId would silently
    // create an org-stamped plan referencing a non-existent (or cross-org) decision
    // while the downstream state UPDATE is an org-scoped no-op. The decisions table
    // may not exist on older DBs; treat a lookup failure as "table absent" and fall
    // through (the INSERT itself is harmless and the UPDATE remains org-scoped).
    try {
      const decision = await dbGet<{ id: string }>(
        `SELECT id FROM v8_lane_decisions WHERE id = ? AND organization_id = ?`,
        [decisionId, organizationId],
        { fallback: true }
      );
      if (!decision?.id) {
        return res
          .status(404)
          .json({ error: 'Decision not found', code: 'MANAGER_DECISION_NOT_FOUND' });
      }
    } catch {
      // v8_lane_decisions table may not exist yet — fall through to plan creation.
    }

    try {
      await dbRun(
        `
        CREATE TABLE IF NOT EXISTS v8_lane_execution_plans (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          lane_id TEXT NOT NULL,
          decision_id TEXT NOT NULL,
          tasks_json TEXT DEFAULT '[]',
          before_state TEXT,
          after_state TEXT,
          verification_status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `,
        []
      );
    } catch {
      // table exists
    }

    await dbRun(
      `INSERT INTO v8_lane_execution_plans (id, organization_id, lane_id, decision_id, tasks_json, verification_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, '[]', 'pending', NOW(), NOW())`,
      [planId, organizationId, laneId, decisionId]
    );

    // Update the decision state to in_execution
    try {
      await dbRun(
        `UPDATE v8_lane_decisions SET state = 'in_execution', updated_at = NOW() WHERE id = ? AND organization_id = ?`,
        [decisionId, organizationId]
      );
    } catch {
      // best effort
    }

    return res.json({
      data: { success: true, planId },
      meta: executionControlMutationMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/manager/lanes/:laneId/verification
 * Get execution plans for verification readback.
 */
managerRouter.get(
  '/lanes/:laneId/verification',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const laneId = String(req.params.laneId);
    if (!VALID_LANES.has(laneId)) {
      return res.status(400).json({ error: 'Invalid lane', code: 'MANAGER_LANE_INVALID' });
    }

    let plans: any[] = [];
    try {
      plans = ((await dbAll(
        `SELECT id, decision_id as "decisionId", tasks_json as "tasksJson",
                before_state as "beforeState", after_state as "afterState",
                verification_status as "verificationStatus"
         FROM v8_lane_execution_plans
         WHERE organization_id = ? AND lane_id = ?
         ORDER BY created_at DESC`,
        [organizationId, laneId]
      )) || []) as any[];

      plans = plans.map((p) => ({
        ...p,
        tasks: p.tasksJson ? JSON.parse(p.tasksJson) : [],
      }));
    } catch {
      // table may not exist
    }

    return res.json({
      data: { plans },
      meta: executionControlMeta(),
    });
  })
);

// ────────────────────────────────────────────────────────────────
// Manager AI endpoints
// ────────────────────────────────────────────────────────────────

/**
 * POST /api/v8/execution-control/manager/lanes/:laneId/ai/recommend
 * AI recommendation for a single problem.
 */
managerRouter.post(
  '/lanes/:laneId/ai/recommend',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const laneId = String(req.params.laneId);
    if (!VALID_LANES.has(laneId)) {
      return res.status(400).json({ error: 'Invalid lane', code: 'MANAGER_LANE_INVALID' });
    }
    const { problemId } = req.body;
    if (!problemId) {
      return res.status(400).json({ error: 'problemId required', code: 'MISSING_PARAM' });
    }
    const projectId = firstQueryString(req.query.projectId);
    const recommendation = await getAiRecommendation(organizationId, laneId, problemId, projectId);
    return res.json({ data: recommendation, meta: executionControlMeta() });
  })
);

/**
 * POST /api/v8/execution-control/manager/lanes/:laneId/ai/triage
 * AI clustering and prioritization of all problems in a lane.
 */
managerRouter.post(
  '/lanes/:laneId/ai/triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const laneId = String(req.params.laneId);
    if (!VALID_LANES.has(laneId)) {
      return res.status(400).json({ error: 'Invalid lane', code: 'MANAGER_LANE_INVALID' });
    }
    const projectId = firstQueryString(req.query.projectId);
    const triage = await getAiTriage(organizationId, laneId, projectId);
    return res.json({ data: triage, meta: executionControlMeta() });
  })
);

/**
 * POST /api/v8/execution-control/manager/lanes/:laneId/ai/manage-all
 * Comprehensive AI management plan for an entire lane.
 */
managerRouter.post(
  '/lanes/:laneId/ai/manage-all',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const laneId = String(req.params.laneId);
    if (!VALID_LANES.has(laneId)) {
      return res.status(400).json({ error: 'Invalid lane', code: 'MANAGER_LANE_INVALID' });
    }
    const projectId = firstQueryString(req.query.projectId);
    const plan = await getAiManageAll(organizationId, laneId, projectId);
    return res.json({ data: plan, meta: executionControlMeta() });
  })
);

// Mount the manager sub-router under the canonical /manager prefix for the gated
// /api/v8 mount (external paths unchanged: /api/v8/execution-control/manager/lanes/...).
router.use('/manager', managerRouter);

export { managerRouter };

export default router;
