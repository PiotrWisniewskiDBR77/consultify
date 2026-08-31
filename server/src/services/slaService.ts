/**
 * SLA Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/slaService.js (CommonJS) to TypeScript (ES Modules)
 * Step 16: SLA timer and escalation logic.
 * Checks for expired assignments and handles escalation to org admins.
 */

import { v4 as _uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import auditLogger from '../utils/auditLogger.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// CONSTANTS
// ==========================================

export const SLA_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
export const DEFAULT_ESCALATION_REASON = 'SLA expired without acknowledgment';

// ==========================================
// TYPES
// ==========================================

interface ExpiredAssignment {
  id: string;
  org_id: string;
  org_name?: string;
  proposal_id: string;
  assigned_to_user_id: string;
  status: string;
  sla_due_at: string;
  escalated_at?: string | null;
}

interface OrgAdmin {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface EscalationResult {
  assignmentId: string;
  escalatedTo: string;
  reason: string;
}

interface SLACheckSummary {
  checked: number;
  escalated: number;
  notificationsSent: number;
  errors: Array<{ assignmentId: string; error: string }>;
}

interface SLAHealthStats {
  total: number;
  pending: number;
  acknowledged: number;
  completed: number;
  expired: number;
  overdue: number;
  escalated: number;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();
let NotificationOutboxService: any;

async function initDeps(): Promise<void> {
  if (!NotificationOutboxService) {
    const module = await import('./notificationOutboxService.js');
    NotificationOutboxService = module.default || module;
  }
}

/**
 * Set dependencies (for testing)
 */
export function setDependencies(
  newDeps: { db?: IDatabase; NotificationOutboxService?: any } = {}
): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
  if (newDeps.NotificationOutboxService) {
    NotificationOutboxService = newDeps.NotificationOutboxService;
  }
}

/**
 * Find all expired (overdue) assignments.
 */
export async function findExpiredAssignments(): Promise<ExpiredAssignment[]> {
  const rows = await DbPromise.all<ExpiredAssignment>(
    db,
    `SELECT aa.*, o.name as org_name
         FROM approval_assignments aa
         LEFT JOIN organizations o ON aa.org_id = o.id
         WHERE aa.status IN ('PENDING', 'ACKED')
         AND COALESCE(aa.assignment_kind, 'project_gate') = 'project_gate'
         AND aa.sla_due_at < datetime('now')
         AND aa.escalated_at IS NULL`,
    []
  );
  return rows || [];
}

/**
 * Mark an assignment as expired.
 */
export async function markExpired(assignmentId: string): Promise<boolean> {
  const result = await DbPromise.run(
    db,
    `UPDATE approval_assignments SET status = 'EXPIRED' WHERE id = ?`,
    [assignmentId]
  );
  return (result.changes || 0) > 0;
}

/**
 * Find org admin (ADMIN role) to escalate to.
 */
export async function findOrgAdmin(orgId: string): Promise<OrgAdmin | null> {
  const row = await DbPromise.get<OrgAdmin>(
    db,
    `SELECT id, email, first_name, last_name 
         FROM users 
         WHERE organization_id = ? AND role = 'ADMIN'
         LIMIT 1`,
    [orgId]
  );
  return row || null;
}

/**
 * Escalate an assignment to another user.
 */
export async function escalateAssignment(
  assignmentId: string,
  toUserId: string,
  reason: string = DEFAULT_ESCALATION_REASON
): Promise<EscalationResult> {
  const result = await DbPromise.run(
    db,
    `UPDATE approval_assignments 
         SET escalated_to_user_id = ?, escalated_at = CURRENT_TIMESTAMP, escalation_reason = ?
         WHERE id = ?`,
    [toUserId, reason, assignmentId]
  );

  if (result.changes === 0) {
    const error = new Error('Assignment not found');
    (error as any).status = 404;
    throw error;
  }

  auditLogger.warn('APPROVAL_ESCALATED', {
    metadata: {
      assignment_id: assignmentId,
      escalated_to: toUserId,
      reason,
    },
  });

  return { assignmentId, escalatedTo: toUserId, reason };
}

/**
 * Main cron job entry point - runs every 10 minutes.
 * Finds expired assignments, escalates to org admin, creates notifications.
 */
export async function runSlaCheck(): Promise<SLACheckSummary> {
  await initDeps();

  logger.info('[SLAService] Running SLA check...');
  const startTime = Date.now();

  const summary: SLACheckSummary = {
    checked: 0,
    escalated: 0,
    notificationsSent: 0,
    errors: [],
  };

  try {
    // 1. Find expired assignments
    const expired = await findExpiredAssignments();
    summary.checked = expired.length;

    for (const assignment of expired) {
      try {
        // 2. Find org admin to escalate to
        const admin = await findOrgAdmin(assignment.org_id);

        if (admin && admin.id !== assignment.assigned_to_user_id) {
          // 3. Escalate
          await escalateAssignment(assignment.id, admin.id, DEFAULT_ESCALATION_REASON);
          summary.escalated++;

          // 4. Create notification for escalated-to user
          await NotificationOutboxService.enqueue(admin.id, assignment.org_id, 'ESCALATION', {
            proposalId: assignment.proposal_id,
            originalAssignee: assignment.assigned_to_user_id,
            slaDueAt: assignment.sla_due_at,
            escalationReason: DEFAULT_ESCALATION_REASON,
          });
          summary.notificationsSent++;

          // 5. Also notify original assignee
          await NotificationOutboxService.enqueue(
            assignment.assigned_to_user_id,
            assignment.org_id,
            'APPROVAL_DUE',
            {
              proposalId: assignment.proposal_id,
              status: 'Escalated to admin',
              slaDueAt: assignment.sla_due_at,
            }
          );
          summary.notificationsSent++;
        } else {
          // No admin found or same as assignee, just mark as needing attention
          await NotificationOutboxService.enqueue(
            assignment.assigned_to_user_id,
            assignment.org_id,
            'APPROVAL_DUE',
            {
              proposalId: assignment.proposal_id,
              status: 'Overdue - requires immediate attention',
              slaDueAt: assignment.sla_due_at,
            }
          );
          summary.notificationsSent++;
        }
      } catch (err: any) {
        const error = err as Error;
        logger.error(`[SLAService] Error processing assignment ${assignment.id}:`, error);
        summary.errors.push({ assignmentId: assignment.id, error: error.message });
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[SLAService] SLA check complete in ${duration}ms:`, summary);

    auditLogger.info('SLA_CHECK_COMPLETE', {
      duration_ms: duration,
      ...summary,
    });

    return summary;
  } catch (err: any) {
    const error = err as Error;
    logger.error('[SLAService] SLA check failed:', error);
    auditLogger.error('SLA_CHECK_FAILED', { error_message: error.message });
    throw err;
  }
}

/**
 * Get SLA health statistics for an organization.
 */
export async function getSlaHealth(orgId: string): Promise<SLAHealthStats> {
  const row = await DbPromise.get<SLAHealthStats>(
    db,
    `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'ACKED' THEN 1 ELSE 0 END) as acknowledged,
            SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired,
            SUM(CASE WHEN sla_due_at < datetime('now') AND status IN ('PENDING', 'ACKED') THEN 1 ELSE 0 END) as overdue,
            SUM(CASE WHEN escalated_at IS NOT NULL THEN 1 ELSE 0 END) as escalated
         FROM approval_assignments
         WHERE org_id = ?`,
    [orgId]
  );

  return (
    row || {
      total: 0,
      pending: 0,
      acknowledged: 0,
      completed: 0,
      expired: 0,
      overdue: 0,
      escalated: 0,
    }
  );
}

// Default export for backward compatibility
const SLAService = {
  SLA_CHECK_INTERVAL_MS,
  setDependencies,
  findExpiredAssignments,
  markExpired,
  findOrgAdmin,
  escalateAssignment,
  runSlaCheck,
  getSlaHealth,
};

export default SLAService;
