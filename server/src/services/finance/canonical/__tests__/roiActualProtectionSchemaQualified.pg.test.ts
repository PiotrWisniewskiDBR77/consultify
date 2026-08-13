/**
 * ROI-E007 CLOSEOUT CO-4 — the "ROI Actual cannot be silently overwritten"
 * guarantee, proved against EVERY PHYSICAL INSTANCE of the protected stores.
 *
 * WHAT THIS FILE EXISTS TO CATCH (finding F-1,
 * docs/validation/finance-v3/generated/gate-d/ROI_E007_FANIN_VERIFICATION_report.md):
 * `20260809_finance_v3_e007_03_legacy_actual_protection.sql` attaches its
 * triggers with UNQUALIFIED identifiers. This database physically contains TWO
 * copies of the KPI-scoped ROI Actual table —
 * `public.v8_roi_realization_entries` (20260323_v8_results_roi.sql) and
 * `v8.v8_roi_realization_entries` (20260719_baseline_gap.sql) — so the
 * unqualified DDL resolved to `public` and left the `v8.` twin bare. Against a
 * database migrated WITHOUT
 * `20260810_finance_v3_e007_04_actual_protection_schema_qualified.sql`, the
 * `v8.`-twin cases in this file are RED: the overwrite goes through, `UPDATE 1`,
 * no exception. With that migration applied they are GREEN.
 *
 * ------------------------------------------------------------------------
 * NON-NEGOTIABLE METHOD: CONFIRMED FIXTURE ROWS BEFORE EVERY TRIGGER PROBE
 * ------------------------------------------------------------------------
 * The fan-in verification's first pass at this reported `UPDATE 0` on every
 * store and looked like a PASS. It was not. The fixture INSERTs had been
 * rejected by a foreign key (`kpi_id` -> `v8_kpi_definitions`, per schema),
 * so there was no row for a FOR EACH ROW trigger to fire on. **`UPDATE 0` is
 * not evidence of protection — it is evidence of an empty table.**
 *
 * Therefore every probe in this file follows the same three-step shape, and
 * the first two steps are assertions, not setup:
 *   1. INSERT the fixture and assert `rowCount === 1`.
 *   2. SELECT it back out-of-band and assert the row EXISTS with the expected
 *      value — the trigger has something to fire on.
 *   3. Only then attempt the UPDATE / DELETE and require a rejection, and
 *      re-read out-of-band to prove the stored value/row count did not move.
 *
 * A rejected mutation is also asserted to leave the value untouched; "the
 * statement errored" and "the data survived" are two different claims and both
 * are checked.
 *
 * SCOPE: `public.v8_roi_realization_entries`, `v8.v8_roi_realization_entries`,
 * `public.roi_realized_values`. `benefit_tracking` is deliberately NOT covered
 * here — its protection is column-scoped rather than table-wide and is owned by
 * a separate, parallel closeout work package
 * (`roiFinanceReconciliationAdapter.pg.test.ts` already exercises that route).
 * On a fresh/strict install `benefit_tracking` does not exist at all, because
 * its producer (067_economics_initiative_integration.sql) is excluded by
 * migrate.postgres.ts's `isSqliteOnlyMigration()` blanket <500 rule.
 *
 * A raw `pg.Client` is used rather than the app's pooled helpers, deliberately:
 * the pool issues `SET search_path TO public, v8`, which is exactly the session
 * setting whose influence this file must be independent of. Every statement
 * here names its schema explicitly. Autocommit (no explicit BEGIN) so a
 * rejected statement fails alone instead of poisoning a transaction for the
 * next probe. Same env-var contract as this repo's other `.pg.test.ts` suites
 * (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`),
 * `describe.skipIf`-gated so a run with no reachable Postgres reports SKIPPED,
 * never a false green.
 *
 * HOW TO RUN (against your own throwaway/ephemeral cluster — NEVER against the
 * shared local Postgres or any demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/roiActualProtectionSchemaQualified.pg.test.ts \
 *     --no-file-parallelism
 *
 * CLEANUP: none, by design. Every row this file writes lands in a store whose
 * whole point is that it cannot be UPDATEd or DELETEd, so `afterAll` cannot tidy
 * up without defeating the thing under test. Ids are `randomUUID()`-suffixed so
 * repeated runs never collide, and the suite is meant for an ephemeral cluster
 * that is dropped afterwards — the same stance `canonicalServices.pg.test.ts`
 * documents for its own append-only tables.
 */
import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** The rejection every protected store must raise. */
const APPEND_ONLY = /append-only under ROI-E007 governance/;

describe.skipIf(!REAL_PG)('ROI-E007 CO-4 — ROI Actual protection on every physical instance', () => {
  let raw: pg.Client;

  const orgId = `org-roi-e007-co4-${randomUUID()}`;
  const initiativeId = `init-roi-e007-co4-${randomUUID()}`;

  beforeAll(async () => {
    raw = new pg.Client({ connectionString: CONNECTION_STRING });
    await raw.connect();

    // Deliberately hostile search_path: `v8` FIRST. Nothing in this file may
    // depend on resolution order — every statement is schema-qualified. If a
    // probe passes only because `public` happened to be resolved first, this
    // ordering exposes it.
    await raw.query('SET search_path TO v8, public');

    await raw.query(`INSERT INTO public.organizations (id, name) VALUES ($1, $2)`, [
      orgId,
      'ROI-E007 CO-4 Protection Org',
    ]);
    await raw.query(
      `INSERT INTO public.initiatives (id, organization_id, status, name) VALUES ($1, $2, 'DRAFT', $3)`,
      [initiativeId, orgId, 'ROI-E007 CO-4 Protection Initiative']
    );
  });

  afterAll(async () => {
    await raw?.end();
  });

  // ==========================================================================
  // Structural: the protection must exist on EVERY physical instance.
  // This is the assertion that fails loudest if a future migration creates a
  // third copy of the table in yet another schema.
  // ==========================================================================
  describe('trigger coverage across schemas', () => {
    it('every physical v8_roi_realization_entries instance carries both deny triggers', async () => {
      const instances = await raw.query<{ table_schema: string }>(
        `SELECT table_schema FROM information_schema.tables
          WHERE table_name = 'v8_roi_realization_entries' ORDER BY table_schema`
      );
      const schemas = instances.rows.map((r) => r.table_schema);

      // The twin is the entire point of this suite; if it is gone, the suite is
      // no longer testing what its name claims and must say so rather than pass.
      expect(schemas).toEqual(expect.arrayContaining(['public', 'v8']));

      for (const schema of schemas) {
        const triggers = await raw.query<{ tgname: string }>(
          `SELECT t.tgname
             FROM pg_trigger t
             JOIN pg_class c ON c.oid = t.tgrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE NOT t.tgisinternal
              AND n.nspname = $1
              AND c.relname = 'v8_roi_realization_entries'
            ORDER BY t.tgname`,
          [schema]
        );
        const names = triggers.rows.map((r) => r.tgname);
        expect(
          names,
          `${schema}.v8_roi_realization_entries is missing append-only protection (found: ${names.join(', ') || 'none'})`
        ).toEqual(
          expect.arrayContaining([
            'trg_v8_roi_realization_entries_deny_delete',
            'trg_v8_roi_realization_entries_deny_update',
          ])
        );
      }
    });

    it('every physical roi_realized_values instance carries both deny triggers', async () => {
      const instances = await raw.query<{ table_schema: string }>(
        `SELECT table_schema FROM information_schema.tables
          WHERE table_name = 'roi_realized_values' ORDER BY table_schema`
      );
      const schemas = instances.rows.map((r) => r.table_schema);
      expect(schemas).toContain('public');

      for (const schema of schemas) {
        const triggers = await raw.query<{ tgname: string }>(
          `SELECT t.tgname
             FROM pg_trigger t
             JOIN pg_class c ON c.oid = t.tgrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE NOT t.tgisinternal
              AND n.nspname = $1
              AND c.relname = 'roi_realized_values'
            ORDER BY t.tgname`,
          [schema]
        );
        const names = triggers.rows.map((r) => r.tgname);
        expect(
          names,
          `${schema}.roi_realized_values is missing append-only protection (found: ${names.join(', ') || 'none'})`
        ).toEqual(
          expect.arrayContaining([
            'trg_roi_realized_values_deny_delete',
            'trg_roi_realized_values_deny_update',
          ])
        );
      }
    });
  });

  // ==========================================================================
  // v8_roi_realization_entries — the SAME behavioural contract asserted against
  // both physical instances. Generated rather than copy-pasted so the two
  // instances cannot silently drift apart in what they are asked to prove.
  // ==========================================================================
  for (const schema of ['public', 'v8'] as const) {
    describe(`${schema}.v8_roi_realization_entries`, () => {
      const kpiId = `kpi-co4-${schema}-${randomUUID()}`;
      const entryId = `entry-co4-${schema}-${randomUUID()}`;
      const ORIGINAL = 500;
      const OVERWRITE = 777777;

      /** Out-of-band read, always schema-qualified. */
      async function readEntry(): Promise<Array<{ realized_value: number }>> {
        const res = await raw.query<{ realized_value: number }>(
          `SELECT realized_value FROM ${schema}.v8_roi_realization_entries WHERE entry_id = $1`,
          [entryId]
        );
        return res.rows;
      }

      it('fixture row is inserted AND confirmed present (a trigger needs a row to fire on)', async () => {
        // The kpi_id FK points at the v8_kpi_definitions copy in the SAME
        // schema. Getting this wrong is precisely how the fan-in probe ended up
        // with an empty table and a misleading `UPDATE 0`.
        const kpiInsert = await raw.query(
          `INSERT INTO ${schema}.v8_kpi_definitions
             (kpi_id, organization_id, name, mode, metric_type, measurement_cadence)
           VALUES ($1, $2, $3, 'standalone', 'currency', 'monthly')`,
          [kpiId, orgId, `CO-4 KPI (${schema})`]
        );
        expect(kpiInsert.rowCount, `FK prerequisite ${schema}.v8_kpi_definitions did not insert`).toBe(1);

        const entryInsert = await raw.query(
          `INSERT INTO ${schema}.v8_roi_realization_entries
             (entry_id, organization_id, kpi_id, realized_value, period)
           VALUES ($1, $2, $3, $4, '2026-Q3')`,
          [entryId, orgId, kpiId, ORIGINAL]
        );
        expect(entryInsert.rowCount, `fixture INSERT into ${schema}.v8_roi_realization_entries failed`).toBe(1);

        // CONFIRMATION — the assertion the fan-in probe was missing.
        const rows = await readEntry();
        expect(rows, `no fixture row in ${schema}.v8_roi_realization_entries — every trigger probe below would be vacuous`).toHaveLength(1);
        expect(rows[0].realized_value).toBe(ORIGINAL);
      });

      it('UPDATE of realized_value is physically rejected, and the stored value does not move', async () => {
        const before = await readEntry();
        expect(before, 'fixture row missing before the UPDATE probe').toHaveLength(1);
        expect(before[0].realized_value).toBe(ORIGINAL);

        await expect(
          raw.query(
            `UPDATE ${schema}.v8_roi_realization_entries SET realized_value = $1 WHERE entry_id = $2`,
            [OVERWRITE, entryId]
          )
        ).rejects.toThrow(APPEND_ONLY);

        const after = await readEntry();
        expect(after).toHaveLength(1);
        expect(
          after[0].realized_value,
          `${schema}.v8_roi_realization_entries was SILENTLY OVERWRITTEN`
        ).toBe(ORIGINAL);
      });

      it('UPDATE that touches no ROI column is rejected too (protection is table-wide, not column-scoped)', async () => {
        const before = await readEntry();
        expect(before, 'fixture row missing before the non-ROI UPDATE probe').toHaveLength(1);

        await expect(
          raw.query(
            `UPDATE ${schema}.v8_roi_realization_entries SET provenance_ref = $1 WHERE entry_id = $2`,
            ['co4-probe', entryId]
          )
        ).rejects.toThrow(APPEND_ONLY);
      });

      it('DELETE is physically rejected, and the row survives', async () => {
        const before = await readEntry();
        expect(before, 'fixture row missing before the DELETE probe').toHaveLength(1);

        await expect(
          raw.query(`DELETE FROM ${schema}.v8_roi_realization_entries WHERE entry_id = $1`, [entryId])
        ).rejects.toThrow(APPEND_ONLY);

        const after = await readEntry();
        expect(after, `${schema}.v8_roi_realization_entries row was DELETED`).toHaveLength(1);
        expect(after[0].realized_value).toBe(ORIGINAL);
      });
    });
  }

  // ==========================================================================
  // roi_realized_values — single physical instance (public), asserted with the
  // same confirmed-fixture discipline.
  // ==========================================================================
  describe('public.roi_realized_values', () => {
    const rowId = `rrv-co4-${randomUUID()}`;
    const ORIGINAL = 1000;
    const OVERWRITE = 999999;

    async function readRow(): Promise<Array<{ realized_savings: number }>> {
      const res = await raw.query<{ realized_savings: number }>(
        `SELECT realized_savings FROM public.roi_realized_values WHERE id = $1`,
        [rowId]
      );
      return res.rows;
    }

    it('fixture row is inserted AND confirmed present', async () => {
      const insert = await raw.query(
        `INSERT INTO public.roi_realized_values
           (id, initiative_id, organization_id, period_month, realized_savings, source)
         VALUES ($1, $2, $3, DATE '2026-07-01', $4, 'manual')`,
        [rowId, initiativeId, orgId, ORIGINAL]
      );
      expect(insert.rowCount, 'fixture INSERT into public.roi_realized_values failed').toBe(1);

      const rows = await readRow();
      expect(rows, 'no fixture row in public.roi_realized_values — every trigger probe below would be vacuous').toHaveLength(1);
      expect(rows[0].realized_savings).toBe(ORIGINAL);
    });

    it('UPDATE of realized_savings is physically rejected, and the stored value does not move', async () => {
      const before = await readRow();
      expect(before, 'fixture row missing before the UPDATE probe').toHaveLength(1);
      expect(before[0].realized_savings).toBe(ORIGINAL);

      await expect(
        raw.query(`UPDATE public.roi_realized_values SET realized_savings = $1 WHERE id = $2`, [
          OVERWRITE,
          rowId,
        ])
      ).rejects.toThrow(APPEND_ONLY);

      const after = await readRow();
      expect(after).toHaveLength(1);
      expect(after[0].realized_savings, 'public.roi_realized_values was SILENTLY OVERWRITTEN').toBe(
        ORIGINAL
      );
    });

    it('UPDATE of a non-ROI column is rejected too (protection is table-wide)', async () => {
      const before = await readRow();
      expect(before, 'fixture row missing before the non-ROI UPDATE probe').toHaveLength(1);

      await expect(
        raw.query(`UPDATE public.roi_realized_values SET variance_notes = $1 WHERE id = $2`, [
          'co4-probe',
          rowId,
        ])
      ).rejects.toThrow(APPEND_ONLY);
    });

    it('DELETE is physically rejected, and the row survives', async () => {
      const before = await readRow();
      expect(before, 'fixture row missing before the DELETE probe').toHaveLength(1);

      await expect(
        raw.query(`DELETE FROM public.roi_realized_values WHERE id = $1`, [rowId])
      ).rejects.toThrow(APPEND_ONLY);

      const after = await readRow();
      expect(after, 'public.roi_realized_values row was DELETED').toHaveLength(1);
      expect(after[0].realized_savings).toBe(ORIGINAL);
    });
  });
});
