import { AsyncLocalStorage } from 'node:async_hooks';

import { all as rawDbAll, run as rawDbRun } from '../../utils/DbPromise.js';
import { withPgTransaction, type PgTransactionClient } from '../../utils/queryHelpers.js';
import { send as notifySend } from '../notificationService.js';
import { getManagerProblems } from './managerProblemsService.js';

type ManagerProblemRow = Awaited<ReturnType<typeof getManagerProblems>>[number];

interface ManagerTransactionContext {
  client: PgTransactionClient;
  afterCommit: Array<() => Promise<void>>;
}

const managerTransaction = new AsyncLocalStorage<ManagerTransactionContext>();

async function dbAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const context = managerTransaction.getStore();
  if (context) return (await context.client.query<T>(sql, params)).rows;
  return rawDbAll<T>(sql, params, { fallback: false });
}

async function dbRun(sql: string, params: unknown[] = []) {
  const context = managerTransaction.getStore();
  if (context) {
    const result = await context.client.query(sql, params);
    if (result.rowCount !== 1) {
      throw new Error(`Manager mutation expected exactly one changed row, got ${result.rowCount}`);
    }
    return { success: true, changes: result.rowCount };
  }
  const result = await rawDbRun(sql, params, { fallback: false });
  if (result.changes !== 1) {
    throw new Error(`Manager mutation expected exactly one changed row, got ${result.changes ?? 0}`);
  }
  return result;
}

export interface ManagerActionExecutionResult {
  success: true;
  message: string;
  changedCount: number;
  changedEntities: Array<{ entityType: string; entityId: string }>;
}

function isoDay(offsetDays = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function pickCandidateUser(
  organizationId: string,
  excludedUserIds: Array<string | null | undefined> = []
) {
  const excluded = excludedUserIds.filter((value): value is string => Boolean(value));
  const params: unknown[] = [organizationId];
  let exclusionSql = '';

  if (excluded.length > 0) {
    exclusionSql = `AND u.id NOT IN (${excluded.map(() => '?').join(', ')})`;
    params.push(...excluded);
  }

  const users = await dbAll<{
    id: string;
    display_name: string;
    load_score: number;
  }>(
    `
      SELECT
        u.id,
        TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS display_name,
        COALESCE(task_load.cnt, 0) + COALESCE(init_load.cnt, 0) * 2 + COALESCE(decision_load.cnt, 0) * 2 AS load_score
      FROM users u
      LEFT JOIN (
        SELECT assignee_id AS user_id, COUNT(*) AS cnt
        FROM tasks
        WHERE organization_id = ?
          AND UPPER(COALESCE(status, '')) NOT IN ('DONE', 'CANCELLED', 'COMPLETED')
          AND assignee_id IS NOT NULL
        GROUP BY assignee_id
      ) task_load ON task_load.user_id = u.id
      LEFT JOIN (
        SELECT owner_execution_id AS user_id, COUNT(*) AS cnt
        FROM initiatives
        WHERE organization_id = ?
          AND owner_execution_id IS NOT NULL
          AND UPPER(COALESCE(status, '')) NOT IN ('DONE', 'CANCELLED', 'ARCHIVED', 'DRAFT')
        GROUP BY owner_execution_id
      ) init_load ON init_load.user_id = u.id
      LEFT JOIN (
        SELECT COALESCE(decision_owner_id, decision_maker_id) AS user_id, COUNT(*) AS cnt
        FROM decisions
        WHERE organization_id = ?
          AND COALESCE(decision_owner_id, decision_maker_id) IS NOT NULL
          AND UPPER(COALESCE(status, '')) NOT IN ('APPROVED', 'REJECTED', 'CANCELLED')
        GROUP BY COALESCE(decision_owner_id, decision_maker_id)
      ) decision_load ON decision_load.user_id = u.id
      WHERE u.organization_id = ?
        AND COALESCE(u.status, 'active') <> 'deleted'
        ${exclusionSql}
      ORDER BY load_score ASC, display_name ASC, u.id ASC
      LIMIT 1
    `,
    [organizationId, organizationId, organizationId, ...params]
  );

  return users[0] || null;
}

async function createRaidEscalation(args: {
  organizationId: string;
  initiativeId: string | null;
  ownerId: string;
  escalationType: 'RISK' | 'DECISION' | 'ISSUE' | 'DEPENDENCY';
  title: string;
  description: string;
}) {
  const raidId = `raid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await dbRun(
    `INSERT INTO raid_items (id, organization_id, initiative_id, type, title, description, status, owner_id, due_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, NOW(), NOW())`,
    [
      raidId,
      args.organizationId,
      args.initiativeId,
      args.escalationType,
      args.title,
      args.description,
      args.ownerId,
      isoDay(7),
    ]
  );
  return raidId;
}

async function getTaskInitiativeId(organizationId: string, taskId: string) {
  const rows = await dbAll<{ initiative_id: string | null }>(
    `SELECT initiative_id FROM tasks WHERE id = ? AND organization_id = ? LIMIT 1`,
    [taskId, organizationId]
  );
  return rows[0]?.initiative_id ?? null;
}

async function managerAuditLog(
  organizationId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  detail: string
) {
  await dbRun(
      `INSERT INTO manager_action_audit_log (id, organization_id, entity_type, entity_id, action, old_value, new_value, reason, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, NOW())`,
      [
        `mgr-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        organizationId,
        entityType,
        entityId,
        `manager_${action}`,
        detail,
        `Manager cockpit action: ${action}`,
        userId,
      ]
    );
}

async function executeProblemActionInternal(
  organizationId: string,
  userId: string,
  row: ManagerProblemRow,
  actionId: string
) {
  const changedEntities: Array<{ entityType: string; entityId: string }> = [];
  const addChange = (entityType: string, entityId: string) =>
    changedEntities.push({ entityType, entityId });

  const candidateUser = async (...excludedIds: Array<string | null | undefined>) =>
    pickCandidateUser(organizationId, [userId, row.ownerId, ...excludedIds]);

  if (row.sourceEntityType === 'TASK') {
    switch (actionId) {
      case 'replan':
      case 'set_due_date': {
        const nextDueDate = isoDay(row.daysOverdue && row.daysOverdue > 0 ? 7 : 5);
        await dbRun(
          `UPDATE tasks SET due_date = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [nextDueDate, row.sourceEntityId, organizationId]
        );
        addChange('TASK', row.sourceEntityId);
        return { message: `Task replanned to ${nextDueDate}.`, changedEntities };
      }
      case 'reassign': {
        const candidate = await candidateUser();
        if (!candidate) {
          throw new Error('No alternative assignee available');
        }
        await dbRun(
          `UPDATE tasks SET assignee_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [candidate.id, row.sourceEntityId, organizationId]
        );
        addChange('TASK', row.sourceEntityId);
        return {
          message: `Task reassigned to ${candidate.display_name || candidate.id}.`,
          changedEntities,
        };
      }
      case 'unblock': {
        await dbRun(
          `UPDATE tasks SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [row.sourceEntityId, organizationId]
        );
        addChange('TASK', row.sourceEntityId);
        return { message: 'Task moved from blocked to in progress.', changedEntities };
      }
      case 'set_capacity': {
        await dbRun(
          `UPDATE tasks SET estimated_hours = COALESCE(estimated_hours, 8), updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [row.sourceEntityId, organizationId]
        );
        addChange('TASK', row.sourceEntityId);
        return { message: 'Task estimate set for capacity planning.', changedEntities };
      }
      case 'smooth_schedule': {
        const nextDueDate = isoDay(7);
        await dbRun(
          `UPDATE tasks SET due_date = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [nextDueDate, row.sourceEntityId, organizationId]
        );
        addChange('TASK', row.sourceEntityId);
        return { message: `Task schedule smoothed to ${nextDueDate}.`, changedEntities };
      }
      case 'escalate': {
        const initiativeId = await getTaskInitiativeId(organizationId, row.sourceEntityId);
        const raidId = await createRaidEscalation({
          organizationId,
          initiativeId,
          ownerId: row.ownerId || userId,
          escalationType:
            row.problemType === 'blocked_task'
              ? 'ISSUE'
              : row.problemType === 'overdue_decision'
                ? 'DECISION'
                : 'ISSUE',
          title: `Escalation: ${row.sourceEntityName}`,
          description: row.rootCause,
        });
        addChange('RAID_ITEM', raidId);
        return { message: 'Escalation created as RAID item.', changedEntities };
      }
      default:
        break;
    }
  }

  if (row.sourceEntityType === 'INITIATIVE') {
    switch (actionId) {
      case 'assign_owner': {
        const candidate = await candidateUser();
        if (!candidate) throw new Error('No owner candidate available');
        await dbRun(
          `UPDATE initiatives SET owner_execution_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [candidate.id, row.sourceEntityId, organizationId]
        );
        addChange('INITIATIVE', row.sourceEntityId);
        return {
          message: `Initiative owner assigned to ${candidate.display_name || candidate.id}.`,
          changedEntities,
        };
      }
      case 'assign_sponsor': {
        const candidate = await candidateUser();
        if (!candidate) throw new Error('No sponsor candidate available');
        await dbRun(
          `UPDATE initiatives SET sponsor_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [candidate.id, row.sourceEntityId, organizationId]
        );
        addChange('INITIATIVE', row.sourceEntityId);
        return {
          message: `Initiative sponsor assigned to ${candidate.display_name || candidate.id}.`,
          changedEntities,
        };
      }
      case 'set_dates':
      case 'set_baseline': {
        await dbRun(
          `UPDATE initiatives
           SET planned_start_date = COALESCE(planned_start_date, ?),
               planned_end_date = COALESCE(planned_end_date, ?),
               updated_at = NOW()
           WHERE id = ? AND organization_id = ?`,
          [isoDay(0), isoDay(14), row.sourceEntityId, organizationId]
        );
        addChange('INITIATIVE', row.sourceEntityId);
        return { message: 'Initiative baseline dates set.', changedEntities };
      }
      case 'replan': {
        await dbRun(
          `UPDATE initiatives
           SET planned_start_date = COALESCE(planned_start_date, ?),
               planned_end_date = ?,
               updated_at = NOW()
           WHERE id = ? AND organization_id = ?`,
          [isoDay(0), isoDay(14), row.sourceEntityId, organizationId]
        );
        addChange('INITIATIVE', row.sourceEntityId);
        return { message: 'Initiative replanned to a new target date.', changedEntities };
      }
      case 'unblock': {
        await dbRun(
          `UPDATE initiatives SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [row.sourceEntityId, organizationId]
        );
        addChange('INITIATIVE', row.sourceEntityId);
        return { message: 'Initiative moved out of blocked state.', changedEntities };
      }
      case 'send_nudge': {
        await dbRun(
          `UPDATE initiatives SET updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [row.sourceEntityId, organizationId]
        );
        addChange('INITIATIVE', row.sourceEntityId);
        return { message: 'Initiative requested for refresh and marked active.', changedEntities };
      }
      case 'escalate': {
        const raidId = await createRaidEscalation({
          organizationId,
          initiativeId: row.sourceEntityId,
          ownerId: row.ownerId || userId,
          escalationType:
            row.problemType === 'missing_baseline'
              ? 'RISK'
              : row.problemType === 'delay_overdue'
                ? 'ISSUE'
                : 'DEPENDENCY',
          title: `Escalation: ${row.sourceEntityName}`,
          description: row.rootCause,
        });
        addChange('RAID_ITEM', raidId);
        return { message: 'Initiative escalation created.', changedEntities };
      }
      case 'scope_reduction': {
        // Baseline integrity (P03 §2.4.5): an intervention adjusts the FORECAST,
        // never the approved baseline. Previously this wrote planned_end_date
        // (+21d), silently rebaselining the initiative. Write forecast_end_date
        // so variance vs baseline stays visible in the control tower.
        await dbRun(
          `UPDATE initiatives
           SET status = 'IN_PROGRESS',
               forecast_end_date = ?,
               updated_at = NOW()
           WHERE id = ? AND organization_id = ?`,
          [isoDay(21), row.sourceEntityId, organizationId]
        );
        addChange('INITIATIVE', row.sourceEntityId);
        return {
          message: 'Initiative scope was reduced and the work was moved back into execution.',
          changedEntities,
        };
      }
      default:
        break;
    }
  }

  if (row.sourceEntityType === 'DECISION') {
    switch (actionId) {
      case 'approve':
      case 'reject':
      case 'defer': {
        const nextStatus =
          actionId === 'approve' ? 'approved' : actionId === 'reject' ? 'rejected' : 'deferred';
        await dbRun(
          `UPDATE decisions
           SET status = ?,
               decided_at = CASE WHEN ? IN ('approved', 'rejected') THEN NOW() ELSE decided_at END,
               updated_at = NOW()
           WHERE id = ? AND organization_id = ?`,
          [nextStatus, nextStatus, row.sourceEntityId, organizationId]
        );
        if (actionId === 'defer') {
          await dbRun(
            `UPDATE decisions SET deadline = COALESCE(deadline, ?), updated_at = NOW() WHERE id = ? AND organization_id = ?`,
            [isoDay(3), row.sourceEntityId, organizationId]
          );
        }
        addChange('DECISION', row.sourceEntityId);
        return { message: `Decision marked as ${nextStatus}.`, changedEntities };
      }
      case 'assign_maker':
      case 'reassign': {
        const candidate = await candidateUser();
        if (!candidate) throw new Error('No decision maker candidate available');
        await dbRun(
          `UPDATE decisions SET decision_maker_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [candidate.id, row.sourceEntityId, organizationId]
        );
        addChange('DECISION', row.sourceEntityId);
        return {
          message: `Decision maker assigned to ${candidate.display_name || candidate.id}.`,
          changedEntities,
        };
      }
      case 'request_info': {
        await dbRun(
          `UPDATE decisions
           SET status = 'deferred',
               deadline = COALESCE(deadline, ?),
               updated_at = NOW()
           WHERE id = ? AND organization_id = ?`,
          [isoDay(3), row.sourceEntityId, organizationId]
        );
        addChange('DECISION', row.sourceEntityId);
        return { message: 'Decision deferred pending additional information.', changedEntities };
      }
      case 'send_nudge': {
        await dbRun(
          `UPDATE decisions SET status = 'escalated', updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [row.sourceEntityId, organizationId]
        );
        addChange('DECISION', row.sourceEntityId);
        return { message: 'Decision escalated for faster resolution.', changedEntities };
      }
      case 'escalate': {
        // F3 — real escalation: route the decision to the initiative sponsor and
        // notify them (CRITICAL), instead of a flat status='escalated' with no
        // target. Sets `escalated_to`; notification is fail-safe (escalation must
        // succeed even if the notification does not).
        const ctx = (await dbAll(
          `SELECT d.initiative_id, i.sponsor_id, i.name AS initiative_name, d.title AS decision_title
           FROM decisions d
           LEFT JOIN initiatives i ON i.id = d.initiative_id
           WHERE d.id = ? AND d.organization_id = ?`,
          [row.sourceEntityId, organizationId]
        )) as Array<Record<string, any>>;
        const sponsorId = ctx[0]?.sponsor_id ? String(ctx[0].sponsor_id) : null;
        const decisionTitle = ctx[0]?.decision_title || ctx[0]?.decisiontitle || 'decision';
        const initiativeName = ctx[0]?.initiative_name || ctx[0]?.initiativename || null;
        await dbRun(
          `UPDATE decisions
           SET status = 'escalated', escalated_to = COALESCE(?, escalated_to), updated_at = NOW()
           WHERE id = ? AND organization_id = ?`,
          [sponsorId, row.sourceEntityId, organizationId]
        );
        addChange('DECISION', row.sourceEntityId);
        if (sponsorId && sponsorId !== userId) {
          managerTransaction.getStore()?.afterCommit.push(async () => {
            await notifySend({
              userId: sponsorId,
              organizationId,
              type: 'decision.escalated',
              severity: 'CRITICAL',
              title: `Decision escalated to you: ${decisionTitle}`,
              body: `An overdue/blocked decision${initiativeName ? ` on "${initiativeName}"` : ''} was escalated to you as sponsor for resolution.`,
              entityType: 'DECISION',
              entityId: String(row.sourceEntityId),
              actorId: userId,
              isActionable: true,
            });
          });
        }
        return {
          message: sponsorId
            ? 'Decision escalated to the sponsor (notified).'
            : 'Decision escalated for faster resolution.',
          changedEntities,
        };
      }
      default:
        break;
    }
  }

  if (row.sourceEntityType === 'RAID_ITEM') {
    switch (actionId) {
      case 'create_mitigation':
      case 'workaround': {
        await dbRun(
          `UPDATE raid_items
           SET mitigation_plan = COALESCE(NULLIF(mitigation_plan, ''), ?),
               mitigation_status = 'IN_PROGRESS',
               updated_at = NOW()
           WHERE id = ? AND organization_id = ?`,
          [
            `Manager mitigation created for ${row.sourceEntityName}`,
            row.sourceEntityId,
            organizationId,
          ]
        );
        addChange('RAID_ITEM', row.sourceEntityId);
        return { message: 'Mitigation plan created and started.', changedEntities };
      }
      case 'assign_mitigation_owner': {
        const candidate = await candidateUser();
        if (!candidate) throw new Error('No mitigation owner candidate available');
        await dbRun(
          `UPDATE raid_items SET owner_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [candidate.id, row.sourceEntityId, organizationId]
        );
        addChange('RAID_ITEM', row.sourceEntityId);
        return {
          message: `Risk owner assigned to ${candidate.display_name || candidate.id}.`,
          changedEntities,
        };
      }
      case 'mark_mitigated': {
        await dbRun(
          `UPDATE raid_items
           SET mitigation_status = 'MITIGATED',
               status = 'MITIGATED',
               updated_at = NOW()
           WHERE id = ? AND organization_id = ?`,
          [row.sourceEntityId, organizationId]
        );
        addChange('RAID_ITEM', row.sourceEntityId);
        return { message: 'Risk/issue marked as mitigated.', changedEntities };
      }
      case 'escalate': {
        const raidId = await createRaidEscalation({
          organizationId,
          initiativeId: row.affectedEntities[0]?.id || null,
          ownerId: row.ownerId || userId,
          escalationType: row.problemType === 'dependency_block' ? 'DEPENDENCY' : 'RISK',
          title: `Escalation: ${row.sourceEntityName}`,
          description: row.rootCause,
        });
        addChange('RAID_ITEM', raidId);
        return { message: 'Follow-up escalation created.', changedEntities };
      }
      default:
        break;
    }
  }

  if (row.sourceEntityType === 'PERSON') {
    if (
      row.problemType === 'overloaded_person' &&
      ['distribute_work', 'reassign'].includes(actionId)
    ) {
      const candidate = await candidateUser(row.sourceEntityId);
      if (!candidate) throw new Error('No rebalance candidate available');
      const tasks = await dbAll<{ id: string }>(
        `SELECT id
         FROM tasks
         WHERE organization_id = ?
           AND assignee_id = ?
           AND UPPER(COALESCE(status, '')) NOT IN ('DONE', 'CANCELLED', 'COMPLETED')
         ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, updated_at ASC
         LIMIT 3`,
        [organizationId, row.sourceEntityId]
      );
      for (const task of tasks) {
        await dbRun(
          `UPDATE tasks SET assignee_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [candidate.id, task.id, organizationId]
        );
        addChange('TASK', task.id);
      }
      return {
        message: tasks.length
          ? `Rebalanced ${tasks.length} task(s) from ${row.sourceEntityName} to ${candidate.display_name || candidate.id}.`
          : 'No active tasks found to rebalance.',
        changedEntities,
      };
    }

    if (row.problemType === 'overloaded_person' && actionId === 'smooth_schedule') {
      const tasks = await dbAll<{ id: string }>(
        `SELECT id
         FROM tasks
         WHERE organization_id = ?
           AND assignee_id = ?
           AND UPPER(COALESCE(status, '')) NOT IN ('DONE', 'CANCELLED', 'COMPLETED')
         ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, updated_at ASC
         LIMIT 3`,
        [organizationId, row.sourceEntityId]
      );
      for (const task of tasks) {
        await dbRun(
          `UPDATE tasks SET due_date = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [isoDay(7), task.id, organizationId]
        );
        addChange('TASK', task.id);
      }
      return {
        message: tasks.length
          ? `Smoothed schedule for ${tasks.length} overloaded task(s).`
          : 'No tasks found to smooth.',
        changedEntities,
      };
    }

    if (row.problemType === 'bus_factor' && ['distribute_work', 'reassign'].includes(actionId)) {
      const candidate = await candidateUser(row.sourceEntityId);
      if (!candidate) throw new Error('No ownership redistribution candidate available');
      const initiatives = await dbAll<{ id: string }>(
        `SELECT id
         FROM initiatives
         WHERE organization_id = ?
           AND owner_execution_id = ?
           AND UPPER(COALESCE(status, '')) NOT IN ('DONE', 'CANCELLED', 'ARCHIVED', 'DRAFT')
         ORDER BY CASE WHEN planned_end_date IS NULL THEN 1 ELSE 0 END, planned_end_date ASC, updated_at ASC
         LIMIT 2`,
        [organizationId, row.sourceEntityId]
      );
      for (const initiative of initiatives) {
        await dbRun(
          `UPDATE initiatives SET owner_execution_id = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [candidate.id, initiative.id, organizationId]
        );
        addChange('INITIATIVE', initiative.id);
      }
      return {
        message: initiatives.length
          ? `Redistributed ownership for ${initiatives.length} initiative(s).`
          : 'No initiatives found to redistribute.',
        changedEntities,
      };
    }
  }

  throw new Error(`Action "${actionId}" is not supported for ${row.problemType}`);
}

export async function executeManagerProblemAction(args: {
  organizationId: string;
  userId: string;
  laneId: string;
  problemId: string;
  actionId: string;
  projectId?: string;
}): Promise<ManagerActionExecutionResult> {
  const problems = await getManagerProblems(args.organizationId, args.laneId, args.projectId);
  const row = problems.find((problem) => problem.id === args.problemId);
  if (!row) {
    throw new Error(`Problem ${args.problemId} not found in lane ${args.laneId}`);
  }

  const afterCommit: Array<() => Promise<void>> = [];
  const response = await withPgTransaction((client) =>
    managerTransaction.run({ client, afterCommit }, async () => {
      const result = await executeProblemActionInternal(
        args.organizationId,
        args.userId,
        row,
        args.actionId
      );

      for (const entity of result.changedEntities) {
        await managerAuditLog(
          args.organizationId,
          args.userId,
          args.actionId,
          entity.entityType,
          entity.entityId,
          `Lane: ${args.laneId}, Problem: ${args.problemId}, Action: ${args.actionId}`
        );
      }

      return {
        success: true as const,
        message: result.message,
        changedCount: result.changedEntities.length,
        changedEntities: result.changedEntities,
      };
    })
  );
  await Promise.allSettled(afterCommit.map((effect) => effect()));
  return response;
}

async function applyManagerSuggestionInternal(args: {
  organizationId: string;
  userId: string;
  laneId: string;
  suggestionId: string;
  projectId?: string;
}): Promise<ManagerActionExecutionResult> {
  const changedEntities: Array<{ entityType: string; entityId: string }> = [];
  const addChange = (entityType: string, entityId: string) =>
    changedEntities.push({ entityType, entityId });

  const problems = await getManagerProblems(args.organizationId, args.laneId, args.projectId);
  const executeByPrefix = async (prefix: string, actionId: string, limit?: number) => {
    const matching = problems.filter((problem) => problem.id.startsWith(prefix));
    const slice = typeof limit === 'number' ? matching.slice(0, limit) : matching;
    for (const problem of slice) {
      const result = await executeProblemActionInternal(
        args.organizationId,
        args.userId,
        problem,
        actionId
      );
      changedEntities.push(...result.changedEntities);
    }
    return slice.length;
  };

  let message = 'Suggestion stored.';

  switch (args.suggestionId) {
    case 'sug-aq:unowned-tasks': {
      const tasks = await dbAll<{
        id: string;
        title: string;
      }>(
        `SELECT id, title
         FROM tasks
         WHERE organization_id = ?
           AND assignee_id IS NULL
           AND UPPER(COALESCE(status, '')) NOT IN ('DONE', 'CANCELLED', 'COMPLETED')
         LIMIT 25`,
        [args.organizationId]
      );
      for (const task of tasks) {
        const pseudoRow = {
          id: `aq-task-unowned-${task.id}`,
          severity: 'warning',
          problemType: 'unassigned_task',
          title: task.title,
          rootCause: 'Task has no assignee.',
          sourceEntityType: 'TASK',
          sourceEntityId: task.id,
          sourceEntityName: task.title,
          ownerId: null,
          ownerName: null,
          daysOverdue: null,
          impactCount: 0,
          affectedEntities: [],
          actions: [],
          meta: {},
        } satisfies ManagerProblemRow;
        const result = await executeProblemActionInternal(
          args.organizationId,
          args.userId,
          pseudoRow,
          'reassign'
        );
        changedEntities.push(...result.changedEntities);
      }
      message = tasks.length
        ? `Assigned ${tasks.length} previously unassigned task(s).`
        : 'No unassigned tasks left to assign.';
      break;
    }
    case 'sug-aq:missing-due-dates': {
      const count = await executeByPrefix('wl-noest-', 'set_capacity');
      const tasks = await dbAll<{ id: string }>(
        `SELECT id
         FROM tasks
         WHERE organization_id = ?
           AND due_date IS NULL
           AND UPPER(COALESCE(status, '')) NOT IN ('DONE', 'CANCELLED', 'COMPLETED')
         LIMIT 25`,
        [args.organizationId]
      );
      for (const task of tasks) {
        await dbRun(
          `UPDATE tasks SET due_date = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?`,
          [isoDay(7), task.id, args.organizationId]
        );
        addChange('TASK', task.id);
      }
      message = tasks.length
        ? `Set due dates for ${tasks.length} task(s) missing deadlines.`
        : count
          ? 'Capacity data refreshed for missing-date work.'
          : 'No tasks without due dates found.';
      break;
    }
    case 'sug-aq:overdue-decisions-escalation':
    case 'sug-blk:decision-escalation': {
      const count = await executeByPrefix('aq-dec-overdue-', 'escalate');
      message = count
        ? `Escalated ${count} overdue decision(s).`
        : 'No overdue decisions to escalate.';
      break;
    }
    case 'sug-blk:dependency-unblock': {
      const tasks = await executeByPrefix('blk-task-', 'unblock', 10);
      const initiatives = await executeByPrefix('blk-ini-', 'unblock', 10);
      message =
        tasks + initiatives > 0
          ? `Unblocked ${tasks + initiatives} blocked work item(s).`
          : 'No blocked work found to unblock.';
      break;
    }
    case 'sug-blk:create-workarounds':
    case 'sug-blk:formal-risk-response-plan': {
      const depCount = await executeByPrefix('blk-dep-', 'workaround', 10);
      const issueCount = await executeByPrefix('blk-issue-', 'create_mitigation', 10);
      message =
        depCount + issueCount > 0
          ? `Started workaround/mitigation on ${depCount + issueCount} blocker item(s).`
          : 'No blocker items found for workaround planning.';
      break;
    }
    case 'sug-blk:scope-reduction': {
      const count = await executeByPrefix('blk-ini-', 'scope_reduction', 5);
      message = count
        ? `Reduced scope on ${count} blocked initiative(s).`
        : 'No blocked initiatives found for scope reduction.';
      break;
    }
    case 'sug-aq:severely-overdue-replan': {
      const count = await executeByPrefix('aq-task-overdue-', 'replan', 10);
      message = count ? `Replanned ${count} overdue task(s).` : 'No overdue tasks to replan.';
      break;
    }
    case 'sug-dec:assign-approvers': {
      const count = await executeByPrefix('dec-nomaker-', 'assign_maker');
      message = count
        ? `Assigned decision makers for ${count} decision(s).`
        : 'No unassigned decisions found.';
      break;
    }
    case 'sug-dec:request-missing-info': {
      const count = await executeByPrefix('dec-overdue-', 'request_info', 10);
      message = count
        ? `Deferred ${count} decision(s) pending more input.`
        : 'No overdue decisions require more input.';
      break;
    }
    case 'sug-dec:assign-substitute-approvers': {
      const count = await executeByPrefix('dec-overdue-', 'assign_maker', 10);
      message = count
        ? `Redistributed ${count} overdue decision(s) to substitute approvers.`
        : 'No overdue decisions to reassign.';
      break;
    }
    case 'sug-dec:weekly-governance-cadence': {
      const count = await executeByPrefix('dec-pending-', 'send_nudge', 10);
      message = count
        ? `Escalated ${count} pending decision(s) into a tighter governance cadence.`
        : 'No pending decisions found for cadence change.';
      break;
    }
    case 'sug-wl:rebalance-top-overload': {
      const count = await executeByPrefix('wl-overload-', 'distribute_work', 1);
      message = count
        ? 'Rebalanced top overload cluster.'
        : 'No overload cluster found to rebalance.';
      break;
    }
    case 'sug-wl:add-estimates': {
      const count = await executeByPrefix('wl-noest-', 'set_capacity', 20);
      message = count
        ? `Added default estimates to ${count} task(s).`
        : 'No tasks without estimates found.';
      break;
    }
    case 'sug-wl:reduce-wip-limit':
    case 'sug-wl:smooth-delivery-schedule': {
      const count = await executeByPrefix('wl-overload-', 'smooth_schedule', 1);
      message = count
        ? 'Smoothed schedule for overloaded work.'
        : 'No overload schedule to smooth.';
      break;
    }
    case 'sug-rsk:set-baseline-dates': {
      const count = await executeByPrefix('risk-nobase-', 'set_baseline', 20);
      message = count
        ? `Set baselines for ${count} initiative(s).`
        : 'No initiatives without baselines found.';
      break;
    }
    case 'sug-rsk:assign-mitigation-owners': {
      const count = await executeByPrefix('risk-', 'assign_mitigation_owner', 10);
      message = count
        ? `Assigned mitigation owners across ${count} risk item(s).`
        : 'No risk items found.';
      break;
    }
    case 'sug-rsk:comprehensive-risk-plan': {
      const count = await executeByPrefix('risk-', 'create_mitigation', 10);
      message = count
        ? `Started mitigation plans for ${count} risk item(s).`
        : 'No risk items found to mitigate.';
      break;
    }
    case 'sug-rsk:leadership-escalation-review': {
      const count = await executeByPrefix('risk-', 'escalate', 5);
      message = count
        ? `Escalated ${count} critical risk item(s) for leadership review.`
        : 'No critical risks found to escalate.';
      break;
    }
    case 'sug-rsk:refresh-stale-items': {
      const count = await executeByPrefix('risk-stale-', 'send_nudge', 20);
      message = count ? `Refreshed ${count} stale initiative(s).` : 'No stale initiatives found.';
      break;
    }
    case 'sug-pc:assign-initiative-owners': {
      const count = await executeByPrefix('pc-noowner-', 'assign_owner', 20);
      message = count ? `Assigned owners to ${count} initiative(s).` : 'No owner gaps remain.';
      break;
    }
    case 'sug-pc:assign-task-owners': {
      const tasks = await dbAll<{
        id: string;
        title: string;
        status: string | null;
        due_date: string | null;
        assignee_id: string | null;
        assignee_name: string | null;
        initiative_id: string | null;
        initiative_name: string | null;
      }>(
        `SELECT t.id, t.title, t.status, t.due_date, t.assignee_id, COALESCE(u.first_name || ' ' || u.last_name, '') as assignee_name, t.initiative_id, i.name as initiative_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         LEFT JOIN initiatives i ON i.id = t.initiative_id
         WHERE t.organization_id = ?
           AND t.assignee_id IS NULL
           AND UPPER(COALESCE(t.status, '')) NOT IN ('DONE', 'CANCELLED', 'COMPLETED')
         LIMIT 20`,
        [args.organizationId]
      );
      for (const task of tasks) {
        const pseudoRow = {
          id: `wl-unassigned-${task.id}`,
          severity: 'warning',
          problemType: 'unassigned_task',
          title: `Unassigned: ${task.title}`,
          rootCause: 'Task has no assignee.',
          sourceEntityType: 'TASK',
          sourceEntityId: task.id,
          sourceEntityName: task.title,
          ownerId: null,
          ownerName: null,
          daysOverdue: null,
          impactCount: 0,
          affectedEntities: [],
          actions: [],
          meta: {},
        } satisfies ManagerProblemRow;
        const result = await executeProblemActionInternal(
          args.organizationId,
          args.userId,
          pseudoRow,
          'reassign'
        );
        changedEntities.push(...result.changedEntities);
      }
      message = tasks.length
        ? `Assigned ${tasks.length} previously unowned task(s).`
        : 'No unowned tasks remain.';
      break;
    }
    case 'sug-pc:update-raci': {
      const count = await executeByPrefix('pc-nosponsor-', 'assign_sponsor', 20);
      message = count ? `Assigned sponsors to ${count} initiative(s).` : 'No sponsor gaps remain.';
      break;
    }
    case 'sug-pc:launch-steerco-cadence': {
      const count = await executeByPrefix('dec-pending-', 'send_nudge', 10);
      message = count
        ? `Escalated ${count} pending decision(s) into active governance flow.`
        : 'No pending decisions found for governance cadence.';
      break;
    }
    case 'sug-pc:distribute-ownership': {
      const count = await executeByPrefix('pc-busfactor-', 'distribute_work', 1);
      message = count
        ? 'Redistributed ownership away from the main bottleneck.'
        : 'No bus-factor issue found.';
      break;
    }
    default:
      break;
  }

  if (message === 'Suggestion stored.') {
    throw new Error(`Suggestion "${args.suggestionId}" has no executable mutation mapping yet.`);
  }

  return {
    success: true,
    message,
    changedCount: changedEntities.length,
    changedEntities,
  };
}

export async function applyManagerSuggestion(args: {
  organizationId: string;
  userId: string;
  laneId: string;
  suggestionId: string;
  projectId?: string;
}): Promise<ManagerActionExecutionResult> {
  const afterCommit: Array<() => Promise<void>> = [];
  const response = await withPgTransaction((client) =>
    managerTransaction.run({ client, afterCommit }, async () => {
      const result = await applyManagerSuggestionInternal(args);
      for (const entity of result.changedEntities) {
        await managerAuditLog(
          args.organizationId,
          args.userId,
          args.suggestionId,
          entity.entityType,
          entity.entityId,
          `Lane: ${args.laneId}, Suggestion: ${args.suggestionId}`
        );
      }
      return result;
    })
  );
  await Promise.allSettled(afterCommit.map((effect) => effect()));
  return response;
}
