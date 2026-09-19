import { createHash } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import {
  assertNonEmptyExecutionWorkSnapshot,
  buildExecutionWorkTaskItems,
  countExecutionWorkTasks,
  type WorkTabTaskRow,
} from './executionWorkTaskSource.js';

const DAY = 86_400_000;
const CLOSED = new Set(['COMPLETED', 'DONE', 'DECIDED', 'APPROVED', 'CANCELED', 'CANCELLED']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WorkRow = {
  aggregate_type: 'execution_task' | 'execution_decision' | 'execution_milestone';
  aggregate_id: string;
  version: number;
  payload_json: Record<string, unknown>;
  initiative_id: string | null;
  project_id: string | null;
  project_title: string | null;
};

type IndependentSourceCounts = {
  taskCount: number | string;
  decisionCount: number | string;
};

export interface ExecutionWorkAnalysisGeneration {
  id: string;
  created: boolean;
  period: { start: string; end: string };
  asOf: string;
  payload: Record<string, unknown>;
}

interface PersistedGenerationRow {
  id: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  asOf: string | Date;
  payload: string | Record<string, unknown>;
}

function persistedGeneration(row: PersistedGenerationRow): ExecutionWorkAnalysisGeneration {
  return {
    id: String(row.id),
    created: false,
    period: {
      start: new Date(row.periodStart).toISOString(),
      end: new Date(row.periodEnd).toISOString(),
    },
    asOf: new Date(row.asOf).toISOString(),
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
  };
}

function mondayUtc(input: Date): Date {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function deterministicUuid(organizationId: string, weekStart: string): string {
  const hex = createHash('sha256').update(`execution-work:${organizationId}:${weekStart}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function workItem(row: WorkRow) {
  const value = row.payload_json;
  const kind = row.aggregate_type === 'execution_task' ? 'TASK' : row.aggregate_type === 'execution_decision' ? 'DECISION' : 'MILESTONE';
  return {
    id: row.aggregate_id,
    kind,
    title: stringValue(value.title) ?? row.aggregate_id,
    status: stringValue(value.status) ?? 'UNKNOWN',
    ownerId: stringValue(value.assigneeId) ?? stringValue(value.authorityId) ?? stringValue(value.ownerId),
    dueAt: stringValue(value.dueAt) ?? stringValue(value.targetAt),
    completedAt: stringValue(value.completedAt) ?? stringValue(value.decidedAt),
    priority: stringValue(value.priority) ?? 'UNKNOWN',
    version: row.version,
    initiativeId: row.initiative_id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    sourceType: 'runtime-v1',
  };
}

export async function generateExecutionWorkAnalysis(args: {
  organizationId: string;
  weekOf: Date;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<ExecutionWorkAnalysisGeneration> {
  const start = mondayUtc(args.weekOf);
  const end = new Date(start.getTime() + 7 * DAY);
  const previousStart = new Date(start.getTime() - 7 * DAY);
  const nextMonthEnd = new Date(start.getTime() + 30 * DAY);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const id = deterministicUuid(args.organizationId, startIso);

  const existing = await dbGet<PersistedGenerationRow>(
    `SELECT id, period_start AS "periodStart", period_end AS "periodEnd", as_of AS "asOf", payload
       FROM execution_report_snapshots
      WHERE id = ? AND organization_id = ?`,
    [id, args.organizationId]
  );
  if (existing) {
    return persistedGeneration(existing);
  }

  const rows = await dbAll<WorkRow>(
    `SELECT work.aggregate_type, work.aggregate_id, work.version, work.payload_json,
            ec.payload_json->>'initiativeId' AS initiative_id,
            initiative.payload_json->>'projectId' AS project_id,
            project.name AS project_title
       FROM ie_aggregate_state work
       JOIN ie_aggregate_state ec
         ON ec.organization_id = work.organization_id
        AND ec.aggregate_type = 'execution_case'
        AND ec.aggregate_id = work.payload_json->>'executionCaseId'
       LEFT JOIN ie_aggregate_state initiative
         ON initiative.organization_id = work.organization_id
        AND initiative.aggregate_type = 'initiative'
        AND initiative.aggregate_id = ec.payload_json->>'initiativeId'
       LEFT JOIN projects project
         ON project.organization_id = work.organization_id
        AND project.id = initiative.payload_json->>'projectId'
      WHERE work.organization_id = ?
        AND work.aggregate_type IN ('execution_task','execution_decision','execution_milestone')
      ORDER BY work.aggregate_type, work.aggregate_id`,
    [args.organizationId]
  );
  const taskRows = await dbAll<WorkTabTaskRow>(
    `SELECT t.id AS aggregate_id, t.title, t.status, t.assignee_id, t.owner_id, t.due_date,
            t.completed_at, t.priority, t.initiative_id,
            COALESCE(t.project_id, i.project_id, initiative.payload_json->>'projectId') AS project_id,
            project.name AS project_title
       FROM tasks t
       LEFT JOIN initiatives i
         ON i.organization_id = t.organization_id
        AND i.id = t.initiative_id
       LEFT JOIN ie_aggregate_state initiative
         ON initiative.organization_id = t.organization_id
        AND initiative.aggregate_type = 'initiative'
        AND initiative.aggregate_id = t.initiative_id
       LEFT JOIN projects project
         ON project.organization_id = t.organization_id
        AND project.id = COALESCE(t.project_id, i.project_id, initiative.payload_json->>'projectId')
      WHERE t.organization_id = ?
        AND t.initiative_id IS NOT NULL
        AND EXISTS (
          SELECT 1
            FROM ie_aggregate_state ec
           WHERE ec.organization_id = t.organization_id
             AND ec.aggregate_type = 'execution_case'
             AND ec.payload_json->>'initiativeId' = t.initiative_id
        )
      ORDER BY t.id`,
    [args.organizationId]
  );
  // D-31: this count deliberately does NOT reuse the exact equality from the
  // materialization queries above. If stored text differs only by casing or
  // surrounding whitespace, those queries can silently return no rows. The
  // normalized count remains non-zero and turns that false-empty report into
  // an explicit 409 instead of persisting it as a legitimate empty snapshot.
  const independentSourceCounts = await dbGet<IndependentSourceCounts>(
    `SELECT
       (SELECT COUNT(*)::int
          FROM tasks t
         WHERE t.organization_id = ?
           AND t.initiative_id IS NOT NULL
           AND EXISTS (
             SELECT 1
               FROM ie_aggregate_state ec
              WHERE ec.organization_id = t.organization_id
                AND ec.aggregate_type = 'execution_case'
                AND LOWER(BTRIM(ec.payload_json->>'initiativeId')) =
                    LOWER(BTRIM(t.initiative_id))
           )) AS "taskCount",
       (SELECT COUNT(*)::int
          FROM ie_aggregate_state work
         WHERE work.organization_id = ?
           AND work.aggregate_type = 'execution_decision'
           AND EXISTS (
             SELECT 1
               FROM ie_aggregate_state ec
              WHERE ec.organization_id = work.organization_id
                AND ec.aggregate_type = 'execution_case'
                AND LOWER(BTRIM(ec.aggregate_id)) =
                    LOWER(BTRIM(work.payload_json->>'executionCaseId'))
           )) AS "decisionCount"`,
    [args.organizationId, args.organizationId]
  );
  const taskItems = buildExecutionWorkTaskItems({
    runtimeRows: rows
      .filter((row) => row.aggregate_type === 'execution_task')
      .map((row) => ({
        aggregate_id: row.aggregate_id,
        version: row.version,
        payload_json: row.payload_json,
        initiative_id: row.initiative_id,
        project_id: row.project_id,
        project_title: row.project_title,
      })),
    taskRows,
  });
  const runtimeItems = rows
    .filter((row) => row.aggregate_type !== 'execution_task')
    .map(workItem);
  const items = [...runtimeItems, ...taskItems];
  const inWindow = (value: string | null, from: Date, to: Date) => {
    const timestamp = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(timestamp) && timestamp >= from.getTime() && timestamp < to.getTime();
  };
  const isClosed = (status: string) => CLOSED.has(status.toUpperCase());
  const previous = items.filter((item) => inWindow(isClosed(item.status) ? item.completedAt : item.dueAt, previousStart, start));
  const next = items.filter((item) => inWindow(item.dueAt, start, end));
  const month = items.filter((item) => inWindow(item.dueAt, start, nextMonthEnd));
  const attention = items.flatMap((item) => {
    if (isClosed(item.status)) return [];
    const reasons: string[] = [];
    if (item.status.toUpperCase() === 'BLOCKED') reasons.push('BLOCKED');
    if (item.dueAt && Date.parse(item.dueAt) < start.getTime()) reasons.push('OVERDUE');
    if (!item.ownerId) reasons.push('UNASSIGNED');
    if (!item.dueAt) reasons.push('NO_DUE_DATE');
    return reasons.length ? [{ ...item, reasons }] : [];
  });
  const taskSourceItems = items.filter((item) => item.kind === 'TASK');
  const decisionSourceItems = items.filter((item) => item.kind === 'DECISION');
  assertNonEmptyExecutionWorkSnapshot({
    taskItems,
    decisionItems: decisionSourceItems,
    sourceTaskCount: Number(independentSourceCounts?.taskCount ?? 0),
    sourceDecisionCount: Number(independentSourceCounts?.decisionCount ?? 0),
  });
  const workTabCounts = countExecutionWorkTasks(taskSourceItems);
  const rowShape = (item: (typeof items)[number]) => ({
    record: item.title,
    type: item.kind,
    source: item.sourceType,
    project: item.projectTitle ?? 'Project name unavailable',
    priority: item.priority,
    status: item.status,
    due: item.dueAt ?? 'No due date',
  });
  const payload = {
    definitionKey: 'weekly-exec',
    title: `Weekly execution work analysis · ${startIso.slice(0, 10)}`,
    subtitle: 'Automatically generated from the canonical execution registry.',
    rag: attention.some((item) => item.reasons.includes('BLOCKED')) ? 'RED' : attention.length ? 'AMBER' : 'GREEN',
    ragReason: `${attention.length} record(s) require management attention.`,
    period: { start: startIso, end: endIso },
    asOf: new Date().toISOString(),
    metrics: [
      { id: 'workTasksTotal', label: 'Work tasks total', value: String(workTabCounts.total) },
      { id: 'workTasksOverdue', label: 'Work tasks overdue', value: String(workTabCounts.overdue), tone: workTabCounts.overdue ? 'WARN' : 'OK' },
      { id: 'workTasksBlocked', label: 'Work tasks blocked', value: String(workTabCounts.blocked), tone: workTabCounts.blocked ? 'CRIT' : 'OK' },
      { id: 'previousWeek', label: 'Previous week', value: String(previous.length) },
      { id: 'nextWeek', label: 'Next week', value: String(next.length) },
      { id: 'nextMonth', label: 'Next month', value: String(month.length) },
      { id: 'attention', label: 'Requires attention', value: String(attention.length), tone: attention.length ? 'WARN' : 'OK' },
    ],
    sections: [
      {
        id: 'attention',
        title: 'Management attention',
        table: {
          columns: [
            { id: 'record', label: 'Record' }, { id: 'reasons', label: 'Reason' },
            { id: 'project', label: 'Project' }, { id: 'priority', label: 'Priority' },
          ],
          rows: attention.map((item) => ({ ...rowShape(item), reasons: item.reasons.join(', ') })),
        },
        empty: 'No records require management attention.',
      },
      ...[
        ['previous-week', 'Previous week', previous],
        ['next-week', 'Next week', next],
        ['next-month', 'Next month', month],
      ].map(([sectionId, title, sectionItems]) => ({
        id: sectionId as string,
        title: title as string,
        table: {
          columns: [
            { id: 'record', label: 'Record' }, { id: 'type', label: 'Type' },
            { id: 'project', label: 'Project' }, { id: 'priority', label: 'Priority' },
            { id: 'status', label: 'Status' },
            { id: 'due', label: 'Due' },
          ],
          rows: (sectionItems as typeof items).map(rowShape),
        },
        empty: 'No records in this window.',
      })),
    ],
  };

  const insert = await dbRun(
    `INSERT INTO execution_report_snapshots
       (id, organization_id, definition_key, level, title, period_start, period_end, as_of,
        status, rag, payload, created_by, created_by_name)
     VALUES (?, ?, 'weekly-exec', 'PMO', ?, ?, ?, ?, 'DRAFT', ?, ?::jsonb, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [id, args.organizationId, payload.title, startIso, endIso, payload.asOf, payload.rag, JSON.stringify(payload), args.actorId ?? null, args.actorName ?? 'Consultify scheduler'],
    { fallback: false }
  );
  // DbPromise retains compatibility with legacy call sites by logging some
  // database failures. This generator must prove durability before reporting
  // success, because its receipt is later used as the weekly cadence record.
  const persisted = await dbGet<PersistedGenerationRow>(
    `SELECT id, period_start AS "periodStart", period_end AS "periodEnd", as_of AS "asOf", payload
       FROM execution_report_snapshots
      WHERE id = ? AND organization_id = ?`,
    [id, args.organizationId]
  );
  if (!persisted) throw new Error(`Execution work analysis ${id} was not persisted`);
  if (insert.changes !== 1) return persistedGeneration(persisted);
  return { id, created: true, period: payload.period, asOf: payload.asOf, payload };
}

export async function generateWeeklyExecutionWorkAnalyses(): Promise<{ organizations: number; created: number }> {
  if (process.env.ENABLE_EXECUTION_WORK_ANALYSIS !== 'true') return { organizations: 0, created: 0 };
  const organizationRows = (await dbAll(`SELECT id FROM organizations WHERE COALESCE(status, 'active') <> 'deleted'`)) as Array<{ id: string }>;
  // Some development databases retain a non-tenant `system` sentinel. It is
  // not a valid tenant foreign key for execution_report_snapshots.
  const organizations = organizationRows.filter((organization) => UUID.test(organization.id));
  let created = 0;
  for (const organization of organizations) {
    const result = await generateExecutionWorkAnalysis({ organizationId: organization.id, weekOf: new Date() });
    if (result.created) created += 1;
  }
  return { organizations: organizations.length, created };
}
