/**
 * M01-P07C — schema guard negative control, on a REAL PostgreSQL.
 *
 * WHY THIS IS A SEPARATE FILE. `canvasMaterialize.ts::assertCanvasIdeaReceiptSchema`
 * memoizes a resolved promise the first time it successfully confirms
 * `canvas_idea_materialization_receipts` exists — a deliberate, documented
 * self-healing-only-on-failure design (see that function's own comment).
 * `canvasIdeaMaterializeAtomicity.p07c.pg.test.ts` calls
 * `materializeWorkspaceTarget` successfully in its very first test, which
 * caches that memoized promise for the rest of THAT file's module
 * lifetime — dropping the table afterward would no longer exercise the
 * assertion path, only a raw, uninteresting "relation does not exist" from
 * whatever statement happens to run first. This file gets its own fresh
 * module registry (vitest isolates per test file by default), so
 * `assertCanvasIdeaReceiptSchema` has never run when its one test starts.
 *
 * WHAT THIS PROVES (P07C coordinator review, follow-up item 5): the receipt
 * table and its indexes are now created EXCLUSIVELY by
 * `server/migrations/944_canvas_idea_materialization_receipts.sql` —
 * `canvasMaterialize.ts` no longer contains a `CREATE TABLE`/`CREATE INDEX`
 * fallback. If that migration is skipped (a fresh environment, a partial
 * deploy, a rollback), idea materialization must fail LOUDLY and
 * immediately — not silently self-heal by creating the table at runtime
 * (which would make the gap invisible to any schema-parity check reading
 * the migrations directory) and not fail with some unrelated, confusing
 * error several statements deep inside an open transaction.
 *
 * HOW TO RUN (repo root, same env as the atomicity suite):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:<port>/<db> \
 *   npx vitest run server/src/services/__tests__/canvasIdeaMaterializeSchemaGuard.p07c.pg.test.ts \
 *     --no-file-parallelism
 *
 * The table is dropped and RE-CREATED (by replaying the migration file
 * verbatim) inside this file's own `it()`, in a `try/finally`, so running
 * this file does not leave the shared test database missing the table for
 * any other file/run.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

process.env.DB_MANAGED_SCHEMA = process.env.DB_MANAGED_SCHEMA ?? 'false';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
// See canvasIdeaMaterializeAtomicity.p07c.pg.test.ts's REAL_DB_REQUESTED
// comment for why this deliberately does not gate on DB_TYPE.
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
    '[M01-P07C] SKIPPING canvasIdeaMaterializeSchemaGuard.p07c.pg.test.ts — real Postgres not ' +
      'requested/reachable (need RUN_DB_TESTS=1 NODE_ENV=test MOCK_DB=false DATABASE_URL=postgresql://...).'
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../migrations/944_canvas_idea_materialization_receipts.sql'
);

describe.runIf(REACHABLE)('M01-P07C — receipt schema guard (real PG, migration-only)', () => {
  it('fails loudly (does not silently create the table) when the 944 migration was never applied', async () => {
    const probe = new Pool({ connectionString: CONNECTION_STRING, max: 2 });
    try {
      // Sanity precondition — this test is only meaningful starting from a
      // database that DOES have the table (i.e. the migration ran as part
      // of this worktree's normal test-setup). If it's already missing for
      // some other reason, that is a setup problem this test should not
      // paper over.
      const before = await probe.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'canvas_idea_materialization_receipts'`
      );
      expect(before.rows.length).toBe(1);

      await probe.query('DROP TABLE IF EXISTS canvas_idea_materialization_receipts CASCADE');

      const { materializeWorkspaceTarget } = await import('../canvasMaterialize.js');

      let caught: unknown = null;
      try {
        await materializeWorkspaceTarget({
          organizationId: 'p07c-schema-guard-org',
          actorUserId: 'p07c-schema-guard-user',
          target: 'idea',
          title: 'Should never be created — table is missing',
          contentMd: 'body',
          summary: 'summary',
          projectId: null,
          sourceDraftId: 'draft-schema-guard',
        });
      } catch (err) {
        caught = err;
      }

      // Fails — does not silently succeed.
      expect(caught).not.toBeNull();
      expect(String((caught as Error)?.message ?? caught)).toMatch(
        /canvas_idea_materialization_receipts|does not exist|relation/i
      );

      // No silent auto-create: the table must still be absent.
      const after = await probe.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'canvas_idea_materialization_receipts'`
      );
      expect(after.rows.length).toBe(0);
    } finally {
      // Restore — replay the migration verbatim so the shared test
      // database is left exactly as any other file/run expects it.
      const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');
      await probe.query(migrationSql);
      const restored = await probe.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'canvas_idea_materialization_receipts'`
      );
      if (restored.rows.length !== 1) {
        // eslint-disable-next-line no-console
        console.error(
          '[M01-P07C] FAILED TO RESTORE canvas_idea_materialization_receipts after schema-guard test — ' +
            `re-run: psql ${CONNECTION_STRING} -f ${MIGRATION_PATH}`
        );
      }
      await probe.end();
    }
  });
});
