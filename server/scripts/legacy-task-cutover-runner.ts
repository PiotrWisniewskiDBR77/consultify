#!/usr/bin/env tsx
import { createHash } from 'node:crypto';

import { Pool } from 'pg';

import { createExecutionTask } from '../src/domain/initiatives-execution/executionWork.js';
import { PostgresMaterialCommandUnitOfWork } from '../src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';
import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

const LABEL = 'legacy-task-cutover-runner';
const CONFIRMATION_ENV = 'CONFIRM_LEGACY_TASK_CUTOVER';
const CONFIRMATION_VALUE = 'day204-write';

export interface RunnerOptions {
  write: boolean;
  confirmBatch: boolean;
  batchSize: number;
  /**
   * FIX-204-2 (D-13 pilot): hard cap on the number of TASK rows a single
   * invocation may plan/migrate, independent of the initiative-level batch
   * size above. Defaults to 1 so `--max-tasks` unset ⇒ exactly one task,
   * which is the only way D-13's "pilot 1 record" claim is actually true.
   */
  maxTasks: number;
  /**
   * FIX-204-1 (D-13): mandatory. Without an explicit organization scope the
   * runner used to touch every organization's personal (initiative-less)
   * tasks at once. Fail-closed: parseRunnerOptions throws when this is
   * missing, before any database connection is opened.
   */
  organizationId: string;
  initiativeId?: string;
  ownerFallback?: 'reporter' | 'created_by' | 'migration-actor';
  slaOffsetDays?: number;
  actorId: string;
  batchId: string;
}

type LegacyTask = {
  id: string;
  organization_id: string;
  initiative_id: string | null;
  title: string;
  assignee_id: string | null;
  owner_id: string | null;
  reporter_id: string | null;
  created_by: string | null;
  due_date: string | null;
  sla_due_at: string | null;
};

type TaskMapping = {
  ownerId: string | null;
  dueAt: string | null;
  slaAt: string | null;
  reasonCode: string | null;
};

type PlannedTask = { task: LegacyTask; mapping: TaskMapping };

export type MigrateOutcome = 'MIGRATED' | 'SKIPPED' | 'NOOP';

function value(args: string[], name: string): string | undefined {
  const equals = args.find((arg) => arg.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function parseRunnerOptions(args: string[]): RunnerOptions {
  const parsedBatch = Number(value(args, '--batch-size') ?? 1);
  if (!Number.isInteger(parsedBatch) || parsedBatch < 1 || parsedBatch > 10) {
    throw new Error('--batch-size must be an integer between 1 and 10');
  }
  const initiativeId = value(args, '--initiative-id');
  if (
    initiativeId &&
    args.some((arg) => arg === '--batch-size' || arg.startsWith('--batch-size='))
  ) {
    throw new Error('--initiative-id and --batch-size are mutually exclusive');
  }
  const ownerFallback = value(args, '--owner-fallback') as RunnerOptions['ownerFallback'];
  if (ownerFallback && !['reporter', 'created_by', 'migration-actor'].includes(ownerFallback)) {
    throw new Error('--owner-fallback must be reporter, created_by, or migration-actor');
  }
  const slaRaw = value(args, '--sla-offset-days');
  const slaOffsetDays = slaRaw === undefined ? undefined : Number(slaRaw);
  if (slaOffsetDays !== undefined && (!Number.isInteger(slaOffsetDays) || slaOffsetDays < 0)) {
    throw new Error('--sla-offset-days must be a non-negative integer');
  }

  // FIX-204-1 (D-13, blocking): fail-closed without an explicit organization
  // scope. The old runner had no organization_id filter at all, so a
  // "pilot" run on staging would have touched every organization's personal
  // tasks (265 rows across N orgs) in addition to whichever initiative it
  // picked. Refuse to even parse options rather than let that happen.
  const organizationId = value(args, '--organization-id');
  if (!organizationId) {
    throw new Error(
      '--organization-id is required. The migration must be scoped to exactly one ' +
        'organization per D-13 (pilot 1 record, then batches) — refusing to start unscoped.'
    );
  }

  // FIX-204-2 (D-13, blocking): independent task-level cap, enforced in SQL
  // (see selectCandidateTasks) on every branch — initiative-tied AND
  // personal tasks alike. Defaults to 1 so an unqualified run is always the
  // smallest possible pilot.
  const maxTasksRaw = value(args, '--max-tasks') ?? '1';
  const maxTasks = Number(maxTasksRaw);
  if (!Number.isInteger(maxTasks) || maxTasks < 1) {
    throw new Error('--max-tasks must be a positive integer');
  }

  return {
    write: args.includes('--write'),
    confirmBatch: args.includes('--confirm-batch'),
    batchSize: args.includes('--confirm-batch') ? parsedBatch : 1,
    maxTasks,
    organizationId,
    initiativeId,
    ownerFallback,
    slaOffsetDays,
    actorId: value(args, '--actor-id') ?? 'day204-migration-actor',
    batchId: value(args, '--batch-id') ?? 'day204-local',
  };
}

export function selectedInitiativeLimit(options: RunnerOptions): number {
  return options.confirmBatch ? options.batchSize : 1;
}

export function assertWriteAuthorized(options: RunnerOptions): void {
  if (options.write) requireConfirmation(CONFIRMATION_ENV, CONFIRMATION_VALUE, LABEL);
}

function checksum(valueToHash: unknown): string {
  return createHash('sha256').update(JSON.stringify(valueToHash)).digest('hex');
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function mappedTask(task: LegacyTask, options: RunnerOptions): TaskMapping {
  const ownerId =
    task.owner_id ??
    (options.ownerFallback === 'reporter'
      ? task.reporter_id
      : options.ownerFallback === 'created_by'
        ? task.created_by
        : options.ownerFallback === 'migration-actor'
          ? options.actorId
          : null);
  const dueAt =
    task.due_date && Number.isFinite(Date.parse(task.due_date))
      ? new Date(task.due_date).toISOString()
      : null;
  const slaAt =
    task.sla_due_at && Number.isFinite(Date.parse(task.sla_due_at))
      ? new Date(task.sla_due_at).toISOString()
      : dueAt && options.slaOffsetDays !== undefined
        ? addDays(dueAt, options.slaOffsetDays)
        : null;
  const missing = [
    !task.initiative_id && 'PERSONAL_NO_INITIATIVE',
    !task.assignee_id && 'MISSING_ASSIGNEE',
    !ownerId && 'MISSING_OWNER',
    !dueAt && 'MISSING_DUE_AT',
    !slaAt && 'MISSING_SLA_AT',
  ].filter(Boolean) as string[];
  return { ownerId, dueAt, slaAt, reasonCode: missing[0] ?? null };
}

/**
 * FIX-204-1 + FIX-204-2 + FIX-204-3 (selector / "Guard A"):
 * Builds the plan of tasks a run would touch. Every branch — initiative-tied
 * AND personal (`initiative_id IS NULL`) — is scoped to
 * `options.organizationId` and excludes rows already present in
 * `legacy_task_cutover_ledger`, then the WHOLE combined set is capped by
 * `options.maxTasks` (not by initiative count). This is what makes
 * `--max-tasks=1` give exactly one task regardless of which branch it comes
 * from, and what gives forward progress across repeated runs: an
 * already-ledgered task can never crowd out a pending one because it is
 * excluded from the SQL result set itself, not merely skipped later.
 *
 * Exported so FIX-204-3's realDB test can prove this guard is load-bearing
 * by mutation: delete the `NOT EXISTS` clause below and a two-task fixture
 * with `--max-tasks=1` will starve the second task forever (the test goes
 * red without it).
 */
export async function selectCandidateTasks(
  pool: Pool,
  options: RunnerOptions
): Promise<{ plan: PlannedTask[]; initiativesConsidered: number }> {
  const initiatives = await pool.query<{ organization_id: string; initiative_id: string }>(
    `SELECT organization_id, initiative_id
       FROM tasks
      WHERE organization_id = $1
        AND initiative_id IS NOT NULL
        AND ($2::text IS NULL OR initiative_id=$2)
        AND NOT EXISTS (
          SELECT 1 FROM legacy_task_cutover_ledger ledger
           WHERE ledger.organization_id=tasks.organization_id
             AND ledger.legacy_task_id=tasks.id
        )
      GROUP BY organization_id, initiative_id
      ORDER BY organization_id, initiative_id
      LIMIT $3`,
    [options.organizationId, options.initiativeId ?? null, selectedInitiativeLimit(options)]
  );
  const selected = new Set(
    initiatives.rows.map((row) => `${row.organization_id}:${row.initiative_id}`)
  );
  const tasks = await pool.query<LegacyTask>(
    `SELECT id,organization_id,initiative_id,title,assignee_id,owner_id,reporter_id,
            created_by,due_date,sla_due_at
       FROM tasks
      WHERE organization_id = $1
        AND (
          initiative_id IS NULL
          OR (organization_id || ':' || initiative_id) = ANY($2::text[])
        )
        AND NOT EXISTS (
          SELECT 1 FROM legacy_task_cutover_ledger ledger
           WHERE ledger.organization_id=tasks.organization_id
             AND ledger.legacy_task_id=tasks.id
        )
      ORDER BY organization_id,initiative_id NULLS LAST,id
      LIMIT $3`,
    [options.organizationId, Array.from(selected), options.maxTasks]
  );
  return {
    plan: tasks.rows.map((task) => ({ task, mapping: mappedTask(task, options) })),
    initiativesConsidered: initiatives.rowCount ?? 0,
  };
}

/**
 * FIX-204-3 ("Guard B"): per-task idempotency check + write. Looks up any
 * existing ledger row for this exact (organization_id, legacy_task_id) and
 * either no-ops (identical checksum — safe replay), throws (checksum
 * mismatch — the underlying task or migration policy changed since it was
 * migrated, which must never be silently overwritten), or performs the real
 * migration.
 *
 * This is deliberately a second, independent check on top of the
 * `NOT EXISTS` in `selectCandidateTasks` — defense in depth against a task
 * reaching this function despite already being ledgered (e.g. a future
 * caller that builds its own plan). Exported so FIX-204-3's realDB test can
 * prove it is load-bearing on its own: call it directly (bypassing the
 * selector) against a task that is already ledgered AND already has a
 * version-1 canonical aggregate; with the guard removed this throws
 * `aggregate version conflict` instead of no-opping.
 */
export async function migrateOneTask(
  pool: Pool,
  uow: PostgresMaterialCommandUnitOfWork,
  task: LegacyTask,
  mapping: TaskMapping,
  options: RunnerOptions
): Promise<MigrateOutcome> {
  const clientRequestId = `tasks-canonical-v1:${task.organization_id}:${task.id}`;
  const taskChecksum = checksum({
    task,
    mapping,
    policy: {
      ownerFallback: options.ownerFallback ?? null,
      slaOffsetDays: options.slaOffsetDays ?? null,
    },
  });
  const existing = await pool.query<{ checksum: string; status: string }>(
    `SELECT checksum,status FROM legacy_task_cutover_ledger WHERE organization_id=$1 AND legacy_task_id=$2`,
    [task.organization_id, task.id]
  );
  if (existing.rows[0]) {
    if (existing.rows[0].checksum !== taskChecksum)
      throw new Error(`checksum conflict for ${task.id}`);
    return 'NOOP';
  }
  if (mapping.reasonCode) {
    await pool.query(
      `INSERT INTO legacy_task_cutover_ledger
       (organization_id,legacy_task_id,batch_id,status,reason_code,client_request_id,
        actor_id,checksum,completed_at)
       VALUES($1,$2,$3,'SKIPPED',$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
      [
        task.organization_id,
        task.id,
        options.batchId,
        mapping.reasonCode,
        clientRequestId,
        options.actorId,
        taskChecksum,
      ]
    );
    return 'SKIPPED';
  }
  const caseRow = await pool.query<{ aggregate_id: string; version: number }>(
    `SELECT aggregate_id,version FROM ie_aggregate_state
      WHERE organization_id=$1 AND aggregate_type='execution_case'
        AND payload_json->>'initiativeId'=$2 AND payload_json->>'state'='ACTIVE'
      ORDER BY version DESC LIMIT 1`,
    [task.organization_id, task.initiative_id]
  );
  if (!caseRow.rows[0]) {
    throw new Error(`CANONICAL_HOME_MISSING:${task.organization_id}:${task.initiative_id}`);
  }
  const caseBefore = caseRow.rows[0].version;
  const result = await createExecutionTask(uow, {
    organizationId: task.organization_id,
    actorId: options.actorId,
    aggregateType: 'execution_task',
    aggregateId: `legacy-task:${task.id}`,
    expectedVersion: 0,
    clientRequestId,
    correlationId: options.batchId,
    policyId: 'legacy-task-cutover-v1',
    policyVersion: 1,
    commandType: 'execution.task.create',
    createIfMissing: true,
    payload: {
      executionCaseId: caseRow.rows[0].aggregate_id,
      initiativeId: task.initiative_id!,
      title: task.title,
      description: '',
      assigneeId: task.assignee_id!,
      ownerId: mapping.ownerId!,
      dueAt: mapping.dueAt!,
      slaAt: mapping.slaAt!,
      blockerDecisionIds: [],
      dependencyTaskIds: [],
      milestoneIds: [],
      evidenceRefs: [`legacy-task:${task.id}`],
      expectedCaseVersion: caseBefore,
    },
  });
  await pool.query(
    `INSERT INTO legacy_task_cutover_ledger
     (organization_id,legacy_task_id,batch_id,status,client_request_id,canonical_id,
      case_version_before,case_version_after,actor_id,checksum,completed_at)
     VALUES($1,$2,$3,'MIGRATED',$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)`,
    [
      task.organization_id,
      task.id,
      options.batchId,
      clientRequestId,
      `legacy-task:${task.id}`,
      caseBefore,
      result.aggregateVersion,
      options.actorId,
      taskChecksum,
    ]
  );
  return 'MIGRATED';
}

export interface CutoverRunResult {
  mode: 'DRY_RUN' | 'WRITE';
  initiativesConsidered: number;
  plan: PlannedTask[];
  outcomes: MigrateOutcome[];
}

/**
 * FIX-204-3: the full migration body, extracted out of `main()` so it can be
 * imported and driven directly by realDB tests (previously this logic was
 * unreachable from any importer — the only test that imported this module
 * was a pure argument-parsing test).
 */
export async function runLegacyTaskCutover(
  pool: Pool,
  options: RunnerOptions
): Promise<CutoverRunResult> {
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const { plan, initiativesConsidered } = await selectCandidateTasks(pool, options);
  if (!options.write) {
    return { mode: 'DRY_RUN', initiativesConsidered, plan, outcomes: [] };
  }
  const outcomes: MigrateOutcome[] = [];
  for (const { task, mapping } of plan) {
    outcomes.push(await migrateOneTask(pool, uow, task, mapping, options));
  }
  return { mode: 'WRITE', initiativesConsidered, plan, outcomes };
}

async function main(): Promise<void> {
  const options = parseRunnerOptions(process.argv.slice(2));
  const target = resolveScriptDatabaseTarget({
    label: LABEL,
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    // FIX-204-4: local loopback is now the normal, expected path for this
    // script (pilot runs happen against a local/dev database first); a
    // remote host requires the separate, explicit consent below.
    allowOnlyLoopback: true,
  });
  logSelectedDatabaseTarget(LABEL, target);
  assertWriteAuthorized(options);

  const pool = new Pool({ connectionString: target.connectionString, max: 2 });
  try {
    const run = await runLegacyTaskCutover(pool, options);
    if (run.mode === 'DRY_RUN') {
      console.log(
        JSON.stringify(
          {
            mode: 'DRY_RUN',
            initiatives: run.initiativesConsidered,
            tasks: run.plan.map(({ task, mapping }) => ({
              id: task.id,
              initiativeId: task.initiative_id,
              reasonCode: mapping.reasonCode,
            })),
          },
          null,
          2
        )
      );
      return;
    }
    console.log(
      JSON.stringify(
        {
          mode: 'WRITE',
          initiatives: run.initiativesConsidered,
          planned: run.plan.length,
          migrated: run.outcomes.filter((o) => o === 'MIGRATED').length,
          skipped: run.outcomes.filter((o) => o === 'SKIPPED').length,
          noop: run.outcomes.filter((o) => o === 'NOOP').length,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
