/**
 * Read-only M1 receipt for an existing plan scenario.
 * Uses pg directly: it never imports Database.ts/DbPromise and cannot initialize schema.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... \
 *   npx tsx scripts/dev/m1-plan-task-demand-readback.ts <organization-id> <plan-scenario-id>
 */
import { Pool } from 'pg';

import {
  calculatePlanTaskDemand,
  type PlanDemandPeriod,
  type PlanTaskDemandRow,
} from '../../server/src/services/workload/planTaskDemandService.js';
import {
  buildRoleSheet,
  roleSlug,
} from '../../server/src/domain/initiatives-execution/capacityRoleSheet.js';
import type { PlanScenario } from '../../server/src/domain/initiatives-execution/planScenario.js';

interface StoredPlan {
  payload_json:
    | string
    | {
        periods?: PlanDemandPeriod[];
        windows?: Array<{ initiativeId?: string }>;
      };
}

const CLOSED_STATUSES = ['done', 'completed', 'validated', 'cancelled'];

async function main(): Promise<void> {
  const organizationId = String(process.argv[2] || '').trim();
  const scenarioId = String(process.argv[3] || '').trim();
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  if (!organizationId || !scenarioId)
    throw new Error('organization id and plan scenario id required');
  if (!connectionString) throw new Error('DATABASE_URL required');

  const pool = new Pool({
    connectionString,
    ssl:
      process.env.DB_SSL === 'true' || process.env.DB_SSL === 'require'
        ? { rejectUnauthorized: false }
        : undefined,
    max: 1,
  });
  try {
    const storedResult = await pool.query<StoredPlan>(
      `SELECT payload_json
         FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='plan_scenario' AND aggregate_id=$2`,
      [organizationId, scenarioId]
    );
    const stored = storedResult.rows[0];
    if (!stored) throw new Error('plan scenario not found in organization scope');
    const payload =
      typeof stored.payload_json === 'string'
        ? JSON.parse(stored.payload_json)
        : stored.payload_json;
    const periods = Array.isArray(payload.periods) ? payload.periods : [];
    const initiativeIds = Array.isArray(payload.windows)
      ? [
          ...new Set(payload.windows.map((window) => String(window.initiativeId || '').trim())),
        ].filter(Boolean)
      : [];
    const tasks = await pool.query<{
      task_id: string;
      user_id: string | null;
      role_label: string | null;
      estimated_hours: number | string | null;
      started_at: string | Date | null;
      created_at: string | Date | null;
      due_date: string | Date | null;
    }>(
      `SELECT t.id AS task_id, t.assignee_id AS user_id,
              COALESCE(NULLIF(TRIM(u.job_title), ''), NULLIF(TRIM(u.title), '')) AS role_label,
              t.estimated_hours, t.started_at, t.created_at, t.due_date
         FROM tasks t
         LEFT JOIN users u ON u.id=t.assignee_id AND u.organization_id=t.organization_id
        WHERE t.organization_id=$1
          AND t.initiative_id = ANY($2::text[])
          AND LOWER(COALESCE(t.status, '')) <> ALL($3::text[])
        ORDER BY t.id`,
      [organizationId, initiativeIds, CLOSED_STATUSES]
    );
    const rows: PlanTaskDemandRow[] = tasks.rows.map((row) => ({
      taskId: row.task_id,
      userId: row.user_id,
      roleLabel: row.role_label,
      estimatedHours: row.estimated_hours,
      startedAt: row.started_at,
      createdAt: row.created_at,
      dueDate: row.due_date,
    }));
    const result = calculatePlanTaskDemand(rows, periods, {
      asOf: new Date().toISOString(),
      initiativeIds,
    });
    const taskIds = [
      ...new Set(result.cells.flatMap((cell) => cell.contributions.map((item) => item.taskId))),
    ];
    const knownHours = result.cells.reduce((sum, cell) => sum + (cell.demandHours ?? 0), 0);
    if (process.argv.includes('--capacity-preview')) {
      const people = await pool.query<{
        role: string | null;
        weekly_capacity_hours: number | string | null;
        availability_percent: number | null;
      }>(
        `SELECT COALESCE(u.job_title, u.title) AS role,
                u.weekly_capacity_hours, u.availability_percent
           FROM users u
          WHERE u.organization_id=$1
            AND COALESCE(NULLIF(TRIM(CAST(u.is_active AS TEXT)), ''), '1') NOT IN ('0', 'false', 'FALSE')`,
        [organizationId]
      );
      const supplyByRole = new Map<
        string,
        { roleId: string; roleLabel: string; fteWeekly: number; headcount: number }
      >();
      for (const person of people.rows) {
        const roleLabel = String(person.role ?? '').trim();
        if (!roleLabel) continue;
        const roleId = roleSlug(roleLabel);
        const current = supplyByRole.get(roleId) ?? {
          roleId,
          roleLabel,
          fteWeekly: 0,
          headcount: 0,
        };
        const rawHours =
          person.weekly_capacity_hours === null ? 40 : Number(person.weekly_capacity_hours);
        const weeklyHours = Number.isFinite(rawHours) && rawHours > 0 ? rawHours : 40;
        const availability = Math.max(0, Math.min(100, person.availability_percent ?? 100));
        current.fteWeekly += (weeklyHours * availability) / 100 / 40;
        current.headcount += 1;
        supplyByRole.set(roleId, current);
      }
      const supply = [...supplyByRole.values()].map((role) => ({
        ...role,
        fteWeekly: Math.round(role.fteWeekly * 1000) / 1000,
      }));
      const plan = payload as PlanScenario;
      const legacy = buildRoleSheet({ plan, supply, ownerId: 'm1b-proof', asOf: result.asOf });
      const taskBased = buildRoleSheet({
        plan,
        supply,
        taskDemand: result,
        ownerId: 'm1b-proof',
        asOf: result.asOf,
      });
      const summarize = (sheet: typeof taskBased) => ({
        periodCount: sheet.length,
        demandTotal:
          Math.round(sheet.reduce((sum, period) => sum + (period.demand.base ?? 0), 0) * 100) / 100,
        supplyTotal:
          Math.round(sheet.reduce((sum, period) => sum + (period.supply.base ?? 0), 0) * 100) / 100,
        sourceCounts: sheet
          .flatMap((period) => period.roles ?? [])
          .reduce<Record<string, number>>((counts, role) => {
            counts[role.demandSource] = (counts[role.demandSource] ?? 0) + 1;
            return counts;
          }, {}),
      });
      process.stdout.write(
        `${JSON.stringify(
          {
            organizationId,
            scenarioId,
            input: {
              knowledgeState: result.knowledgeState,
              taskCount: taskIds.length,
              knownDemandHours: Math.round(knownHours * 100) / 100,
              incompleteTasks: result.incompleteTasks,
            },
            before: { unit: 'FTE', ...summarize(legacy) },
            after: {
              unit: 'HOURS',
              ...summarize(taskBased),
              roles: taskBased.flatMap((period) =>
                (period.roles ?? [])
                  .filter((role) => role.demandSource === 'TASKS' || role.demandSource === 'MANUAL')
                  .map((role) => ({ periodId: period.periodId, ...role }))
              ),
            },
          },
          null,
          2
        )}\n`
      );
      if (result.incompleteTasks.length) process.exitCode = 2;
      return;
    }
    process.stdout.write(
      `${JSON.stringify(
        {
          organizationId,
          scenarioId,
          knowledgeState: result.knowledgeState,
          initiativeCount: result.initiativeIds.length,
          periodCount: result.periods.length,
          cellCount: result.cells.length,
          taskCount: taskIds.length,
          knownDemandHours: Math.round(knownHours * 100) / 100,
          incompleteTasks: result.incompleteTasks,
          cells: result.cells,
        },
        null,
        2
      )}\n`
    );
    if (result.incompleteTasks.length) process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
