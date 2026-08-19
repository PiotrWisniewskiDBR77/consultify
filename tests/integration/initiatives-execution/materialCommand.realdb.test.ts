import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  executeMaterialCommand,
  MaterialCommandConflictError,
} from '../../../server/src/domain/initiatives-execution/materialCommand';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('material command PostgreSQL realDB contract', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  const unitOfWork = new PostgresMaterialCommandUnitOfWork(pool);

  beforeAll(async () => {
    const migration = await readFile(
      path.resolve('server/migrations/932_initiatives_execution_material_commands.sql'),
      'utf8'
    );
    await pool.query(migration);
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE ie_aggregate_relations, ie_command_receipts, ie_audit_events, ie_outbox_delivery_receipts, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
    );
    await pool.query(
      `INSERT INTO ie_aggregate_state
        (organization_id, aggregate_type, aggregate_id, version, payload_json)
       VALUES ('org-a', 'initiative', 'initiative-a', 1, '{}'::jsonb),
              ('org-b', 'initiative', 'initiative-a', 1, '{}'::jsonb)`
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  const envelope = (requestId: string, expectedVersion = 1) => ({
    organizationId: 'org-a',
    actorId: 'actor-a',
    aggregateType: 'initiative',
    aggregateId: 'initiative-a',
    expectedVersion,
    clientRequestId: requestId,
    correlationId: `corr-${requestId}`,
    policyId: 'standard-industrial',
    policyVersion: 2,
    commandType: 'initiative.definition.publish',
    payload: { title: 'ACO' },
  });

  const prepare = (eventType = 'initiative.card.versioned') => async () => ({
    mutation: { title: 'ACO' },
    response: { title: 'ACO' },
    eventType,
    eventPayload: { cardKey: 'summary-scope' },
    auditPayload: { before: null, after: { title: 'ACO' } },
  });

  it('commits aggregate, audit, outbox and receipt and replays without duplicates', async () => {
    const first = await executeMaterialCommand(unitOfWork, envelope('request-1'), prepare());
    const replay = await executeMaterialCommand(unitOfWork, envelope('request-1'), prepare());

    expect(first.status).toBe('APPLIED');
    expect(replay.status).toBe('REPLAYED');
    const counts = await pool.query<{
      aggregate_count: string;
      audit_count: string;
      outbox_count: string;
      receipt_count: string;
    }>(`SELECT
      (SELECT count(*) FROM ie_aggregate_state WHERE organization_id='org-a' AND version=2) aggregate_count,
      (SELECT count(*) FROM ie_audit_events) audit_count,
      (SELECT count(*) FROM ie_outbox_events) outbox_count,
      (SELECT count(*) FROM ie_command_receipts) receipt_count`);
    expect(counts.rows[0]).toEqual({
      aggregate_count: '1',
      audit_count: '1',
      outbox_count: '1',
      receipt_count: '1',
    });
  });

  it('serializes competing expected-version commands so exactly one succeeds', async () => {
    const attempts = await Promise.allSettled([
      executeMaterialCommand(unitOfWork, envelope('request-a'), prepare()),
      executeMaterialCommand(unitOfWork, envelope('request-b'), prepare()),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    expect(
      attempts.find((attempt) => attempt.status === 'rejected')?.reason
    ).toBeInstanceOf(MaterialCommandConflictError);
  });

  it('rolls back aggregate and audit if outbox persistence fails', async () => {
    await expect(
      executeMaterialCommand(unitOfWork, envelope('request-fail'), prepare(''))
    ).rejects.toThrow();
    const state = await pool.query<{ version: number }>(
      `SELECT version FROM ie_aggregate_state
        WHERE organization_id='org-a' AND aggregate_type='initiative' AND aggregate_id='initiative-a'`
    );
    expect(state.rows[0]?.version).toBe(1);
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM ie_command_receipts')).rowCount).toBe(0);
  });

  it('keeps the same aggregate ID isolated between organizations', async () => {
    await executeMaterialCommand(unitOfWork, envelope('request-org-a'), prepare());
    const versions = await pool.query<{ organization_id: string; version: number }>(
      `SELECT organization_id, version FROM ie_aggregate_state
        WHERE aggregate_type='initiative' AND aggregate_id='initiative-a'
        ORDER BY organization_id`
    );
    expect(versions.rows).toEqual([
      { organization_id: 'org-a', version: 2 },
      { organization_id: 'org-b', version: 1 },
    ]);
  });

  it('creates a missing aggregate once and replays Register idempotently', async () => {
    const register = {
      ...envelope('register-1'),
      aggregateId: 'initiative-new',
      commandType: 'initiative.register',
      createIfMissing: true,
      expectedVersion: 0,
    };
    const first = await executeMaterialCommand(unitOfWork, register, prepare('initiative.registered'));
    const replay = await executeMaterialCommand(unitOfWork, register, prepare('initiative.registered'));

    expect(first.status).toBe('APPLIED');
    expect(replay.status).toBe('REPLAYED');
    const rows = await pool.query<{ version: number }>(
      `SELECT version FROM ie_aggregate_state
        WHERE organization_id='org-a' AND aggregate_type='initiative' AND aggregate_id='initiative-new'`
    );
    expect(rows.rows).toEqual([{ version: 1 }]);
  });

  it('serializes two competing creates for the same missing aggregate', async () => {
    const create = (requestId: string) => ({
      ...envelope(requestId),
      aggregateId: 'initiative-race',
      commandType: 'initiative.register',
      createIfMissing: true,
      expectedVersion: 0,
    });
    const attempts = await Promise.allSettled([
      executeMaterialCommand(unitOfWork, create('register-a'), prepare('initiative.registered')),
      executeMaterialCommand(unitOfWork, create('register-b'), prepare('initiative.registered')),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    const rows = await pool.query<{ count: string }>(
      `SELECT count(*)::text count FROM ie_aggregate_state
        WHERE organization_id='org-a' AND aggregate_type='initiative' AND aggregate_id='initiative-race'`
    );
    expect(rows.rows[0]?.count).toBe('1');
  });
});
import { readFile } from 'node:fs/promises';
import path from 'node:path';
