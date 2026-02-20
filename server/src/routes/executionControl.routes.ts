/**
 * Execution Control Routes (T039 + T040)
 *
 * API endpoints for:
 *  - Risk signal detection (heuristic)
 *  - Execution audit log (timeline changes)
 *  - Initiative timeline updates with audit trail
 *  - Risk alert dismissal
 *  - Mitigation management
 */
import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
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
      if (
        row.planned_end_date &&
        new Date(row.planned_end_date) < now &&
        row.status !== 'DONE'
      ) {
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
          message: row.blocked_reason || `Blocked${blockedDays > 0 ? ` for ${blockedDays} days` : ''}`,
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
  responseStrategy: z
    .enum(['AVOID', 'TRANSFER', 'MITIGATE', 'ACCEPT', 'ESCALATE'])
    .optional(),
  mitigationOwnerId: z.string().optional(),
  mitigationDueDate: z.string().optional(),
  mitigationStatus: z
    .enum(['OPEN', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'CLOSED'])
    .optional(),
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

    updates.push("updated_at = NOW()");
    params.push(req.params.id, orgId);

    await dbRun(
      `UPDATE raid_items SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    return res.json({ success: true });
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
