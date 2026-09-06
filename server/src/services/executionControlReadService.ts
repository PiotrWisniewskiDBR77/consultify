/**
 * Read-only execution control aggregates shared by legacy `/api/execution-control`
 * and the V8 bridge (`/api/v8/execution-control`).
 */

import { all as dbAll } from '../utils/DbPromise.js';

export interface TimelineWarning {
  initiativeId: string;
  initiativeName: string;
  type: 'overdue' | 'blocked' | 'dependency_conflict' | 'sla_approaching';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  daysOverdue?: number;
}

interface InitiativeWarningRow {
  id: string;
  name: string;
  status: string;
  priority: string;
  planned_end_date: string | null;
  sla_deadline: string | null;
  blocked_reason: string | null;
  blocked_at: string | null;
  on_hold: boolean | null;
  progress: number | null;
  owner_business_id: string | null;
}

/**
 * Top timeline warnings (overdue, blocked) for active initiatives — same logic as
 * legacy GET /api/execution-control/warnings.
 */
export async function getTimelineWarningsSnapshot(
  organizationId: string,
  projectId?: string
): Promise<{ warnings: TimelineWarning[]; total: number }> {
  let query = `
      SELECT id, name, status, priority, planned_end_date, sla_deadline,
             blocked_reason, blocked_at, on_hold, progress, owner_business_id
      FROM initiatives
      -- DEC-424 (P12-int-c): DONE -> CLOSED, CANCELLED -> REJECTED; ARCHIVED is a flag.
      WHERE organization_id = ?
        AND status NOT IN ('CLOSED', 'REJECTED', 'DRAFT')
    `;
  const params: unknown[] = [organizationId];
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
      row.status !== 'CLOSED' // DEC-424 (P12-int-c): DONE -> CLOSED
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

    if (row.on_hold) {
      // DEC-424 (P12-int-c): BLOCKED -> IN_EXECUTION + flaga on_hold.
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
    const sevOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0);
  });

  return { warnings: warnings.slice(0, 10), total: warnings.length };
}
