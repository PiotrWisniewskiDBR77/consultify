import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { adoptChatDraftInitiative } from '../../../server/src/domain/initiatives-execution/adoptChatDraftInitiative';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { assertRealPostgresTestEnvironment } from '../../integration/_helpers/assertRealPostgres';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('Teresa chat-draft adoption PostgreSQL vertical', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  const unitOfWork = new PostgresMaterialCommandUnitOfWork(pool);
  const reader = new PostgresInitiativeReader(pool);
  const orgId = 'day214-org';
  const projectId = 'day214-project';
  const ownerId = 'day214-owner';
  const runId = `${Date.now()}`;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    const migration = await readFile(
      path.resolve('server/migrations/20261900_flow_teresa_chat_draft_adoption.sql'),
      'utf8'
    );
    await pool.query(migration);
    await pool.query(
      `INSERT INTO organizations(id,name) VALUES($1,'Day214') ON CONFLICT(id) DO NOTHING`,
      [orgId]
    );
    await pool.query(`INSERT INTO users(id) VALUES($1) ON CONFLICT(id) DO NOTHING`, [ownerId]);
    await pool.query(
      `INSERT INTO projects(id,organization_id,name) VALUES($1,$2,'Day214') ON CONFLICT(id) DO NOTHING`,
      [projectId, orgId]
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  const envelope = (initiativeId: string, requestId: string) => ({
    organizationId: orgId,
    actorId: ownerId,
    aggregateType: 'initiative',
    aggregateId: initiativeId,
    expectedVersion: 0,
    clientRequestId: requestId,
    correlationId: `corr-${requestId}`,
    policyId: 'day214-policy',
    policyVersion: 1,
    commandType: 'initiative.adopt-chat-draft',
    createIfMissing: true,
    payload: {
      chatInitiativeId: initiativeId,
      projectId,
      initiativeOwnerId: ownerId,
      visibility: 'PROJECT' as const,
    },
  });

  it('uses the real PostgreSQL test environment', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
  });

  it('rejects a blocked draft without creating an aggregate or adoption receipt', async () => {
    const initiativeId = `day214-blocked-${runId}`;
    await pool.query(
      `INSERT INTO initiatives(id,organization_id,name,title,problem_statement,source_type,source_id)
       VALUES($1,$2,'Blocked','Blocked','Problem','teresa_chat',$1)`,
      [initiativeId, orgId]
    );
    await expect(
      adoptChatDraftInitiative(
        unitOfWork,
        envelope(initiativeId, `day214-blocked-request-${runId}`)
      )
    ).rejects.toThrow('project_id is required');
    const counts = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2) aggregates,
        (SELECT count(*)::int FROM flow_teresa_chat_draft_adoptions WHERE organization_id=$1 AND chat_initiative_id=$2) receipts`,
      [orgId, initiativeId]
    );
    expect(counts.rows[0]).toEqual({ aggregates: 0, receipts: 0 });
  });

  it('adopts a complete draft once and replays the same client request idempotently', async () => {
    const initiativeId = `day214-ready-${runId}`;
    await pool.query(
      `INSERT INTO initiatives
       (id,organization_id,project_id,name,title,problem_statement,source_type,source_id,owner_execution_id)
       VALUES($1,$2,$3,'Ready','Ready','Measured problem','teresa_chat',$1,$4)`,
      [initiativeId, orgId, projectId, ownerId]
    );
    expect(await reader.findById(orgId, initiativeId)).toBeNull();
    const command = envelope(initiativeId, `day214-ready-request-${runId}`);
    const first = await adoptChatDraftInitiative(unitOfWork, command);
    const replay = await adoptChatDraftInitiative(unitOfWork, command);
    expect(first.status).toBe('APPLIED');
    expect(replay.status).toBe('REPLAYED');
    const counts = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2) aggregates,
        (SELECT count(*)::int FROM flow_teresa_chat_draft_adoptions WHERE organization_id=$1 AND chat_initiative_id=$2) receipts`,
      [orgId, initiativeId]
    );
    expect(counts.rows[0]).toEqual({ aggregates: 1, receipts: 1 });
    await expect(reader.findById(orgId, initiativeId)).resolves.toMatchObject({
      initiative: {
        initiativeId,
        lifecycleState: 'REGISTERED_DRAFT',
        source: { sourceType: 'teresa_chat', sourceId: initiativeId },
      },
    });
  });

  // FIX-214 pkt 2 (ODBIOR_214.md §4 FIX-y wymagane, pkt 4 sekcja "nie blokuje
  // merge, ale zanotować"): dowód mutacyjny dla advisory locka
  // `pg_advisory_xact_lock` w `PostgresMaterialCommandUnitOfWork.adoptChatDraftInitiative`
  // (postgresMaterialCommandUnitOfWork.ts:221-223), który chroni przed
  // równoległą adopcją TEGO SAMEGO szkicu czatowego.
  //
  // Wynik testu poniżej jest GREEN na dzisiejszym kodzie: dwie równoległe
  // adopcje tego samego chatInitiativeId (różnym clientRequestId — realny
  // scenariusz „dwa kliknięcia/dwie karty") zawsze osiadają na DOKŁADNIE
  // jednej inicjatywie — jedna strona `APPLIED`, druga rzuca
  // `aggregate version conflict` (nieładny, ale bezpieczny fail-closed).
  //
  // DOWÓD MUTACYJNY (Z32), oba przebiegi wykonane RĘCZNIE poza tym plikiem
  // (kopia pliku przed/po w scratchu dyżuru), wynik w RAPORCIE FIX-214:
  //   (a) usunięcie SAMEGO `pg_advisory_xact_lock(...)` (linie 221-223)
  //       → BEZ ZMIANY: nadal 1 APPLIED + 1 "aggregate version conflict",
  //       nadal dokładnie 1 wiersz w ie_aggregate_state i 1 w
  //       flow_teresa_chat_draft_adoptions. Powód: `SELECT ... FROM
  //       initiatives ... FOR UPDATE` (linie 234-239, tuż pod usuniętym
  //       lockiem, W TEJ SAMEJ transakcji) i tak serializuje obie strony,
  //       bo blokuje ten sam, JUŻ ISTNIEJĄCY wiersz `initiatives`.
  //   (b) usunięcie RÓWNIEŻ `FOR UPDATE` z tego SELECT-a (podwójna mutacja)
  //       → NADAL BEZ ZMIANY: ten sam wynik. Powód: klucz główny
  //       `ie_aggregate_state_pkey (organization_id, aggregate_type,
  //       aggregate_id)` we WSPÓLNYM silniku `executeMaterialCommand`/
  //       `persistAggregate` (poza licencją tego dyżuru — "silnika poleceń"
  //       NIE WOLNO ruszać) serializuje zapis niezależnie od obu lokalnych
  //       blokad i to on jest realnym źródłem `aggregate version conflict`.
  //
  // UCZCIWY WNIOSEK: żadna z DWÓCH mutacji dostępnych w licencji tego
  // dyżuru (advisory lock i FOR UPDATE wewnątrz
  // `adoptChatDraftInitiative`) nie daje niezależnej czerwieni — obie są
  // defense-in-depth wobec współdzielonego klucza głównego, którego dyżur
  // 214 nie dodał i którego nie wolno mu ruszać. Test poniżej i tak jest
  // wartościowym dowodem: potwierdza mechanicznie (nie deklaratywnie), że
  // inwariant „nigdy dwie inicjatywy z jednego szkicu" trzyma się DZIŚ,
  // niezależnie od tego, KTÓRA warstwa go faktycznie broni.
  it('two concurrent adoptions of the same chat draft (different clientRequestId) settle into exactly one initiative, never two', async () => {
    const initiativeId = `day214-concurrent-${runId}`;
    await pool.query(
      `INSERT INTO initiatives
       (id,organization_id,project_id,name,title,problem_statement,source_type,source_id,owner_execution_id)
       VALUES($1,$2,$3,'Concurrent','Concurrent','Measured problem','teresa_chat',$1,$4)`,
      [initiativeId, orgId, projectId, ownerId]
    );
    const commandA = envelope(initiativeId, `day214-concurrent-request-a-${runId}`);
    const commandB = envelope(initiativeId, `day214-concurrent-request-b-${runId}`);
    const results = await Promise.allSettled([
      adoptChatDraftInitiative(unitOfWork, commandA),
      adoptChatDraftInitiative(unitOfWork, commandB),
    ]);
    const applied = results.filter(
      (result) => result.status === 'fulfilled' && (result.value as { status: string }).status === 'APPLIED'
    );
    // Exactly one side may win APPLIED; the other must NOT also win — it
    // either rejects (today: 'aggregate version conflict') or, if the
    // engine is ever hardened to replay gracefully, resolves REPLAYED —
    // but never a second independent APPLIED for the same draft.
    expect(applied.length).toBe(1);
    const counts = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2) aggregates,
        (SELECT count(*)::int FROM flow_teresa_chat_draft_adoptions WHERE organization_id=$1 AND chat_initiative_id=$2) receipts`,
      [orgId, initiativeId]
    );
    expect(counts.rows[0]).toEqual({ aggregates: 1, receipts: 1 });
  });

  it('keeps the adoption receipt append-only', async () => {
    await expect(
      pool.query(
        `UPDATE flow_teresa_chat_draft_adoptions SET correlation_id='changed'
          WHERE organization_id=$1 AND chat_initiative_id=$2`,
        [orgId, `day214-ready-${runId}`]
      )
    ).rejects.toThrow('append-only');
  });
});
