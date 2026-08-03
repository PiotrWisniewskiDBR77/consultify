/**
 * Execution Control Routes (T039–T042)
 *
 * API endpoints for:
 *  - Risk signal detection (heuristic) — T040
 *  - Execution audit log (timeline changes) — T039
 *  - Initiative timeline updates with audit trail — T039
 *  - Risk alert dismissal — T040
 *  - Mitigation management — T040
 *  - Delay detection & schedule control — T041
 *  - Budget planning & financial control — T042
 */
import { Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { requireOrgRole } from '../middleware/rbac.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import {
  advanceWorkaround,
  buildWorkaroundFromSignal,
  type ClosedLoopWorkaround,
} from '../services/closedLoopService.js';
import {
  detectDelaySignals,
  getPersistedDelaySignals,
  persistDelaySignals,
} from '../services/delayDetectionService.js';
import {
  createBudgetEntry,
  deleteBudgetEntry,
  detectOverspendSignals,
  getBudgetEntries,
  getInitiativeBudgetSummary,
  getPortfolioBudgetSummary,
} from '../services/executionBudgetService.js';
import { getTimelineWarningsSnapshot } from '../services/executionControlReadService.js';
import { dispatchProjectCommunicationEvent } from '../services/integrations/communicationSyncService.js';
import { detectRiskSignals } from '../services/riskDetectionService.js';
import { getCapacityTimeline, getOverloadAlerts } from '../services/workloadCapacityService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';

const router = Router();

// ================================================================
// T040: Risk Signals
// ================================================================

router.get(
  '/risk-signals',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { projectId } = req.query;
    const signals = await detectRiskSignals(orgId, projectId as string | undefined);
    return res.json({ signals, count: signals.length });
  })
);

router.post(
  '/risk-signals/dispatch',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const projectId =
      typeof req.body?.projectId === 'string' && req.body.projectId.trim()
        ? req.body.projectId.trim()
        : undefined;
    const signals = await detectRiskSignals(orgId, projectId);
    const criticalSignals = signals.slice(0, 5);

    const deliveries = await Promise.all(
      criticalSignals.map((signal) =>
        dispatchProjectCommunicationEvent({
          organizationId: orgId,
          projectId,
          eventType: 'risk_alert',
          title: signal.title,
          body: signal.description || signal.suggestedAction || 'Execution risk detected.',
          deepLink: signal.initiativeId ? `/initiatives/${signal.initiativeId}` : null,
          severity:
            signal.severity === 'CRITICAL'
              ? 'critical'
              : signal.severity === 'HIGH'
                ? 'high'
                : 'normal',
        })
      )
    );

    return res.json({
      success: true,
      signals: criticalSignals.length,
      deliveries: deliveries.flat(),
    });
  })
);

// ================================================================
// T040: Dismiss risk alert
// ================================================================

const DismissAlertSchema = z.object({
  signalId: z.string().min(1),
});

router.post(
  '/risk-signals/dismiss',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  validateBody(DismissAlertSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { signalId } = req.body;
    await dbRun(
      // Cross-org guard on DO UPDATE: risk-signal ids are deterministic
      // (overdue-${initiativeId} etc.), so without the org WHERE an org-A caller
      // could dismiss an org-B alert by guessing its id. Mirrors the v8 fix.
      `INSERT INTO risk_signal_alerts (id, organization_id, signal_type, severity, title, is_dismissed, dismissed_by, dismissed_at)
       VALUES (?, ?, 'DISMISSED', 'LOW', ?, TRUE, ?, NOW())
       ON CONFLICT (id) DO UPDATE SET is_dismissed = TRUE, dismissed_by = ?, dismissed_at = NOW()
       WHERE risk_signal_alerts.organization_id = ?`,
      [signalId, orgId, `Dismissed: ${signalId}`, userId, userId, orgId]
    );
    return res.json({ success: true });
  })
);

// ================================================================
// T039: Execution Audit Log
// ================================================================

router.get(
  '/audit-log',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { initiativeId, limit = '50' } = req.query;
    let query = `
      SELECT eal.*, u.first_name, u.last_name, u.avatar_url, i.name as initiative_name
      FROM execution_audit_log eal
      LEFT JOIN users u ON u.id = eal.changed_by
      LEFT JOIN initiatives i ON i.id = eal.initiative_id
      WHERE eal.organization_id = ?
    `;
    const params: unknown[] = [orgId];

    if (initiativeId) {
      query += ' AND eal.initiative_id = ?';
      params.push(initiativeId);
    }

    query += ` ORDER BY eal.changed_at DESC LIMIT ?`;
    params.push(Math.min(parseInt(limit as string, 10) || 50, 200));

    const rows = (await dbAll(query, params)) || [];
    return res.json({ entries: rows });
  })
);

// ================================================================
// T039: Update initiative timeline fields with audit trail
// ================================================================

// ★ INI-005 follow-up fix (2026-08-01): `field` used to be a Zod enum that
// INCLUDED 'status', with `value: z.string()` completely unconstrained — i.e.
// `{field:'status', value:'EXECUTING'}` was a legal request that did a raw
// `UPDATE initiatives SET status = ?` with NO transition validation, NO row
// lock, NO GO/NO-GO decision check, NO audit-history row (only a generic
// execution_audit_log entry). This endpoint's real purpose is timeline/date
// fields (see the allow-list below) — status changes belong exclusively to
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

router.post(
  '/timeline-update',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  validateBody(TimelineUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

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
      [initiativeId, orgId]
    )) as { current_value: string | null }[];

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Initiative not found' });
    }

    const oldValue = existing[0].current_value;

    // Always scope updates by organization_id to avoid cross-tenant writes.
    await dbRun(
      `UPDATE initiatives SET ${field} = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [value, initiativeId, orgId]
    );

    await dbRun(
      `INSERT INTO execution_audit_log (id, organization_id, initiative_id, field_changed, old_value, new_value, change_reason, changed_by)
       VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, ?, ?, ?)`,
      [orgId, initiativeId, field, oldValue, value, reason || null, userId]
    );

    return res.json({ success: true, field, oldValue, newValue: value });
  })
);

// ================================================================
// T039: Top warnings (overdue, blocked, dependency risk)
// ================================================================

router.get(
  '/warnings',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { projectId } = req.query;
    const { warnings, total } = await getTimelineWarningsSnapshot(
      orgId,
      typeof projectId === 'string' ? projectId : undefined
    );
    return res.json({ warnings, total });
  })
);

// ================================================================
// T040: RAID mitigation update
// ================================================================

const MitigationUpdateSchema = z.object({
  raidItemId: z.string().min(1),
  mitigationPlan: z.string().optional(),
  responseStrategy: z.enum(['AVOID', 'TRANSFER', 'MITIGATE', 'ACCEPT', 'ESCALATE']).optional(),
  mitigationOwnerId: z.string().optional(),
  mitigationDueDate: z.string().optional(),
  mitigationStatus: z.enum(['OPEN', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'CLOSED']).optional(),
});

router.patch(
  '/raid/:id/mitigation',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  validateBody(MitigationUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { raidItemId, ...fields } = req.body;
    const updates: string[] = [];
    const params: unknown[] = [];

    if (fields.mitigationPlan !== undefined) {
      updates.push('mitigation_plan = ?');
      params.push(fields.mitigationPlan);
    }
    if (fields.responseStrategy !== undefined) {
      updates.push('response_strategy = ?');
      params.push(fields.responseStrategy);
    }
    if (fields.mitigationOwnerId !== undefined) {
      updates.push('mitigation_owner_id = ?');
      params.push(fields.mitigationOwnerId);
    }
    if (fields.mitigationDueDate !== undefined) {
      updates.push('mitigation_due_date = ?');
      params.push(fields.mitigationDueDate);
    }
    if (fields.mitigationStatus !== undefined) {
      updates.push('mitigation_status = ?');
      params.push(fields.mitigationStatus);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id, orgId);

    await dbRun(
      `UPDATE raid_items SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    return res.json({ success: true });
  })
);

// ================================================================
// T041: Delay Detection — live detection
// ================================================================

router.get(
  '/delay-signals',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { projectId, severity, entityType, persisted } = req.query;

    if (persisted === 'true') {
      const signals = await getPersistedDelaySignals(orgId, {
        projectId: projectId as string | undefined,
        severity: severity as 'WARNING' | 'CRITICAL' | undefined,
        entityType: entityType as 'INITIATIVE' | 'TASK' | undefined,
      });
      return res.json({ signals, count: signals.length });
    }

    const signals = await detectDelaySignals(orgId, projectId as string | undefined);
    const filtered = signals.filter((s) => {
      if (severity && s.severity !== severity) return false;
      if (entityType && s.entityType !== entityType) return false;
      return true;
    });
    return res.json({ signals: filtered, count: filtered.length });
  })
);

// ================================================================
// T041: Delay Detection — dismiss signal
// ================================================================

const DismissDelaySchema = z.object({
  signalId: z.string().min(1),
  entityType: z.enum(['INITIATIVE', 'TASK']),
  entityId: z.string().min(1),
  deviationType: z.string().min(1),
});

router.post(
  '/delay-signals/dismiss',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  validateBody(DismissDelaySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { signalId, entityType, entityId, deviationType } = req.body;
    const updateRes = await dbRun(
      `UPDATE delay_signals
       SET is_dismissed = TRUE, dismissed_by = ?, dismissed_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [userId, signalId, orgId]
    );

    // If the signal was never persisted, create a minimal dismissed row so
    // live detection can still respect the dismissal (by id).
    if ((updateRes?.changes || 0) === 0) {
      let entityName = String(signalId);
      try {
        if (entityType === 'INITIATIVE') {
          const rows = (await dbAll(
            `SELECT COALESCE(name, title) as entity_name
             FROM initiatives
             WHERE id = ? AND organization_id = ?
             LIMIT 1`,
            [entityId, orgId]
          )) as Array<{ entity_name?: string | null }>;
          const n = rows?.[0]?.entity_name;
          if (n) entityName = String(n);
        } else if (entityType === 'TASK') {
          const rows = (await dbAll(
            `SELECT title as entity_name
             FROM tasks
             WHERE id = ? AND organization_id = ?
             LIMIT 1`,
            [entityId, orgId]
          )) as Array<{ entity_name?: string | null }>;
          const n = rows?.[0]?.entity_name;
          if (n) entityName = String(n);
        }
      } catch {
        // non-blocking
      }

      await dbRun(
        `INSERT INTO delay_signals
           (id, organization_id, entity_type, entity_id, entity_name, deviation_type, severity, days_deviation,
            is_dismissed, dismissed_by, dismissed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'WARNING', 0, TRUE, ?, NOW(), NOW(), NOW())
         ON CONFLICT (id)
         DO UPDATE SET is_dismissed = TRUE, dismissed_by = EXCLUDED.dismissed_by, dismissed_at = NOW(), updated_at = NOW()
         WHERE delay_signals.organization_id = ?`,
        [signalId, orgId, entityType, entityId, entityName, deviationType, userId, orgId]
      );
    }
    return res.json({ success: true });
  })
);

// ================================================================
// T041: Delay Detection — worker endpoint (cron trigger)
// ================================================================

router.post(
  '/delay-signals/detect',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { projectId } = req.body;
    const signals = await detectDelaySignals(orgId, projectId);
    const result = await persistDelaySignals(orgId, signals);
    return res.json({
      success: true,
      detected: signals.length,
      persisted: result.persisted,
      alertsSent: result.alertsSent,
    });
  })
);

// ================================================================
// T042: Budget entries — list
// ================================================================

router.get(
  '/budget/entries/:initiativeId',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const initId = String(req.params.initiativeId);
    const entries = await getBudgetEntries(orgId, initId);
    return res.json({ entries, count: entries.length });
  })
);

// ================================================================
// T042: Budget entries — create
// ================================================================

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

router.post(
  '/budget/entries',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  validateBody(CreateBudgetEntrySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const id = await createBudgetEntry(orgId, { ...req.body, createdBy: userId });
    return res.json({ success: true, id });
  })
);

// ================================================================
// T042: Budget entries — delete
// ================================================================

router.delete(
  '/budget/entries/:entryId',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { initiativeId } = req.query;
    if (!initiativeId) return res.status(400).json({ error: 'initiativeId is required' });

    await deleteBudgetEntry(orgId, String(req.params.entryId), String(initiativeId));
    return res.json({ success: true });
  })
);

// ================================================================
// T042: Budget summary — initiative level
// ================================================================

router.get(
  '/budget/initiative/:initiativeId',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const summary = await getInitiativeBudgetSummary(orgId, String(req.params.initiativeId));
    if (!summary) return res.status(404).json({ error: 'Initiative not found' });
    return res.json(summary);
  })
);

// ================================================================
// T042: Budget summary — portfolio level
// ================================================================

router.get(
  '/budget/portfolio',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { projectId } = req.query;
    const summary = await getPortfolioBudgetSummary(orgId, projectId as string | undefined);
    return res.json(summary);
  })
);

// ================================================================
// T042: Overspend signals
// ================================================================

router.get(
  '/budget/overspend-signals',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { projectId } = req.query;
    const signals = await detectOverspendSignals(orgId, projectId as string | undefined);
    return res.json({ signals, count: signals.length });
  })
);

// ================================================================
// V4-EXEC-05: Closed-loop workarounds
// ================================================================

const CreateWorkaroundSchema = z.object({
  signalId: z.string().min(1),
  signalType: z.string().min(1),
  initiativeId: z.string().min(1),
});

router.post(
  '/workarounds',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  validateBody(CreateWorkaroundSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { signalId, signalType, initiativeId } = req.body;
    const partial = buildWorkaroundFromSignal({ id: signalId, signalType, initiativeId });

    const id = `clw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    if (partial.steps?.[0]) {
      partial.steps[0].completedBy = userId;
    }

    await dbRun(
      `INSERT INTO closed_loop_workarounds (id, organization_id, initiative_id, signal_id, signal_type, status, steps_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        initiativeId,
        signalId,
        signalType,
        partial.status,
        JSON.stringify(partial.steps),
        now,
        now,
      ]
    );

    await dbRun(
      `INSERT INTO execution_audit_log (id, organization_id, initiative_id, field_changed, old_value, new_value, change_reason, changed_by)
       VALUES (gen_random_uuid()::TEXT, ?, ?, 'closed_loop_workaround', NULL, ?, 'Workaround created from signal', ?)`,
      [orgId, initiativeId, id, userId]
    );

    return res.json({
      id,
      signalId,
      signalType,
      initiativeId,
      organizationId: orgId,
      status: partial.status,
      steps: partial.steps,
      createdAt: now,
    });
  })
);

router.get(
  '/workarounds',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { initiativeId, status, limit = '50', offset = '0' } = req.query;
    let query = `SELECT * FROM closed_loop_workarounds WHERE organization_id = ?`;
    const params: unknown[] = [orgId];

    if (initiativeId) {
      query += ' AND initiative_id = ?';
      params.push(initiativeId);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(parseInt(limit as string, 10) || 50, 200));
    params.push(parseInt(offset as string, 10) || 0);

    const rows = ((await dbAll(query, params)) || []) as ClosedLoopWorkaroundRow[];
    const workarounds = rows.map(parseWorkaroundRow);
    return res.json({ workarounds, count: workarounds.length });
  })
);

router.get(
  '/workarounds/:id',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const rows = (await dbAll(
      `SELECT * FROM closed_loop_workarounds WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as ClosedLoopWorkaroundRow[];

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Workaround not found' });
    }

    return res.json(parseWorkaroundRow(rows[0]));
  })
);

const AdvanceWorkaroundSchema = z.object({
  stepId: z.string().min(1),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

router.patch(
  '/workarounds/:id/advance',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  validateBody(AdvanceWorkaroundSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const rows = (await dbAll(
      `SELECT * FROM closed_loop_workarounds WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as ClosedLoopWorkaroundRow[];

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Workaround not found' });
    }

    const workaround = parseWorkaroundRow(rows[0]);
    const { stepId, entityType, entityId } = req.body;

    const updated = advanceWorkaround(workaround, stepId, entityType, entityId, userId);

    if (stepId === 'raid' && entityId) {
      await dbRun(
        `UPDATE closed_loop_workarounds SET raid_item_id = ?, status = ?, steps_json = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
        [entityId, updated.status, JSON.stringify(updated.steps), req.params.id, orgId]
      );
    } else {
      await dbRun(
        `UPDATE closed_loop_workarounds SET status = ?, steps_json = ?, updated_at = NOW()${updated.closedAt ? ', closed_at = NOW()' : ''} WHERE id = ? AND organization_id = ?`,
        [updated.status, JSON.stringify(updated.steps), req.params.id, orgId]
      );
    }

    await dbRun(
      `INSERT INTO execution_audit_log (id, organization_id, initiative_id, field_changed, old_value, new_value, change_reason, changed_by)
       VALUES (gen_random_uuid()::TEXT, ?, ?, 'closed_loop_step', ?, ?, ?, ?)`,
      [orgId, updated.initiativeId, stepId, updated.status, `Step ${stepId} advanced`, userId]
    );

    return res.json(updated);
  })
);

const CreateMitigationTaskSchema = z.object({
  title: z.string().min(1),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

router.post(
  '/workarounds/:id/create-mitigation-task',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  validateBody(CreateMitigationTaskSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const rows = (await dbAll(
      `SELECT * FROM closed_loop_workarounds WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as ClosedLoopWorkaroundRow[];

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Workaround not found' });
    }

    const workaround = parseWorkaroundRow(rows[0]);
    if (!workaround.raidItemId) {
      return res
        .status(400)
        .json({ error: 'Workaround has no linked RAID item. Advance the raid step first.' });
    }

    const { title, assigneeId, dueDate } = req.body;
    // F15 (data-integrity, continuation of Z139): decode HTML entities the
    // global input-sanitization middleware escaped on this request body
    // string, before storing tasks.title.
    const decodedTitle = decodeHtmlEntities(String(title));
    const taskId = `task-clw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO tasks (id, organization_id, initiative_id, raid_item_id, title, status, priority, assignee_id, due_date, reporter_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'todo', 'high', ?, ?, ?, ?, ?)`,
      [
        taskId,
        orgId,
        workaround.initiativeId,
        workaround.raidItemId,
        decodedTitle,
        assigneeId || null,
        dueDate || null,
        userId,
        now,
        now,
      ]
    );

    const updated = advanceWorkaround(workaround, 'task', 'task', taskId, userId);

    await dbRun(
      `UPDATE closed_loop_workarounds SET status = ?, steps_json = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [updated.status, JSON.stringify(updated.steps), req.params.id, orgId]
    );

    return res.json({
      task: {
        id: taskId,
        title: decodedTitle,
        assigneeId,
        dueDate,
        raidItemId: workaround.raidItemId,
        status: 'todo',
      },
      workaround: updated,
    });
  })
);

const VerifyWorkaroundSchema = z.object({
  verificationNotes: z.string().optional(),
});

router.post(
  '/workarounds/:id/verify',
  verifyToken,
  isAuthenticated,
  requireOrgRole('admin'),
  validateBody(VerifyWorkaroundSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const rows = (await dbAll(
      `SELECT * FROM closed_loop_workarounds WHERE id = ? AND organization_id = ?`,
      [req.params.id, orgId]
    )) as ClosedLoopWorkaroundRow[];

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Workaround not found' });
    }

    let workaround = parseWorkaroundRow(rows[0]);
    workaround = advanceWorkaround(workaround, 'verify', undefined, undefined, userId);
    workaround = advanceWorkaround(workaround, 'close', undefined, undefined, userId);

    await dbRun(
      `UPDATE closed_loop_workarounds SET status = ?, steps_json = ?, updated_at = NOW(), closed_at = NOW() WHERE id = ? AND organization_id = ?`,
      [workaround.status, JSON.stringify(workaround.steps), req.params.id, orgId]
    );

    if (workaround.raidItemId) {
      await dbRun(
        `UPDATE raid_items SET status = 'CLOSED', mitigation_status = 'CLOSED', updated_at = NOW() WHERE id = ? AND organization_id = ?`,
        [workaround.raidItemId, orgId]
      );
    }

    await dbRun(
      `INSERT INTO execution_audit_log (id, organization_id, initiative_id, field_changed, old_value, new_value, change_reason, changed_by)
       VALUES (gen_random_uuid()::TEXT, ?, ?, 'closed_loop_verified', 'in_progress', 'closed', ?, ?)`,
      [
        orgId,
        workaround.initiativeId,
        req.body.verificationNotes || 'Workaround verified and closed',
        userId,
      ]
    );

    return res.json(workaround);
  })
);

// ================================================================
// V4-EXEC-04: Capacity leveling & timeline
// ================================================================

// ★ #77 wiring fix (2026-07-19): see matching handler + rationale in
// server/src/routes/v8/execution-control.routes.ts — this legacy fallback
// (used when the v8 endpoint 4xx/5xx's, see `shouldFallbackToLegacyExecutionControl`
// in ExecutionHub.tsx) had the identical getLevelingAlerts/getOverloadAlerts
// shape mismatch, so capacityAlerts silently emptied via this path too.
router.get(
  '/capacity/leveling-alerts',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const alerts = await getOverloadAlerts(orgId, 'week');
    return res.json({ alerts });
  })
);

router.get(
  '/capacity/timeline',
  verifyToken,
  isAuthenticated,
  requireOrgRole('user'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { initiativeId } = req.query;
    const rawWeeks = await getCapacityTimeline(orgId, initiativeId as string | undefined);
    const weeks = rawWeeks.map((w) => ({
      weekStart: w.weekStart,
      capacityHours: w.totalCapacity,
      allocatedHours: w.totalAllocated,
      availableHours: Math.round((w.totalCapacity - w.totalAllocated) * 10) / 10,
      utilizationPercent: w.utilizationPercent,
    }));
    return res.json({ weeks });
  })
);

export default router;

// ================================================================
// Helper types
// ================================================================

interface ClosedLoopWorkaroundRow {
  id: string;
  organization_id: string;
  initiative_id: string;
  signal_id: string;
  signal_type: string;
  raid_item_id: string | null;
  status: string;
  steps_json: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

function parseWorkaroundRow(row: ClosedLoopWorkaroundRow): ClosedLoopWorkaround {
  let steps = [];
  try {
    steps = JSON.parse(row.steps_json || '[]');
  } catch {
    steps = [];
  }
  return {
    id: row.id,
    signalId: row.signal_id,
    signalType: row.signal_type,
    raidItemId: row.raid_item_id || undefined,
    initiativeId: row.initiative_id,
    organizationId: row.organization_id,
    status: row.status as ClosedLoopWorkaround['status'],
    steps,
    createdAt: row.created_at,
    closedAt: row.closed_at || undefined,
  };
}
