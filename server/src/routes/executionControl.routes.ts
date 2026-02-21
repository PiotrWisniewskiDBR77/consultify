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
import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
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
import { detectRiskSignals } from '../services/riskDetectionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

// ================================================================
// T040: Risk Signals
// ================================================================

router.get(
  '/risk-signals',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { projectId } = req.query;
    const signals = await detectRiskSignals(orgId, projectId as string | undefined);
    return res.json({ signals, count: signals.length });
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
  validateBody(DismissAlertSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { signalId } = req.body;
    await dbRun(
      `INSERT INTO risk_signal_alerts (id, organization_id, signal_type, severity, title, is_dismissed, dismissed_by, dismissed_at)
       VALUES (?, ?, 'DISMISSED', 'LOW', ?, TRUE, ?, NOW())
       ON CONFLICT (id) DO UPDATE SET is_dismissed = TRUE, dismissed_by = ?, dismissed_at = NOW()`,
      [signalId, orgId, `Dismissed: ${signalId}`, userId, userId]
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

router.post(
  '/timeline-update',
  verifyToken,
  isAuthenticated,
  validateBody(TimelineUpdateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { initiativeId, field, value, reason } = req.body;

    const existing = (await dbAll(
      `SELECT ${field} as current_value FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, orgId]
    )) as { current_value: string | null }[];

    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Initiative not found' });
    }

    const oldValue = existing[0].current_value;

    await dbRun(`UPDATE initiatives SET ${field} = ?, updated_at = NOW() WHERE id = ?`, [
      value,
      initiativeId,
    ]);

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
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { projectId } = req.query;

    let query = `
      SELECT id, name, status, priority, planned_end_date, sla_deadline,
             blocked_reason, blocked_at, progress, owner_business_id
      FROM initiatives
      WHERE organization_id = ?
        AND status NOT IN ('DONE', 'CANCELLED', 'ARCHIVED', 'DRAFT')
    `;
    const params: unknown[] = [orgId];
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }

    const rows = ((await dbAll(query, params)) || []) as InitiativeWarningRow[];
    const now = new Date();
    const warnings: TimelineWarning[] = [];

    for (const row of rows) {
      if (row.planned_end_date && new Date(row.planned_end_date) < now && row.status !== 'DONE') {
        const days = Math.floor(
          (now.getTime() - new Date(row.planned_end_date).getTime()) / 86400000
        );
        warnings.push({
          initiativeId: row.id,
          initiativeName: row.name,
          type: 'overdue',
          severity: days > 14 ? 'critical' : days > 7 ? 'high' : 'medium',
          message: `Overdue by ${days} days`,
          daysOverdue: days,
        });
      }

      if (row.status === 'BLOCKED') {
        const blockedDays = row.blocked_at
          ? Math.floor((now.getTime() - new Date(row.blocked_at).getTime()) / 86400000)
          : 0;
        warnings.push({
          initiativeId: row.id,
          initiativeName: row.name,
          type: 'blocked',
          severity: blockedDays > 10 ? 'high' : 'medium',
          message:
            row.blocked_reason || `Blocked${blockedDays > 0 ? ` for ${blockedDays} days` : ''}`,
        });
      }
    }

    warnings.sort((a, b) => {
      const sevOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
    });

    return res.json({ warnings: warnings.slice(0, 10), total: warnings.length });
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
  validateBody(DismissDelaySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { signalId } = req.body;
    await dbRun(
      `UPDATE delay_signals
       SET is_dismissed = TRUE, dismissed_by = ?, dismissed_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [userId, signalId, orgId]
    );
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
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { projectId } = req.query;
    const signals = await detectOverspendSignals(orgId, projectId as string | undefined);
    return res.json({ signals, count: signals.length });
  })
);

export default router;

// ================================================================
// Helper types
// ================================================================

interface InitiativeWarningRow {
  id: string;
  name: string;
  status: string;
  priority: string;
  planned_end_date: string | null;
  sla_deadline: string | null;
  blocked_reason: string | null;
  blocked_at: string | null;
  progress: number | null;
  owner_business_id: string | null;
}

interface TimelineWarning {
  initiativeId: string;
  initiativeName: string;
  type: 'overdue' | 'blocked' | 'dependency_conflict' | 'sla_approaching';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  daysOverdue?: number;
}
