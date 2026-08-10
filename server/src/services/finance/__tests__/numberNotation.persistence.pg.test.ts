/**
 * RC-00 — real PostgreSQL gate on the CORRECTED magnitudes.
 *
 * Why a database test for a parser fix: the fix multiplies every affected figure by 1000, and
 * `financial_statement_values.value` is declared `REAL` (float4, 24-bit mantissa — integers are
 * exact only up to 2^24 = 16 777 216). A parser that now returns 122 070 instead of 122.07 is
 * worthless if the column silently rounds it. This suite writes the real corrected figures through
 * the actual production table and reads them back.
 *
 * Same env contract as the repo's other `.pg.test.ts` suites: `RUN_DB_TESTS=1`, `MOCK_DB=false`,
 * `DATABASE_URL=postgresql://…`, `describe.skipIf`-gated. Without them the suite SKIPS rather than
 * passing against a mock — a green run here means a real server answered.
 *
 * Figures: docs/validation/finance-v3/generated/gate-d/REAL_COMPANY_PROOF_report.md §RC-00 and
 * docs/validation/finance-v3/generated/STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json.
 */

import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseStatementNumber } from '../numberNotation.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG) {
  process.env.DB_TYPE = 'postgres';
}

/** Source token as the issuer prints it, the notation of its document, and the figure it reports. */
const REAL_FIGURES: Array<{ issuer: string; token: string; notation: 'en' | 'eu'; expected: number }> =
  [
    { issuer: 'Tesla 10-K 2024 · total assets', token: '122,070', notation: 'en', expected: 122070 },
    { issuer: 'Tesla 10-K 2024 · cash', token: '16,139', notation: 'en', expected: 16139 },
    { issuer: 'Coca-Cola 10-K 2025 · total assets', token: '100,549', notation: 'en', expected: 100549 },
    { issuer: 'bp 20-F 2025 · total assets', token: '26,574', notation: 'en', expected: 26574 },
    { issuer: 'BMW 2024 · total assets', token: '267.732', notation: 'eu', expected: 267732 },
    { issuer: 'BMW 2024 · current assets', token: '36.752', notation: 'eu', expected: 36752 },
    { issuer: 'Grupa Apator RS 2024 · total assets', token: '1 227 799', notation: 'eu', expected: 1227799 },
    { issuer: 'Grupa Apator RS 2024 · equity', token: '466 231', notation: 'eu', expected: 466231 },
  ];

describe.skipIf(!REAL_PG)('RC-00 — corrected magnitudes survive the real financial_statement_values column', () => {
  let withPinnedPostgresTransaction: typeof import('../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;

  const orgId = `org-rc00-${randomUUID()}`;
  const statementId = `stmt-rc00-${randomUUID()}`;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../database/PostgresDatabase.js'));

    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `INSERT INTO financial_statements (id, organization_id, statement_type, period_start, period_end)
         VALUES (?, ?, 'BS', DATE '2024-01-01', DATE '2024-12-31')`,
        [statementId, orgId]
      );
    });
  });

  afterAll(async () => {
    if (!withPinnedPostgresTransaction) return;
    // Demo/test data is never left behind: the cascade removes the values rows with the statement.
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`DELETE FROM financial_statements WHERE id = ?`, [statementId]);
    });
  });

  it('confirms the column really is float4 — the reason this gate exists', async () => {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ data_type: string }>(
        `SELECT data_type FROM information_schema.columns
          WHERE table_name = 'financial_statement_values' AND column_name = 'value'`,
        []
      )
    );
    // Read from the live catalogue, not from the migration file — a mock cannot answer this.
    expect(row?.data_type).toBe('real');
  });

  it('round-trips every corrected real figure without loss', async () => {
    for (const figure of REAL_FIGURES) {
      const parsed = parseStatementNumber(figure.token, figure.notation);
      expect(parsed.value, `${figure.issuer}: parser`).toBe(figure.expected);
      expect(parsed.ambiguous).toBe(false);

      const id = `fsv-rc00-${randomUUID()}`;
      await withPinnedPostgresTransaction(async (tx) => {
        await tx.queryRun(
          `INSERT INTO financial_statement_values (id, statement_id, original_label, value, mapping_status)
           VALUES (?, ?, ?, ?, 'auto')`,
          [id, statementId, figure.issuer, parsed.value]
        );
      });

      const stored = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ value: number | string }>(
          `SELECT value FROM financial_statement_values WHERE id = ?`,
          [id]
        )
      );
      expect(Number(stored?.value), `${figure.issuer}: round-trip`).toBe(figure.expected);
    }
  });

  it('would have stored the 1000x-wrong figure before the fix', async () => {
    // The pre-fix reading of the very same token, persisted to prove the defect was storable —
    // i.e. nothing downstream of the parser would have rejected it.
    const broken = parseStatementNumber('122,070', 'eu');
    expect(broken.value).toBe(122.07);

    const id = `fsv-rc00-broken-${randomUUID()}`;
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `INSERT INTO financial_statement_values (id, statement_id, original_label, value, mapping_status)
         VALUES (?, ?, 'RC-00 pre-fix reading', ?, 'auto')`,
        [id, statementId, broken.value]
      );
    });
    const stored = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ value: number | string }>(
        `SELECT value FROM financial_statement_values WHERE id = ?`,
        [id]
      )
    );
    expect(Number(stored?.value)).toBeCloseTo(122.07, 4);
    // 1000x apart, same digits — the whole of RC-00 in one assertion.
    expect(Math.round(Number(stored?.value) * 1000)).toBe(122070);
  });
});
