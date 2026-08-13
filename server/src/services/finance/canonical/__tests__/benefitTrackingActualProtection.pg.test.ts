/**
 * ROI-E007 closeout CO-3 — `benefit_tracking.actual_*` append-only protection,
 * proved on a PHYSICALLY EXISTING ROW of a MIGRATION-BUILT table.
 *
 * WHY A SEPARATE SUITE FROM `roiFinanceReconciliationAdapter.pg.test.ts`
 * --------------------------------------------------------------------
 * That suite proves the ENDPOINT behaves correctly around the trigger, but it
 * cannot prove the schema gap this file exists to close: its `beforeAll`
 * creates `benefit_tracking` itself when the table is absent, and then applies
 * the protection migration by hand off disk. It therefore stays green whether
 * or not the migration runner produces the table — which is exactly how the
 * ROI-E007 fan-in verification report ended up recording point 6c as
 * EVIDENCE_MISSING (the table was absent on a strict fresh install, the
 * protection migration's `to_regclass()` guard took its ELSE branch, and the
 * triggers were never created).
 *
 * This suite asserts the opposite direction: the database it is pointed at
 * must already carry the table and both triggers, produced by the normal
 * migration path (`server/migrations/946_benefit_tracking_fresh_install.sql`
 * in phase 0, then
 * `server/migrations/20260809_finance_v3_e007_03_legacy_actual_protection.sql`
 * in phase 1). It creates NO schema of its own — a hand-rolled fallback would
 * reintroduce precisely the vacuity it is here to prevent.
 *
 * THE ROW MATTERS. Both triggers are `FOR EACH ROW`: with no row, an `UPDATE`
 * affects nothing, reports `UPDATE 0`, and never fires the trigger. A test
 * that skips the INSERT (or whose INSERT is silently rejected, e.g. by a FK)
 * would read that `UPDATE 0` as "the write was blocked" and pass on a
 * completely unprotected table. Every protection assertion below is therefore
 * preceded by an explicit re-read confirming the row is physically present
 * with its recorded value.
 *
 * HOW TO RUN (your own ephemeral cluster — NEVER demo/staging/prod):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/benefitTrackingActualProtection.pg.test.ts \
 *     --no-file-parallelism
 *
 * Without both `RUN_DB_TESTS=1` and `MOCK_DB=false` the whole suite reports
 * SKIPPED rather than a false green.
 *
 * CLEANUP: this suite's own rows only, matched by an id prefix unique to the
 * run. The DELETE guard is the very thing under test, so cleanup captures the
 * live `pg_get_triggerdef` text, drops that one trigger, deletes, and restores
 * the trigger verbatim from the captured definition — never re-typed.
 */
import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const PROTECTED_COLUMNS = [
  'actual_cost_savings',
  'actual_revenue_increase',
  'actual_productivity_gains',
] as const;

describe.skipIf(!REAL_PG)(
  'ROI-E007 CO-3 — benefit_tracking actual_* protection on a migration-built table',
  () => {
    let raw: pg.Client;
    const runId = randomUUID();
    const rowId = `bt-co3-${runId}`;

    /** Re-reads the row out of band and fails loudly if it is not there. The
     * return value is the currently stored actual_*, so each protection
     * assertion can compare against what the table really holds. */
    async function readRowOrFail(): Promise<Record<string, number>> {
      const res = await raw.query(
        `SELECT actual_cost_savings, actual_revenue_increase, actual_productivity_gains
           FROM benefit_tracking WHERE id = $1`,
        [rowId]
      );
      expect(
        res.rowCount,
        'the probe row must be physically present — without it the FOR EACH ROW trigger never ' +
          'fires and a rejected-looking "UPDATE 0" would be a false proof'
      ).toBe(1);
      return res.rows[0];
    }

    beforeAll(async () => {
      raw = new pg.Client({ connectionString: CONNECTION_STRING });
      await raw.connect();

      await raw.query(
        `INSERT INTO benefit_tracking (
           id, financial_id, initiative_id, organization_id,
           period_start, period_end, tracking_period,
           planned_cost_savings, actual_cost_savings, actual_revenue_increase,
           actual_productivity_gains, overall_variance_percent, created_by
         ) VALUES ($1, NULL, $2, $3, now(), now(), '2026-Q1', 100000, 250000, 30000, 12.5, 150, $4)`,
        [rowId, `init-co3-${runId}`, `org-co3-${runId}`, `user-co3-${runId}`]
      );
    });

    afterAll(async () => {
      if (!raw) return;
      const def = await raw.query<{ def: string }>(
        `SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger
          WHERE tgrelid = 'public.benefit_tracking'::regclass
            AND tgname = 'trg_benefit_tracking_deny_delete'`
      );
      const triggerDef = def.rows[0]?.def;
      if (triggerDef) {
        await raw.query('DROP TRIGGER trg_benefit_tracking_deny_delete ON benefit_tracking');
      }
      try {
        await raw.query('DELETE FROM benefit_tracking WHERE id = $1', [rowId]);
      } finally {
        if (triggerDef) await raw.query(triggerDef);
        await raw.end();
      }
    });

    describe('schema — produced by the migration runner, not by this suite', () => {
      it('benefit_tracking exists (946_benefit_tracking_fresh_install.sql ran)', async () => {
        const res = await raw.query<{ reg: string | null }>(
          `SELECT to_regclass('public.benefit_tracking')::text AS reg`
        );
        expect(
          res.rows[0]?.reg,
          'benefit_tracking is missing — 067 is excluded by isSqliteOnlyMigration() and ' +
            '946_benefit_tracking_fresh_install.sql is what replaces it on a strict fresh install'
        ).toBe('benefit_tracking');
      });

      it('946_benefit_tracking_fresh_install.sql is recorded success', async () => {
        const hasLedger = await raw.query<{ reg: string | null }>(
          `SELECT to_regclass('public.schema_migrations')::text AS reg`
        );
        // A hand-built scratch database has no ledger; there is nothing to
        // assert there and pretending otherwise would be theatre.
        if (!hasLedger.rows[0]?.reg) return;

        const res = await raw.query<{ status: string }>(
          `SELECT status FROM schema_migrations WHERE filename = $1`,
          ['946_benefit_tracking_fresh_install.sql']
        );
        expect(res.rows[0]?.status).toBe('success');
      });

      it('both protection triggers are attached to the table', async () => {
        const res = await raw.query<{ tgname: string }>(
          `SELECT tgname FROM pg_trigger
            WHERE tgrelid = 'public.benefit_tracking'::regclass AND NOT tgisinternal
            ORDER BY tgname`
        );
        const names = res.rows.map((r) => r.tgname);
        expect(names).toContain('trg_benefit_tracking_deny_actual_overwrite');
        expect(names).toContain('trg_benefit_tracking_deny_delete');
      });
    });

    describe('protection — column-scoped, on a row that exists', () => {
      it.each(PROTECTED_COLUMNS)(
        'rejects an UPDATE that changes %s, leaving the recorded value intact',
        async (column) => {
          const before = await readRowOrFail();

          await expect(
            raw.query(`UPDATE benefit_tracking SET ${column} = 999999 WHERE id = $1`, [rowId])
          ).rejects.toThrow(/append-only under ROI-E007 governance/);

          const after = await readRowOrFail();
          expect(after[column]).toBe(before[column]);
        }
      );

      it('rejects a DELETE, leaving the row in place', async () => {
        await readRowOrFail();

        await expect(
          raw.query('DELETE FROM benefit_tracking WHERE id = $1', [rowId])
        ).rejects.toThrow(/DELETE not permitted/);

        await readRowOrFail();
      });

      it('treats a same-value write of actual_* as a no-op, not a violation', async () => {
        const before = await readRowOrFail();

        // The trigger's own IS DISTINCT FROM semantics — this is the path
        // PUT /benefits takes when the caller re-sends an unchanged actual.
        await raw.query(
          `UPDATE benefit_tracking
              SET actual_cost_savings = $2, planned_cost_savings = 111111
            WHERE id = $1`,
          [rowId, before.actual_cost_savings]
        );

        const after = await readRowOrFail();
        expect(after.actual_cost_savings).toBe(before.actual_cost_savings);
      });
    });

    describe('the guard is not a blanket deny — the ordinary workflow still saves', () => {
      it('updates planned_* / overall_variance_percent (what PUT /benefits writes)', async () => {
        await readRowOrFail();

        await raw.query(
          `UPDATE benefit_tracking
              SET planned_cost_savings = 175000, overall_variance_percent = 42.75, updated_at = now()
            WHERE id = $1`,
          [rowId]
        );

        const res = await raw.query(
          `SELECT planned_cost_savings, overall_variance_percent FROM benefit_tracking WHERE id = $1`,
          [rowId]
        );
        expect(res.rows[0].planned_cost_savings).toBe(175000);
        expect(res.rows[0].overall_variance_percent).toBeCloseTo(42.75, 2);
      });

      it('updates the verification columns the migration promises stay writable', async () => {
        await readRowOrFail();

        await raw.query(
          `UPDATE benefit_tracking
              SET verification_status = 'verified', verified_by = $2, verified_at = now(),
                  variance_notes = 'CO-3 closeout regression', achievements = '[]', challenges = '[]',
                  planned_revenue_increase = 5, planned_productivity_gains = 6
            WHERE id = $1`,
          [rowId, `user-co3-${runId}`]
        );

        const res = await raw.query(
          `SELECT verification_status, verified_by, variance_notes FROM benefit_tracking WHERE id = $1`,
          [rowId]
        );
        expect(res.rows[0].verification_status).toBe('verified');
        expect(res.rows[0].variance_notes).toBe('CO-3 closeout regression');

        // …and the protected values are still what they were at INSERT.
        const actuals = await readRowOrFail();
        expect(actuals.actual_cost_savings).toBe(250000);
        expect(actuals.actual_revenue_increase).toBe(30000);
        expect(actuals.actual_productivity_gains).toBeCloseTo(12.5, 2);
      });
    });
  }
);
