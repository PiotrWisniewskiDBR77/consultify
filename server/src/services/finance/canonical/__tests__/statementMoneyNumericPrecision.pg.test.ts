/**
 * Finance v3 / CLOSEOUT CO-9 — statement money columns must be exact.
 *
 * WHAT THIS FILE EXISTS TO CATCH
 * ------------------------------
 * `financial_statement_values.value` was created as `REAL` (IEEE-754 binary32,
 * 24-bit significand) in `20260316_financial_statement_packs.sql:78` and no
 * later migration changed it. Integers are exact in binary32 only up to
 * 2^24 = 16 777 216. Every Apator figure exercised so far fits, because that
 * statement is reported in THOUSANDS. A statement reported in UNITS does not:
 *
 *     revenue 1 227 799 000 PLN  ->  stored as 1 227 799 040 PLN, silently
 *
 * `20260810_finance_v3_co9_statement_money_numeric.sql` converts that column —
 * and the sibling money columns it is copied into and compared against — to
 * `numeric`. Against a database migrated WITHOUT that file, the `numeric`
 * assertions below are RED.
 *
 * THE THREE CLAIMS, KEPT SEPARATE
 * -------------------------------
 *   1. STRUCTURE  — the columns are `numeric` on a freshly migrated database.
 *   2. BEHAVIOUR  — `real` provably loses the amount, `numeric` provably keeps
 *                   it. Claim 2 is asserted against a REAL `real` column, not
 *                   against a description of one, so the test proves the defect
 *                   exists rather than asserting that it does.
 *   3. UPGRADE    — rows written BEFORE the migration survive it unchanged.
 *
 * NOT CLAIMED, DELIBERATELY: that the migration repairs historical data. A row
 * already snapped to 1 227 799 040 on write is snapped; the information is gone
 * and no ALTER can invent it back. The upgrade test asserts PRESERVATION of what
 * is currently stored, and one case pins the fact that a pre-migration value is
 * still the damaged one afterwards, so nobody later mistakes this migration for
 * a data repair.
 *
 * A raw `pg.Client` is used rather than the app's pooled helpers: this suite is
 * about physical column types and driver-level round-tripping, which the pooled
 * helpers' coercion would hide. Same env-var contract as this repo's other
 * `.pg.test.ts` suites (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=...`),
 * `describe.skipIf`-gated so a run with no reachable Postgres reports SKIPPED,
 * never a false green.
 *
 * HOW TO RUN (against your own throwaway/ephemeral cluster — NEVER against the
 * shared local Postgres or any demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/statementMoneyNumericPrecision.pg.test.ts \
 *     --no-file-parallelism
 */
import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/**
 * The headline case: a P&L reported in units, not thousands. Chosen because it
 * is the smallest realistic Polish revenue figure that binary32 cannot hold.
 */
const REVENUE_IN_UNITS = '1227799000';

/** Every money column CO-9 converts, as (table, column) pairs. */
const MONEY_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['financial_statement_values', 'value'],
  ['financial_statement_value_evidence', 'contribution_value'],
  ['financial_statement_validations', 'expected_value'],
  ['financial_statement_validations', 'actual_value'],
  ['financial_statement_validations', 'difference'],
  ['financial_statement_validations', 'tolerance'],
];

/**
 * Score/ratio columns that CO-9 deliberately LEAVES as `real`. Pinned so that a
 * future well-meaning "convert everything to numeric" sweep has to argue with a
 * test instead of silently widening the blast radius. See the migration header.
 */
const DELIBERATELY_STILL_REAL: ReadonlyArray<readonly [string, string]> = [
  ['financial_statement_values', 'confidence'],
  ['financial_statement_values', 'mapping_confidence'],
  ['financial_statement_value_evidence', 'weight'],
];

describe.skipIf(!REAL_PG)('Finance v3 CO-9 — statement money columns are exact', () => {
  let raw: pg.Client;

  const suffix = randomUUID();
  const orgId = `org-co9-${suffix}`;
  const statementId = `stmt-co9-${suffix}`;

  const dataType = async (table: string, column: string): Promise<string | null> => {
    const res = await raw.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [table, column]
    );
    return res.rows[0]?.data_type ?? null;
  };

  beforeAll(async () => {
    raw = new pg.Client({ connectionString: CONNECTION_STRING });
    await raw.connect();
    await raw.query(`INSERT INTO public.organizations (id, name) VALUES ($1, $2)`, [
      orgId,
      'CO-9 Numeric Precision Org',
    ]);
    await raw.query(
      `INSERT INTO public.financial_statements
         (id, organization_id, statement_type, period_label, period_start, period_end, currency, scaling)
       VALUES ($1, $2, 'P&L', 'FY2025', '2025-01-01', '2025-12-31', 'PLN', 'units')`,
      [statementId, orgId]
    );
  });

  afterAll(async () => {
    // Ordinary mutable tables — unlike the append-only ROI stores, this suite
    // can and does tidy up after itself. Demo data is the product's face.
    if (raw) {
      await raw.query(
        `DELETE FROM public.financial_statement_value_evidence
          WHERE statement_value_id IN
            (SELECT id FROM public.financial_statement_values WHERE statement_id = $1)`,
        [statementId]
      );
      await raw.query(`DELETE FROM public.financial_statement_values WHERE statement_id = $1`, [
        statementId,
      ]);
      await raw.query(`DELETE FROM public.financial_statement_validations WHERE statement_id = $1`, [
        statementId,
      ]);
      await raw.query(`DELETE FROM public.financial_statements WHERE id = $1`, [statementId]);
      await raw.query(`DELETE FROM public.organizations WHERE id = $1`, [orgId]);
      await raw.end();
    }
  });

  // ==========================================================================
  // CLAIM 1 — STRUCTURE
  // ==========================================================================
  describe('column types on a freshly migrated database', () => {
    it.each(MONEY_COLUMNS)('%s.%s is numeric, not real', async (table, column) => {
      const type = await dataType(table, column);
      expect(
        type,
        `${table}.${column} is "${type}" — money in a binary float silently rounds ` +
          `above 2^24; CO-9 requires numeric`
      ).toBe('numeric');
    });

    it.each(DELIBERATELY_STILL_REAL)(
      '%s.%s stays real on purpose (score/ratio, not money)',
      async (table, column) => {
        expect(await dataType(table, column)).toBe('real');
      }
    );

    it('leaves no real/double money column behind in the statement ingestion chain', async () => {
      const res = await raw.query<{ table_name: string; column_name: string; data_type: string }>(
        `SELECT table_name, column_name, data_type
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND data_type IN ('real', 'double precision')
            AND (table_name, column_name) IN (
              ('financial_statement_values', 'value'),
              ('financial_statement_value_evidence', 'contribution_value'),
              ('financial_statement_validations', 'expected_value'),
              ('financial_statement_validations', 'actual_value'),
              ('financial_statement_validations', 'difference'),
              ('financial_statement_validations', 'tolerance')
            )
          ORDER BY table_name, column_name`
      );
      expect(
        res.rows.map((r) => `${r.table_name}.${r.column_name} (${r.data_type})`),
        'a CO-9 money column is still a binary float'
      ).toEqual([]);
    });
  });

  // ==========================================================================
  // CLAIM 2 — BEHAVIOUR. The defect is demonstrated, not described.
  // ==========================================================================
  describe('precision, proved against a live real column', () => {
    const probe = `co9_real_probe_${suffix.replace(/-/g, '')}`;

    beforeAll(async () => {
      await raw.query(`CREATE TEMP TABLE ${probe} (as_real real, as_numeric numeric)`);
    });

    it('BEFORE: a real column cannot hold a P&L reported in units', async () => {
      await raw.query(`INSERT INTO ${probe} (as_real, as_numeric) VALUES ($1, $1)`, [
        REVENUE_IN_UNITS,
      ]);
      const res = await raw.query<{ stored: string; matches: boolean }>(
        `SELECT as_real::text::numeric::text AS stored,
                (as_real::float8 = $1::float8) AS matches
           FROM ${probe}`,
        [REVENUE_IN_UNITS]
      );

      // The float4 nearest to 1 227 799 000 is 1 227 799 040 — off by 40 PLN.
      const storedAsFloat = await raw.query<{ exact: string }>(
        `SELECT (as_real::float8)::numeric::text AS exact FROM ${probe}`
      );
      expect(storedAsFloat.rows[0].exact).toBe('1227799040');
      expect(
        res.rows[0].matches,
        'a real column round-tripped the amount exactly — the premise of CO-9 no longer holds'
      ).toBe(false);
    });

    it('AFTER: the numeric column returns the amount bit for bit', async () => {
      const res = await raw.query<{ as_numeric: string }>(
        `SELECT as_numeric::text AS as_numeric FROM ${probe}`
      );
      expect(res.rows[0].as_numeric).toBe(REVENUE_IN_UNITS);
    });

    it('round-trips through the real production column', async () => {
      const valueId = `fsv-co9-headline-${suffix}`;
      await raw.query(
        `INSERT INTO public.financial_statement_values
           (id, statement_id, original_label, value, mapping_status)
         VALUES ($1, $2, 'Przychody netto ze sprzedazy', $3, 'manual')`,
        [valueId, statementId, REVENUE_IN_UNITS]
      );
      const res = await raw.query<{ value: string }>(
        `SELECT value::text AS value FROM public.financial_statement_values WHERE id = $1`,
        [valueId]
      );
      expect(res.rows[0].value).toBe(REVENUE_IN_UNITS);
    });

    /**
     * Boundary cases. `below 2^24` must survive in BOTH types (it is the reason
     * the defect stayed invisible); everything above must survive in numeric and
     * is checked against what `real` would have done to it.
     */
    it.each([
      // [label,               amount,             survives in real?]
      ['just below 2^24', '16777215', true],
      ['exactly 2^24', '16777216', true],
      ['just above 2^24', '16777217', false],
      ['revenue in units', REVENUE_IN_UNITS, false],
      ['grosze on a large amount', '999999999999.99', false],
      ['grosze on a small amount', '12345.67', false],
    ])('%s (%s) is exact in numeric', async (_label, amount, survivesInReal) => {
      const valueId = `fsv-co9-${_label.replace(/[^a-z0-9]/gi, '')}-${suffix}`;
      await raw.query(
        `INSERT INTO public.financial_statement_values
           (id, statement_id, original_label, value, mapping_status)
         VALUES ($1, $2, $3, $4, 'manual')`,
        [valueId, statementId, _label, amount]
      );
      const res = await raw.query<{ value: string }>(
        `SELECT value::text AS value FROM public.financial_statement_values WHERE id = $1`,
        [valueId]
      );
      expect(res.rows[0].value).toBe(amount);

      // And confirm the `real` verdict this case claims, so the table above
      // cannot drift into fiction.
      const viaReal = await raw.query<{ same: boolean }>(
        `SELECT ($1::numeric = $1::numeric::real::text::numeric) AS same`,
        [amount]
      );
      expect(
        viaReal.rows[0].same,
        `expected "${amount}" to ${survivesInReal ? 'survive' : 'be damaged by'} a real column`
      ).toBe(survivesInReal);
    });
  });

  // ==========================================================================
  // CLAIM 3 — UPGRADE of a database that already holds `real` rows.
  // ==========================================================================
  describe('upgrading a table that already holds data', () => {
    const legacy = `co9_legacy_${suffix.replace(/-/g, '')}`;

    it('preserves every stored value across ALTER ... TYPE numeric', async () => {
      // A table shaped like the pre-CO-9 one, populated BEFORE the conversion.
      await raw.query(`CREATE TEMP TABLE ${legacy} (id int primary key, value real)`);
      await raw.query(
        `INSERT INTO ${legacy} (id, value) VALUES
           (1, 12345.67), (2, 1227799000), (3, 1234567.89), (4, 16777215), (5, 0.1)`
      );
      // What the application observes today: node-pg receives float4out's
      // shortest round-trip form, which is what `::text` reproduces.
      const before = await raw.query<{ id: number; v: string }>(
        `SELECT id, value::text AS v FROM ${legacy} ORDER BY id`
      );

      await raw.query(`SET extra_float_digits = 3`);
      await raw.query(
        `ALTER TABLE ${legacy} ALTER COLUMN value TYPE numeric USING value::text::numeric`
      );
      await raw.query(`RESET extra_float_digits`);

      const after = await raw.query<{ id: number; v: string }>(
        `SELECT id, value::text AS v FROM ${legacy} ORDER BY id`
      );
      expect(after.rows.map((r) => r.v)).toEqual(before.rows.map((r) => r.v));
      expect(
        (
          await raw.query<{ t: string }>(
            `SELECT pg_typeof(value)::text AS t FROM ${legacy} LIMIT 1`
          )
        ).rows[0].t
      ).toBe('numeric');
    });

    /**
     * The trap that makes the OBVIOUS version of this migration a data-corruption
     * bug: Postgres' built-in float4->numeric cast formats with `%.*g` at
     * FLT_DIG = 6, so a bare `ALTER ... TYPE numeric` truncates every amount to
     * six significant digits — strictly worse than the defect being fixed. This
     * test pins the difference so the `::text::numeric` cast in the migration can
     * never be "simplified" away.
     */
    it('the naive ::numeric cast truncates to 6 digits and must not be used', async () => {
      const res = await raw.query<{
        naive: string;
        via_text: string;
      }>(
        `SELECT 12345.67::real::numeric::text        AS naive,
                12345.67::real::text::numeric::text  AS via_text`
      );
      expect(res.rows[0].naive).toBe('12345.7'); // grosze destroyed by the cast itself
      expect(res.rows[0].via_text).toBe('12345.67'); // preserved
      expect(res.rows[0].naive).not.toBe(res.rows[0].via_text);
    });

    /**
     * Honesty pin: the migration does NOT repair history. A value damaged on
     * write stays damaged; CO-9 only guarantees exactness from now on.
     */
    it('does not pretend to repair values already damaged on write', async () => {
      const damaged = `co9_damaged_${suffix.replace(/-/g, '')}`;
      await raw.query(`CREATE TEMP TABLE ${damaged} (value real)`);
      await raw.query(`INSERT INTO ${damaged} (value) VALUES ($1)`, [REVENUE_IN_UNITS]);
      await raw.query(
        `ALTER TABLE ${damaged} ALTER COLUMN value TYPE numeric USING value::float8::numeric`
      );
      const res = await raw.query<{ v: string }>(`SELECT value::text AS v FROM ${damaged}`);
      // 1 227 799 040, not 1 227 799 000: the 40 PLN was lost at INSERT time,
      // long before any migration ran.
      expect(res.rows[0].v).toBe('1227799040');
      expect(res.rows[0].v).not.toBe(REVENUE_IN_UNITS);
    });
  });

  // ==========================================================================
  // Driver contract — the consequence that had to be audited before shipping.
  // ==========================================================================
  describe('node-pg driver contract for the converted columns', () => {
    it('hands numeric back as a string, so every consumer must coerce', async () => {
      const valueId = `fsv-co9-driver-${suffix}`;
      await raw.query(
        `INSERT INTO public.financial_statement_values
           (id, statement_id, original_label, value, confidence, mapping_status)
         VALUES ($1, $2, 'driver contract', $3, 0.5, 'manual')`,
        [valueId, statementId, REVENUE_IN_UNITS]
      );
      const res = await raw.query(
        `SELECT value, confidence FROM public.financial_statement_values WHERE id = $1`,
        [valueId]
      );
      // numeric -> string (OID 1700 has no parser registered in this repo);
      // real -> number (OID 700 does). Both facts matter to callers.
      expect(typeof res.rows[0].value).toBe('string');
      expect(typeof res.rows[0].confidence).toBe('number');
      // And the string is exact — Number() is safe here because 1 227 799 000
      // is far below 2^53.
      expect(Number(res.rows[0].value)).toBe(1227799000);
    });
  });
});
