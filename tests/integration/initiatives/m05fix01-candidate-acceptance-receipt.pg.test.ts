/**
 * M05-FIX-01 — acceptance-receipt idempotency on a REAL PostgreSQL.
 *
 * Runs only with RUN_DB_TESTS=1 and a reachable DATABASE_URL, and it FAILS LOUD
 * rather than skipping when those are set but the database is unusable — a silent
 * skip is exactly how this module's earlier "green" real-DB proofs passed vacuously.
 *
 * The SQL goes through the production adapter (`adaptQuery` from PostgresDatabase),
 * so the `?` placeholders and boolean rewrites under test are the same ones the
 * runtime executes — not a re-implementation.
 *
 * Gates (Master Codex M05-FIX-01):
 *   G0  negative control — WITHOUT the migration the old contract duplicates
 *   G1  first success            → exactly 1 initiative + 1 canonical receipt
 *   G2  retry / lost response    → same initiative, no second DRAFT
 *   G3  concurrent double-accept → exactly one receipt claim wins
 *   G4  rollback / failure       → fail-closed, candidate stays pending, retry reconciles
 *   G5  owner/tenant negative control → cross-org accept resolves nothing
 */
import fs from 'fs';
import path from 'path';

import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { adaptQuery } from '../../../server/src/database/PostgresDatabase.js';
import {
  acceptCandidate,
  type CandidateDb,
} from '../../../server/src/services/initiative/initiativeCandidateService.js';

const RUN = process.env.RUN_DB_TESTS === '1' && !!process.env.DATABASE_URL;

const MIGRATION = path.resolve(
  __dirname,
  '../../../server/migrations/20260805_ini_candidate_acceptance_receipt_reconcile.sql'
);

let client: Client;

/** Real-DB CandidateDb using the production SQL adapter. */
const db: CandidateDb = {
  queryAll: async (sql, params = []) => (await client.query(adaptQuery(sql), params as any[])).rows,
  queryOne: async (sql, params = []) =>
    (await client.query(adaptQuery(sql), params as any[])).rows[0] ?? null,
  queryRun: async (sql, params = []) => {
    const r = await client.query(adaptQuery(sql), params as any[]);
    return { changes: r.rowCount ?? 0 };
  },
};

/** Injected canonical-funnel stand-in that performs a REAL insert. */
let createCalls = 0;
const makeDeps = (overrides: Record<string, unknown> = {}) =>
  ({
    createInitiative: async (orgId: string, input: Record<string, unknown>) => {
      createCalls += 1;
      const id = `ini-${createCalls}-${(process.hrtime.bigint() % 100000n).toString()}`;
      await client.query(
        `INSERT INTO initiatives (id, organization_id, title, name, status, source_type, source_id)
         VALUES ($1,$2,$3,$3,'DRAFT',$4,$5)`,
        [id, orgId, input.title ?? null, input.sourceType ?? 'manual', input.sourceId ?? null]
      );
      return { id };
    },
    generateFull: async () => ({ qualitySummary: { filled: 0 }, cards: {} }),
    generatorDeps: () => ({}),
    ...overrides,
  }) as any;

const ORG = 'org-m05fix';
const OTHER_ORG = 'org-intruder';

async function baselineSchema() {
  // Deliberately the DEMO shape: initiative_candidates WITHOUT the 932 columns.
  await client.query(`DROP TABLE IF EXISTS initiative_candidates, initiatives`);
  await client.query(`
    CREATE TABLE initiatives (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, title TEXT, name TEXT,
      status TEXT, source_type TEXT, source_id TEXT
    )`);
  await client.query(`
    CREATE TABLE initiative_candidates (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, source_type TEXT, source_id TEXT,
      title TEXT, rationale TEXT, fit_score REAL, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by TEXT
    )`);
}

async function applyMigration() {
  await client.query(fs.readFileSync(MIGRATION, 'utf8'));
}

async function seedCandidate(id = 'cand-1', org = ORG) {
  await client.query(
    `INSERT INTO initiative_candidates (id, organization_id, source_type, source_id, title, rationale, fit_score, status)
     VALUES ($1,$2,'interview_insight','finding-9',$3,'bo tak','0.8','pending')`,
    [id, org, `Skrócenie przezbrojeń linii ${id}`]
  );
}

const countInitiatives = async () =>
  Number((await client.query(`SELECT count(*)::int AS c FROM initiatives`)).rows[0].c);
const readCandidate = async (id = 'cand-1') =>
  (await client.query(`SELECT * FROM initiative_candidates WHERE id=$1`, [id])).rows[0];

describe.skipIf(!RUN)('M05-FIX-01 — candidate acceptance receipt (real Postgres)', () => {
  beforeAll(async () => {
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect(); // throws loudly if unusable — never a silent skip
  });
  afterAll(async () => {
    await client?.end();
  });
  beforeEach(() => {
    createCalls = 0;
  });

  it('G0a without the migration the receipt cannot persist, but title de-dup still catches the plain retry', async () => {
    await baselineSchema();
    await seedCandidate();

    const first = await acceptCandidate(db, 'cand-1', { orgId: ORG, fill: false, deps: makeDeps() });
    expect(first?.initiativeId).toBeTruthy();
    // Fail-CLOSED is the new contract: the missing columns are surfaced, not masked.
    expect(first?.receiptPersisted).toBe(false);
    expect((await readCandidate()).status).toBe('pending');

    // Measured, not assumed: the pre-existing cross-record de-dup (title similarity
    // over non-terminal initiatives) already absorbs the simple retry. The duplicate
    // risk is therefore NARROWER than "every retry mints a DRAFT" — see G0b.
    const second = await acceptCandidate(db, 'cand-1', {
      orgId: ORG,
      fill: false,
      deps: makeDeps(),
    });
    expect(second?.initiativeId).toBe(first!.initiativeId);
    expect(await countInitiatives()).toBe(1);
  });

  it('G0b without the migration, a de-dup miss DOES mint a duplicate DRAFT (the real defect)', async () => {
    await baselineSchema();
    await seedCandidate();

    const first = await acceptCandidate(db, 'cand-1', { orgId: ORG, fill: false, deps: makeDeps() });
    expect(first?.receiptPersisted).toBe(false);

    // findDuplicateInitiative() excludes CANCELLED/REJECTED/ARCHIVED. Any lifecycle
    // move into a terminal status — or a retitle below the similarity threshold —
    // blinds the only net, and with no durable receipt the retry forks.
    await client.query(`UPDATE initiatives SET status='ARCHIVED' WHERE id=$1`, [
      first!.initiativeId,
    ]);

    const second = await acceptCandidate(db, 'cand-1', {
      orgId: ORG,
      fill: false,
      deps: makeDeps(),
    });
    expect(second?.initiativeId).not.toBe(first!.initiativeId);
    expect(await countInitiatives()).toBe(2); // ← duplicate DRAFT, pre-fix
  });

  it('G0c WITH the migration the same de-dup miss no longer duplicates', async () => {
    await baselineSchema();
    await applyMigration();
    await seedCandidate();

    const first = await acceptCandidate(db, 'cand-1', { orgId: ORG, fill: false, deps: makeDeps() });
    expect(first?.receiptPersisted).toBe(true);

    await client.query(`UPDATE initiatives SET status='ARCHIVED' WHERE id=$1`, [
      first!.initiativeId,
    ]);

    // The durable receipt is consulted BEFORE de-dup, so it holds even when the
    // de-dup net is blind and the initiative is terminal.
    const second = await acceptCandidate(db, 'cand-1', {
      orgId: ORG,
      fill: false,
      deps: makeDeps(),
    });
    expect(second?.initiativeId).toBe(first!.initiativeId);
    expect(await countInitiatives()).toBe(1);
  });

  it('G1 first success — exactly one initiative and one canonical receipt', async () => {
    await baselineSchema();
    await applyMigration();
    await seedCandidate();

    const res = await acceptCandidate(db, 'cand-1', { orgId: ORG, fill: false, deps: makeDeps() });

    expect(res?.initiativeId).toBeTruthy();
    expect(res?.receiptPersisted).toBe(true);
    expect(await countInitiatives()).toBe(1);

    const row = await readCandidate();
    expect(row.status).toBe('accepted');
    expect(row.initiative_id).toBe(res!.initiativeId);
    expect(row.accepted_at).toBeTruthy();
  });

  it('G2 retry / lost response — same initiative, no second DRAFT', async () => {
    await baselineSchema();
    await applyMigration();
    await seedCandidate();

    const first = await acceptCandidate(db, 'cand-1', { orgId: ORG, fill: false, deps: makeDeps() });
    const callsAfterFirst = createCalls;

    // Client never saw the response and retries twice.
    const retry1 = await acceptCandidate(db, 'cand-1', {
      orgId: ORG,
      fill: false,
      deps: makeDeps(),
    });
    const retry2 = await acceptCandidate(db, 'cand-1', {
      orgId: ORG,
      fill: false,
      deps: makeDeps(),
    });

    expect(retry1?.initiativeId).toBe(first!.initiativeId);
    expect(retry2?.initiativeId).toBe(first!.initiativeId);
    expect(retry1?.receiptPersisted).toBe(true);
    expect(await countInitiatives()).toBe(1);
    expect(createCalls).toBe(callsAfterFirst); // funnel never re-entered
  });

  it('G3 concurrent double-accept — exactly one receipt claim wins', async () => {
    await baselineSchema();
    await applyMigration();
    await seedCandidate();

    const [a, b] = await Promise.all([
      acceptCandidate(db, 'cand-1', { orgId: ORG, fill: false, deps: makeDeps() }),
      acceptCandidate(db, 'cand-1', { orgId: ORG, fill: false, deps: makeDeps() }),
    ]);

    const row = await readCandidate();
    expect(row.status).toBe('accepted');
    // Both callers converge on the durable row — no last-writer-wins overwrite.
    expect(a?.initiativeId).toBe(row.initiative_id);
    expect(b?.initiativeId).toBe(row.initiative_id);
    expect(a?.initiativeId).toBe(b?.initiativeId);
  });

  it('G4 rollback / failure — fail-closed, then retry reconciles onto the same initiative', async () => {
    await baselineSchema();
    await applyMigration();
    await seedCandidate();

    // Receipt write fails (column vanishes mid-flight = the demo condition).
    await client.query(`ALTER TABLE initiative_candidates DROP COLUMN accepted_at`);
    const broken = await acceptCandidate(db, 'cand-1', {
      orgId: ORG,
      fill: false,
      deps: makeDeps(),
    });

    expect(broken?.receiptPersisted).toBe(false); // never reported as a clean success
    expect((await readCandidate()).status).toBe('pending'); // stays recoverable
    expect(await countInitiatives()).toBe(1);

    // Repair, then retry: de-dup must reconcile onto the SAME initiative, not fork.
    await client.query(`ALTER TABLE initiative_candidates ADD COLUMN accepted_at TIMESTAMPTZ`);
    const repaired = await acceptCandidate(db, 'cand-1', {
      orgId: ORG,
      fill: false,
      deps: makeDeps(),
    });

    expect(repaired?.initiativeId).toBe(broken!.initiativeId);
    expect(repaired?.receiptPersisted).toBe(true);
    expect(await countInitiatives()).toBe(1); // ← the duplicate-DRAFT bug is closed
    expect((await readCandidate()).status).toBe('accepted');
  });

  it('G6 driver omitting `changes` still resolves correctly (no false receiptPersisted)', async () => {
    await baselineSchema();
    await applyMigration();
    await seedCandidate();

    // Some drivers/mocks return no rowcount. `Number(res?.changes ?? 0)` then reads
    // 0 and takes the re-read branch — which must settle on the truth, not guess.
    const blindDb: CandidateDb = {
      ...db,
      queryRun: async (sql, params = []) => {
        await client.query(adaptQuery(sql), params as any[]);
        return {} as any; // no `changes` reported
      },
    };

    const res = await acceptCandidate(blindDb, 'cand-1', {
      orgId: ORG,
      fill: false,
      deps: makeDeps(),
    });

    // The UPDATE really did happen, so the re-read finds the claim and reports true.
    expect(res?.receiptPersisted).toBe(true);
    expect(await countInitiatives()).toBe(1);
    const row = await readCandidate();
    expect(row.status).toBe('accepted');
    expect(row.initiative_id).toBe(res!.initiativeId);
  });

  it('G5 owner/tenant negative control — cross-org accept resolves nothing', async () => {
    await baselineSchema();
    await applyMigration();
    await seedCandidate();

    const intruder = await acceptCandidate(db, 'cand-1', {
      orgId: OTHER_ORG,
      fill: false,
      deps: makeDeps(),
    });

    expect(intruder).toBeNull();
    expect(await countInitiatives()).toBe(0);
    expect(createCalls).toBe(0);
    const row = await readCandidate();
    expect(row.status).toBe('pending');
    expect(row.initiative_id).toBeNull();
  });
});
