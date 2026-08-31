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
  return {
    write: args.includes('--write'),
    confirmBatch: args.includes('--confirm-batch'),
    batchSize: args.includes('--confirm-batch') ? parsedBatch : 1,
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

function mappedTask(task: LegacyTask, options: RunnerOptions) {
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

async function main(): Promise<void> {
  const options = parseRunnerOptions(process.argv.slice(2));
  const target = resolveScriptDatabaseTarget({
    label: LABEL,
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget(LABEL, target);
  assertWriteAuthorized(options);

  const pool = new Pool({ connectionString: target.connectionString, max: 2 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  try {
    const initiatives = await pool.query<{ organization_id: string; initiative_id: string }>(
      `SELECT organization_id, initiative_id
         FROM tasks
        WHERE initiative_id IS NOT NULL
          AND ($1::text IS NULL OR initiative_id=$1)
          AND NOT EXISTS (
            SELECT 1 FROM legacy_task_cutover_ledger ledger
             WHERE ledger.organization_id=tasks.organization_id
               AND ledger.legacy_task_id=tasks.id
          )
        GROUP BY organization_id, initiative_id
        ORDER BY organization_id, initiative_id
        LIMIT $2`,
      [options.initiativeId ?? null, selectedInitiativeLimit(options)]
    );
    const selected = new Set(
      initiatives.rows.map((row) => `${row.organization_id}:${row.initiative_id}`)
    );
    const tasks = await pool.query<LegacyTask>(
      `SELECT id,organization_id,initiative_id,title,assignee_id,owner_id,reporter_id,
              created_by,due_date,sla_due_at
         FROM tasks
        WHERE initiative_id IS NULL OR (organization_id || ':' || initiative_id) = ANY($1::text[])
        ORDER BY organization_id,initiative_id NULLS LAST,id`,
      [Array.from(selected)]
    );
    const plan = tasks.rows.map((task) => ({ task, mapping: mappedTask(task, options) }));
    if (!options.write) {
      console.log(
        JSON.stringify(
          {
            mode: 'DRY_RUN',
            initiatives: initiatives.rowCount,
            tasks: plan.map(({ task, mapping }) => ({
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

    for (const { task, mapping } of plan) {
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
        continue;
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
        continue;
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
    }
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
