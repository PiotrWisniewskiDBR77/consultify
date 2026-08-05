/**
 * M01-P07C — atomic Idea materialization, proved on a REAL PostgreSQL.
 *
 * FINDING M01-033 (P1): `canvasMaterialize.ts`'s `idea` branch used to issue
 * TWO INDEPENDENT `insertDynamic` calls (my_ideas, then my_idea_maps), each a
 * separate round trip through the shared connection POOL. A crash between
 * them left a durable `my_ideas` row with no `my_idea_maps` row behind it.
 * The fix pins one PostgreSQL connection (`withPgTransaction`) for the idea
 * insert, the map insert, a genuine read-back SELECT, and a receipt insert —
 * see the block comment above `ensureCanvasIdeaReceiptTable` in
 * `../canvasMaterialize.ts` for the full design.
 *
 * WHY THIS CANNOT BE A MOCK. The claim under test is about what PostgreSQL
 * actually does when a transaction is interrupted mid-way — an in-memory
 * fake shares the code's own assumptions about when a write "lands" and
 * cannot falsify that claim. Every fault below is injected as a REAL
 * PostgreSQL trigger (`BEFORE INSERT ... RAISE EXCEPTION`, or an
 * `AFTER INSERT ... DELETE` to make a just-written row vanish before the
 * read-back runs) gated on a marker value that ONLY the test writes into a
 * plain column already in `CanvasMaterializeInput` (`sourceDraftId` /
 * `preferredTool`). Production code (`canvasMaterialize.ts`) has ZERO
 * awareness of these triggers — the ROLLBACK, `client.release()`, and
 * read-back behavior under test are entirely real Postgres/pg-driver
 * behavior, not simulated.
 *
 * HOW TO RUN (repo root):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:<port>/<db> \
 *   npx vitest run server/src/services/__tests__/canvasIdeaMaterializeAtomicity.p07c.pg.test.ts \
 *     --no-file-parallelism
 *
 * `NODE_ENV=test` ALONE IS A TRAP — `RUN_DB_TESTS` and `MOCK_DB=false` are
 * what force the real driver (see server/src/utils/dbSchema.ts's
 * `isMockDbEnabled` and server/src/database/Database.ts's `createDatabase`).
 * `DB_TYPE=postgres` above is for operator habit/clarity only — neither of
 * those two gates actually reads it (this codebase is Postgres-only; see
 * Database.ts's own header comment), and both vitest configs in this repo
 * hardcode `DB_TYPE: 'sqlite'` in `test.env` regardless of the shell — see
 * the comment on `REAL_DB_REQUESTED` below. Without a reachable database the
 * whole file SKIPS, loudly, rather than failing a machine with no local
 * Postgres.
 *
 * ISOLATION. Every test owns its own `organizationId` (`orgFor('<key>')`) so
 * no test can observe another test's rows, and the four fault triggers are
 * gated on marker values unique to the test that uses them — a leaked fault
 * cannot fire in a different test's data. `describe(..., { sequential: true })`
 * because state #10 counts live Postgres backend connections and would be
 * corrupted by parallel test files/workers touching the same database.
 */

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Schema is already migrated in the target database; skip the app's own
// (much larger, slower, and here pointless) initDb() pass.
process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';
// Deliberately small pool for the WHOLE file (must be set before
// `server/src/config/DatabaseConfig.ts` is first imported — which happens
// transitively the first time `../canvasMaterialize.js` is dynamically
// imported in `beforeAll` below, never before). Small-but->1 serves two
// purposes: (a) test #8 needs >=2 so its two concurrent calls can genuinely
// overlap on the database instead of being serialized by the pool itself
// (which would silently turn "prove a real race" into "prove sequential
// execution"); (b) test #10 needs it SMALL so that a `client.release()` leak
// on any path becomes observable as pool exhaustion (a hang on
// `pool.connect()`) within a handful of operations, not only after ~10+.
process.env.DB_POOL_SIZE = process.env.DB_POOL_SIZE ?? '3';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
// NOTE: deliberately does NOT gate on `process.env.DB_TYPE` — both
// vitest.config.ts (root) and server/vitest.config.ts hardcode
// `DB_TYPE: 'sqlite'` in their `test.env` block, unconditionally, before this
// file's top-level code runs. That is harmless here: `createDatabase()`
// (server/src/database/Database.ts) and `isMockDbEnabled()`
// (server/src/utils/dbSchema.ts) both decide real-vs-mock from
// `RUN_DB_TESTS`/`MOCK_DB`/`NODE_ENV` only — "PostgreSQL only. SQLite has
// been fully removed." (Database.ts's own header comment) — and
// `withPgTransaction` (server/src/database/PostgresDatabase.ts) talks to a
// real `pg.Pool` unconditionally. Matches the gating convention already
// established by atelierFinancePinnedTransaction.pg.test.ts.
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

async function canReach(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
  try {
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = REAL_DB_REQUESTED ? await canReach(CONNECTION_STRING) : false;

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    '[M01-P07C] SKIPPING canvasIdeaMaterializeAtomicity.p07c.pg.test.ts — real Postgres not ' +
      'requested/reachable (need RUN_DB_TESTS=1 NODE_ENV=test DB_TYPE=postgres MOCK_DB=false ' +
      'DATABASE_URL=postgresql://...). This file must never fail a machine with no local Postgres.'
  );
}

describe.runIf(REACHABLE)('M01-P07C — canvasMaterialize idea atomicity (real PG)', () => {
  // A dedicated probe pool, SEPARATE from the app's internal pool — used for
  // fixture setup/teardown, row counting, fault-trigger install/remove, and
  // the pg_stat_activity connection-leak check. Never used to exercise the
  // code under test itself (that always goes through
  // `materializeWorkspaceTarget`, which uses the APP's pool via
  // `withPgTransaction`).
  const probe = new Pool({ connectionString: CONNECTION_STRING, max: 4 });

  const RUN_ID = randomUUID().slice(0, 8);
  const orgFor = (key: string) => `p07c-org-${RUN_ID}-${key}`;
  const userFor = (key: string) => `p07c-user-${RUN_ID}-${key}`;

  const FAULT_IDEA_INSERT = `__p07c_fault_idea_insert_${RUN_ID}__`;
  const FAULT_MAP_INSERT = `__p07c_fault_map_insert_${RUN_ID}__`;
  const FAULT_MAP_VANISH = `__p07c_fault_map_vanish_${RUN_ID}__`;
  const FAULT_RECEIPT_INSERT = `__p07c_fault_receipt_insert_${RUN_ID}__`;

  let materializeWorkspaceTarget: typeof import('../canvasMaterialize.js').materializeWorkspaceTarget;

  beforeAll(async () => {
    ({ materializeWorkspaceTarget } = await import('../canvasMaterialize.js'));

    // ---- schema precondition (P07C review fix) --------------------------
    // canvasMaterialize.ts no longer creates canvas_idea_materialization_receipts
    // at runtime — the table and BOTH indexes come exclusively from
    // server/migrations/944_canvas_idea_materialization_receipts.sql. Assert
    // their presence via information_schema/pg_indexes BEFORE any test runs,
    // rather than assuming they exist: if the migration was never applied,
    // this whole file must fail loudly here, not several tests deep with a
    // confusing "relation does not exist" from inside a transaction.
    const tableRow = await probe.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'canvas_idea_materialization_receipts'`
    );
    if (tableRow.rows.length === 0) {
      throw new Error(
        'canvas_idea_materialization_receipts is missing. Apply ' +
          'server/migrations/944_canvas_idea_materialization_receipts.sql against ' +
          `${CONNECTION_STRING} before running this test file.`
      );
    }
    const indexRows = await probe.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'canvas_idea_materialization_receipts'`
    );
    const presentIndexNames = new Set(indexRows.rows.map((row) => row.indexname as string));
    const requiredIndexNames = ['idx_canvas_idea_receipts_org_idem', 'idx_canvas_idea_receipts_idea_id'];
    const missingIndexNames = requiredIndexNames.filter((name) => !presentIndexNames.has(name));
    if (missingIndexNames.length > 0) {
      throw new Error(
        `canvas_idea_materialization_receipts is missing required index(es): ` +
          `${missingIndexNames.join(', ')}. Apply ` +
          'server/migrations/944_canvas_idea_materialization_receipts.sql (it recreates both ' +
          `indexes idempotently) against ${CONNECTION_STRING} before running this test file.`
      );
    }

    // ---- fault triggers (real Postgres, marker-gated, own functions/names
    // so they cannot collide with anything the app itself defines) --------
    await probe.query(`
      CREATE OR REPLACE FUNCTION __p07c_fault_idea_insert() RETURNS trigger AS $$
      BEGIN
        IF NEW.source_message_id = '${FAULT_IDEA_INSERT}' THEN
          RAISE EXCEPTION 'P07C_INJECTED_FAULT: idea insert blocked';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await probe.query(`
      DROP TRIGGER IF EXISTS trg_p07c_fault_idea_insert ON my_ideas;
      CREATE TRIGGER trg_p07c_fault_idea_insert BEFORE INSERT ON my_ideas
      FOR EACH ROW EXECUTE FUNCTION __p07c_fault_idea_insert();
    `);

    await probe.query(`
      CREATE OR REPLACE FUNCTION __p07c_fault_map_insert() RETURNS trigger AS $$
      BEGIN
        IF NEW.preferred_tool = '${FAULT_MAP_INSERT}' THEN
          RAISE EXCEPTION 'P07C_INJECTED_FAULT: idea-map insert blocked';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await probe.query(`
      DROP TRIGGER IF EXISTS trg_p07c_fault_map_insert ON my_idea_maps;
      CREATE TRIGGER trg_p07c_fault_map_insert BEFORE INSERT ON my_idea_maps
      FOR EACH ROW EXECUTE FUNCTION __p07c_fault_map_insert();
    `);

    // AFTER INSERT: the map insert itself SUCCEEDS (no error thrown at
    // insert time — production code's own INSERT statement reports success),
    // then this trigger deletes the row before canvasMaterialize.ts's
    // read-back SELECT can see it. Simulates "the write reported success but
    // the row isn't there when read back" without touching production code.
    await probe.query(`
      CREATE OR REPLACE FUNCTION __p07c_fault_map_vanish() RETURNS trigger AS $$
      BEGIN
        IF NEW.preferred_tool = '${FAULT_MAP_VANISH}' THEN
          DELETE FROM my_idea_maps WHERE id = NEW.id;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await probe.query(`
      DROP TRIGGER IF EXISTS trg_p07c_fault_map_vanish ON my_idea_maps;
      CREATE TRIGGER trg_p07c_fault_map_vanish AFTER INSERT ON my_idea_maps
      FOR EACH ROW EXECUTE FUNCTION __p07c_fault_map_vanish();
    `);

    // canvas_idea_materialization_receipts already exists (asserted above,
    // created by the migration) — the trigger below can attach immediately,
    // no bootstrap materialize call needed to force table creation anymore.
    await probe.query(`
      CREATE OR REPLACE FUNCTION __p07c_fault_receipt_insert() RETURNS trigger AS $$
      BEGIN
        IF NEW.source_draft_id = '${FAULT_RECEIPT_INSERT}' THEN
          RAISE EXCEPTION 'P07C_INJECTED_FAULT: receipt insert blocked';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await probe.query(`
      DROP TRIGGER IF EXISTS trg_p07c_fault_receipt_insert ON canvas_idea_materialization_receipts;
      CREATE TRIGGER trg_p07c_fault_receipt_insert BEFORE INSERT ON canvas_idea_materialization_receipts
      FOR EACH ROW EXECUTE FUNCTION __p07c_fault_receipt_insert();
    `);
  });

  afterAll(async () => {
    await probe.query('DROP TRIGGER IF EXISTS trg_p07c_fault_idea_insert ON my_ideas').catch(() => undefined);
    await probe.query('DROP FUNCTION IF EXISTS __p07c_fault_idea_insert()').catch(() => undefined);
    await probe.query('DROP TRIGGER IF EXISTS trg_p07c_fault_map_insert ON my_idea_maps').catch(() => undefined);
    await probe.query('DROP FUNCTION IF EXISTS __p07c_fault_map_insert()').catch(() => undefined);
    await probe.query('DROP TRIGGER IF EXISTS trg_p07c_fault_map_vanish ON my_idea_maps').catch(() => undefined);
    await probe.query('DROP FUNCTION IF EXISTS __p07c_fault_map_vanish()').catch(() => undefined);
    await probe
      .query(
        'DROP TRIGGER IF EXISTS trg_p07c_fault_receipt_insert ON canvas_idea_materialization_receipts'
      )
      .catch(() => undefined);
    await probe.query('DROP FUNCTION IF EXISTS __p07c_fault_receipt_insert()').catch(() => undefined);

    // Data cleanup — every row this file created carries a RUN_ID-scoped org
    // or draft id, so this cannot touch any other test's/run's data.
    await probe.query(`DELETE FROM canvas_idea_materialization_receipts WHERE organization_id LIKE $1`, [
      `p07c-org-${RUN_ID}-%`,
    ]);
    await probe.query(`DELETE FROM my_idea_maps WHERE organization_id LIKE $1`, [`p07c-org-${RUN_ID}-%`]);
    await probe.query(`DELETE FROM my_ideas WHERE organization_id LIKE $1`, [`p07c-org-${RUN_ID}-%`]);

    await probe.end();
  });

  async function counts(organizationId: string) {
    const [ideas, maps, receipts] = await Promise.all([
      probe.query(`SELECT count(*)::int AS n FROM my_ideas WHERE organization_id = $1`, [organizationId]),
      probe.query(`SELECT count(*)::int AS n FROM my_idea_maps WHERE organization_id = $1`, [
        organizationId,
      ]),
      probe.query(
        `SELECT count(*)::int AS n FROM canvas_idea_materialization_receipts WHERE organization_id = $1`,
        [organizationId]
      ),
    ]);
    return {
      ideas: ideas.rows[0].n as number,
      maps: maps.rows[0].n as number,
      receipts: receipts.rows[0].n as number,
    };
  }

  // =====================================================================
  // Matrix state 1 — success
  // =====================================================================
  it('[1/10 success] writes idea + map + receipt together and read-back confirms all three', async () => {
    const organizationId = orgFor('success');
    const result = await materializeWorkspaceTarget({
      organizationId,
      actorUserId: userFor('success'),
      target: 'idea',
      title: 'Success case idea',
      contentMd: '## Section A\nbody',
      summary: 'summary',
      projectId: null,
      sourceDraftId: 'draft-success',
    });

    expect(result.type).toBe('idea');
    expect(result.readBack.status).toBe('completed');
    expect(result.readBack.receiptId).toBeTruthy();

    const c = await counts(organizationId);
    expect(c).toEqual({ ideas: 1, maps: 1, receipts: 1 });
  });

  // =====================================================================
  // Matrix state 2 — idea insert fails
  // =====================================================================
  it('[2/10 idea insert fails] rolls back to zero idea/map/receipt rows', async () => {
    const organizationId = orgFor('fail-idea');
    await expect(
      materializeWorkspaceTarget({
        organizationId,
        actorUserId: userFor('fail-idea'),
        target: 'idea',
        title: 'Should never persist',
        contentMd: 'body',
        summary: 'summary',
        projectId: null,
        sourceDraftId: FAULT_IDEA_INSERT,
      })
    ).rejects.toThrow(/P07C_INJECTED_FAULT: idea insert blocked/);

    expect(await counts(organizationId)).toEqual({ ideas: 0, maps: 0, receipts: 0 });
  });

  // =====================================================================
  // Matrix state 3 — map insert fails (idea insert already succeeded
  // in-transaction)
  // =====================================================================
  it('[3/10 map insert fails] rolls back the ALREADY-inserted idea too — zero rows', async () => {
    const organizationId = orgFor('fail-map');
    await expect(
      materializeWorkspaceTarget({
        organizationId,
        actorUserId: userFor('fail-map'),
        target: 'idea',
        title: 'Idea inserted, map insert blocked',
        contentMd: 'body',
        summary: 'summary',
        projectId: null,
        sourceDraftId: 'draft-fail-map',
        preferredTool: FAULT_MAP_INSERT,
      })
    ).rejects.toThrow(/P07C_INJECTED_FAULT: idea-map insert blocked/);

    expect(await counts(organizationId)).toEqual({ ideas: 0, maps: 0, receipts: 0 });
  });

  // =====================================================================
  // Matrix state 4 — read-back fails (map row vanishes between insert and
  // the read-back SELECT, within the same transaction)
  // =====================================================================
  it('[4/10 read-back fails] rolls back idea + map + receipt — zero rows', async () => {
    const organizationId = orgFor('fail-readback');
    await expect(
      materializeWorkspaceTarget({
        organizationId,
        actorUserId: userFor('fail-readback'),
        target: 'idea',
        title: 'Map vanishes before read-back',
        contentMd: 'body',
        summary: 'summary',
        projectId: null,
        sourceDraftId: 'draft-fail-readback',
        preferredTool: FAULT_MAP_VANISH,
      })
    ).rejects.toThrow(/read-back failed/);

    expect(await counts(organizationId)).toEqual({ ideas: 0, maps: 0, receipts: 0 });
  });

  // =====================================================================
  // Matrix state 5 — receipt insert fails
  // =====================================================================
  it('[5/10 receipt insert fails] rolls back the idea + map too — zero rows', async () => {
    const organizationId = orgFor('fail-receipt');
    await expect(
      materializeWorkspaceTarget({
        organizationId,
        actorUserId: userFor('fail-receipt'),
        target: 'idea',
        title: 'Receipt insert blocked',
        contentMd: 'body',
        summary: 'summary',
        projectId: null,
        sourceDraftId: FAULT_RECEIPT_INSERT,
      })
    ).rejects.toThrow(/P07C_INJECTED_FAULT: receipt insert blocked/);

    expect(await counts(organizationId)).toEqual({ ideas: 0, maps: 0, receipts: 0 });
  });

  // =====================================================================
  // Matrix state 6 — lost response after commit (retry with the SAME
  // idempotency key returns the SAME objects, no growth)
  // =====================================================================
  it('[6/10 lost response after commit] retry with the same idempotencyKey returns the SAME idea/map, no duplicate', async () => {
    const organizationId = orgFor('lost-response');
    const idempotencyKey = `idem-lost-response-${RUN_ID}`;
    const first = await materializeWorkspaceTarget({
      organizationId,
      actorUserId: userFor('lost-response'),
      target: 'idea',
      title: 'Committed, response lost',
      contentMd: 'body',
      summary: 'summary',
      projectId: null,
      sourceDraftId: 'draft-lost-response',
      idempotencyKey,
    });

    // Simulate the client never seeing `first` and resubmitting the
    // identical logical operation.
    const retry = await materializeWorkspaceTarget({
      organizationId,
      actorUserId: userFor('lost-response'),
      target: 'idea',
      title: 'Committed, response lost',
      contentMd: 'body',
      summary: 'summary',
      projectId: null,
      sourceDraftId: 'draft-lost-response',
      idempotencyKey,
    });

    expect(retry.id).toBe(first.id);
    expect(retry.readBack.mapId).toBe(first.readBack.mapId);
    expect(await counts(organizationId)).toEqual({ ideas: 1, maps: 1, receipts: 1 });
  });

  // =====================================================================
  // Matrix state 7 — retry after failure: zero objects from the failed
  // attempt, exactly one after the successful retry
  // =====================================================================
  it('[7/10 retry after failure] a failed attempt leaves zero rows; retry with the SAME key succeeds with exactly one', async () => {
    const organizationId = orgFor('retry-after-fail');
    const idempotencyKey = `idem-retry-after-fail-${RUN_ID}`;

    await expect(
      materializeWorkspaceTarget({
        organizationId,
        actorUserId: userFor('retry-after-fail'),
        target: 'idea',
        title: 'First attempt fails',
        contentMd: 'body',
        summary: 'summary',
        projectId: null,
        sourceDraftId: FAULT_IDEA_INSERT,
        idempotencyKey,
      })
    ).rejects.toThrow(/P07C_INJECTED_FAULT/);
    expect(await counts(organizationId)).toEqual({ ideas: 0, maps: 0, receipts: 0 });

    const retried = await materializeWorkspaceTarget({
      organizationId,
      actorUserId: userFor('retry-after-fail'),
      target: 'idea',
      title: 'Retry succeeds',
      contentMd: 'body',
      summary: 'summary',
      projectId: null,
      sourceDraftId: 'draft-retry-after-fail-take2',
      idempotencyKey,
    });
    expect(retried.readBack.status).toBe('completed');
    expect(await counts(organizationId)).toEqual({ ideas: 1, maps: 1, receipts: 1 });
  });

  // =====================================================================
  // Matrix state 8 — concurrent double execution: exactly one winner
  // =====================================================================
  it('[8/10 concurrent double execution] two parallel calls with the SAME idempotencyKey produce exactly one idea/map/receipt', async () => {
    const organizationId = orgFor('concurrent');
    const idempotencyKey = `idem-concurrent-${RUN_ID}`;
    const input = {
      organizationId,
      actorUserId: userFor('concurrent'),
      target: 'idea' as const,
      title: 'Race',
      contentMd: 'body',
      summary: 'summary',
      projectId: null,
      sourceDraftId: 'draft-concurrent',
      idempotencyKey,
    };

    const [a, b] = await Promise.all([
      materializeWorkspaceTarget(input),
      materializeWorkspaceTarget(input),
    ]);

    expect(a.id).toBe(b.id);
    expect(a.readBack.mapId).toBe(b.readBack.mapId);
    expect(await counts(organizationId)).toEqual({ ideas: 1, maps: 1, receipts: 1 });
  });

  // =====================================================================
  // Matrix state 9 — cross-tenant: two different orgs sharing the SAME
  // idempotency key never collide, and the read-back is genuinely
  // tenant-scoped (a receipt from org A is invisible under org B's filter)
  // =====================================================================
  it('[9/10 cross-tenant] two organizations sharing one idempotencyKey each get their OWN idea; org-scoped read-back proves isolation', async () => {
    const orgA = orgFor('tenant-a');
    const orgB = orgFor('tenant-b');
    const sharedIdempotencyKey = `idem-cross-tenant-${RUN_ID}`;

    const resultA = await materializeWorkspaceTarget({
      organizationId: orgA,
      actorUserId: userFor('tenant-a'),
      target: 'idea',
      title: 'Org A idea',
      contentMd: 'body',
      summary: 'summary',
      projectId: null,
      sourceDraftId: 'draft-tenant-a',
      idempotencyKey: sharedIdempotencyKey,
    });
    const resultB = await materializeWorkspaceTarget({
      organizationId: orgB,
      actorUserId: userFor('tenant-b'),
      target: 'idea',
      title: 'Org B idea',
      contentMd: 'body',
      summary: 'summary',
      projectId: null,
      sourceDraftId: 'draft-tenant-b',
      idempotencyKey: sharedIdempotencyKey,
    });

    // No cross-tenant reuse: the same idempotency key under two different
    // orgs must never collapse into one idea.
    expect(resultA.id).not.toBe(resultB.id);
    expect(await counts(orgA)).toEqual({ ideas: 1, maps: 1, receipts: 1 });
    expect(await counts(orgB)).toEqual({ ideas: 1, maps: 1, receipts: 1 });

    // The production read-back query, run directly with org B's id against
    // org A's idea id, must find nothing — this is the SAME
    // `WHERE id = $1 AND organization_id = $2` shape canvasMaterialize.ts's
    // read-back uses. See negative control (c) in the return report: with
    // the organization_id filter removed, this assertion goes red.
    const crossTenantAttempt = await probe.query(
      `SELECT id FROM my_ideas WHERE id = $1 AND organization_id = $2`,
      [resultA.id, orgB]
    );
    expect(crossTenantAttempt.rows).toHaveLength(0);

    const sameTenantAttempt = await probe.query(
      `SELECT id FROM my_ideas WHERE id = $1 AND organization_id = $2`,
      [resultA.id, orgA]
    );
    expect(sameTenantAttempt.rows).toHaveLength(1);
  });

  // =====================================================================
  // Matrix state 10 — connection release: the pinned client is returned to
  // the app's pool on EVERY path, success and failure alike.
  //
  // WHY POOL EXHAUSTION, NOT A `pg_stat_activity` COUNT. An earlier version
  // of this test counted live backend connections before/after a batch and
  // asserted the count stayed roughly flat. That measured the wrong thing:
  // `pg.Pool` deliberately KEEPS idle connections open (up to `max`) for
  // reuse rather than closing them immediately, so a healthy, LEAK-FREE run
  // under concurrent load also grows the live-connection count toward
  // `max` — indistinguishable from a leak by count alone, and it flaked
  // exactly that way in practice (real measured counts: 11–13, unrelated to
  // whether client.release() ran). Pool EXHAUSTION is the real, unambiguous
  // signal: this file sets `DB_POOL_SIZE=3` (see top of file) precisely so
  // that a `client.release()` skipped on ANY path — success or any of the
  // four injected failures — leaves that ONE connection permanently
  // checked out. Run enough TRULY SEQUENTIAL operations (each `await`ed
  // before the next starts, so at most one connection is ever needed
  // concurrently) to exceed the pool size several times over: with proper
  // release, all of them complete quickly on 1 reused connection; with a
  // leak anywhere, the pool exhausts after 3 operations and the 4th's
  // `pool.connect()` hangs waiting for a connection nothing will ever
  // return — a real, observable hang, not a simulated one. Bounded by a
  // hard timeout so a leak fails the test instead of hanging the runner
  // forever (same "BOUNDED TIME" principle used by
  // atelierFinancePinnedTransaction.pg.test.ts).
  // =====================================================================
  it(
    '[10/10 connection release] client.release() fires on every success AND failure path — pool of 3 survives 9 sequential ops without exhausting',
    { timeout: 15000 },
    async () => {
      const organizationId = orgFor('release');
      const ops: Array<() => Promise<unknown>> = [];
      for (let i = 0; i < 3; i++) {
        ops.push(() =>
          materializeWorkspaceTarget({
            organizationId,
            actorUserId: userFor('release'),
            target: 'idea',
            title: `release success ${i}`,
            contentMd: 'body',
            summary: 'summary',
            projectId: null,
            sourceDraftId: `draft-release-success-${i}`,
          })
        );
        ops.push(() =>
          materializeWorkspaceTarget({
            organizationId,
            actorUserId: userFor('release'),
            target: 'idea',
            title: `release fail idea ${i}`,
            contentMd: 'body',
            summary: 'summary',
            projectId: null,
            sourceDraftId: FAULT_IDEA_INSERT,
          }).catch(() => undefined)
        );
        ops.push(() =>
          materializeWorkspaceTarget({
            organizationId,
            actorUserId: userFor('release'),
            target: 'idea',
            title: `release fail map ${i}`,
            contentMd: 'body',
            summary: 'summary',
            projectId: null,
            sourceDraftId: `draft-release-fail-map-${i}`,
            preferredTool: FAULT_MAP_INSERT,
          }).catch(() => undefined)
        );
        ops.push(() =>
          materializeWorkspaceTarget({
            organizationId,
            actorUserId: userFor('release'),
            target: 'idea',
            title: `release fail readback ${i}`,
            contentMd: 'body',
            summary: 'summary',
            projectId: null,
            sourceDraftId: `draft-release-fail-readback-${i}`,
            preferredTool: FAULT_MAP_VANISH,
          }).catch(() => undefined)
        );
        ops.push(() =>
          materializeWorkspaceTarget({
            organizationId,
            actorUserId: userFor('release'),
            target: 'idea',
            title: `release fail receipt ${i}`,
            contentMd: 'body',
            summary: 'summary',
            projectId: null,
            sourceDraftId: FAULT_RECEIPT_INSERT,
          }).catch(() => undefined)
        );
      }

      // Genuinely sequential — each factory is invoked (and its promise
      // created/awaited) only after the previous one settles. `ops.push`
      // above stores THUNKS, not started promises, specifically so nothing
      // runs until this loop calls it.
      for (const op of ops) {
        await op();
      }

      // 15 operations against a pool of 3. If this line is reached at all,
      // the pool never exhausted permanently — proving every operation
      // returned its connection. (An exhausting leak would have hung on
      // whichever op first needed a 4th connection, failing this test via
      // its 15s timeout instead of reaching here.) The row counts below are
      // a second, independent check that every one of the 15 sequential
      // calls actually ran to its real conclusion (not silently skipped):
      // exactly the 3 "success" calls persisted, none of the 12
      // fault-injected calls left anything behind.
      expect(await counts(organizationId)).toEqual({ ideas: 3, maps: 3, receipts: 3 });
    }
  );
});
