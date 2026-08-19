import { createHash, randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import type { IDatabase } from '../../../database/IDatabase.js';
import {
  buildRecoveryCardDTO,
  closeRecoveryCard as closeLegacyRecoveryCard,
  ensureRecoveryCardForCase,
  getRecoveryCardDTO,
  RecoveryCardServiceError,
  updateRecoveryCard as updateLegacyRecoveryCard,
  type RecoveryCardDTO,
  type RecoveryCardRow,
  type RecoveryEffectivenessRating,
  type RecoveryPriority,
  type RecoveryReferenceItem,
} from '../../results/kpiRecoveryCardService.js';
import {
  AtomicWriteAggregateNotFoundError,
  AtomicWriteConflictError,
  executeAtomicCreate,
  type AtomicCommandOutcome,
  type AtomicEventInput,
} from '../platform/atomicWrite.js';
import {
  assertCommandCapability,
  CommandCapabilityDeniedError,
  type CommandAccessContext,
} from '../platform/commandCapabilityGuard.js';
import { computeStateHash, KPI_EVENT_SOURCE } from './kpiDefinitionCommands.js';

type CommandResult = {
  card: RecoveryCardDTO;
  requestHash: string;
  deviationCaseId: string;
};

interface Context {
  organizationId: string;
  actorUserId: string;
  actorEffectiveRole: string;
  access: CommandAccessContext;
  idempotencyKey: string;
  correlationId?: string;
}

interface CardAuthority {
  id: string;
  deviation_case_id: string;
  owner_user_id: string | null;
}

const CAPABILITIES = {
  create: 'results.kpi.deviation.submit_plan',
  update: 'results.kpi.deviation.submit_plan',
  close: 'results.kpi.deviation.close',
} as const;

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

function fingerprint(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function validateReplay(expected: string) {
  return (existing: CommandResult) => {
    if (existing.requestHash !== expected) {
      throw new AtomicWriteConflictError(
        'Idempotency key was already used for a different recovery-card command',
        'IDEMPOTENCY_FINGERPRINT_CONFLICT'
      );
    }
  };
}

function numberedSql(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/** Keep the proven recovery-card state machine on the caller's pinned tx. */
function database(client: PoolClient): IDatabase {
  return {
    async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
      const result = await client.query<T & Record<string, unknown>>(numberedSql(sql), params);
      return result.rows[0] as T | undefined;
    },
    async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const result = await client.query<T & Record<string, unknown>>(numberedSql(sql), params);
      return result.rows as T[];
    },
    async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
      const result = await client.query(numberedSql(sql), params);
      return { changes: result.rowCount ?? 0 };
    },
  } as IDatabase;
}

async function assertActiveMember(client: PoolClient, organizationId: string, actorUserId: string) {
  const result = await client.query(
    `SELECT 1 FROM organization_members
      WHERE organization_id=$1 AND user_id=$2 AND UPPER(status)='ACTIVE'`,
    [organizationId, actorUserId]
  );
  if (!result.rows[0]) {
    throw new CommandCapabilityDeniedError('results.kpi.recovery.active_membership');
  }
}

function authorize(input: Context, responsibleUserId: string | null, capability: string) {
  assertCommandCapability({
    access: input.access,
    actorUserId: input.actorUserId,
    capability,
    responsibleUserIds: [responsibleUserId],
  });
}

async function loadCaseAuthority(
  client: PoolClient,
  organizationId: string,
  caseId: string,
  lock = false
) {
  const result = await client.query<{
    id: string;
    kpi_id: string;
    severity: string | null;
    owner_user_id: string | null;
  }>(
    `SELECT dc.id, dc.kpi_id, dc.severity, dc.owner_user_id
       FROM kpi_deviation_cases dc
      WHERE dc.id=$1 AND dc.organization_id=$2${lock ? ' FOR UPDATE' : ''}`,
    [caseId, organizationId]
  );
  if (!result.rows[0]) throw new AtomicWriteAggregateNotFoundError('Deviation case not found');
  return result.rows[0];
}

async function loadCardAuthority(
  client: PoolClient,
  organizationId: string,
  cardId: string,
  lock = false
): Promise<CardAuthority> {
  const result = await client.query<CardAuthority>(
    `SELECT c.id, c.deviation_case_id, dc.owner_user_id
       FROM kpi_recovery_cards c
       JOIN kpi_deviation_cases dc
         ON dc.id=c.deviation_case_id AND dc.organization_id=c.organization_id
      WHERE c.id=$1 AND c.organization_id=$2${lock ? ' FOR UPDATE OF c' : ''}`,
    [cardId, organizationId]
  );
  if (!result.rows[0]) throw new AtomicWriteAggregateNotFoundError('Recovery card not found');
  return result.rows[0];
}

function event(input: Context, result: CommandResult, eventType: string, expectedVersion: number | null): AtomicEventInput {
  return {
    schemaVersion: 1,
    eventType,
    aggregateType: 'deviation_case',
    aggregateId: result.deviationCaseId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorEffectiveRole: input.actorEffectiveRole,
    commandId: randomUUID(),
    correlationId: input.correlationId ?? randomUUID(),
    causationId: null,
    occurredAt: new Date().toISOString(),
    policyVersion: 'results-recovery-card-v1',
    beforeState: null,
    afterState: result,
    stateHash: computeStateHash(result),
    reason: null,
    evidenceRefs: [],
    source: KPI_EVENT_SOURCE,
    idempotencyKey: input.idempotencyKey,
    expectedVersion,
    resultingVersion: result.card.version,
    payload: { requestHash: result.requestHash },
  };
}

function unwrap(outcome: AtomicCommandOutcome<CommandResult>): AtomicCommandOutcome<RecoveryCardDTO> {
  return { ...outcome, result: outcome.result.card };
}

function mapServiceError(error: unknown): never {
  if (error instanceof RecoveryCardServiceError) {
    if (error.code === 'NOT_FOUND') throw new AtomicWriteAggregateNotFoundError(error.message);
    throw new AtomicWriteConflictError(error.message, `RECOVERY_${error.code}`);
  }
  throw error;
}

export async function createRecoveryCard(
  input: Context & { caseId: string; initialPatch?: RecoveryCardPatch }
): Promise<AtomicCommandOutcome<RecoveryCardDTO>> {
  const hash = fingerprint({ op: 'create-card', actorUserId: input.actorUserId, caseId: input.caseId,
    initialPatch: input.initialPatch ?? {} });
  const outcome = await executeAtomicCreate<CommandResult>({
    organizationId: input.organizationId,
    idempotencyKey: input.idempotencyKey,
    preflight: async (client) => {
      const authority = await loadCaseAuthority(client, input.organizationId, input.caseId);
      authorize(input, authority.owner_user_id, CAPABILITIES.create);
      await assertActiveMember(client, input.organizationId, input.actorUserId);
    },
    validateExistingResult: validateReplay(hash),
    applyMutation: async (client) => {
      const authority = await loadCaseAuthority(client, input.organizationId, input.caseId, true);
      authorize(input, authority.owner_user_id, CAPABILITIES.create);
      await assertActiveMember(client, input.organizationId, input.actorUserId);
      try {
        const priorCanonicalCreate = await client.query(
          `SELECT 1 FROM rvn_platform_events
            WHERE organization_id=$1 AND aggregate_type='deviation_case' AND aggregate_id=$2
              AND event_type='kpi.recovery_card_created'
            LIMIT 1`,
          [input.organizationId, input.caseId]
        );
        if (priorCanonicalCreate.rows[0]) {
          throw new AtomicWriteConflictError(
            'Recovery card already exists; retry the original command identity',
            'RECOVERY_CARD_ALREADY_EXISTS'
          );
        }
        const created = await ensureRecoveryCardForCase({
          db: database(client),
          orgId: input.organizationId,
          kpiId: authority.kpi_id,
          caseId: input.caseId,
          severity: String(authority.severity).toUpperCase() === 'RED' ? 'RED' : 'AMBER',
          actorUserId: input.actorUserId,
        });
        if (!created) throw new AtomicWriteAggregateNotFoundError('Deviation case not found');
        let row = await client.query<RecoveryCardRow>(
          'SELECT * FROM kpi_recovery_cards WHERE id=$1 AND organization_id=$2',
          [created.cardId, input.organizationId]
        );
        if (input.initialPatch && Object.keys(input.initialPatch).length > 0) {
          const initialized = await updateLegacyRecoveryCard({
            db: database(client), orgId: input.organizationId, recoveryCardId: created.cardId,
            expectedVersion: row.rows[0]!.version, patch: input.initialPatch,
            actorUserId: input.actorUserId,
          });
          if (!initialized.ok) {
            throw new AtomicWriteConflictError('Recovery card changed during creation', 'STALE_VERSION');
          }
          row = await client.query<RecoveryCardRow>(
            'SELECT * FROM kpi_recovery_cards WHERE id=$1 AND organization_id=$2',
            [created.cardId, input.organizationId]
          );
        }
        return {
          card: await buildRecoveryCardDTO(database(client), input.organizationId, row.rows[0]!),
          requestHash: hash,
          deviationCaseId: input.caseId,
        };
      } catch (error) {
        return mapServiceError(error);
      }
    },
    buildEvent: ({ result }) => event(input, result, 'kpi.recovery_card_created', null),
  });
  return unwrap(outcome);
}

export interface RecoveryCardPatch {
  hypothesis?: string | null;
  confirmedCause?: string | null;
  impactDescription?: string | null;
  priority?: RecoveryPriority;
  expectedImpact?: string | null;
  dependencies?: RecoveryReferenceItem[];
  risks?: RecoveryReferenceItem[];
  expectedRecoveryDate?: string | null;
  effectivenessCriteria?: string | null;
}

export async function updateRecoveryCard(
  input: Context & { cardId: string; expectedVersion: number; patch: RecoveryCardPatch }
): Promise<AtomicCommandOutcome<RecoveryCardDTO>> {
  const hash = fingerprint({ op: 'update-card', actorUserId: input.actorUserId, cardId: input.cardId,
    expectedVersion: input.expectedVersion, patch: input.patch });
  const outcome = await executeAtomicCreate<CommandResult>({
    organizationId: input.organizationId,
    idempotencyKey: input.idempotencyKey,
    preflight: async (client) => {
      const authority = await loadCardAuthority(client, input.organizationId, input.cardId);
      authorize(input, authority.owner_user_id, CAPABILITIES.update);
      await assertActiveMember(client, input.organizationId, input.actorUserId);
    },
    validateExistingResult: validateReplay(hash),
    applyMutation: async (client) => {
      const authority = await loadCardAuthority(client, input.organizationId, input.cardId, true);
      authorize(input, authority.owner_user_id, CAPABILITIES.update);
      await assertActiveMember(client, input.organizationId, input.actorUserId);
      try {
        const updated = await updateLegacyRecoveryCard({
          db: database(client), orgId: input.organizationId, recoveryCardId: input.cardId,
          expectedVersion: input.expectedVersion, patch: input.patch, actorUserId: input.actorUserId,
        });
        if (!updated.ok) {
          throw new AtomicWriteConflictError('Recovery card changed', 'STALE_VERSION', {
            currentVersion: (await getRecoveryCardDTO(database(client), input.organizationId, input.cardId))?.version,
            expectedVersion: input.expectedVersion,
          });
        }
        return { card: updated.card, requestHash: hash, deviationCaseId: authority.deviation_case_id };
      } catch (error) {
        return mapServiceError(error);
      }
    },
    buildEvent: ({ result }) => event(input, result, 'kpi.recovery_card_updated', input.expectedVersion),
  });
  return unwrap(outcome);
}

export async function closeRecoveryCard(
  input: Context & {
    cardId: string;
    expectedVersion: number;
    evidenceText?: string | null;
    evidenceRef?: string | null;
    effectivenessRating: RecoveryEffectivenessRating;
  }
): Promise<AtomicCommandOutcome<RecoveryCardDTO>> {
  const hash = fingerprint({ op: 'close-card', actorUserId: input.actorUserId, cardId: input.cardId,
    expectedVersion: input.expectedVersion, evidenceText: input.evidenceText ?? null,
    evidenceRef: input.evidenceRef ?? null, effectivenessRating: input.effectivenessRating });
  const outcome = await executeAtomicCreate<CommandResult>({
    organizationId: input.organizationId,
    idempotencyKey: input.idempotencyKey,
    preflight: async (client) => {
      const authority = await loadCardAuthority(client, input.organizationId, input.cardId);
      authorize(input, authority.owner_user_id, CAPABILITIES.close);
      await assertActiveMember(client, input.organizationId, input.actorUserId);
    },
    validateExistingResult: validateReplay(hash),
    applyMutation: async (client) => {
      const authority = await loadCardAuthority(client, input.organizationId, input.cardId, true);
      authorize(input, authority.owner_user_id, CAPABILITIES.close);
      await assertActiveMember(client, input.organizationId, input.actorUserId);
      try {
        const closed = await closeLegacyRecoveryCard({
          db: database(client), orgId: input.organizationId, recoveryCardId: input.cardId,
          expectedVersion: input.expectedVersion, evidenceText: input.evidenceText,
          evidenceRef: input.evidenceRef, effectivenessRating: input.effectivenessRating,
          actorUserId: input.actorUserId,
        });
        if (!closed.closed) {
          throw new AtomicWriteConflictError(
            'Recovery card could not be closed',
            `RECOVERY_CARD_CLOSE_${closed.reason}`,
            {
              reason: closed.reason,
              ...('latestMeasurement' in closed ? { latestMeasurement: closed.latestMeasurement } : {}),
            }
          );
        }
        return { card: closed.card, requestHash: hash, deviationCaseId: authority.deviation_case_id };
      } catch (error) {
        return mapServiceError(error);
      }
    },
    buildEvent: ({ result }) => event(input, result, 'kpi.recovery_card_closed', input.expectedVersion),
  });
  return unwrap(outcome);
}
