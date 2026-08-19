import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MaterialCommandConflictError } from '../../../server/src/domain/initiatives-execution/materialCommand';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { publishInitiativeCard } from '../../../server/src/domain/initiatives-execution/publishInitiativeCard';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('Publish Initiative Card PostgreSQL vertical', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const unitOfWork = new PostgresMaterialCommandUnitOfWork(pool);

  beforeAll(async () => {
    for (const migrationName of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ]) {
      await pool.query(
        await readFile(path.resolve('server/migrations', migrationName), 'utf8')
      );
    }
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE ie_initiative_card_versions, ie_initiative_card_selection, ie_aggregate_relations, ie_command_receipts, ie_audit_events, ie_outbox_delivery_receipts, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
    );
    await pool.query(`INSERT INTO ie_aggregate_state
      (organization_id, aggregate_type, aggregate_id, version, payload_json)
      VALUES ('org-card','initiative','initiative-card-1',1,
        '{"initiativeId":"initiative-card-1","projectId":"project-card","lifecycleState":"REGISTERED_DRAFT"}'::jsonb)`);
  });

  const command = {
    organizationId: 'org-card',
    actorId: 'initiative-owner-1',
    aggregateType: 'initiative',
    aggregateId: 'initiative-card-1',
    expectedVersion: 1,
    clientRequestId: 'publish-summary-1',
    correlationId: 'correlation-summary-1',
    policyId: 'standard-card',
    policyVersion: 2,
    commandType: 'initiative.card.publish',
    payload: {
      cardKey: 'summary-scope',
      expectedCardVersion: 0,
      applicability: 'REQUIRED' as const,
      completion: 'COMPLETE' as const,
      quality: 'SUFFICIENT' as const,
      freshness: 'CURRENT' as const,
      reviewState: 'REQUESTED' as const,
      content: {
        problem: 'Changeovers are unstable',
        outcome: 'Stable performance',
        inScope: ['Line 4'],
        outOfScope: ['Line 5'],
      },
      evidenceRefs: ['assessment:ASM-F-ACO-001:v3'],
      waiverDecisionId: null,
    },
  };

  it('atomically publishes an immutable card version and aggregate read-back', async () => {
    const first = await publishInitiativeCard(unitOfWork, command);
    const replay = await publishInitiativeCard(unitOfWork, command);
    expect(first.status).toBe('APPLIED');
    expect(replay.status).toBe('REPLAYED');
    expect(first.response).toMatchObject({ cardKey: 'summary-scope', cardVersion: 1 });
    const aggregate = await pool.query(
      `SELECT version, payload_json #>> '{cardRefs,summary-scope,cardVersion}' card_version
         FROM ie_aggregate_state WHERE organization_id = 'org-card'`
    );
    expect(aggregate.rows[0]).toEqual({ version: 2, card_version: '1' });
    expect((await pool.query('SELECT 1 FROM ie_initiative_card_versions')).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM ie_outbox_events')).rowCount).toBe(1);
  });

  it('rejects stale card OCC and rolls back every evidence table', async () => {
    await publishInitiativeCard(unitOfWork, command);
    await expect(
      publishInitiativeCard(unitOfWork, {
        ...command,
        expectedVersion: 2,
        clientRequestId: 'publish-summary-stale',
      })
    ).rejects.toBeInstanceOf(MaterialCommandConflictError);
    expect((await pool.query('SELECT 1 FROM ie_initiative_card_versions')).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(1);
  });

  it('rejects a card outside the canonical catalog', async () => {
    await expect(
      publishInitiativeCard(unitOfWork, {
        ...command,
        clientRequestId: 'publish-invented',
        payload: { ...command.payload, cardKey: 'invented-card' },
      })
    ).rejects.toThrow();
    expect((await pool.query('SELECT 1 FROM ie_initiative_card_versions')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(0);
  });

  afterAll(async () => pool.end());
});
