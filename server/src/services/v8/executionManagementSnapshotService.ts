import {
  EXECUTION_MANAGEMENT_SNAPSHOT_CONTRACT,
  type ExecutionManagementSnapshot,
  type SnapshotSectionProvenance,
} from '../../types/executionManagementSnapshot.js';
import { all as dbAll, get as dbGet } from '../../utils/DbPromise.js';

type QueryDeps = {
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  now(): Date;
};

const defaultDeps: QueryDeps = {
  get: async (sql, params = []) => (await dbGet(sql, params)) ?? undefined,
  all: (sql, params = []) => dbAll(sql, params),
  now: () => new Date(),
};

type InitiativeRow = {
  id: string;
  projectId: string | null;
  name: string;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
};

async function readSection<T>(
  source: string,
  read: () => Promise<T[]>
): Promise<{ rows: T[]; provenance: SnapshotSectionProvenance }> {
  try {
    return { rows: (await read()) || [], provenance: { source, state: 'available' } };
  } catch {
    return {
      rows: [],
      provenance: {
        source,
        state: 'degraded',
        reason: 'section_unavailable',
      },
    };
  }
}

/**
 * Additive read model over canonical initiative, milestone, task and decision rows.
 * A project decision is never included unless it is explicitly linked by initiative_id.
 */
export async function getExecutionManagementSnapshot(
  organizationId: string,
  initiativeId: string,
  projectId?: string,
  deps: QueryDeps = defaultDeps
): Promise<ExecutionManagementSnapshot | null> {
  const projectClause = projectId ? ' AND i.project_id = ?' : '';
  const params = projectId
    ? [initiativeId, organizationId, projectId]
    : [initiativeId, organizationId];
  const initiative = await deps.get<InitiativeRow>(
    `SELECT i.id,
            i.project_id as "projectId",
            COALESCE(i.name, '') as name,
            i.status,
            COALESCE(i.owner_execution_id, i.owner_business_id) as "ownerId",
            COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), u.email) as "ownerName",
            i.planned_start_date as "plannedStartDate",
            i.planned_end_date as "plannedEndDate",
            NULL as "actualStartDate",
            NULL as "actualEndDate"
       FROM initiatives i
       LEFT JOIN users u ON u.id = COALESCE(i.owner_execution_id, i.owner_business_id)
      WHERE i.id = ? AND i.organization_id = ?${projectClause}
      LIMIT 1`,
    params
  );
  if (!initiative) return null;

  const [milestones, tasks, decisions] = await Promise.all([
    readSection('initiative_milestones', () =>
      deps.all<Record<string, unknown>>(
        `SELECT id, initiative_id as "initiativeId", name, description,
                target_date as "targetDate", actual_date as "actualDate", status,
                order_index as "orderIndex", is_gate as "isGate",
                gate_decision_id as "gateDecisionId", updated_at as "updatedAt"
           FROM initiative_milestones
          WHERE initiative_id = ? AND organization_id = ?
          ORDER BY order_index ASC, target_date ASC, id ASC`,
        [initiativeId, organizationId]
      )
    ),
    readSection('tasks', () =>
      deps.all<Record<string, unknown>>(
        `SELECT id, initiative_id as "initiativeId", project_id as "projectId", title,
                description, status, priority, assignee_id as "assigneeId",
                due_date as "dueDate", updated_at as "updatedAt"
           FROM tasks
          WHERE initiative_id = ? AND organization_id = ?
          ORDER BY due_date ASC, created_at ASC, id ASC`,
        [initiativeId, organizationId]
      )
    ),
    readSection('decisions', () =>
      deps.all<Record<string, unknown>>(
        `SELECT id, initiative_id as "initiativeId", project_id as "projectId", task_id as "taskId",
                title, type, status, decision_maker_id as "decisionMakerId",
                deadline, selected_option as "selectedOption",
                decision_rationale as "decisionRationale", decided_at as "decidedAt",
                updated_at as "updatedAt"
           FROM decisions
          WHERE initiative_id = ? AND organization_id = ?
          ORDER BY deadline ASC, created_at ASC, id ASC`,
        [initiativeId, organizationId]
      )
    ),
  ]);

  const provenance = {
    initiative: { source: 'initiatives', state: 'available' as const },
    milestones: milestones.provenance,
    tasks: tasks.provenance,
    decisions: decisions.provenance,
  };
  const degradedSections = (['milestones', 'tasks', 'decisions'] as const).filter(
    (section) => provenance[section].state === 'degraded'
  );

  return {
    contractVersion: EXECUTION_MANAGEMENT_SNAPSHOT_CONTRACT,
    asOf: deps.now().toISOString(),
    initiative,
    milestones: milestones.rows,
    tasks: tasks.rows,
    decisions: decisions.rows,
    provenance,
    degradedSections,
  };
}

export type { QueryDeps as ExecutionManagementSnapshotQueryDeps };
