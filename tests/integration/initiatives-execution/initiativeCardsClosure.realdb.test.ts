import { Pool } from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { configureInitiativeCards } from '../../../server/src/domain/initiatives-execution/configureInitiativeCards';
import { MaterialCommandConflictError } from '../../../server/src/domain/initiatives-execution/materialCommand';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { publishInitiativeCard } from '../../../server/src/domain/initiatives-execution/publishInitiativeCard';
import { registerInitiative } from '../../../server/src/domain/initiatives-execution/registerInitiative';

const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;

real('INI-MVP-CARDS-001 production-command closure', () => {
  const pool = new Pool({ connectionString: url, max: 6 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const org = 'codex-ini-cards-001';
  const foreignOrg = 'codex-ini-cards-foreign';
  const initiativeId = 'codex-ini-cards-initiative';
  const proposalId = 'codex-ini-cards-proposal';

  const clean = async () => {
    for (const table of [
      'ie_initiative_card_versions',
      'ie_initiative_card_selection',
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id = ANY($1)`, [[org, foreignOrg]]);
    }
    await pool.query('DELETE FROM initiative_candidates WHERE organization_id = ANY($1)', [
      [org, foreignOrg],
    ]);
  };

  beforeEach(async () => {
    await clean();
    await pool.query(
      `INSERT INTO initiative_candidates
       (id,organization_id,source_type,source_id,source_version,title,problem,proposed_outcome,
        project_id,initiative_owner_id,visibility,evidence_state,duplicate_state,status,version)
       VALUES($1,$2,'assessment-finding','codex-cards-source',1,'Deterministic cards',
        'Cards need persisted truth','Prove cold deterministic cards','codex-cards-project',
        'codex-cards-owner','PROJECT','READY','CLEAR','pending',1)`,
      [proposalId, org]
    );
  });
  afterAll(async () => {
    await clean();
    await pool.end();
  });

  const envelope = (requestId: string, expectedVersion: number, commandType: string) => ({
    organizationId: org,
    actorId: 'codex-cards-owner',
    aggregateType: 'initiative',
    aggregateId: initiativeId,
    expectedVersion,
    clientRequestId: requestId,
    correlationId: `corr-${requestId}`,
    policyId: 'codex-cards-policy',
    policyVersion: 1,
    commandType,
  });

  const register = () =>
    registerInitiative(uow, {
      ...envelope('cards-register', 0, 'initiative.register'),
      createIfMissing: true,
      payload: {
        proposalId,
        proposalVersion: 1,
        sourceType: 'assessment-finding',
        sourceId: 'codex-cards-source',
        sourceVersion: 1,
        title: 'Deterministic cards',
        problem: 'Cards need persisted truth',
        proposedOutcome: 'Prove cold deterministic cards',
        projectId: 'codex-cards-project',
        visibility: 'PROJECT' as const,
        initiativeOwnerId: 'codex-cards-owner',
        validatorCapability: 'INITIATIVE_REGISTER' as const,
      },
    });

  const configure = async () => {
    const catalog = await pool.query<{ card_key: string }>(
      'SELECT card_key FROM ie_initiative_card_catalog WHERE active=TRUE ORDER BY card_key'
    );
    return configureInitiativeCards(uow, {
      ...envelope('cards-configure', 1, 'initiative.cards.configure'),
      payload: {
        registryVersion: 1,
        cards: catalog.rows.map((row, position) => ({
          cardKey: row.card_key,
          included: true,
          position,
          requiredness: 'OPTIONAL' as const,
          waiverDecisionId: null,
        })),
      },
    });
  };

  const publish = (cardKey: string, expectedVersion: number, requestId: string) =>
    publishInitiativeCard(uow, {
      ...envelope(requestId, expectedVersion, 'initiative.card.publish'),
      payload: {
        cardKey,
        expectedCardVersion: 0,
        applicability: 'REQUIRED' as const,
        completion: 'COMPLETE' as const,
        quality: 'SUFFICIENT' as const,
        freshness: 'CURRENT' as const,
        reviewState: 'REQUESTED' as const,
        content: { title: cardKey, deterministicFixture: true },
        evidenceRefs: [`fixture:${cardKey}:v1`],
        waiverDecisionId: null,
      },
    });

  it('persists three live cards and reopens the same read model through a new pool/client', async () => {
    const first = await register();
    const replay = await register();
    expect(first.status).toBe('APPLIED');
    expect(replay.status).toBe('REPLAYED');
    await configure();
    await publish('summary-scope', 2, 'publish-summary');
    await publish('success-criteria', 3, 'publish-success');
    const third = await publish('risk-raid', 4, 'publish-risk');
    expect((await publish('risk-raid', 4, 'publish-risk')).response).toEqual(third.response);

    const coldPool = new Pool({ connectionString: url, max: 1 });
    try {
      const coldReader = new PostgresInitiativeReader(coldPool);
      const reopened = await coldReader.findById(org, initiativeId);
      expect(reopened?.version).toBe(5);
      expect(await coldReader.listInitiativeCardSelection(org, initiativeId)).toHaveLength(26);
      const cards = await coldReader.listLatestInitiativeCards(org, initiativeId);
      expect(cards.map((card) => card.cardKey).sort()).toEqual([
        'risk-raid',
        'success-criteria',
        'summary-scope',
      ]);
      expect(cards.every((card) => card.content.deterministicFixture === true)).toBe(true);
      await expect(coldReader.findById(foreignOrg, initiativeId)).resolves.toBeNull();
      await expect(coldReader.listLatestInitiativeCards(foreignOrg, initiativeId)).resolves.toEqual([]);
    } finally {
      await coldPool.end();
    }
  });

  it('serializes competing writers and rejects stale aggregate/card CAS without partial rows', async () => {
    await register();
    await configure();
    const settled = await Promise.allSettled([
      publish('summary-scope', 2, 'concurrent-summary'),
      publish('success-criteria', 2, 'concurrent-success'),
    ]);
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((settled.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason)
      .toBeInstanceOf(MaterialCommandConflictError);
    expect(
      (await pool.query('SELECT count(*)::int n FROM ie_initiative_card_versions WHERE organization_id=$1', [org]))
        .rows[0].n
    ).toBe(1);
    expect(
      (await pool.query('SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2', [org, initiativeId]))
        .rows[0].version
    ).toBe(3);
  });

  it('rejects a caller without the registration capability and writes no aggregate', async () => {
    await expect(
      registerInitiative(uow, {
        ...envelope('cards-role-negative', 0, 'initiative.register'),
        createIfMissing: true,
        payload: {
          proposalId,
          proposalVersion: 1,
          sourceType: 'assessment-finding',
          sourceId: 'codex-cards-source',
          sourceVersion: 1,
          title: 'Forbidden',
          problem: 'Forbidden',
          proposedOutcome: 'Forbidden',
          projectId: 'codex-cards-project',
          visibility: 'PROJECT' as const,
          initiativeOwnerId: 'codex-cards-owner',
          validatorCapability: 'NONE' as any,
        },
      })
    ).rejects.toThrow();
    expect(
      (await pool.query('SELECT count(*)::int n FROM ie_aggregate_state WHERE organization_id=$1', [org]))
        .rows[0].n
    ).toBe(0);
  });
});
