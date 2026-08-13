import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { configureInitiativeCards } from '../../../server/src/domain/initiatives-execution/configureInitiativeCards';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('Configure Initiative Cards PostgreSQL vertical', () => {
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
      'TRUNCATE ie_initiative_card_versions, ie_initiative_card_selection, ie_command_receipts, ie_audit_events, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
    );
    await pool.query(`INSERT INTO ie_aggregate_state
      (organization_id, aggregate_type, aggregate_id, version, payload_json)
      VALUES ('org-config','initiative','initiative-config-1',1,
        '{"initiativeId":"initiative-config-1","projectId":"project-config","lifecycleState":"REGISTERED_DRAFT"}'::jsonb)`);
    await pool.query(`INSERT INTO ie_initiative_card_versions
      (organization_id, initiative_id, card_key, card_version, aggregate_version,
       applicability, completion, quality, freshness, review_state, content_json,
       evidence_refs_json, published_by)
      VALUES ('org-config','initiative-config-1','summary-scope',1,1,
       'REQUIRED','IN_PROGRESS','UNKNOWN','CURRENT','NOT_REQUESTED',
       '{"problem":"Preserve me"}'::jsonb,'[]'::jsonb,'owner-1')`);
  });

  const selection = async () => {
    const catalog = await pool.query<{ card_key: string }>(
      'SELECT card_key FROM ie_initiative_card_catalog WHERE active = TRUE ORDER BY card_key'
    );
    return catalog.rows.map((row, position) => ({
      cardKey: row.card_key,
      included: row.card_key !== 'technical-specification',
      position,
      requiredness: 'OPTIONAL' as const,
      waiverDecisionId: null,
    }));
  };

  it('configures exactly 26 catalog cards without deleting omitted-card history', async () => {
    const cards = await selection();
    const result = await configureInitiativeCards(unitOfWork, {
      organizationId: 'org-config',
      actorId: 'owner-1',
      aggregateType: 'initiative',
      aggregateId: 'initiative-config-1',
      expectedVersion: 1,
      clientRequestId: 'configure-cards-1',
      correlationId: 'configure-cards-correlation-1',
      policyId: 'standard-config',
      policyVersion: 1,
      commandType: 'initiative.cards.configure',
      payload: { registryVersion: 1, cards },
    });
    expect(result.response.cards).toHaveLength(26);
    expect((await pool.query('SELECT 1 FROM ie_initiative_card_selection')).rowCount).toBe(26);
    const preserved = await pool.query(
      `SELECT content_json FROM ie_initiative_card_versions
        WHERE organization_id = 'org-config' AND initiative_id = 'initiative-config-1'`
    );
    expect(preserved.rows[0].content_json).toEqual({ problem: 'Preserve me' });
  });

  it('rejects a required omission without an authorized waiver', async () => {
    const cards = await selection();
    cards[0] = { ...cards[0], included: false, requiredness: 'REQUIRED' };
    await expect(
      configureInitiativeCards(unitOfWork, {
        organizationId: 'org-config',
        actorId: 'owner-1',
        aggregateType: 'initiative',
        aggregateId: 'initiative-config-1',
        expectedVersion: 1,
        clientRequestId: 'configure-cards-blocked',
        correlationId: 'configure-cards-blocked-correlation',
        policyId: 'standard-config',
        policyVersion: 1,
        commandType: 'initiative.cards.configure',
        payload: { registryVersion: 1, cards },
      })
    ).rejects.toThrow();
    expect((await pool.query('SELECT 1 FROM ie_initiative_card_selection')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(0);
  });

  afterAll(async () => pool.end());
});
