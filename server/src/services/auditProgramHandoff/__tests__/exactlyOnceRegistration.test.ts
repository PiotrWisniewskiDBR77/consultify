/**
 * exactlyOnceRegistration — AUD-MVP-AI-HANDOFF-001 headline evidence.
 *
 * `registerAsInitiative` (server/src/services/audits/proposalService.ts,
 * OUT OF LEASE for this worktree — read only) is check-then-act: it reads
 * `proposal.status`, calls the canonical `createInitiative()` funnel, then
 * writes `status='registered'` back onto the proposal row. Two concurrent
 * calls for the SAME proposal can both pass the read-check before either
 * write lands, so both would call `createInitiative()` — i.e. TWO downstream
 * receipts for ONE proposal. Because that service file is outside this
 * lane's lease, the fix is enforced purely at the schema layer: migration
 * server/migrations/20260910_claude_a_audit_initiative_proposal_exactly_once.sql
 * adds a partial UNIQUE INDEX on `initiatives (organization_id, source_id)
 * WHERE source_type='audit'` — the business identity of the receipt. The
 * SECOND concurrent `createInitiative()` INSERT then fails with a
 * unique-violation, which `registerAsInitiative`'s existing try/catch
 * (proposalService.ts:498-506) already converts into a defined
 * AUDIT_PROPOSAL_REGISTER_FAILED domain error — never an unhandled
 * exception, never a second receipt.
 *
 * Lives under `server/src/services/auditProgramHandoff/__tests__/` (not
 * `tests/auditProgramHandoff/`) so the root `vitest.config.ts` include glob
 * for service-level test dirs (any `server/src/services/<x>/__tests__/*.test.ts`)
 * actually collects it — a `tests/auditProgramHandoff` file would match zero
 * include globs and vitest would report a silent, misleading "0 tests, exit
 * 0" rather than a failure. `auditProgramHandoff` is a NEW directory, a
 * sibling of (not inside) the leased-out `server/src/services/audits` tree.
 *
 * Run (from repo root):
 *   DATABASE_URL=postgresql://... DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/auditProgramHandoff/__tests__/exactlyOnceRegistration.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  actorFor,
  addMember,
  cleanupOrg,
  insertOrganization,
  makeProgram,
  REAL_PG,
  requireRealPg,
  uid,
} from './helpers.js';

// __dirname = server/src/services/auditProgramHandoff/__tests__ — 5 levels
// up (__tests__ -> auditProgramHandoff -> services -> src -> server) lands
// at the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const MIGRATION_FILE = path.join(
  REPO_ROOT,
  'server/migrations/20260910_claude_a_audit_initiative_proposal_exactly_once.sql',
);

const DOCKER_CONTAINER = 'consultify-closure-a-34916';

function dockerAvailable(): boolean {
  try {
    execSync(`docker exec ${DOCKER_CONTAINER} psql -U consultinity -d consultinity -c "SELECT 1"`, {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

const describeDb = REAL_PG ? describe : describe.skip;
if (REAL_PG) requireRealPg();

describeDb('registerAsInitiative — exactly ONE downstream receipt (real Postgres)', () => {
  let pool: InstanceType<typeof import('pg').Pool>;
  let proposalService: typeof import('../../audits/proposalService.js');

  const orgId = uid('org-exactly1');
  const lead = uid('user-lead');

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    proposalService = await import('../../audits/proposalService.js');
    await insertOrganization(pool, orgId);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await cleanupOrg(pool, orgId);
    await pool.end();
  });

  async function makeDraftProposal(): Promise<{ programId: string; findingId: string; proposalId: string }> {
    const programId = await makeProgram(pool, orgId, lead);
    await addMember(pool, orgId, programId, lead, 'lead_auditor');
    await addMember(pool, orgId, programId, lead, 'program_owner');

    const findingId = uid('find');
    await pool.query(
      `INSERT INTO audit_program_findings
         (id, program_id, organization_id, statement, classification, severity, status)
       VALUES ($1,$2,$3,$4,'nonconforming','medium','confirmed')`,
      [findingId, programId, orgId, `Ustalenie exactly-once ${findingId}`],
    );

    const [proposal] = await proposalService.draftProposalsFromFindings(orgId, actorFor(orgId, lead), programId, {
      findingIds: [findingId],
      title: `Propozycja exactly-once ${findingId}`,
    });
    return { programId, findingId, proposalId: proposal.id };
  }

  async function receiptCount(sourceId: string): Promise<number> {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM initiatives WHERE organization_id=$1 AND source_type='audit' AND source_id=$2`,
      [orgId, sourceId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  it('1. CONCURRENT registration: two Promise.all() calls for the SAME proposal ⇒ exactly ONE downstream receipt', async () => {
    const { proposalId } = await makeDraftProposal();

    const results = await Promise.allSettled([
      proposalService.registerAsInitiative(orgId, actorFor(orgId, lead), proposalId),
      proposalService.registerAsInitiative(orgId, actorFor(orgId, lead), proposalId),
    ]);

    // Never an unhandled exception — both settle, one way or the other.
    expect(results).toHaveLength(2);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    // Exactly one of the two concurrent calls wins the race.
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const count = await receiptCount(proposalId);
    expect(count).toBe(1);

    const proposalRow = await pool.query(`SELECT status, registered_initiative_id FROM audit_initiative_proposals WHERE id=$1`, [
      proposalId,
    ]);
    expect(proposalRow.rows[0].status).toBe('registered');
    expect(proposalRow.rows[0].registered_initiative_id).toBeTruthy();
  }, 60_000);

  it('2. SEQUENTIAL replay: registering twice in a row ⇒ still one receipt, second call yields a DEFINED outcome (never an unhandled exception)', async () => {
    const { proposalId } = await makeDraftProposal();

    const first = await proposalService.registerAsInitiative(orgId, actorFor(orgId, lead), proposalId);
    expect(first.status).toBe('registered');

    let secondError: unknown = null;
    try {
      await proposalService.registerAsInitiative(orgId, actorFor(orgId, lead), proposalId);
    } catch (err) {
      secondError = err;
    }
    // The service's own state check (`status === 'registered'`) already
    // rejects the second call with a defined domain error before ever
    // reaching the DB-level constraint — this proves the migration does not
    // interfere with (or weaken) that existing guard.
    expect(secondError).toMatchObject({ code: 'AUDIT_INVALID_STATE' });

    const count = await receiptCount(proposalId);
    expect(count).toBe(1);
  }, 60_000);

  it('3. POSITIVE control: a single register call still SUCCEEDS end-to-end and produces exactly one receipt', async () => {
    const { proposalId } = await makeDraftProposal();

    const registered = await proposalService.registerAsInitiative(orgId, actorFor(orgId, lead), proposalId);
    expect(registered.status).toBe('registered');
    expect(registered.registeredInitiativeId).toBeTruthy();

    const initiativeRow = await pool.query(`SELECT id, source_type, source_id FROM initiatives WHERE id=$1`, [
      registered.registeredInitiativeId,
    ]);
    expect(initiativeRow.rows).toHaveLength(1);
    expect(initiativeRow.rows[0].source_type).toBe('audit');
    expect(initiativeRow.rows[0].source_id).toBe(proposalId);

    const count = await receiptCount(proposalId);
    expect(count).toBe(1);
  }, 60_000);

  // ---------------------------------------------------------------------
  // 4. Pre-existing-duplicate control — the migration must still APPLY on a
  //    database that already violates the constraint it is about to add.
  // ---------------------------------------------------------------------
  const dockerReady = dockerAvailable();
  const describeDupes = dockerReady ? describe : describe.skip;
  if (!dockerReady) {
    // eslint-disable-next-line no-console
    console.warn(
      `[exactlyOnceRegistration.test SKIPPED test 4 — clean skip, not a failure] ` +
        `docker exec ${DOCKER_CONTAINER} unreachable from this environment`,
    );
  }

  describeDupes('4. migration applies safely on a database with PRE-EXISTING duplicates', () => {
    const scratchDb = `scratch_dupes_${Date.now()}`;
    let scratchPool: InstanceType<typeof import('pg').Pool>;

    beforeAll(async () => {
      execSync(`docker exec ${DOCKER_CONTAINER} psql -U consultinity -d consultinity -c "CREATE DATABASE ${scratchDb};"`, {
        stdio: 'pipe',
      });
      // Schema-only clone: fast, and sufficient — this test only needs the
      // table shapes, not the data.
      execSync(
        `docker exec ${DOCKER_CONTAINER} bash -c "pg_dump -U consultinity -d consultinity --schema-only --no-owner --no-privileges | psql -U consultinity -d ${scratchDb} -q"`,
        { stdio: 'pipe' },
      );
      // The clone was schema-dumped AFTER this migration was already applied
      // to the source `consultinity` DB (this suite's own beforeAll chain
      // runs after the migration was applied earlier in this task) — so the
      // clone already carries the two new indexes and the schema_migrations
      // tracking row. Reset both, one statement per `psql -c` call: multiple
      // `;`-separated statements in a single `-c` string execute as ONE
      // implicit transaction in Postgres's simple query protocol, so an
      // error in a later statement silently rolls back an earlier DROP INDEX
      // in the same call (discovered the hard way while building this test).
      execSync(`docker exec ${DOCKER_CONTAINER} psql -U consultinity -d ${scratchDb} -c "DROP INDEX IF EXISTS uq_initiatives_audit_source_once;"`, { stdio: 'pipe' });
      execSync(`docker exec ${DOCKER_CONTAINER} psql -U consultinity -d ${scratchDb} -c "DROP INDEX IF EXISTS uq_audit_initiative_proposals_registered_initiative_id;"`, { stdio: 'pipe' });
      execSync(
        `docker exec ${DOCKER_CONTAINER} psql -U consultinity -d ${scratchDb} -c "DELETE FROM schema_migrations WHERE filename LIKE '%20260910_claude_a%';"`,
        { stdio: 'pipe' },
      );

      const { Pool } = await import('pg');
      scratchPool = new Pool({
        connectionString: process.env.DATABASE_URL!.replace(/\/[^/]+$/, `/${scratchDb}`),
      });

      // Seed the exact duplicate shapes the migration must survive: two
      // 'audit'-sourced initiatives sharing one source_id, and two proposals
      // sharing one registered_initiative_id.
      await scratchPool.query(`INSERT INTO organizations (id, name) VALUES ('dupe-org','Dupe org') ON CONFLICT DO NOTHING`);
      await scratchPool.query(
        `INSERT INTO initiatives (id, organization_id, name, source_type, source_id, created_at) VALUES
           ('dupe-init-1','dupe-org','Dupe Init 1','audit','dupe-src-1', now() - interval '2 days'),
           ('dupe-init-2','dupe-org','Dupe Init 2','audit','dupe-src-1', now() - interval '1 day')`,
      );
      await scratchPool.query(
        `INSERT INTO audit_initiative_proposals (id, program_id, organization_id, title, registered_initiative_id, registered_at, created_at) VALUES
           ('dupe-prop-1','dupe-prog','dupe-org','Dupe Prop 1','dupe-shared-init', now() - interval '2 days', now() - interval '2 days'),
           ('dupe-prop-2','dupe-prog','dupe-org','Dupe Prop 2','dupe-shared-init', now() - interval '1 day', now() - interval '1 day')`,
      );
    }, 180_000);

    afterAll(async () => {
      if (scratchPool) await scratchPool.end();
      try {
        execSync(`docker exec ${DOCKER_CONTAINER} psql -U consultinity -d consultinity -c "DROP DATABASE IF EXISTS ${scratchDb};"`, {
          stdio: 'pipe',
        });
      } catch {
        /* best-effort cleanup */
      }
    }, 60_000);

    it('applies without error, keeps the earliest row as sole receipt, and then enforces uniqueness', async () => {
      const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
      // The migration itself must apply cleanly despite the seeded duplicates.
      await expect(scratchPool.query(sql)).resolves.toBeDefined();

      const initiatives = await scratchPool.query(
        `SELECT id, source_id FROM initiatives WHERE id IN ('dupe-init-1','dupe-init-2') ORDER BY id`,
      );
      expect(initiatives.rows).toEqual([
        { id: 'dupe-init-1', source_id: 'dupe-src-1' },
        { id: 'dupe-init-2', source_id: null },
      ]);

      const proposals = await scratchPool.query(
        `SELECT id, registered_initiative_id FROM audit_initiative_proposals WHERE id IN ('dupe-prop-1','dupe-prop-2') ORDER BY id`,
      );
      expect(proposals.rows).toEqual([
        { id: 'dupe-prop-1', registered_initiative_id: 'dupe-shared-init' },
        { id: 'dupe-prop-2', registered_initiative_id: null },
      ]);

      // The constraint is now live: a fresh duplicate insert is rejected.
      await expect(
        scratchPool.query(
          `INSERT INTO initiatives (id, organization_id, name, source_type, source_id) VALUES ('dupe-init-3','dupe-org','Dupe Init 3','audit','dupe-src-1')`,
        ),
      ).rejects.toThrow(/duplicate key value violates unique constraint/);

      // Re-applying the migration a second time is a no-op (IF NOT EXISTS).
      await expect(scratchPool.query(sql)).resolves.toBeDefined();
    }, 120_000);
  });
});
