/**
 * ASM-BVP-001 (part 2) — "exactly-one initiative batch per assessment",
 * proved against REAL Postgres (no mocked DB, no mocked queryHelpers).
 *
 * Exercises the ACTUAL production code path:
 *   server/src/services/assessment/AssessmentWorkbenchService.ts's exported
 *   `upsertActiveAssessmentInitiativeBatch`, which both
 *   AssessmentWorkbenchService.ts (H1.3 auto-batch) and
 *   assessment-workflow-v2.routes.ts (manual-initiative batch) now share —
 *   backed by the partial unique index created in
 *   server/migrations/20260910_claude_a_assessment_initiative_batch_uniqueness.sql.
 *
 * Run (real Postgres required — a mocked/local-sqlite run would prove
 * nothing about the DB-level constraint):
 *   DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:PORT/consultinity" \
 *   DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/assessment/__tests__/assessmentInitiativeBatchUniqueness.realdb.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0
 *
 * Every row this file creates is prefixed with a per-run token and removed
 * in `afterAll` — no test data survives the run (CLAUDE.md: "probe'y
 * sprzątają po sobie, zero rekordów testowych").
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
process.env.DATABASE_URL = DATABASE_URL;
process.env.DB_TYPE = process.env.DB_TYPE || 'postgres';

const describeDb = DATABASE_URL ? describe : describe.skip;

const P = `aibu-${Date.now()}-`;
const ORG_A = `${P}orgA`;
const ORG_B = `${P}orgB`;

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

async function seedOrg(id: string): Promise<void> {
  const c = await db();
  try {
    await c.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      id,
      id,
    ]);
  } finally {
    await c.end();
  }
}

async function seedAssessment(id: string, orgId: string): Promise<void> {
  const c = await db();
  try {
    await c.query(
      `INSERT INTO assessments (id, organization_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [id, orgId]
    );
  } finally {
    await c.end();
  }
}

async function activeBatchRows(assessmentId: string): Promise<Array<{ id: string; status: string }>> {
  const c = await db();
  try {
    const r = await c.query(
      `SELECT id, status FROM assessment_initiative_batches
        WHERE assessment_id = $1 AND status IS DISTINCT FROM 'superseded'`,
      [assessmentId]
    );
    return r.rows as Array<{ id: string; status: string }>;
  } finally {
    await c.end();
  }
}

async function allBatchRows(assessmentId: string): Promise<Array<{ id: string; status: string }>> {
  const c = await db();
  try {
    const r = await c.query(`SELECT id, status FROM assessment_initiative_batches WHERE assessment_id = $1`, [
      assessmentId,
    ]);
    return r.rows as Array<{ id: string; status: string }>;
  } finally {
    await c.end();
  }
}

describeDb('ASM-BVP-001 (part 2) — assessment_initiative_batches uniqueness (real DB)', () => {
  let upsertActiveAssessmentInitiativeBatch: typeof import('../AssessmentWorkbenchService.js').upsertActiveAssessmentInitiativeBatch;

  beforeAll(async () => {
    ({ upsertActiveAssessmentInitiativeBatch } = await import('../AssessmentWorkbenchService.js'));
    await seedOrg(ORG_A);
    await seedOrg(ORG_B);
  }, 60_000);

  afterAll(async () => {
    const c = await db();
    try {
      await c.query(`DELETE FROM assessment_initiative_links WHERE assessment_id LIKE $1`, [`${P}%`]);
      await c.query(`DELETE FROM assessment_initiative_batches WHERE assessment_id LIKE $1`, [`${P}%`]);
      await c.query(`DELETE FROM assessment_initiative_batch_dedup_reports WHERE 1=0`); // never touched by this file; no-op, documents intent
      await c.query(`DELETE FROM assessments WHERE id LIKE $1`, [`${P}%`]);
      await c.query(`DELETE FROM organizations WHERE id = $1 OR id = $2`, [ORG_A, ORG_B]);
    } finally {
      await c.end();
    }
  });

  // -------------------------------------------------------------------
  // 1. Migration idempotency — the index exists with the exact expected
  //    definition, and re-executing the migration file's substantive SQL
  //    a second time is a byte-for-byte no-op (proven earlier, out of
  //    band, via `psql -f <file>` run twice plus a full-suite double run
  //    of server/scripts/migrate.postgres.ts — see the closure report).
  //    This test re-asserts the resulting index shape so a regression
  //    (e.g. someone drops/recreates it with a different predicate) fails
  //    loudly here too.
  // -------------------------------------------------------------------
  it('1. unique index exists with the exact partial predicate the writers rely on', async () => {
    const c = await db();
    try {
      const r = await c.query(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_assessment_initiative_batches_one_active_per_assessment'`
      );
      expect(r.rows.length).toBe(1);
      const def = String(r.rows[0].indexdef);
      expect(def).toContain('assessment_id');
      expect(def).toContain("COALESCE(organization_id, ''::text)");
      expect(def).toContain("WHERE (status IS DISTINCT FROM 'superseded'::text)");
    } finally {
      await c.end();
    }
  });

  // -------------------------------------------------------------------
  // 2. Duplicate prevention — two SEQUENTIAL creations for the same
  //    assessment produce exactly ONE row.
  // -------------------------------------------------------------------
  it('2. two sequential upserts for the same assessment yield exactly one row', async () => {
    const assessmentId = `${P}seq-1`;
    await seedAssessment(assessmentId, ORG_A);

    const first = await upsertActiveAssessmentInitiativeBatch({
      batchId: `${P}seq-1-batch-a`,
      assessmentId,
      organizationId: ORG_A,
      fields: { methodology_id: 'test', status: 'draft', created_at: new Date().toISOString() },
    });
    const second = await upsertActiveAssessmentInitiativeBatch({
      batchId: `${P}seq-1-batch-b`,
      assessmentId,
      organizationId: ORG_A,
      fields: { methodology_id: 'test', status: 'draft', created_at: new Date().toISOString() },
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.batchId).toBe(first.batchId);

    const rows = await activeBatchRows(assessmentId);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(first.batchId);
  });

  // -------------------------------------------------------------------
  // 3. Concurrency — N CONCURRENT creations for the same assessment yield
  //    exactly ONE row; every caller gets a defined outcome (same batch id
  //    back), never an unhandled exception, never a second row.
  // -------------------------------------------------------------------
  it('3. concurrent upserts for the same assessment yield exactly one row and no thrown errors', async () => {
    const assessmentId = `${P}concurrent-1`;
    await seedAssessment(assessmentId, ORG_A);

    const N = 8;
    const attempts = Array.from({ length: N }, (_, i) =>
      upsertActiveAssessmentInitiativeBatch({
        batchId: `${P}concurrent-1-batch-${i}`,
        assessmentId,
        organizationId: ORG_A,
        fields: { methodology_id: 'test', status: 'draft', created_at: new Date().toISOString() },
      })
    );

    const results = await Promise.allSettled(attempts);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toEqual([]); // never an unhandled exception

    const fulfilled = results
      .filter((r): r is PromiseFulfilledResult<{ batchId: string; created: boolean }> => r.status === 'fulfilled')
      .map((r) => r.value);
    expect(fulfilled.length).toBe(N);

    const winners = fulfilled.filter((r) => r.created);
    expect(winners.length).toBe(1); // exactly one INSERT actually won

    const batchIds = new Set(fulfilled.map((r) => r.batchId));
    expect(batchIds.size).toBe(1); // every caller (winner + losers) agrees on the same batch id

    const rows = await activeBatchRows(assessmentId);
    expect(rows.length).toBe(1);
  });

  // -------------------------------------------------------------------
  // 4. Retry/replay — repeating the same logical request AFTER success is
  //    a no-op that returns the same batch id (simulates a client retrying
  //    after a dropped response).
  // -------------------------------------------------------------------
  it('4. replaying the request after success returns the same batch id (no new row)', async () => {
    const assessmentId = `${P}replay-1`;
    await seedAssessment(assessmentId, ORG_A);

    const first = await upsertActiveAssessmentInitiativeBatch({
      batchId: `${P}replay-1-batch-a`,
      assessmentId,
      organizationId: ORG_A,
      fields: { methodology_id: 'test', status: 'draft', created_at: new Date().toISOString() },
    });
    expect(first.created).toBe(true);

    // Simulate a later, independent retry (e.g. client resubmit) — a fresh
    // proposed id, same assessment/org.
    const replay = await upsertActiveAssessmentInitiativeBatch({
      batchId: `${P}replay-1-batch-retry`,
      assessmentId,
      organizationId: ORG_A,
      fields: { methodology_id: 'test', status: 'draft', created_at: new Date().toISOString() },
    });
    expect(replay.created).toBe(false);
    expect(replay.batchId).toBe(first.batchId);

    const rows = await activeBatchRows(assessmentId);
    expect(rows.length).toBe(1);
  });

  // -------------------------------------------------------------------
  // 5. Tenant / scope negative control — proves the constraint did NOT
  //    over-constrain: (a) two DIFFERENT organizations each get their own
  //    batch for their OWN assessment, and (b) the SAME organization can
  //    still have independent batches for TWO DIFFERENT assessments (the
  //    key is (assessment_id, organization_id), not organization_id alone
  //    — this is the more meaningful negative control given assessment_id
  //    already 1:1-determines its owning org via the assessments FK).
  // -------------------------------------------------------------------
  it('5a. two different organizations each get their own batch for their own assessment', async () => {
    const assessmentA = `${P}tenant-orgA`;
    const assessmentB = `${P}tenant-orgB`;
    await seedAssessment(assessmentA, ORG_A);
    await seedAssessment(assessmentB, ORG_B);

    const a = await upsertActiveAssessmentInitiativeBatch({
      batchId: `${P}tenant-orgA-batch`,
      assessmentId: assessmentA,
      organizationId: ORG_A,
      fields: { methodology_id: 'test', status: 'draft', created_at: new Date().toISOString() },
    });
    const b = await upsertActiveAssessmentInitiativeBatch({
      batchId: `${P}tenant-orgB-batch`,
      assessmentId: assessmentB,
      organizationId: ORG_B,
      fields: { methodology_id: 'test', status: 'draft', created_at: new Date().toISOString() },
    });

    expect(a.created).toBe(true);
    expect(b.created).toBe(true);
    expect(a.batchId).not.toBe(b.batchId);
  });

  it('5b. the same organization gets independent batches for two different assessments', async () => {
    const assessment1 = `${P}same-org-1`;
    const assessment2 = `${P}same-org-2`;
    await seedAssessment(assessment1, ORG_A);
    await seedAssessment(assessment2, ORG_A);

    const one = await upsertActiveAssessmentInitiativeBatch({
      batchId: `${P}same-org-1-batch`,
      assessmentId: assessment1,
      organizationId: ORG_A,
      fields: { methodology_id: 'test', status: 'draft', created_at: new Date().toISOString() },
    });
    const two = await upsertActiveAssessmentInitiativeBatch({
      batchId: `${P}same-org-2-batch`,
      assessmentId: assessment2,
      organizationId: ORG_A,
      fields: { methodology_id: 'test', status: 'draft', created_at: new Date().toISOString() },
    });

    expect(one.created).toBe(true);
    expect(two.created).toBe(true);
    expect(one.batchId).not.toBe(two.batchId);

    const rows1 = await activeBatchRows(assessment1);
    const rows2 = await activeBatchRows(assessment2);
    expect(rows1.length).toBe(1);
    expect(rows2.length).toBe(1);
  });

  // -------------------------------------------------------------------
  // 6. Pre-existing-duplicates control — proves the MIGRATION (not just
  //    the application-level CAS function) survives a database that
  //    already has duplicate active rows for the same
  //    (assessment_id, organization_id) BEFORE the guard is in place.
  //
  //    The shared scratch DB already has this migration applied (required
  //    so the writers under test can run at all), so this scenario is
  //    reproduced against an isolated TEMP TABLE — a real Postgres
  //    scratch construct, dropped automatically when this test's
  //    connection closes, with zero footprint on the shared
  //    public.assessment_initiative_batches table other tests/lanes read.
  //    The reconciliation statements below are copied verbatim (adjusted
  //    only for the temp table name) from
  //    server/migrations/20260910_claude_a_assessment_initiative_batch_uniqueness.sql
  //    section 2/3, so this proves the ALGORITHM the migration runs, not a
  //    different one — see that file for the byte-identical statements.
  // -------------------------------------------------------------------
  it('6. migration reconciliation + index creation survives pre-existing duplicate rows', async () => {
    const c = await db();
    try {
      await c.query('BEGIN');
      // INCLUDING DEFAULTS only — deliberately NOT "INCLUDING ALL": the
      // real table already carries the unique index this test exists to
      // characterize (this scratch DB has the migration applied, since the
      // writers under test in cases 1-5/7 need it). Copying indexes would
      // paste that same constraint onto the temp table and make it
      // impossible to seed the "before the guard existed" duplicate rows
      // this test needs (verified: an earlier version of this test with
      // INCLUDING ALL failed the seed INSERT itself with 23505, before the
      // reconciliation logic under test ever ran).
      await c.query(
        `CREATE TEMP TABLE t_aibu_dupe_control (LIKE assessment_initiative_batches INCLUDING DEFAULTS) ON COMMIT DROP`
      );

      // Seed TWO pre-existing "active" duplicates for assessment X (the
      // scenario a bare CREATE UNIQUE INDEX would choke on), plus one
      // control row for a different assessment that must be left alone.
      await c.query(
        `INSERT INTO t_aibu_dupe_control (id, assessment_id, organization_id, status, created_at) VALUES
           ('dup-old', 'dupe-x', 'org-dupe', 'pending', NOW() - interval '2 hour'),
           ('dup-new', 'dupe-x', 'org-dupe', 'draft',   NOW() - interval '1 hour'),
           ('solo',    'dupe-y', 'org-dupe', 'pending', NOW())`
      );

      // --- verbatim reconciliation logic from the migration file (section 2) ---
      await c.query(
        `CREATE TEMP TABLE _t_aibu_rank ON COMMIT DROP AS
         SELECT id,
           row_number() OVER (
             PARTITION BY assessment_id, COALESCE(organization_id, '')
             ORDER BY created_at DESC NULLS LAST, id DESC
           ) AS rn,
           count(*) OVER (
             PARTITION BY assessment_id, COALESCE(organization_id, '')
           ) AS group_size
         FROM t_aibu_dupe_control
         WHERE status IS DISTINCT FROM 'superseded'`
      );
      const updateResult = await c.query(
        `UPDATE t_aibu_dupe_control b
            SET status = 'superseded', updated_at = NOW()
           FROM _t_aibu_rank r
          WHERE b.id = r.id AND r.rn > 1`
      );
      expect(updateResult.rowCount).toBe(1); // exactly one of the two duplicates superseded

      // --- verbatim index-creation statement from the migration file (section 3) ---
      await c.query(
        `CREATE UNIQUE INDEX uq_t_aibu_one_active ON t_aibu_dupe_control
           (assessment_id, (COALESCE(organization_id, '')))
           WHERE status IS DISTINCT FROM 'superseded'`
      ); // must not throw — this is the assertion that matters most here

      const remaining = await c.query(
        `SELECT id, status FROM t_aibu_dupe_control WHERE assessment_id = 'dupe-x' AND status IS DISTINCT FROM 'superseded'`
      );
      expect(remaining.rows.length).toBe(1);
      expect(remaining.rows[0].id).toBe('dup-new'); // keep-newest rule kept the later row

      const superseded = await c.query(
        `SELECT id FROM t_aibu_dupe_control WHERE assessment_id = 'dupe-x' AND status = 'superseded'`
      );
      expect(superseded.rows.map((r) => r.id)).toEqual(['dup-old']); // never deleted, only marked

      const control = await c.query(
        `SELECT id, status FROM t_aibu_dupe_control WHERE assessment_id = 'dupe-y'`
      );
      expect(control.rows).toEqual([{ id: 'solo', status: 'pending' }]); // untouched
    } finally {
      await c.query('ROLLBACK').catch(() => undefined);
      await c.end();
    }
  });

  // -------------------------------------------------------------------
  // 7. Zero orphan rows after a failed/rolled-back attempt — an insert
  //    that violates the assessment_id FK (assessment does not exist)
  //    must throw (never silently swallow), and must leave ZERO rows
  //    behind (withRawPgTransaction's BEGIN/COMMIT/ROLLBACK wraps the
  //    INSERT + conflict-check together).
  // -------------------------------------------------------------------
  it('7. a failed insert (FK violation) leaves zero orphan rows', async () => {
    const bogusAssessmentId = `${P}does-not-exist`;
    const proposedBatchId = `${P}orphan-check-batch`;

    await expect(
      upsertActiveAssessmentInitiativeBatch({
        batchId: proposedBatchId,
        assessmentId: bogusAssessmentId,
        organizationId: ORG_A,
        fields: { methodology_id: 'test', status: 'draft', created_at: new Date().toISOString() },
      })
    ).rejects.toThrow();

    const c = await db();
    try {
      const r = await c.query(`SELECT id FROM assessment_initiative_batches WHERE id = $1`, [
        proposedBatchId,
      ]);
      expect(r.rows.length).toBe(0);
      const byAssessment = await allBatchRows(bogusAssessmentId);
      expect(byAssessment.length).toBe(0);
    } finally {
      await c.end();
    }
  });
});
