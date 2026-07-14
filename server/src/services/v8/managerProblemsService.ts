/**
 * Manager Problems Service
 *
 * Transforms raw DB entities into a flat list of ManagerProblemRow objects
 * for each of the 6 manager lanes. No demo fallbacks — real data only.
 */

import { all as dbAll } from '../../utils/DbPromise.js';

type ProblemSeverity = 'critical' | 'warning' | 'info';
type SourceEntityType = 'INITIATIVE' | 'TASK' | 'DECISION' | 'RAID_ITEM' | 'PERSON';

interface ProblemAction {
  id: string;
  label: string;
  variant?: 'default' | 'primary' | 'danger';
}

interface ManagerProblemRow {
  id: string;
  severity: ProblemSeverity;
  problemType: string;
  title: string;
  rootCause: string;
  sourceEntityType: SourceEntityType;
  sourceEntityId: string;
  sourceEntityName: string;
  ownerId: string | null;
  ownerName: string | null;
  daysOverdue: number | null;
  impactCount: number;
  affectedEntities: Array<{ id: string; name: string; type: SourceEntityType }>;
  actions: ProblemAction[];
  meta: Record<string, unknown>;
}

function daysDiff(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / 86400000);
}

function staleDays(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / 86400000);
}

// ─── SQL helpers ──────────────────────────────────────────────────────────

async function loadInitiatives(orgId: string, projectId?: string): Promise<any[]> {
  try {
    let q = `
      SELECT i.id, i.name, i.status, i.owner_execution_id,
             i.planned_start_date, i.planned_end_date, i.start_date,
             i.progress, i.updated_at, i.project_id,
             COALESCE(u.first_name || ' ' || u.last_name, '') as owner_name,
             COALESCE(sp.first_name || ' ' || sp.last_name, '') as sponsor_name,
             i.sponsor_id
      FROM initiatives i
      LEFT JOIN users u ON u.id = i.owner_execution_id
      LEFT JOIN users sp ON sp.id = i.sponsor_id
      WHERE i.organization_id = $1
    `;
    const params: unknown[] = [orgId];
    if (projectId) {
      q += ' AND i.project_id = $2';
      params.push(projectId);
    }
    return ((await dbAll(q, params)) || []) as any[];
  } catch {
    return [];
  }
}

async function loadTasks(orgId: string, projectId?: string): Promise<any[]> {
  try {
    let q = `
      SELECT t.id, t.title, t.status, t.due_date, t.assignee_id,
             t.estimated_hours, t.initiative_id, t.project_id, t.updated_at,
             COALESCE(u.first_name || ' ' || u.last_name, '') as assignee_name,
             i.name as initiative_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN initiatives i ON i.id = t.initiative_id
      WHERE t.organization_id = $1
    `;
    const params: unknown[] = [orgId];
    if (projectId) {
      q += ' AND t.project_id = $2';
      params.push(projectId);
    }
    return ((await dbAll(q, params)) || []) as any[];
  } catch {
    return [];
  }
}

async function loadDecisions(orgId: string, projectId?: string): Promise<any[]> {
  try {
    let q = `
      SELECT d.id, d.title, d.status, d.priority, d.deadline,
             COALESCE(d.decision_owner_id, d.decision_maker_id) as owner_id,
             COALESCE(u.first_name || ' ' || u.last_name, '') as owner_name,
             d.initiative_id, d.created_at,
             ini.name as initiative_name
      FROM decisions d
      LEFT JOIN users u ON u.id = COALESCE(d.decision_owner_id, d.decision_maker_id)
      LEFT JOIN initiatives ini ON ini.id = d.initiative_id
      WHERE d.organization_id = $1
    `;
    const params: unknown[] = [orgId];
    if (projectId) {
      q += ' AND d.project_id = $2';
      params.push(projectId);
    }
    return ((await dbAll(q, params)) || []) as any[];
  } catch {
    return [];
  }
}

async function loadRaidItems(orgId: string, projectId?: string): Promise<any[]> {
  try {
    let q = `
      SELECT r.id, r.title, r.type, r.status, r.probability, r.impact,
             r.risk_score, r.owner_id, r.due_date, r.initiative_id,
             r.mitigation_plan, r.response_strategy, r.mitigation_status,
             COALESCE(u.first_name || ' ' || u.last_name, '') as owner_name,
             ini.name as initiative_name
      FROM raid_items r
      LEFT JOIN users u ON u.id = r.owner_id
      LEFT JOIN initiatives ini ON ini.id = r.initiative_id
      WHERE r.organization_id = $1
    `;
    const params: unknown[] = [orgId];
    if (projectId) {
      q += ' AND r.initiative_id IN (SELECT id FROM initiatives WHERE project_id = $2)';
      params.push(projectId);
    }
    return ((await dbAll(q, params)) || []) as any[];
  } catch {
    return [];
  }
}

async function loadTaskCountsByPerson(orgId: string): Promise<Record<string, number>> {
  try {
    const rows = (await dbAll(
      `SELECT assignee_id, COUNT(*) as cnt
       FROM tasks
       WHERE organization_id = $1 AND UPPER(COALESCE(status,'')) NOT IN ('DONE','CANCELLED')
       GROUP BY assignee_id`,
      [orgId]
    )) as any[];
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (r.assignee_id) map[r.assignee_id] = Number(r.cnt);
    }
    return map;
  } catch {
    return {};
  }
}

// ─── Problem builders per lane ────────────────────────────────────────────

function buildActionQueue(
  initiatives: any[],
  tasks: any[],
  decisions: any[],
  raidItems: any[]
): ManagerProblemRow[] {
  const problems: ManagerProblemRow[] = [];
  const now = Date.now();

  for (const t of tasks) {
    const s = String(t.status || '').toUpperCase();
    if (s === 'DONE' || s === 'CANCELLED') continue;
    if (t.due_date) {
      const over = daysDiff(t.due_date);
      if (over !== null && over > 0) {
        problems.push({
          id: `aq-task-overdue-${t.id}`,
          severity: over > 14 ? 'critical' : over > 7 ? 'warning' : 'info',
          problemType: 'overdue_task',
          title: `Task overdue: ${t.title}`,
          rootCause: `Due date was ${new Date(t.due_date).toLocaleDateString()}, ${over} days ago.${t.initiative_name ? ` Part of "${t.initiative_name}".` : ''}`,
          sourceEntityType: 'TASK',
          sourceEntityId: t.id,
          sourceEntityName: t.title,
          ownerId: t.assignee_id,
          ownerName: t.assignee_name || null,
          daysOverdue: over,
          impactCount: t.initiative_id ? 1 : 0,
          affectedEntities: t.initiative_id
            ? [
                {
                  id: t.initiative_id,
                  name: t.initiative_name || 'Initiative',
                  type: 'INITIATIVE' as SourceEntityType,
                },
              ]
            : [],
          actions: [
            { id: 'replan', label: 'Replan', variant: 'primary' },
            { id: 'reassign', label: 'Reassign' },
            { id: 'escalate', label: 'Escalate', variant: 'danger' },
          ],
          meta: { status: t.status, assignee: t.assignee_name },
        });
      }
    }
    if (s === 'BLOCKED') {
      problems.push({
        id: `aq-task-blocked-${t.id}`,
        severity: 'critical',
        problemType: 'blocked_task',
        title: `Task blocked: ${t.title}`,
        rootCause: `Task is in BLOCKED status.${t.initiative_name ? ` Part of "${t.initiative_name}".` : ''}`,
        sourceEntityType: 'TASK',
        sourceEntityId: t.id,
        sourceEntityName: t.title,
        ownerId: t.assignee_id,
        ownerName: t.assignee_name || null,
        daysOverdue: null,
        impactCount: t.initiative_id ? 1 : 0,
        affectedEntities: t.initiative_id
          ? [
              {
                id: t.initiative_id,
                name: t.initiative_name || 'Initiative',
                type: 'INITIATIVE' as SourceEntityType,
              },
            ]
          : [],
        actions: [
          { id: 'unblock', label: 'Unblock', variant: 'primary' },
          { id: 'escalate', label: 'Escalate', variant: 'danger' },
          { id: 'reassign', label: 'Reassign' },
        ],
        meta: { status: t.status },
      });
    }
  }

  for (const d of decisions) {
    const s = String(d.status || '').toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED') continue;
    if (d.deadline) {
      const over = daysDiff(d.deadline);
      if (over !== null && over > 0) {
        problems.push({
          id: `aq-dec-overdue-${d.id}`,
          severity: over > 7 ? 'critical' : 'warning',
          problemType: 'overdue_decision',
          title: `Decision overdue: ${d.title}`,
          rootCause: `Deadline was ${new Date(d.deadline).toLocaleDateString()}, ${over} days ago. Status: ${d.status}.`,
          sourceEntityType: 'DECISION',
          sourceEntityId: d.id,
          sourceEntityName: d.title,
          ownerId: d.owner_id,
          ownerName: d.owner_name || null,
          daysOverdue: over,
          impactCount: d.initiative_id ? 1 : 0,
          affectedEntities: d.initiative_name
            ? [
                {
                  id: d.initiative_id,
                  name: d.initiative_name,
                  type: 'INITIATIVE' as SourceEntityType,
                },
              ]
            : [],
          actions: [
            { id: 'approve', label: 'Approve', variant: 'primary' },
            { id: 'reject', label: 'Reject', variant: 'danger' },
            { id: 'defer', label: 'Defer' },
            { id: 'escalate', label: 'Escalate' },
          ],
          meta: { status: d.status, priority: d.priority },
        });
      }
    }
  }

  for (const r of raidItems) {
    const s = String(r.status || '').toUpperCase();
    if (s === 'CLOSED' || s === 'MITIGATED') continue;
    const t = String(r.type || '').toUpperCase();
    if (t === 'ISSUE' && (r.risk_score >= 8 || Number(r.impact) >= 4)) {
      problems.push({
        id: `aq-issue-${r.id}`,
        severity: r.risk_score >= 10 ? 'critical' : 'warning',
        problemType: 'critical_issue',
        title: `Issue: ${r.title}`,
        rootCause: `Impact: ${r.impact}, Score: ${r.risk_score}.${r.initiative_name ? ` Linked to "${r.initiative_name}".` : ''}`,
        sourceEntityType: 'RAID_ITEM',
        sourceEntityId: r.id,
        sourceEntityName: r.title,
        ownerId: r.owner_id,
        ownerName: r.owner_name || null,
        daysOverdue: daysDiff(r.due_date),
        impactCount: 1,
        affectedEntities: r.initiative_name
          ? [
              {
                id: r.initiative_id,
                name: r.initiative_name,
                type: 'INITIATIVE' as SourceEntityType,
              },
            ]
          : [],
        actions: [
          { id: 'create_mitigation', label: 'Mitigate', variant: 'primary' },
          { id: 'escalate', label: 'Escalate', variant: 'danger' },
        ],
        meta: { type: r.type, risk_score: r.risk_score },
      });
    }
  }

  return problems.sort(
    (a, b) =>
      severityOrder(a.severity) - severityOrder(b.severity) ||
      (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0)
  );
}

// F3 — decision SLA per priority (was a flat 7d/14d for everything). A critical
// decision must not wait as long as a low-priority one (PRINCE2 tolerances).
const DECISION_SLA_DAYS: Record<string, number> = { CRITICAL: 2, HIGH: 3, MEDIUM: 7, LOW: 14 };
export function decisionSlaDays(priority?: string): number {
  return DECISION_SLA_DAYS[String(priority || 'MEDIUM').toUpperCase()] ?? 7;
}
export function overdueDecisionSeverity(
  priority: string | undefined,
  daysOver: number
): 'critical' | 'warning' {
  const p = String(priority || '').toUpperCase();
  if (p === 'CRITICAL' || p === 'HIGH') return 'critical';
  return daysOver > decisionSlaDays(priority) ? 'critical' : 'warning';
}
export function pendingDecisionSeverity(
  priority: string | undefined,
  daysWaiting: number
): 'critical' | 'warning' | 'info' {
  const sla = decisionSlaDays(priority);
  if (daysWaiting > sla * 2) return 'critical';
  if (daysWaiting > sla) return 'warning';
  return 'info';
}

function buildDecisions(decisions: any[]): ManagerProblemRow[] {
  const problems: ManagerProblemRow[] = [];

  for (const d of decisions) {
    const s = String(d.status || '').toUpperCase();
    if (s === 'APPROVED' || s === 'REJECTED') continue;

    if (d.deadline && daysDiff(d.deadline)! > 0) {
      problems.push({
        id: `dec-overdue-${d.id}`,
        severity: overdueDecisionSeverity(d.priority, daysDiff(d.deadline)!),
        problemType: 'overdue_decision',
        title: `Overdue: ${d.title}`,
        rootCause: `Deadline ${new Date(d.deadline).toLocaleDateString()} passed ${daysDiff(d.deadline)} days ago.`,
        sourceEntityType: 'DECISION',
        sourceEntityId: d.id,
        sourceEntityName: d.title,
        ownerId: d.owner_id,
        ownerName: d.owner_name || null,
        daysOverdue: daysDiff(d.deadline),
        impactCount: d.initiative_id ? 1 : 0,
        affectedEntities: d.initiative_name
          ? [{ id: d.initiative_id, name: d.initiative_name, type: 'INITIATIVE' }]
          : [],
        actions: [
          { id: 'approve', label: 'Approve', variant: 'primary' },
          { id: 'reject', label: 'Reject', variant: 'danger' },
          { id: 'defer', label: 'Defer' },
          { id: 'assign_maker', label: 'Assign maker' },
        ],
        meta: { status: d.status, priority: d.priority },
      });
    } else if (s === 'PENDING' || s === 'DEFERRED') {
      const daysWaiting = daysDiff(d.created_at) ?? 0;
      problems.push({
        id: `dec-pending-${d.id}`,
        severity: s === 'DEFERRED' ? 'warning' : pendingDecisionSeverity(d.priority, daysWaiting),
        problemType: s === 'DEFERRED' ? 'deferred_decision' : 'pending_decision',
        title: `${s === 'DEFERRED' ? 'Deferred' : 'Pending'}: ${d.title}`,
        rootCause: `${s === 'DEFERRED' ? 'Decision was deferred.' : `Waiting for ${daysWaiting} days.`}${d.owner_name ? ` Owner: ${d.owner_name}.` : ''}`,
        sourceEntityType: 'DECISION',
        sourceEntityId: d.id,
        sourceEntityName: d.title,
        ownerId: d.owner_id,
        ownerName: d.owner_name || null,
        daysOverdue: d.deadline ? daysDiff(d.deadline) : null,
        impactCount: 0,
        affectedEntities: d.initiative_name
          ? [{ id: d.initiative_id, name: d.initiative_name, type: 'INITIATIVE' }]
          : [],
        actions: [
          { id: 'approve', label: 'Approve', variant: 'primary' },
          { id: 'reject', label: 'Reject', variant: 'danger' },
          { id: 'request_info', label: 'Request info' },
          { id: 'send_nudge', label: 'Send nudge' },
        ],
        meta: { status: d.status, days_waiting: daysWaiting },
      });
    }

    if (!d.owner_id) {
      problems.push({
        id: `dec-nomaker-${d.id}`,
        severity: 'warning',
        problemType: 'no_decision_maker',
        title: `No decision maker: ${d.title}`,
        rootCause: 'Decision has no assigned owner/maker.',
        sourceEntityType: 'DECISION',
        sourceEntityId: d.id,
        sourceEntityName: d.title,
        ownerId: null,
        ownerName: null,
        daysOverdue: null,
        impactCount: 0,
        affectedEntities: [],
        actions: [{ id: 'assign_maker', label: 'Assign maker', variant: 'primary' }],
        meta: { status: d.status },
      });
    }
  }

  return problems.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
}

function buildBlockers(initiatives: any[], tasks: any[], raidItems: any[]): ManagerProblemRow[] {
  const problems: ManagerProblemRow[] = [];

  for (const i of initiatives) {
    const s = String(i.status || '').toUpperCase();
    if (s === 'BLOCKED' || s === 'ON_HOLD') {
      problems.push({
        id: `blk-ini-${i.id}`,
        severity: 'critical',
        problemType: 'blocked_initiative',
        title: `Blocked initiative: ${i.name}`,
        rootCause: `Initiative status is ${i.status}. Requires unblocking to proceed.`,
        sourceEntityType: 'INITIATIVE',
        sourceEntityId: i.id,
        sourceEntityName: i.name,
        ownerId: i.owner_execution_id,
        ownerName: i.owner_name || null,
        daysOverdue: null,
        impactCount: 0,
        affectedEntities: [],
        actions: [
          { id: 'unblock', label: 'Unblock', variant: 'primary' },
          { id: 'escalate', label: 'Escalate', variant: 'danger' },
          { id: 'scope_reduction', label: 'Reduce scope' },
        ],
        meta: { status: i.status },
      });
    }
  }

  for (const t of tasks) {
    const s = String(t.status || '').toUpperCase();
    if (s === 'BLOCKED') {
      problems.push({
        id: `blk-task-${t.id}`,
        severity: 'critical',
        problemType: 'blocked_task',
        title: `Blocked task: ${t.title}`,
        rootCause: `Task is blocked.${t.initiative_name ? ` Part of "${t.initiative_name}".` : ''}`,
        sourceEntityType: 'TASK',
        sourceEntityId: t.id,
        sourceEntityName: t.title,
        ownerId: t.assignee_id,
        ownerName: t.assignee_name || null,
        daysOverdue: null,
        impactCount: t.initiative_id ? 1 : 0,
        affectedEntities: t.initiative_name
          ? [{ id: t.initiative_id, name: t.initiative_name, type: 'INITIATIVE' }]
          : [],
        actions: [
          { id: 'unblock', label: 'Unblock', variant: 'primary' },
          { id: 'workaround', label: 'Workaround' },
          { id: 'escalate', label: 'Escalate', variant: 'danger' },
        ],
        meta: { status: t.status },
      });
    }
  }

  for (const r of raidItems) {
    const s = String(r.status || '').toUpperCase();
    if (s === 'CLOSED' || s === 'MITIGATED') continue;
    const t = String(r.type || '').toUpperCase();
    if (t === 'DEPENDENCY') {
      problems.push({
        id: `blk-dep-${r.id}`,
        severity: Number(r.risk_score) >= 8 ? 'critical' : 'warning',
        problemType: 'dependency_block',
        title: `Dependency: ${r.title}`,
        rootCause: `External dependency blocking progress. Score: ${r.risk_score}.`,
        sourceEntityType: 'RAID_ITEM',
        sourceEntityId: r.id,
        sourceEntityName: r.title,
        ownerId: r.owner_id,
        ownerName: r.owner_name || null,
        daysOverdue: daysDiff(r.due_date),
        impactCount: r.initiative_id ? 1 : 0,
        affectedEntities: r.initiative_name
          ? [{ id: r.initiative_id, name: r.initiative_name, type: 'INITIATIVE' }]
          : [],
        actions: [
          { id: 'escalate', label: 'Escalate', variant: 'danger' },
          { id: 'workaround', label: 'Workaround' },
          { id: 'create_mitigation', label: 'Mitigate' },
        ],
        meta: { type: r.type, risk_score: r.risk_score },
      });
    }
    if (t === 'ISSUE') {
      problems.push({
        id: `blk-issue-${r.id}`,
        severity: Number(r.risk_score) >= 8 ? 'critical' : 'warning',
        problemType: 'critical_issue',
        title: `Issue: ${r.title}`,
        rootCause: `Open issue. Impact: ${r.impact}, Score: ${r.risk_score}.`,
        sourceEntityType: 'RAID_ITEM',
        sourceEntityId: r.id,
        sourceEntityName: r.title,
        ownerId: r.owner_id,
        ownerName: r.owner_name || null,
        daysOverdue: daysDiff(r.due_date),
        impactCount: 1,
        affectedEntities: r.initiative_name
          ? [{ id: r.initiative_id, name: r.initiative_name, type: 'INITIATIVE' }]
          : [],
        actions: [
          { id: 'create_mitigation', label: 'Mitigate', variant: 'primary' },
          { id: 'escalate', label: 'Escalate', variant: 'danger' },
        ],
        meta: { type: r.type, risk_score: r.risk_score },
      });
    }
  }

  return problems.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
}

function buildWorkload(
  tasks: any[],
  taskCountsByPerson: Record<string, number>
): ManagerProblemRow[] {
  const problems: ManagerProblemRow[] = [];
  const OVERLOAD_THRESHOLD = 7;
  const seen = new Set<string>();

  for (const [userId, cnt] of Object.entries(taskCountsByPerson)) {
    if (cnt >= OVERLOAD_THRESHOLD && !seen.has(userId)) {
      seen.add(userId);
      const sample = tasks.find((t: any) => t.assignee_id === userId);
      const name = sample?.assignee_name || 'Unknown';
      problems.push({
        id: `wl-overload-${userId}`,
        severity: cnt >= 12 ? 'critical' : 'warning',
        problemType: 'overloaded_person',
        title: `Overloaded: ${name} (${cnt} active tasks)`,
        rootCause: `Person has ${cnt} non-closed tasks assigned. Threshold is ${OVERLOAD_THRESHOLD}.`,
        sourceEntityType: 'PERSON',
        sourceEntityId: userId,
        sourceEntityName: name,
        ownerId: userId,
        ownerName: name,
        daysOverdue: null,
        impactCount: cnt,
        affectedEntities: [],
        actions: [
          { id: 'distribute_work', label: 'Distribute work', variant: 'primary' },
          { id: 'smooth_schedule', label: 'Smooth schedule' },
          { id: 'reassign', label: 'Reassign tasks' },
        ],
        meta: { active_tasks: cnt },
      });
    }
  }

  for (const t of tasks) {
    const s = String(t.status || '').toUpperCase();
    if (s === 'DONE' || s === 'CANCELLED') continue;
    if (!t.assignee_id) {
      problems.push({
        id: `wl-unassigned-${t.id}`,
        severity: t.due_date && daysDiff(t.due_date)! > 0 ? 'warning' : 'info',
        problemType: 'unassigned_task',
        title: `Unassigned: ${t.title}`,
        rootCause: `Task has no assignee.${t.initiative_name ? ` Part of "${t.initiative_name}".` : ''}`,
        sourceEntityType: 'TASK',
        sourceEntityId: t.id,
        sourceEntityName: t.title,
        ownerId: null,
        ownerName: null,
        daysOverdue: daysDiff(t.due_date),
        impactCount: 0,
        affectedEntities: t.initiative_name
          ? [{ id: t.initiative_id, name: t.initiative_name, type: 'INITIATIVE' }]
          : [],
        actions: [{ id: 'reassign', label: 'Assign', variant: 'primary' }],
        meta: { status: t.status },
      });
    }
    if (!t.estimated_hours && s !== 'DONE') {
      problems.push({
        id: `wl-noest-${t.id}`,
        severity: 'info',
        problemType: 'no_estimate',
        title: `No estimate: ${t.title}`,
        rootCause: 'Task has no estimated hours — capacity planning degraded.',
        sourceEntityType: 'TASK',
        sourceEntityId: t.id,
        sourceEntityName: t.title,
        ownerId: t.assignee_id,
        ownerName: t.assignee_name || null,
        daysOverdue: null,
        impactCount: 0,
        affectedEntities: [],
        actions: [{ id: 'set_capacity', label: 'Set estimate' }],
        meta: { status: t.status },
      });
    }
    if (t.due_date && s !== 'DONE' && s !== 'CANCELLED') {
      const dd = daysDiff(t.due_date);
      if (dd !== null && dd >= -5 && dd <= 0) {
        problems.push({
          id: `wl-duesoon-${t.id}`,
          severity: dd >= -2 ? 'warning' : 'info',
          problemType: 'due_soon',
          title: `Due soon: ${t.title}`,
          rootCause: `Due in ${Math.abs(dd)} day(s).${t.assignee_name ? ` Assigned to ${t.assignee_name}.` : ''}`,
          sourceEntityType: 'TASK',
          sourceEntityId: t.id,
          sourceEntityName: t.title,
          ownerId: t.assignee_id,
          ownerName: t.assignee_name || null,
          daysOverdue: dd,
          impactCount: 0,
          affectedEntities: t.initiative_name
            ? [{ id: t.initiative_id, name: t.initiative_name, type: 'INITIATIVE' }]
            : [],
          actions: [
            { id: 'replan', label: 'Extend deadline' },
            { id: 'reassign', label: 'Reassign' },
          ],
          meta: { status: t.status, days_until_due: Math.abs(dd) },
        });
      }
    }
  }

  return problems.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
}

function buildRisk(initiatives: any[], tasks: any[], raidItems: any[]): ManagerProblemRow[] {
  const problems: ManagerProblemRow[] = [];

  for (const r of raidItems) {
    const s = String(r.status || '').toUpperCase();
    if (s === 'CLOSED' || s === 'MITIGATED') continue;
    const t = String(r.type || '').toUpperCase();
    if (t !== 'RISK') continue;

    const score = Number(r.risk_score) || 0;
    const sev: ProblemSeverity = score >= 10 ? 'critical' : score >= 6 ? 'warning' : 'info';
    problems.push({
      id: `risk-${r.id}`,
      severity: sev,
      problemType: score >= 8 ? 'critical_risk' : 'high_risk',
      title: `Risk: ${r.title}`,
      rootCause: `Probability: ${r.probability}, Impact: ${r.impact}, Score: ${score}.${r.mitigation_plan ? ` Mitigation: ${r.mitigation_plan}` : ' No mitigation plan.'}`,
      sourceEntityType: 'RAID_ITEM',
      sourceEntityId: r.id,
      sourceEntityName: r.title,
      ownerId: r.owner_id,
      ownerName: r.owner_name || null,
      daysOverdue: daysDiff(r.due_date),
      impactCount: r.initiative_id ? 1 : 0,
      affectedEntities: r.initiative_name
        ? [{ id: r.initiative_id, name: r.initiative_name, type: 'INITIATIVE' }]
        : [],
      actions: [
        {
          id: 'create_mitigation',
          label: r.mitigation_plan ? 'Update mitigation' : 'Create mitigation',
          variant: 'primary',
        },
        { id: 'assign_mitigation_owner', label: 'Assign owner' },
        { id: 'escalate', label: 'Escalate', variant: 'danger' },
        { id: 'mark_mitigated', label: 'Mark mitigated' },
      ],
      meta: {
        probability: r.probability,
        impact: r.impact,
        risk_score: score,
        response_strategy: r.response_strategy,
      },
    });
  }

  for (const i of initiatives) {
    if (!i.planned_start_date && !i.planned_end_date) {
      problems.push({
        id: `risk-nobase-${i.id}`,
        severity: 'warning',
        problemType: 'missing_baseline',
        title: `No baseline: ${i.name}`,
        rootCause: 'Initiative has no planned dates. Variance cannot be tracked.',
        sourceEntityType: 'INITIATIVE',
        sourceEntityId: i.id,
        sourceEntityName: i.name,
        ownerId: i.owner_execution_id,
        ownerName: i.owner_name || null,
        daysOverdue: null,
        impactCount: 0,
        affectedEntities: [],
        actions: [{ id: 'set_baseline', label: 'Set baseline', variant: 'primary' }],
        meta: { status: i.status },
      });
    }
    if (i.planned_end_date) {
      const over = daysDiff(i.planned_end_date);
      if (over !== null && over > 0 && String(i.status || '').toUpperCase() !== 'DONE') {
        problems.push({
          id: `risk-delay-${i.id}`,
          severity: over > 14 ? 'critical' : 'warning',
          problemType: 'delay_overdue',
          title: `Overdue initiative: ${i.name}`,
          rootCause: `Planned end ${new Date(i.planned_end_date).toLocaleDateString()} was ${over} days ago.`,
          sourceEntityType: 'INITIATIVE',
          sourceEntityId: i.id,
          sourceEntityName: i.name,
          ownerId: i.owner_execution_id,
          ownerName: i.owner_name || null,
          daysOverdue: over,
          impactCount: 0,
          affectedEntities: [],
          actions: [
            { id: 'replan', label: 'Replan', variant: 'primary' },
            { id: 'escalate', label: 'Escalate', variant: 'danger' },
          ],
          meta: { status: i.status },
        });
      }
    }
    const stale = staleDays(i.updated_at);
    if (stale !== null && stale > 14 && String(i.status || '').toUpperCase() !== 'DONE') {
      problems.push({
        id: `risk-stale-${i.id}`,
        severity: stale > 30 ? 'warning' : 'info',
        problemType: 'stale_item',
        title: `Stale initiative: ${i.name}`,
        rootCause: `Not updated for ${stale} days.`,
        sourceEntityType: 'INITIATIVE',
        sourceEntityId: i.id,
        sourceEntityName: i.name,
        ownerId: i.owner_execution_id,
        ownerName: i.owner_name || null,
        daysOverdue: null,
        impactCount: 0,
        affectedEntities: [],
        actions: [{ id: 'send_nudge', label: 'Request update' }],
        meta: { days_stale: stale, status: i.status },
      });
    }
  }

  return problems.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
}

function buildPeopleChange(
  initiatives: any[],
  tasks: any[],
  taskCountsByPerson: Record<string, number>
): ManagerProblemRow[] {
  const problems: ManagerProblemRow[] = [];

  for (const i of initiatives) {
    if (!i.owner_execution_id) {
      problems.push({
        id: `pc-noowner-${i.id}`,
        severity: 'warning',
        problemType: 'no_owner',
        title: `No owner: ${i.name}`,
        rootCause: 'Initiative has no execution owner assigned.',
        sourceEntityType: 'INITIATIVE',
        sourceEntityId: i.id,
        sourceEntityName: i.name,
        ownerId: null,
        ownerName: null,
        daysOverdue: null,
        impactCount: 0,
        affectedEntities: [],
        actions: [{ id: 'assign_owner', label: 'Assign owner', variant: 'primary' }],
        meta: { status: i.status },
      });
    }
    if (!i.sponsor_id) {
      problems.push({
        id: `pc-nosponsor-${i.id}`,
        severity: 'info',
        problemType: 'no_sponsor',
        title: `No sponsor: ${i.name}`,
        rootCause: 'Initiative has no sponsor. Governance gap.',
        sourceEntityType: 'INITIATIVE',
        sourceEntityId: i.id,
        sourceEntityName: i.name,
        ownerId: i.owner_execution_id,
        ownerName: i.owner_name || null,
        daysOverdue: null,
        impactCount: 0,
        affectedEntities: [],
        actions: [{ id: 'assign_sponsor', label: 'Assign sponsor', variant: 'primary' }],
        meta: { status: i.status },
      });
    }
    if (!i.planned_start_date && !i.planned_end_date) {
      problems.push({
        id: `pc-nodates-${i.id}`,
        severity: 'info',
        problemType: 'no_dates',
        title: `No dates: ${i.name}`,
        rootCause: 'Initiative has no planned start or end dates.',
        sourceEntityType: 'INITIATIVE',
        sourceEntityId: i.id,
        sourceEntityName: i.name,
        ownerId: i.owner_execution_id,
        ownerName: i.owner_name || null,
        daysOverdue: null,
        impactCount: 0,
        affectedEntities: [],
        actions: [{ id: 'set_dates', label: 'Set dates', variant: 'primary' }],
        meta: { status: i.status },
      });
    }
  }

  const ownerInitiatives: Record<string, string[]> = {};
  for (const i of initiatives) {
    if (i.owner_execution_id) {
      if (!ownerInitiatives[i.owner_execution_id]) ownerInitiatives[i.owner_execution_id] = [];
      ownerInitiatives[i.owner_execution_id].push(i.name);
    }
  }
  for (const [ownerId, inis] of Object.entries(ownerInitiatives)) {
    if (inis.length >= 3) {
      const sample = tasks.find((t: any) => t.assignee_id === ownerId);
      const name = sample?.assignee_name || inis[0];
      problems.push({
        id: `pc-busfactor-${ownerId}`,
        severity: inis.length >= 5 ? 'warning' : 'info',
        problemType: 'bus_factor',
        title: `Bus factor risk: ${name} owns ${inis.length} initiatives`,
        rootCause: `Single person owns ${inis.length} initiatives: ${inis.slice(0, 3).join(', ')}${inis.length > 3 ? '...' : ''}.`,
        sourceEntityType: 'PERSON',
        sourceEntityId: ownerId,
        sourceEntityName: name,
        ownerId,
        ownerName: name,
        daysOverdue: null,
        impactCount: inis.length,
        affectedEntities: [],
        actions: [
          { id: 'distribute_work', label: 'Distribute', variant: 'primary' },
          { id: 'reassign', label: 'Reassign' },
        ],
        meta: { initiative_count: inis.length },
      });
    }
  }

  return problems.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
}

function severityOrder(s: ProblemSeverity): number {
  return s === 'critical' ? 0 : s === 'warning' ? 1 : 2;
}

// ─── Public API ───────────────────────────────────────────────────────────

type LaneId = 'action-queue' | 'decisions' | 'blockers' | 'workload' | 'risk' | 'people-change';

export async function getManagerProblems(
  organizationId: string,
  laneId: string,
  projectId?: string
): Promise<ManagerProblemRow[]> {
  const [initiatives, tasks, decisions, raidItems, taskCounts] = await Promise.all([
    loadInitiatives(organizationId, projectId),
    loadTasks(organizationId, projectId),
    loadDecisions(organizationId, projectId),
    loadRaidItems(organizationId, projectId),
    loadTaskCountsByPerson(organizationId),
  ]);

  switch (laneId as LaneId) {
    case 'action-queue':
      return buildActionQueue(initiatives, tasks, decisions, raidItems);
    case 'decisions':
      return buildDecisions(decisions);
    case 'blockers':
      return buildBlockers(initiatives, tasks, raidItems);
    case 'workload':
      return buildWorkload(tasks, taskCounts);
    case 'risk':
      return buildRisk(initiatives, tasks, raidItems);
    case 'people-change':
      return buildPeopleChange(initiatives, tasks, taskCounts);
    default:
      return [];
  }
}
