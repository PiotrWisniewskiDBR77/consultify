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

export default router;
