import { createHash } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres';
import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  materialCommandFingerprint,
  type MaterialCommandEnvelope,
} from '../../server/src/domain/initiatives-execution/materialCommand';
import { PostgresMaterialCommandUnitOfWork } from '../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const organizationId = 'day204-r1-org';
const databaseUrl = process.env.DATABASE_URL || '';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

function fingerprintIncludingCorrelationId<T>(envelope: MaterialCommandEnvelope<T>): string {
  return createHash('sha256')
    .update(
      canonicalJson({
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
        commandType: envelope.commandType,
        expectedVersion: envelope.expectedVersion,
        policyId: envelope.policyId,
        policyVersion: envelope.policyVersion,
        correlationId: envelope.correlationId,
        payload: envelope.payload,
      })
    )
    .digest('hex');
}

describe('Day204 R1 stage-two mines on real PostgreSQL', { retry: 0 }, () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');
    for (const table of [
      'legacy_task_cutover_step_ledger',
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    }
  });

  afterAll(async () => {
    for (const table of [
      'legacy_task_cutover_step_ledger',
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    }
    await pool.end();
  });

  it('proves adding correlationId to the global fingerprint invalidates an existing receipt', async () => {
    const envelope: MaterialCommandEnvelope<{ value: string }> = {
      organizationId,
      actorId: 'day204-actor',
      aggregateType: 'day204_probe',
      aggregateId: 'fingerprint',
      expectedVersion: 0,
      clientRequestId: 'day204-fingerprint-request',
      correlationId: 'day204-batch-a',
      policyId: 'migration',
      policyVersion: 1,
      commandType: 'day204.probe.create',
      createIfMissing: true,
      payload: { value: 'stable' },
    };
    const applied = await executeMaterialCommand(uow, envelope, async () => ({
      mutation: envelope.payload,
      response: envelope.payload,
      eventType: 'day204.probe.created',
      eventPayload: envelope.payload,
      auditPayload: envelope.payload,
    }));
    expect(applied.status).toBe('APPLIED');
    expect(materialCommandFingerprint(envelope)).not.toBe(
      fingerprintIncludingCorrelationId(envelope)
    );

    await pool.query(
      `UPDATE ie_command_receipts SET request_fingerprint=$1
       WHERE organization_id=$2 AND client_request_id=$3`,
      [fingerprintIncludingCorrelationId(envelope), organizationId, envelope.clientRequestId]
    );

    await expect(
      executeMaterialCommand(uow, envelope, async () => {
        throw new Error('prepare must not run on receipt replay');
      })
    ).rejects.toBeInstanceOf(MaterialCommandConflictError);
  });

  it('proves aggregate CAS fires before claimRelation after a committed step without ledger write', async () => {
    let prepareCalls = 0;
    const command = (clientRequestId: string) =>
      executeMaterialCommand(
        uow,
        {
          organizationId,
          actorId: 'day204-actor',
          aggregateType: 'day204_probe',
          aggregateId: 'relation-cas',
          expectedVersion: 0,
          clientRequestId,
          correlationId: 'day204-batch-relation',
          policyId: 'migration',
          policyVersion: 1,
          commandType: 'day204.probe.relation',
          createIfMissing: true,
          payload: { value: 'stable' },
        },
        async (transaction) => {
          prepareCalls += 1;
          await transaction.claimRelation({
            organizationId,
            relationType: 'DAY204_PROBE',
            sourceType: 'day204_probe',
            sourceId: 'relation-cas',
            sourceVersion: 1,
            targetType: 'day204_target',
            targetId: 'target-1',
            payload: { stable: true },
          });
          return {
            mutation: { value: 'stable' },
            response: { value: 'stable' },
            eventType: 'day204.probe.related',
            eventPayload: { value: 'stable' },
            auditPayload: { value: 'stable' },
          };
        }
      );

    expect((await command('day204-relation-first')).status).toBe('APPLIED');
    await expect(command('day204-relation-after-crash')).rejects.toThrow(
      'aggregate version conflict'
    );
    expect(prepareCalls).toBe(1);
    const relations = await pool.query(
      `SELECT 1 FROM ie_aggregate_relations
       WHERE organization_id=$1 AND relation_type='DAY204_PROBE'`,
      [organizationId]
    );
    expect(relations.rowCount).toBe(1);
  });

  it('provides a durable step replay key without changing the global command fingerprint', async () => {
    await pool.query(
      `INSERT INTO legacy_task_cutover_step_ledger
       (organization_id,initiative_id,step_key,client_request_id,command_type,
        command_status,request_checksum)
       VALUES($1,$2,$3,$4,$5,'APPLIED',$6)`,
      [organizationId, 'initiative-1', 'register', 'request-1', 'initiative.register', 'sum-1']
    );
    await expect(
      pool.query(
        `INSERT INTO legacy_task_cutover_step_ledger
         (organization_id,initiative_id,step_key,client_request_id,command_type,
          command_status,request_checksum)
         VALUES($1,$2,$3,$4,$5,'APPLIED',$6)`,
        [organizationId, 'initiative-1', 'register', 'request-2', 'initiative.register', 'sum-2']
      )
    ).rejects.toThrow();
  });
});
