/**
 * ROI-E007 CLOSEOUT CO-6 / finding F-1 — `benefit_tracking.actual_*` protection on the
 * UPGRADE path.
 *
 * ==========================================================================================
 * WHAT THIS FILE EXISTS TO CATCH (and what the existing suites cannot)
 * ==========================================================================================
 * `benefitTrackingActualProtection.pg.test.ts` (CO-3) proves the FRESH-INSTALL path: point it
 * at a database built by the migration runner and both triggers are there. That suite is green
 * on a database that has the defect this file is about, because the defect is not "the fresh
 * install is broken" — it is "one specific history produces a table with no protection at all":
 *
 *   1. `20260809_finance_v3_e007_03_legacy_actual_protection.sql` wraps the whole
 *      `benefit_tracking` block (protection FUNCTION included) in
 *      `IF to_regclass('public.benefit_tracking') IS NOT NULL THEN ... ELSE RAISE NOTICE`.
 *   2. On a database migrated before `946_benefit_tracking_fresh_install.sql` existed, that
 *      guard took the ELSE branch. `RAISE NOTICE` is not an error, so the runner recorded the
 *      migration as `status = 'success'` — and `migrate.postgres.ts` never re-runs a migration
 *      recorded as success.
 *   3. 946 is applied later and creates the table. Nothing re-evaluates the guard.
 *   4. The table now exists with ZERO triggers and not even the protection function — a
 *      recorded ROI Actual can be silently overwritten with a plain `UPDATE`.
 *
 * The fix is the additive migration
 * `server/migrations/20260822_finance_v3_e007_05_benefit_tracking_protection_reattach.sql`.
 *
 * ==========================================================================================
 * METHOD — THE SUITE RECREATES THE BROKEN STATE AND PROVES IT IS BROKEN FIRST
 * ==========================================================================================
 * A test that only asserts "the triggers are there" cannot distinguish "the fix works" from
 * "this database never had the problem". So this suite, in order:
 *
 *   A. Asserts the table exists (built by the runner — this suite creates no schema of its
 *      own; a hand-rolled fallback is exactly the vacuity CO-3's header warns about).
 *   B. Physically recreates the F-1 state: drops both triggers on EVERY physical instance and
 *      drops the protection function — byte-for-byte the catalog state that the skipped ELSE
 *      branch leaves behind.
 *   C. Proves that state is genuinely unprotected (RED): a confirmed row's `actual_cost_savings`
 *      is overwritten and the row is deleted, both silently. If these ever stop being possible,
 *      the suite FAILS rather than quietly passing — the scenario would no longer be the one it
 *      claims to reproduce.
 *   D. Applies the CO-6 migration from disk and proves the same operations are now rejected
 *      (GREEN), while unprotected columns stay updatable.
 *   E. Applies it a second time and proves there are still exactly two triggers per instance
 *      (no duplicates), with protection still enforced.
 *
 * Every mutation probe follows the CO-4 rule: INSERT and assert `rowCount === 1`, re-read the
 * row out of band and assert it is physically there, and only then attempt the mutation.
 * `UPDATE 0` is not evidence of protection — it is evidence of an empty table.
 * A rejected mutation is additionally re-read: "the statement errored" and "the data survived"
 * are two different claims and both are checked.
 *
 * ==========================================================================================
 * SAFETY
 * ==========================================================================================
 * Step B REMOVES protection for the duration of the suite, so this file refuses to run against
 * anything but a loopback host, on top of the usual `RUN_DB_TESTS=1` + `MOCK_DB=false` gate
 * (without both, the suite reports SKIPPED, never a false green). `afterAll` re-applies the
 * migration unconditionally, so even a mid-suite failure leaves the database protected.
 *
 * HOW TO RUN (your own ephemeral cluster — NEVER demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/benefitTrackingUpgradeProtection.pg.test.ts \
 *     --no-file-parallelism
 *
 * CLEANUP: this suite's own rows only, matched by an id prefix unique to the run. DELETE is the
 * very thing under test, so cleanup captures the live `pg_get_triggerdef` text, drops that one
 * trigger, deletes, and restores the trigger verbatim from the captured definition — never
 * re-typed (same idiom as CO-3's suite).
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** The rejection the protection must raise, in both its UPDATE and DELETE wording. */
const APPEND_ONLY = /append-only.*under ROI-E007 governance/;

const MIGRATION_FILENAME = '20260822_finance_v3_e007_05_benefit_tracking_protection_reattach.sql';

const UPDATE_TRIGGER = 'trg_benefit_tracking_deny_actual_overwrite';
const DELETE_TRIGGER = 'trg_benefit_tracking_deny_delete';
const PROTECTION_FUNCTION = 'benefit_tracking_deny_actual_overwrite';

/** Resolved from this file's location so the suite does not depend on the runner's cwd. */
function migrationSql(): string {
  const repoRoot = path.resolve(__dirname, '../../../../../..');
  const file = path.join(repoRoot, 'server', 'migrations', MIGRATION_FILENAME);
  if (!fs.existsSync(file)) {
    throw new Error(
      `ROI-E007 CO-6: migration ${MIGRATION_FILENAME} not found at ${file} — this suite proves that file's behaviour and cannot run without it`
    );
  }
  return fs.readFileSync(file, 'utf-8');
}

function assertLoopbackTarget(connectionString: string): void {
  const host = new URL(connectionString).hostname;
  if (!['127.0.0.1', 'localhost', '::1', ''].includes(host)) {
    throw new Error(
      `ROI-E007 CO-6: this suite temporarily REMOVES the actual_* protection to reproduce finding F-1 and therefore refuses to run against a non-loopback host (got "${host}"). Point it at your own ephemeral cluster.`
    );
  }
}

describe.skipIf(!REAL_PG)(
  'ROI-E007 CO-6 (F-1) — benefit_tracking actual_* protection survives the UPGRADE path',
  () => {
    let raw: pg.Client;

    const runId = randomUUID();
    const redRowId = `bt-co6-red-${runId}`;
    const greenRowId = `bt-co6-green-${runId}`;
    const idempotenceRowId = `bt-co6-again-${runId}`;
    const orgId = `org-co6-${runId}`;
    const initiativeId = `init-co6-${runId}`;

    /** Physical instances of `benefit_tracking`, whatever schema they live in. */
    async function benefitTrackingInstances(): Promise<string[]> {
      const res = await raw.query<{ nspname: string }>(
        `SELECT n.nspname
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'r' AND c.relname = 'benefit_tracking'
          ORDER BY n.nspname`
      );
      return res.rows.map((r) => r.nspname);
    }

    async function triggerNamesOn(schema: string): Promise<string[]> {
      const res = await raw.query<{ tgname: string }>(
        `SELECT t.tgname
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE NOT t.tgisinternal AND n.nspname = $1 AND c.relname = 'benefit_tracking'
          ORDER BY t.tgname`,
        [schema]
      );
      return res.rows.map((r) => r.tgname);
    }

    async function protectionFunctionExists(): Promise<boolean> {
      const res = await raw.query<{ exists: boolean }>(
        `SELECT to_regprocedure('public.${PROTECTION_FUNCTION}()') IS NOT NULL AS exists`
      );
      return res.rows[0]?.exists === true;
    }

    /** INSERT + confirmed read-back. Returns the stored actual_cost_savings. */
    async function insertConfirmedRow(id: string, actualCostSavings: number): Promise<number> {
      const inserted = await raw.query(
        `INSERT INTO public.benefit_tracking
           (id, initiative_id, organization_id, period_start, period_end,
            planned_cost_savings, actual_cost_savings, actual_revenue_increase,
            actual_productivity_gains, overall_variance_percent)
         VALUES ($1, $2, $3, now(), now(), 1000, $4, 300, 150, 5)`,
        [id, initiativeId, orgId, actualCostSavings]
      );
      // A FOR EACH ROW trigger needs a row. A silently rejected fixture would make every
      // protection assertion below vacuous, so this is an assertion, not setup.
      expect(inserted.rowCount).toBe(1);

      const stored = await readActuals(id);
      expect(stored).not.toBeNull();
      expect(stored?.actual_cost_savings).toBe(actualCostSavings);
      return stored!.actual_cost_savings;
    }

    async function readActuals(id: string): Promise<{
      actual_cost_savings: number;
      actual_revenue_increase: number;
      actual_productivity_gains: number;
      planned_cost_savings: number;
      overall_variance_percent: number | null;
    } | null> {
      const res = await raw.query(
        `SELECT actual_cost_savings, actual_revenue_increase, actual_productivity_gains,
                planned_cost_savings, overall_variance_percent
           FROM public.benefit_tracking WHERE id = $1`,
        [id]
      );
      return (res.rows[0] as any) ?? null;
    }

    async function applyCo6Migration(): Promise<void> {
      await raw.query(migrationSql());
    }

    beforeAll(async () => {
      assertLoopbackTarget(CONNECTION_STRING);
      raw = new pg.Client({ connectionString: CONNECTION_STRING });
      await raw.connect();
      // Hostile on purpose: `v8` first. Nothing here may depend on search_path resolution
      // order — the protection must be a property of the data, not of a session variable.
      await raw.query('SET search_path TO v8, public');
    });

    afterAll(async () => {
      if (!raw) return;
      try {
        // Leave the database protected no matter how the suite ended.
        await applyCo6Migration();

        // Remove this run's rows. DELETE is blocked by the very trigger under test, so the
        // trigger definition is captured from the catalog, dropped, and restored verbatim.
        const def = await raw.query<{ def: string }>(
          `SELECT pg_get_triggerdef(t.oid) AS def
             FROM pg_trigger t
             JOIN pg_class c ON c.oid = t.tgrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE NOT t.tgisinternal AND n.nspname = 'public'
              AND c.relname = 'benefit_tracking' AND t.tgname = $1`,
          [DELETE_TRIGGER]
        );
        const capturedDef = def.rows[0]?.def;
        if (capturedDef) {
          await raw.query(`DROP TRIGGER ${DELETE_TRIGGER} ON public.benefit_tracking`);
          try {
            await raw.query(`DELETE FROM public.benefit_tracking WHERE id = ANY($1::text[])`, [
              [redRowId, greenRowId, idempotenceRowId],
            ]);
          } finally {
            await raw.query(capturedDef);
          }
        }
      } finally {
        await raw.end();
      }
    });

    // ======================================================================================
    // A. Preconditions — the suite must be pointed at a runner-built database.
    // ======================================================================================
    describe('A. preconditions', () => {
      it('benefit_tracking exists, built by the migration runner (not by this suite)', async () => {
        const instances = await benefitTrackingInstances();
        expect(instances).toContain('public');
      });

      it('946_benefit_tracking_fresh_install.sql and the 20260809 protection are both recorded applied', async () => {
        const res = await raw.query<{ filename: string; status: string }>(
          `SELECT filename, status FROM public.schema_migrations
            WHERE filename IN ($1, $2)`,
          [
            '946_benefit_tracking_fresh_install.sql',
            '20260809_finance_v3_e007_03_legacy_actual_protection.sql',
          ]
        );
        const byName = new Map(res.rows.map((r) => [r.filename, r.status]));
        expect(byName.get('946_benefit_tracking_fresh_install.sql')).toBe('success');
        expect(byName.get('20260809_finance_v3_e007_03_legacy_actual_protection.sql')).toBe(
          'success'
        );
      });
    });

    // ======================================================================================
    // B + C. Reproduce finding F-1 and prove the reproduction is genuinely unprotected.
    // ======================================================================================
    describe('B/C. the F-1 state is real: table present, protection absent, overwrite silent', () => {
      it('recreates the catalog state left by the skipped ELSE branch (no triggers, no function)', async () => {
        for (const schema of await benefitTrackingInstances()) {
          await raw.query(`DROP TRIGGER IF EXISTS ${UPDATE_TRIGGER} ON "${schema}".benefit_tracking`);
          await raw.query(`DROP TRIGGER IF EXISTS ${DELETE_TRIGGER} ON "${schema}".benefit_tracking`);
        }
        await raw.query(`DROP FUNCTION IF EXISTS public.${PROTECTION_FUNCTION}()`);

        for (const schema of await benefitTrackingInstances()) {
          expect(await triggerNamesOn(schema)).toEqual([]);
        }
        expect(await protectionFunctionExists()).toBe(false);
      });

      it('RED: a recorded actual_cost_savings is silently overwritten', async () => {
        await insertConfirmedRow(redRowId, 4200);

        const updated = await raw.query(
          `UPDATE public.benefit_tracking SET actual_cost_savings = 9999999 WHERE id = $1`,
          [redRowId]
        );
        expect(updated.rowCount).toBe(1); // no exception, no protection

        const after = await readActuals(redRowId);
        expect(after?.actual_cost_savings).toBe(9999999);
      });

      it('RED: the row can be deleted outright, destroying its actual_* history', async () => {
        const deleted = await raw.query(`DELETE FROM public.benefit_tracking WHERE id = $1`, [
          redRowId,
        ]);
        expect(deleted.rowCount).toBe(1);
        expect(await readActuals(redRowId)).toBeNull();
      });
    });

    // ======================================================================================
    // D. The CO-6 migration closes it.
    // ======================================================================================
    describe('D. after the CO-6 migration', () => {
      it('applies cleanly and recreates the protection function it found missing', async () => {
        await applyCo6Migration();
        expect(await protectionFunctionExists()).toBe(true);
      });

      it('attaches both triggers to EVERY physical instance of benefit_tracking', async () => {
        const instances = await benefitTrackingInstances();
        expect(instances.length).toBeGreaterThan(0);
        for (const schema of instances) {
          expect(await triggerNamesOn(schema)).toEqual([UPDATE_TRIGGER, DELETE_TRIGGER].sort());
        }
      });

      it('rejects an UPDATE of actual_cost_savings and leaves the stored value untouched', async () => {
        await insertConfirmedRow(greenRowId, 4200);

        await expect(
          raw.query(`UPDATE public.benefit_tracking SET actual_cost_savings = 9999999 WHERE id = $1`, [
            greenRowId,
          ])
        ).rejects.toThrow(APPEND_ONLY);

        const after = await readActuals(greenRowId);
        expect(after?.actual_cost_savings).toBe(4200);
      });

      it('rejects an UPDATE of actual_revenue_increase and actual_productivity_gains too', async () => {
        await expect(
          raw.query(
            `UPDATE public.benefit_tracking SET actual_revenue_increase = 88888 WHERE id = $1`,
            [greenRowId]
          )
        ).rejects.toThrow(APPEND_ONLY);
        await expect(
          raw.query(
            `UPDATE public.benefit_tracking SET actual_productivity_gains = 77777 WHERE id = $1`,
            [greenRowId]
          )
        ).rejects.toThrow(APPEND_ONLY);

        const after = await readActuals(greenRowId);
        expect(after?.actual_revenue_increase).toBe(300);
        expect(after?.actual_productivity_gains).toBe(150);
      });

      it('rejects a DELETE and the row survives', async () => {
        await expect(
          raw.query(`DELETE FROM public.benefit_tracking WHERE id = $1`, [greenRowId])
        ).rejects.toThrow(APPEND_ONLY);

        const after = await readActuals(greenRowId);
        expect(after).not.toBeNull();
        expect(after?.actual_cost_savings).toBe(4200);
      });

      it('still allows the ordinary workflow columns (planned_*, overall_variance_percent) to move', async () => {
        const updated = await raw.query(
          `UPDATE public.benefit_tracking
              SET planned_cost_savings = 7777, overall_variance_percent = 42,
                  verification_status = 'verified'
            WHERE id = $1`,
          [greenRowId]
        );
        expect(updated.rowCount).toBe(1);

        const after = await readActuals(greenRowId);
        expect(after?.planned_cost_savings).toBe(7777);
        expect(after?.overall_variance_percent).toBe(42);
        // …and the protected columns did not move with them.
        expect(after?.actual_cost_savings).toBe(4200);
      });

      it('an UPDATE that leaves actual_* at their current values is not blocked (no false positive)', async () => {
        const updated = await raw.query(
          `UPDATE public.benefit_tracking
              SET actual_cost_savings = 4200, variance_notes = 'unchanged actual, notes edited'
            WHERE id = $1`,
          [greenRowId]
        );
        expect(updated.rowCount).toBe(1);
      });
    });

    // ======================================================================================
    // E. Idempotence — re-running must replace, never duplicate.
    // ======================================================================================
    describe('E. idempotence', () => {
      it('a second application leaves exactly two triggers per instance', async () => {
        await applyCo6Migration();
        await applyCo6Migration();
        for (const schema of await benefitTrackingInstances()) {
          expect(await triggerNamesOn(schema)).toEqual([UPDATE_TRIGGER, DELETE_TRIGGER].sort());
        }
      });

      it('protection is still enforced after the repeated runs', async () => {
        await insertConfirmedRow(idempotenceRowId, 1234);
        await expect(
          raw.query(`UPDATE public.benefit_tracking SET actual_cost_savings = 4321 WHERE id = $1`, [
            idempotenceRowId,
          ])
        ).rejects.toThrow(APPEND_ONLY);
        expect((await readActuals(idempotenceRowId))?.actual_cost_savings).toBe(1234);
      });
    });

    // ======================================================================================
    // F. The other two ROI Actual stores were checked, not assumed (task item 2).
    //
    // They cannot be in the F-1 state: their trigger DDL in 20260809 is UNGUARDED, so a missing
    // table would have made that migration raise and be recorded failed/skipped — and the
    // runner re-runs anything not recorded 'success'. "Recorded success" therefore proves both
    // tables existed at that moment. This block asserts the resulting invariant on the live
    // catalog rather than trusting the argument.
    // ======================================================================================
    describe('F. sibling ROI Actual stores', () => {
      it('every physical instance of roi_realized_values / v8_roi_realization_entries carries both deny triggers', async () => {
        const instances = await raw.query<{ nspname: string; relname: string }>(
          `SELECT n.nspname, c.relname
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r'
              AND c.relname IN ('roi_realized_values', 'v8_roi_realization_entries')
              AND n.nspname IN ('public', 'v8')
            ORDER BY 1, 2`
        );
        expect(instances.rows.length).toBeGreaterThan(0);

        for (const inst of instances.rows) {
          const triggers = await raw.query<{ tgname: string }>(
            `SELECT t.tgname
               FROM pg_trigger t
               JOIN pg_class c ON c.oid = t.tgrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE NOT t.tgisinternal AND n.nspname = $1 AND c.relname = $2
                AND t.tgname LIKE '%\\_deny\\_%'
              ORDER BY t.tgname`,
            [inst.nspname, inst.relname]
          );
          expect(
            triggers.rows.map((r) => r.tgname),
            `${inst.nspname}.${inst.relname} must carry both append-only deny triggers`
          ).toHaveLength(2);
        }
      });
    });
  }
);
