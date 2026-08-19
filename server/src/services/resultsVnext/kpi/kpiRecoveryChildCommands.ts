import { createHash, randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import {
  executeAtomicCreate,
  AtomicWriteConflictError,
  AtomicWriteAggregateNotFoundError,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  CommandCapabilityDeniedError,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';
import { computeStateHash, KPI_EVENT_SOURCE } from './kpiDefinitionCommands.js';

export type RecoveryActionType = 'IMMEDIATE' | 'DURABLE';
export type RecoveryActionStatus = 'OPEN' | 'DONE' | 'CANCELLED';
export type RecoveryCheckpointStatus = 'PENDING' | 'MET' | 'MISSED' | 'CANCELLED';

interface RecoveryCardAuthorityRow {
  id: string;
  organization_id: string;
  owner_user_id: string | null;
  deviation_case_id: string;
}

interface RecoveryActionRow {
  action_id: string;
  organization_id: string;
  recovery_card_id: string;
  action_type: RecoveryActionType;
  title: string;
  description: string | null;
  owner_user_id: string | null;
  due_date: string | null;
  status: RecoveryActionStatus;
  linked_task_id: string | null;
  task_link_status: 'NONE' | 'PENDING' | 'LINKED' | 'LINK_FAILED';
  task_link_error: string | null;
  row_version: number;
  created_at: string;
  updated_at: string;
}

interface RecoveryCheckpointRow {
  checkpoint_id: string;
  organization_id: string;
  recovery_card_id: string;
  checkpoint_date: string;
  status: RecoveryCheckpointStatus;
  kpi_time_series_id: string | null;
  notes: string | null;
  row_version: number;
  created_at: string;
  resolved_at: string | null;
}

export interface RecoveryAction {
  id: string;
  actionType: RecoveryActionType;
  title: string;
  description: string | null;
  ownerUserId: string | null;
  dueDate: string | null;
  status: RecoveryActionStatus;
  linkedTaskId: string | null;
  taskLinkStatus: 'NONE' | 'PENDING' | 'LINKED' | 'LINK_FAILED';
  taskLinkError: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryCheckpoint {
  id: string;
  checkpointDate: string;
  status: RecoveryCheckpointStatus;
  notes: string | null;
  kpiTimeSeriesId: string | null;
  rowVersion: number;
  createdAt: string;
  resolvedAt: string | null;
}

type CommandResult<T> = { data: T; requestHash: string; deviationCaseId: string };

const CAPABILITIES = {
  mutateAction: 'results.kpi.deviation.corrective_action.update',
  addAction: 'results.kpi.deviation.corrective_action.add',
  checkpoint: 'results.kpi.deviation.record_recovery_observation',
} as const;

function actionDto(row: RecoveryActionRow): RecoveryAction {
  return {
    id: row.action_id,
    actionType: row.action_type,
    title: row.title,
    description: row.description,
    ownerUserId: row.owner_user_id,
    dueDate: row.due_date,
    status: row.status,
    linkedTaskId: row.linked_task_id,
    taskLinkStatus: row.task_link_status,
    taskLinkError: row.task_link_error,
    rowVersion: row.row_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function checkpointDto(row: RecoveryCheckpointRow): RecoveryCheckpoint {
  return {
    id: row.checkpoint_id,
    checkpointDate: row.checkpoint_date,
    status: row.status,
    notes: row.notes,
    kpiTimeSeriesId: row.kpi_time_series_id,
    rowVersion: row.row_version,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function requestHash(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function ensureFingerprint<T>(expectedHash: string) {
  return (existing: CommandResult<T>) => {
    if (existing.requestHash !== expectedHash) {
      throw new AtomicWriteConflictError(
        'Idempotency key was already used for a different request',
        'IDEMPOTENCY_FINGERPRINT_CONFLICT'
      );
    }
  };
}

async function loadCardAuthority(
  client: PoolClient,
  organizationId: string,
  cardId: string,
  lock = false
): Promise<RecoveryCardAuthorityRow> {
  const result = await client.query<RecoveryCardAuthorityRow>(
    `SELECT c.id, c.organization_id, c.deviation_case_id, dc.owner_user_id
       FROM kpi_recovery_cards c
       INNER JOIN kpi_deviation_cases dc
               ON dc.id = c.deviation_case_id AND dc.organization_id = c.organization_id
      WHERE c.id = $1 AND c.organization_id = $2${lock ? ' FOR UPDATE OF c' : ''}`,
    [cardId, organizationId]
  );
  if (!result.rows[0]) throw new AtomicWriteAggregateNotFoundError('Recovery card not found');
  return result.rows[0];
}

async function assertActiveOrganizationMember(
  client: PoolClient,
  organizationId: string,
  userId: string,
  label: 'actor' | 'assignee'
): Promise<void> {
  const result = await client.query(
    `SELECT 1 FROM organization_members
      WHERE organization_id=$1 AND user_id=$2 AND UPPER(status)='ACTIVE'`,
    [organizationId, userId]
  );
  if (!result.rows[0]) {
    if (label === 'actor') {
      throw new CommandCapabilityDeniedError('results.kpi.recovery.active_membership');
    }
    throw new AtomicWriteConflictError(
      `Recovery task ${label} is not an active organization member`,
      label === 'assignee' ? 'ASSIGNEE_NOT_ACTIVE_MEMBER' : 'ACTOR_NOT_ACTIVE_MEMBER'
    );
  }
}

function authorize(
  access: CommandAccessContext,
  actorUserId: string,
  capability: string,
  authority: RecoveryCardAuthorityRow,
  extraOwner?: string | null
): void {
  assertCommandCapability({
    access,
    actorUserId,
    capability,
    responsibleUserIds: [authority.owner_user_id, extraOwner],
  });
}

async function preflightCardCommand(
  client: PoolClient,
  input: CommandContext,
  capability: string,
  actionId?: string
): Promise<void> {
  const authority = await loadCardAuthority(client, input.organizationId, input.cardId);
  let actionOwner: string | null = null;
  if (actionId) {
    const action = await client.query<{ owner_user_id: string | null }>(
      `SELECT owner_user_id FROM rvn_kpi_recovery_actions
        WHERE action_id=$1 AND recovery_card_id=$2 AND organization_id=$3`,
      [actionId, input.cardId, input.organizationId]
    );
    if (!action.rows[0]) throw new AtomicWriteAggregateNotFoundError('Recovery action not found');
    actionOwner = action.rows[0].owner_user_id;
  }
  authorize(input.access, input.actorUserId, capability, authority, actionOwner);
  await assertActiveOrganizationMember(client, input.organizationId, input.actorUserId, 'actor');
}

function event<T>(input: {
  eventType: string;
  aggregateType: 'deviation_case';
  aggregateId: string;
  organizationId: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  expectedVersion: number | null;
  resultingVersion: number;
  result: CommandResult<T>;
}): AtomicEventInput {
  return {
    schemaVersion: 1,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorEffectiveRole: input.actorEffectiveRole,
    commandId: randomUUID(),
    correlationId: input.correlationId ?? randomUUID(),
    causationId: null,
    occurredAt: new Date().toISOString(),
    policyVersion: 'results-recovery-children-v1',
    beforeState: null,
    afterState: input.result,
    stateHash: computeStateHash(input.result),
    reason: null,
    evidenceRefs: [],
    source: KPI_EVENT_SOURCE,
    idempotencyKey: input.idempotencyKey,
    expectedVersion: input.expectedVersion,
    resultingVersion: input.resultingVersion,
    payload: { requestHash: input.result.requestHash },
  };
}

interface CommandContext {
  organizationId: string;
  cardId: string;
  actorUserId: string;
  actorEffectiveRole: string;
  access: CommandAccessContext;
  idempotencyKey: string;
  correlationId?: string;
}

function unwrap<T>(outcome: AtomicCommandOutcome<CommandResult<T>>): AtomicCommandOutcome<T> {
  return { ...outcome, result: outcome.result.data };
}

export async function createRecoveryAction(
  input: CommandContext & {
    actionType: RecoveryActionType;
    title: string;
    description?: string | null;
    ownerUserId?: string | null;
    dueDate?: string | null;
  }
): Promise<AtomicCommandOutcome<RecoveryAction>> {
  const hash = requestHash({
    op: 'create-action', actorUserId: input.actorUserId, cardId: input.cardId, actionType: input.actionType,
    title: input.title, description: input.description ?? null,
    ownerUserId: input.ownerUserId ?? null, dueDate: input.dueDate ?? null,
  });
  const outcome = await executeAtomicCreate<CommandResult<RecoveryAction>>({
    organizationId: input.organizationId,
    idempotencyKey: input.idempotencyKey,
    preflight: (client) => preflightCardCommand(client, input, CAPABILITIES.addAction),
    validateExistingResult: ensureFingerprint(hash),
    applyMutation: async (client) => {
      const authority = await loadCardAuthority(client, input.organizationId, input.cardId, true);
      authorize(input.access, input.actorUserId, CAPABILITIES.addAction, authority);
      await assertActiveOrganizationMember(client, input.organizationId, input.actorUserId, 'actor');
      if (input.ownerUserId) {
        await assertActiveOrganizationMember(client, input.organizationId, input.ownerUserId, 'assignee');
      }
      const inserted = await client.query<RecoveryActionRow>(
        `INSERT INTO rvn_kpi_recovery_actions
           (organization_id, recovery_card_id, action_type, title, description,
            owner_user_id, due_date, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [input.organizationId, input.cardId, input.actionType, input.title,
          input.description ?? null, input.ownerUserId ?? null, input.dueDate ?? null,
          input.actorUserId]
      );
      return { data: actionDto(inserted.rows[0]!), requestHash: hash, deviationCaseId: authority.deviation_case_id };
    },
    buildEvent: ({ result }) => event({
      eventType: 'kpi.recovery_action_created', aggregateType: 'deviation_case',
      aggregateId: result.deviationCaseId, organizationId: input.organizationId,
      actorUserId: input.actorUserId, actorEffectiveRole: input.actorEffectiveRole,
      idempotencyKey: input.idempotencyKey, correlationId: input.correlationId,
      expectedVersion: null, resultingVersion: 1, result,
    }),
  });
  return unwrap(outcome);
}

export async function updateRecoveryAction(
  input: CommandContext & {
    actionId: string;
    expectedVersion: number;
    status?: RecoveryActionStatus;
    ownerUserId?: string | null;
    dueDate?: string | null;
  }
): Promise<AtomicCommandOutcome<RecoveryAction>> {
  const hash = requestHash({ op: 'update-action', actorUserId: input.actorUserId, cardId: input.cardId, actionId: input.actionId,
    expectedVersion: input.expectedVersion, status: input.status,
    ownerUserId: input.ownerUserId, dueDate: input.dueDate });
  const outcome = await executeAtomicCreate<CommandResult<RecoveryAction>>({
    organizationId: input.organizationId, idempotencyKey: input.idempotencyKey,
    preflight: (client) => preflightCardCommand(client, input, CAPABILITIES.mutateAction, input.actionId),
    validateExistingResult: ensureFingerprint(hash),
    applyMutation: async (client) => {
      const authority = await loadCardAuthority(client, input.organizationId, input.cardId, true);
      const current = await client.query<RecoveryActionRow>(
        `SELECT * FROM rvn_kpi_recovery_actions
          WHERE action_id=$1 AND recovery_card_id=$2 AND organization_id=$3 FOR UPDATE`,
        [input.actionId, input.cardId, input.organizationId]
      );
      const row = current.rows[0];
      if (!row) throw new AtomicWriteAggregateNotFoundError('Recovery action not found');
      authorize(input.access, input.actorUserId, CAPABILITIES.mutateAction, authority, row.owner_user_id);
      await assertActiveOrganizationMember(client, input.organizationId, input.actorUserId, 'actor');
      if (input.ownerUserId) {
        await assertActiveOrganizationMember(client, input.organizationId, input.ownerUserId, 'assignee');
      }
      if (row.row_version !== input.expectedVersion) {
        throw new AtomicWriteConflictError('Recovery action changed', 'STALE_VERSION', {
          currentVersion: row.row_version, expectedVersion: input.expectedVersion,
        });
      }
      const updated = await client.query<RecoveryActionRow>(
        `UPDATE rvn_kpi_recovery_actions SET
           status=COALESCE($1,status),
           owner_user_id=CASE WHEN $2 THEN $3 ELSE owner_user_id END,
           due_date=CASE WHEN $4 THEN $5::date ELSE due_date END,
           row_version=row_version+1, updated_at=now()
         WHERE action_id=$6 AND recovery_card_id=$7 AND organization_id=$8 RETURNING *`,
        [input.status ?? null, input.ownerUserId !== undefined, input.ownerUserId ?? null,
          input.dueDate !== undefined, input.dueDate ?? null, input.actionId,
          input.cardId, input.organizationId]
      );
      return { data: actionDto(updated.rows[0]!), requestHash: hash, deviationCaseId: authority.deviation_case_id };
    },
    buildEvent: ({ result }) => event({ eventType: 'kpi.recovery_action_updated',
      aggregateType: 'deviation_case', aggregateId: result.deviationCaseId,
      organizationId: input.organizationId, actorUserId: input.actorUserId,
      actorEffectiveRole: input.actorEffectiveRole, idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId, expectedVersion: input.expectedVersion,
      resultingVersion: result.data.rowVersion, result }),
  });
  return unwrap(outcome);
}

export interface LinkRecoveryTaskResult {
  linked: true;
  linkedTaskId: string;
  action: RecoveryAction;
}

export async function linkRecoveryActionTask(
  input: CommandContext & { actionId: string; expectedVersion: number }
): Promise<AtomicCommandOutcome<LinkRecoveryTaskResult>> {
  const hash = requestHash({ op: 'link-task', actorUserId: input.actorUserId, cardId: input.cardId,
    actionId: input.actionId, expectedVersion: input.expectedVersion });
  const outcome = await executeAtomicCreate<CommandResult<LinkRecoveryTaskResult>>({
    organizationId: input.organizationId, idempotencyKey: input.idempotencyKey,
    preflight: (client) => preflightCardCommand(client, input, CAPABILITIES.mutateAction, input.actionId),
    validateExistingResult: ensureFingerprint(hash),
    applyMutation: async (client) => {
      const authority = await loadCardAuthority(client, input.organizationId, input.cardId, true);
      const current = await client.query<RecoveryActionRow>(
        `SELECT * FROM rvn_kpi_recovery_actions
          WHERE action_id=$1 AND recovery_card_id=$2 AND organization_id=$3 FOR UPDATE`,
        [input.actionId, input.cardId, input.organizationId]
      );
      const row = current.rows[0];
      if (!row) throw new AtomicWriteAggregateNotFoundError('Recovery action not found');
      authorize(input.access, input.actorUserId, CAPABILITIES.mutateAction, authority, row.owner_user_id);
      if (row.row_version !== input.expectedVersion) {
        throw new AtomicWriteConflictError('Recovery action changed', 'STALE_VERSION', {
          currentVersion: row.row_version, expectedVersion: input.expectedVersion,
        });
      }
      if (row.linked_task_id) {
        throw new AtomicWriteConflictError('Recovery action already has a task', 'TASK_ALREADY_LINKED');
      }
      await assertActiveOrganizationMember(client, input.organizationId, input.actorUserId, 'actor');
      if (row.owner_user_id) {
        await assertActiveOrganizationMember(client, input.organizationId, row.owner_user_id, 'assignee');
      }
      const taskId = randomUUID();
      // Pinned-client adapter for TaskService.createTask's canonical core:
      // same task states/defaults, creator-derived tenant, stable source
      // identity and idempotency columns.  The membership checks above are
      // stricter than TaskService's current implementation and keep the
      // task+link+event in this one transaction (TaskService owns its own DB
      // handle and notification side effect, so calling it here would break
      // atomicity).
      await client.query(
        `INSERT INTO tasks
           (id, organization_id, title, description, status, priority, assignee_id,
            due_date, created_by, idempotency_key, source_type, source_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'todo','medium',$5,$6,$7,$8,'kpi_recovery_action',$9,now(),now())`,
        [taskId, input.organizationId, row.title,
          row.description ?? `KPI recovery action (${row.action_id})`,
          row.owner_user_id, row.due_date, input.actorUserId,
          `recovery-task:${input.idempotencyKey}`, row.action_id]
      );
      const updated = await client.query<RecoveryActionRow>(
        `UPDATE rvn_kpi_recovery_actions
            SET linked_task_id=$1, task_link_status='LINKED', task_link_error=NULL,
                task_link_attempted_at=now(), row_version=row_version+1,
                updated_at=now()
          WHERE action_id=$2 AND recovery_card_id=$3 AND organization_id=$4 RETURNING *`,
        [taskId, input.actionId, input.cardId, input.organizationId]
      );
      return { data: { linked: true, linkedTaskId: taskId, action: actionDto(updated.rows[0]!) },
        requestHash: hash, deviationCaseId: authority.deviation_case_id };
    },
    buildEvent: ({ result }) => event({ eventType: 'kpi.recovery_action_task_linked',
      aggregateType: 'deviation_case', aggregateId: result.deviationCaseId,
      organizationId: input.organizationId, actorUserId: input.actorUserId,
      actorEffectiveRole: input.actorEffectiveRole, idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId, expectedVersion: input.expectedVersion,
      resultingVersion: result.data.action.rowVersion, result }),
  });
  return unwrap(outcome);
}

export async function createRecoveryCheckpoint(
  input: CommandContext & { checkpointDate: string; notes?: string | null }
): Promise<AtomicCommandOutcome<RecoveryCheckpoint>> {
  const hash = requestHash({ op: 'create-checkpoint', actorUserId: input.actorUserId, cardId: input.cardId,
    checkpointDate: input.checkpointDate, notes: input.notes ?? null });
  const outcome = await executeAtomicCreate<CommandResult<RecoveryCheckpoint>>({
    organizationId: input.organizationId, idempotencyKey: input.idempotencyKey,
    preflight: (client) => preflightCardCommand(client, input, CAPABILITIES.checkpoint),
    validateExistingResult: ensureFingerprint(hash),
    applyMutation: async (client) => {
      const authority = await loadCardAuthority(client, input.organizationId, input.cardId, true);
      authorize(input.access, input.actorUserId, CAPABILITIES.checkpoint, authority);
      await assertActiveOrganizationMember(client, input.organizationId, input.actorUserId, 'actor');
      const inserted = await client.query<RecoveryCheckpointRow>(
        `INSERT INTO rvn_kpi_recovery_checkpoints
           (organization_id,recovery_card_id,checkpoint_date,notes,created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [input.organizationId, input.cardId, input.checkpointDate,
          input.notes ?? null, input.actorUserId]
      );
      return { data: checkpointDto(inserted.rows[0]!), requestHash: hash, deviationCaseId: authority.deviation_case_id };
    },
    buildEvent: ({ result }) => event({ eventType: 'kpi.recovery_checkpoint_created',
      aggregateType: 'deviation_case', aggregateId: result.deviationCaseId,
      organizationId: input.organizationId, actorUserId: input.actorUserId,
      actorEffectiveRole: input.actorEffectiveRole, idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId, expectedVersion: null, resultingVersion: 1, result }),
  });
  return unwrap(outcome);
}

export async function resolveRecoveryCheckpoint(
  input: CommandContext & { checkpointId: string; expectedVersion: number;
    status: Exclude<RecoveryCheckpointStatus, 'PENDING'>; kpiTimeSeriesId?: string | null }
): Promise<AtomicCommandOutcome<RecoveryCheckpoint>> {
  const hash = requestHash({ op: 'resolve-checkpoint', actorUserId: input.actorUserId, cardId: input.cardId,
    checkpointId: input.checkpointId, expectedVersion: input.expectedVersion,
    status: input.status, kpiTimeSeriesId: input.kpiTimeSeriesId ?? null });
  const outcome = await executeAtomicCreate<CommandResult<RecoveryCheckpoint>>({
    organizationId: input.organizationId, idempotencyKey: input.idempotencyKey,
    preflight: (client) => preflightCardCommand(client, input, CAPABILITIES.checkpoint),
    validateExistingResult: ensureFingerprint(hash),
    applyMutation: async (client) => {
      const authority = await loadCardAuthority(client, input.organizationId, input.cardId, true);
      authorize(input.access, input.actorUserId, CAPABILITIES.checkpoint, authority);
      await assertActiveOrganizationMember(client, input.organizationId, input.actorUserId, 'actor');
      const current = await client.query<RecoveryCheckpointRow>(
        `SELECT * FROM rvn_kpi_recovery_checkpoints
          WHERE checkpoint_id=$1 AND recovery_card_id=$2 AND organization_id=$3 FOR UPDATE`,
        [input.checkpointId, input.cardId, input.organizationId]
      );
      const row = current.rows[0];
      if (!row) throw new AtomicWriteAggregateNotFoundError('Recovery checkpoint not found');
      if (row.row_version !== input.expectedVersion) {
        throw new AtomicWriteConflictError('Recovery checkpoint changed', 'STALE_VERSION', {
          currentVersion: row.row_version, expectedVersion: input.expectedVersion,
        });
      }
      if (row.status !== 'PENDING') {
        throw new AtomicWriteConflictError('Recovery checkpoint is already resolved', 'CHECKPOINT_TERMINAL');
      }
      if (input.status === 'MET' && !input.kpiTimeSeriesId) {
        throw new AtomicWriteConflictError('A MET checkpoint requires an exact measurement', 'MEASUREMENT_REQUIRED');
      }
      if (input.kpiTimeSeriesId) {
        const measurement = await client.query(
          `SELECT 1 FROM kpi_time_series ts
            INNER JOIN kpi_recovery_cards c ON c.kpi_id=ts.kpi_id AND c.organization_id=ts.organization_id
           WHERE ts.id=$1 AND c.id=$2 AND c.organization_id=$3`,
          [input.kpiTimeSeriesId, input.cardId, input.organizationId]
        );
        if (!measurement.rows[0]) throw new AtomicWriteAggregateNotFoundError('KPI measurement not found');
      }
      const updated = await client.query<RecoveryCheckpointRow>(
        `UPDATE rvn_kpi_recovery_checkpoints SET status=$1, kpi_time_series_id=$2,
            row_version=row_version+1, resolved_at=now()
          WHERE checkpoint_id=$3 AND recovery_card_id=$4 AND organization_id=$5 RETURNING *`,
        [input.status, input.kpiTimeSeriesId ?? null, input.checkpointId,
          input.cardId, input.organizationId]
      );
      return { data: checkpointDto(updated.rows[0]!), requestHash: hash, deviationCaseId: authority.deviation_case_id };
    },
    buildEvent: ({ result }) => event({ eventType: 'kpi.recovery_checkpoint_resolved',
      aggregateType: 'deviation_case', aggregateId: result.deviationCaseId,
      organizationId: input.organizationId, actorUserId: input.actorUserId,
      actorEffectiveRole: input.actorEffectiveRole, idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId, expectedVersion: input.expectedVersion,
      resultingVersion: result.data.rowVersion, result }),
  });
  return unwrap(outcome);
}
