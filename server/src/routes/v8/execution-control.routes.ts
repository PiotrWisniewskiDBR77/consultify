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
import { detectRiskSignals } from '../../services/riskDetectionService.js';
import {
  getExecutionControlTowerItemDetail,
  getExecutionControlTowerQueues,
  V8_EXECUTION_CONTROL_TOWER_CONTRACT,
} from '../../services/v8ExecutionControlTowerService.js';
import { getCapacityTimeline, getLevelingAlerts } from '../../services/workloadCapacityService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';

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

const CONTROL_TOWER_QUEUES = new Set([
  'late',
  'at_risk',
  'blocked',
  'overloaded',
  'stale',
  'all',
]);

const firstQueryString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

const DismissAlertSchema = z.object({
  signalId: z.string().min(1),
});

const TimelineUpdateSchema = z.object({
  initiativeId: z.string().min(1),
  field: z.enum([
    'status',
    'planned_start_date',
    'planned_end_date',
    'start_date',
    'actual_end_date',
    'progress',
  ]),
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

    await dbRun(
      `INSERT INTO risk_signal_alerts (id, organization_id, signal_type, severity, title, is_dismissed, dismissed_by, dismissed_at)
       VALUES (?, ?, 'DISMISSED', 'LOW', ?, TRUE, ?, NOW())
       ON CONFLICT (id) DO UPDATE SET is_dismissed = TRUE, dismissed_by = ?, dismissed_at = NOW()`,
      [signalId, organizationId, `Dismissed: ${signalId}`, userId, userId]
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

    const payload = await getExecutionControlTowerQueues(organizationId, { projectId, queue });
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

      await dbRun(
        `INSERT INTO delay_signals
           (id, organization_id, entity_type, entity_id, entity_name, deviation_type, severity, days_deviation,
            is_dismissed, dismissed_by, dismissed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'WARNING', 0, TRUE, ?, NOW(), NOW(), NOW())
         ON CONFLICT (id)
         DO UPDATE SET is_dismissed = TRUE, dismissed_by = EXCLUDED.dismissed_by, dismissed_at = NOW(), updated_at = NOW()`,
        [signalId, organizationId, entityType, entityId, entityName, deviationType, userId]
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
 */
router.get(
  '/capacity/leveling-alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const alerts = await getLevelingAlerts(organizationId);
    return res.json({
      data: { alerts },
      meta: executionControlMeta(),
    });
  })
);

/**
 * GET /api/v8/execution-control/capacity/timeline
 */
router.get(
  '/capacity/timeline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const initiativeId = firstQueryString(req.query.initiativeId);
    const weeks = await getCapacityTimeline(organizationId, initiativeId);
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
    const id = await createBudgetEntry(organizationId, { ...req.body, createdBy: userId });
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

router.post(
  '/timeline-update',
  validateBody(TimelineUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const { initiativeId, field, value, reason } = req.body;

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
  userId: string
) {
  try {
    await dbRun(
      `INSERT INTO execution_audit_log (id, organization_id, initiative_id, field_changed, old_value, new_value, change_reason, changed_by)
       VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, ?, ?, ?)`,
      [orgId, initiativeId, field, String(oldVal ?? ''), String(newVal ?? ''), reason, userId]
    );
  } catch {
    // best-effort audit
  }
}

async function refreshControlTower(
  organizationId: string,
  projectId?: string,
  entityType?: 'INITIATIVE' | 'TASK',
  entityId?: string
) {
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
  return { queues, drillDown };
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
    const { organizationId, userId } = getV8Context(req);
    const { entityType, entityId, newOwnerId, reason } = req.body;

    if (entityType === 'TASK') {
      const old = (await dbAll(
        `SELECT assignee_id FROM tasks WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { assignee_id: string | null }[];
      if (!old?.length) {
        return res.status(404).json({ error: 'Task not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      await dbRun(
        `UPDATE tasks SET assignee_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
        [newOwnerId, entityId, organizationId]
      );
      await auditLog(organizationId, null, 'assignee_id', old[0].assignee_id, newOwnerId, reason || null, userId);
    } else {
      const old = (await dbAll(
        `SELECT owner_execution_id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { owner_execution_id: string | null }[];
      if (!old?.length) {
        return res.status(404).json({ error: 'Initiative not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      await dbRun(
        `UPDATE initiatives SET owner_execution_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
        [newOwnerId, entityId, organizationId]
      );
      await auditLog(organizationId, entityId, 'owner_execution_id', old[0].owner_execution_id, newOwnerId, reason || null, userId);
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
    const { organizationId, userId } = getV8Context(req);
    const { entityType, entityId, forecastStartDate, forecastEndDate, allocatedHours, reason } =
      req.body;

    if (entityType === 'TASK') {
      const old = (await dbAll(
        `SELECT due_date, estimated_hours FROM tasks WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { due_date: string | null; estimated_hours: number | null }[];
      if (!old?.length) {
        return res.status(404).json({ error: 'Task not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
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
        return res.status(400).json({ error: 'No fields to smooth', code: 'EXECUTION_SMOOTH_EMPTY' });
      }
      sets.push('updated_at = NOW()');
      params.push(entityId, organizationId);
      await dbRun(
        `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        params
      );
      await auditLog(organizationId, null, 'smooth', JSON.stringify(old[0]), JSON.stringify({ forecastEndDate, allocatedHours }), reason || null, userId);
    } else {
      const old = (await dbAll(
        `SELECT planned_start_date, planned_end_date FROM initiatives WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { planned_start_date: string | null; planned_end_date: string | null }[];
      if (!old?.length) {
        return res.status(404).json({ error: 'Initiative not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      const sets: string[] = [];
      const params: unknown[] = [];
      if (forecastStartDate) {
        sets.push('planned_start_date = ?');
        params.push(forecastStartDate);
      }
      if (forecastEndDate) {
        sets.push('planned_end_date = ?');
        params.push(forecastEndDate);
      }
      if (sets.length === 0) {
        return res.status(400).json({ error: 'No fields to smooth', code: 'EXECUTION_SMOOTH_EMPTY' });
      }
      sets.push('updated_at = NOW()');
      params.push(entityId, organizationId);
      await dbRun(
        `UPDATE initiatives SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        params
      );
      await auditLog(organizationId, entityId, 'smooth', JSON.stringify(old[0]), JSON.stringify({ forecastStartDate, forecastEndDate }), reason || null, userId);
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
    const { organizationId, userId } = getV8Context(req);
    const { entityType, entityId, forecastStartDate, forecastEndDate, forecastEffortHours, reason } =
      req.body;

    if (entityType === 'TASK') {
      const old = (await dbAll(
        `SELECT due_date, estimated_hours FROM tasks WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { due_date: string | null; estimated_hours: number | null }[];
      if (!old?.length) {
        return res.status(404).json({ error: 'Task not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
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
        return res.status(400).json({ error: 'No forecast fields to update', code: 'EXECUTION_REPLAN_EMPTY' });
      }
      sets.push('updated_at = NOW()');
      params.push(entityId, organizationId);
      await dbRun(
        `UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        params
      );
      await auditLog(organizationId, null, 'replan', JSON.stringify(old[0]), JSON.stringify({ forecastEndDate, forecastEffortHours }), reason, userId);
    } else {
      const old = (await dbAll(
        `SELECT planned_start_date, planned_end_date FROM initiatives WHERE id = ? AND organization_id = ?`,
        [entityId, organizationId]
      )) as { planned_start_date: string | null; planned_end_date: string | null }[];
      if (!old?.length) {
        return res.status(404).json({ error: 'Initiative not found', code: 'EXECUTION_ENTITY_NOT_FOUND' });
      }
      const sets: string[] = [];
      const params: unknown[] = [];
      if (forecastStartDate) {
        sets.push('planned_start_date = ?');
        params.push(forecastStartDate);
      }
      if (forecastEndDate) {
        sets.push('planned_end_date = ?');
        params.push(forecastEndDate);
      }
      if (sets.length === 0) {
        return res.status(400).json({ error: 'No forecast fields to update', code: 'EXECUTION_REPLAN_EMPTY' });
      }
      sets.push('updated_at = NOW()');
      params.push(entityId, organizationId);
      await dbRun(
        `UPDATE initiatives SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
        params
      );
      await auditLog(organizationId, entityId, 'replan', JSON.stringify(old[0]), JSON.stringify({ forecastStartDate, forecastEndDate }), reason, userId);
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
    const { organizationId, userId } = getV8Context(req);
    const { entityType, entityId, escalationType, title, description, ownerId, dueDate } = req.body;

    const initiativeId =
      entityType === 'INITIATIVE'
        ? entityId
        : ((
            (await dbAll(
              `SELECT initiative_id FROM tasks WHERE id = ? AND organization_id = ?`,
              [entityId, organizationId]
            )) as { initiative_id: string | null }[]
          )?.[0]?.initiative_id ?? null);

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
      `SELECT planned_start_date, planned_end_date, start_date, actual_end_date, progress
       FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, organizationId]
    )) as {
      planned_start_date: string | null;
      planned_end_date: string | null;
      start_date: string | null;
      actual_end_date: string | null;
      progress: number | null;
    }[];

    if (!inits?.length) {
      return res.status(404).json({ error: 'Initiative not found', code: 'EXECUTION_INITIATIVE_NOT_FOUND' });
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

    const forecastStart = init.start_date || init.planned_start_date;
    const forecastEnd = init.actual_end_date || init.planned_end_date;

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
        variance: hasBaseline
          ? { startDays: startVarianceDays, endDays: endVarianceDays }
          : null,
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

export default router;
