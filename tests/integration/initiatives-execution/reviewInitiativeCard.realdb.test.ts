import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { reviewInitiativeCard } from '../../../server/src/domain/initiatives-execution/reviewInitiativeCard';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('Review Initiative Card PostgreSQL vertical', () => {
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
      'TRUNCATE ie_initiative_card_versions, ie_command_receipts, ie_audit_events, ie_outbox_delivery_receipts, ie_outbox_events, ie_aggregate_state RESTART IDENTITY'
    );
    await pool.query(`INSERT INTO ie_aggregate_state
      (organization_id, aggregate_type, aggregate_id, version, payload_json)
      VALUES ('org-review','initiative','initiative-review-1',2,
        '{"initiativeId":"initiative-review-1","projectId":"project-review","lifecycleState":"REGISTERED_DRAFT"}'::jsonb)`);
    await pool.query(`INSERT INTO ie_initiative_card_versions
      (organization_id, initiative_id, card_key, card_version, aggregate_version,
       applicability, completion, quality, freshness, review_state, content_json,
       evidence_refs_json, published_by)
      VALUES ('org-review','initiative-review-1','summary-scope',1,2,
       'REQUIRED','COMPLETE','SUFFICIENT','CURRENT','REQUESTED',
       '{"problem":"Problem","outcome":"Outcome"}'::jsonb,
       '["evidence:1"]'::jsonb,'initiative-owner')`);
  });

  const command = (actorId: string, requestId: string) => ({
    organizationId: 'org-review',
    actorId,
    aggregateType: 'initiative',
    aggregateId: 'initiative-review-1',
    expectedVersion: 2,
    clientRequestId: requestId,
    correlationId: `${requestId}-correlation`,
    policyId: 'standard-review',
    policyVersion: 2,
    commandType: 'initiative.card.review',
    payload: {
      cardKey: 'summary-scope',
      expectedCardVersion: 1,
      outcome: 'ACCEPTED' as const,
      rationale: 'Definition evidence is sufficient and current.',
      selfApprovalAllowed: false,
    },
  });

  it('creates an immutable accepted review version by an independent reviewer', async () => {
    const result = await reviewInitiativeCard(
      unitOfWork,
      command('definition-reviewer', 'review-card-1')
    );
    expect(result.response).toMatchObject({ outcome: 'ACCEPTED', cardVersion: 2 });
    const versions = await pool.query(
      `SELECT card_version, review_state, published_by, reviewed_by, review_decision_id
         FROM ie_initiative_card_versions ORDER BY card_version`
    );
    expect(versions.rows).toEqual([
      expect.objectContaining({ card_version: 1, review_state: 'REQUESTED', reviewed_by: null }),
      expect.objectContaining({
        card_version: 2,
        review_state: 'ACCEPTED',
        published_by: 'initiative-owner',
        reviewed_by: 'definition-reviewer',
      }),
    ]);
  });

  it('fails closed on self-approval and leaves no evidence side effects', async () => {
    await expect(
      reviewInitiativeCard(unitOfWork, command('initiative-owner', 'review-card-self'))
    ).rejects.toThrow('Independent reviewer is required');
    expect((await pool.query('SELECT 1 FROM ie_initiative_card_versions')).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM ie_audit_events')).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM ie_outbox_events')).rowCount).toBe(0);
  });

  afterAll(async () => pool.end());
});
