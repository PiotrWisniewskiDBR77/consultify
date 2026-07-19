/**
 * O6.2/O6.3 — Financial benchmark REAL-runtime proof.
 *
 * Question: `financeIndustryBenchmarks.ts` (industry quartile bands +
 * `benchmarkFinancial()` + O6.3 disclaimer/refresh-owner metadata) is BUILT
 * and unit-tested (35/35, tests/unit/finance/financeIndustryBenchmarks.test.ts)
 * — does it actually reach a real HTTP endpoint, fed by a real org + real
 * financial-statement values, with a real (non-fabricated) industry band?
 *
 * This harness seeds ONE organization with `industry` set to a manufacturing
 * free-text label, a real Balance Sheet statement with CURRENT_ASSETS/
 * CURRENT_LIABILITIES values chosen to sit BELOW the industrial-manufacturing
 * CURRENT_RATIO p25 band (so the proof is not a happy-path in-range number),
 * mounts the REAL finance-statements router behind REAL verifyToken, and
 * calls the REAL `GET /:id/ratios` endpoint (→ `ratioAnalysisService.
 * computeRatios` → `buildRatioBenchmark` → `financeIndustryBenchmarks.
 * getRatioBenchmark`/`buildSourceMetadata` — the exact O6.3 wiring closed in
 * commit 77691e2771).
 *
 * Prefix for all rows this test writes: `odbior--o6--`.
 */
import { createServer, type Server } from 'node:http';

import express, { type Express } from 'express';
import request from 'supertest';

import { getJwtSecret, mintToken, pgClient, requireLocalDbUrl } from './harness';
import { seed, SEED } from './seed.mjs';

const PREFIX = 'odbior--o6--';
const PACK_ID = `${PREFIX}pack`;
const STMT_ID = `${PREFIX}stmt`;
// Second industry (retail-ecommerce) — proves the endpoint returns a DIFFERENT
// real, named-source band for a different org.industry free-text, not a
// hardcoded/fixture value that happens to match one industry.
const PACK_ID2 = `${PREFIX}pack2`;
const STMT_ID2 = `${PREFIX}stmt2`;

let app: Express;
let server: Server;
let token: string;
let originalIndustry: string | null = null;

describe('O6.2/O6.3 — financial industry benchmark real-runtime wiring', () => {
  beforeAll(async () => {
    requireLocalDbUrl();
    process.env.JWT_SECRET = process.env.JWT_SECRET || getJwtSecret();
    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';
    process.env.POSTGRES_SKIP_INIT_IN_TEST = 'true';

    await seed();

    const client = pgClient();
    await client.connect();
    try {
      // ── Give the seeded org an industry free-text that resolveBenchmarkIndustry
      // maps to 'industrial-manufacturing' (has('manufactur','produkc','przemysł'...)).
      // Save+restore so this doesn't leak into other acceptance files sharing SEED.ORG_ID.
      const orgRow = await client.query<{ industry: string | null }>(
        `SELECT industry FROM organizations WHERE id = $1`,
        [SEED.ORG_ID]
      );
      originalIndustry = orgRow.rows[0]?.industry ?? null;
      await client.query(`UPDATE organizations SET industry = $1 WHERE id = $2`, [
        'Produkcja przemysłowa — komponenty motoryzacyjne',
        SEED.ORG_ID,
      ]);

      const { ensureCanonicalRegistryInDatabase } = await import(
        '../../server/src/services/financeCanonicalRegistrySyncService.js'
      );
      await ensureCanonicalRegistryInDatabase();

      const lineRows = await client.query<{ id: string; line_code: string }>(
        `SELECT id, line_code FROM financial_statement_lines
         WHERE line_code IN ('CURRENT_ASSETS', 'CURRENT_LIABILITIES')`
      );
      const lineIdByCode = new Map(lineRows.rows.map((r) => [r.line_code, r.id]));
      const currentAssetsLineId = lineIdByCode.get('CURRENT_ASSETS');
      const currentLiabilitiesLineId = lineIdByCode.get('CURRENT_LIABILITIES');
      if (!currentAssetsLineId || !currentLiabilitiesLineId) {
        throw new Error(
          `[o6] canonical registry missing CURRENT_ASSETS/CURRENT_LIABILITIES (got: ${[...lineIdByCode.keys()].join(',')})`
        );
      }

      // ── Cleanup any leftovers from a previous aborted run (reversible prefix).
      await client.query(`DELETE FROM financial_statement_values WHERE statement_id = $1`, [
        STMT_ID,
      ]);
      await client.query(`DELETE FROM financial_statements WHERE id = $1`, [STMT_ID]);
      await client.query(`DELETE FROM financial_statement_packs WHERE id = $1`, [PACK_ID]);

      await client.query(
        `INSERT INTO financial_statement_packs
           (id, organization_id, entity_name, period_start, period_end, period_label,
            currency, pack_status, pack_readiness_status, source_statement_count)
         VALUES ($1, $2, 'Odbior O6 Sp. z o.o.', '2025-01-01', '2025-12-31', 'FY2025', 'PLN', 'confirmed', 'ready', 1)`,
        [PACK_ID, SEED.ORG_ID]
      );
      await client.query(
        `INSERT INTO financial_statements
           (id, organization_id, entity_name, statement_type, period_start, period_end,
            period_label, currency, status, readiness_status, statement_pack_id)
         VALUES ($1, $2, 'Odbior O6 Sp. z o.o.', 'BS', '2025-01-01', '2025-12-31', 'FY2025', 'PLN', 'confirmed', 'ready', $3)`,
        [STMT_ID, SEED.ORG_ID, PACK_ID]
      );
      // CURRENT_ASSETS / CURRENT_LIABILITIES = 900,000 / 1,000,000 = 0.9x —
      // deliberately BELOW the industrial-manufacturing CURRENT_RATIO p25 (1.1x,
      // see INDUSTRY_BENCHMARK_PROFILES['industrial-manufacturing'].ratios.
      // CURRENT_RATIO) so the proof exercises the below-p25 branch, not a
      // trivial in-range happy path.
      await client.query(
        `INSERT INTO financial_statement_values
           (id, statement_id, canonical_line_id, original_label, value, confidence, mapping_status, value_origin)
         VALUES
           ($1, $2, $3, 'Aktywa obrotowe', 900000, 1, 'manual', 'manual'),
           ($4, $2, $5, 'Zobowiązania krótkoterminowe', 1000000, 1, 'manual', 'manual')`,
        [`${STMT_ID}-ca`, STMT_ID, currentAssetsLineId, `${STMT_ID}-cl`, currentLiabilitiesLineId]
      );
    } finally {
      await client.end();
    }

    // ── Mount the REAL finance-statements router behind REAL verifyToken.
    const { default: verifyToken } = await import(
      '../../server/src/middleware/auth.middleware.js'
    );
    const { default: financeStatementsRouter } = await import(
      '../../server/src/routes/finance-statements.routes.js'
    );

    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use('/api/finance-statements', verifyToken as any, financeStatementsRouter);

    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));

    token = mintToken();
  }, 60_000);

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));

    const client = pgClient();
    await client.connect();
    try {
      await client.query(`DELETE FROM financial_statement_values WHERE statement_id = $1`, [
        STMT_ID,
      ]);
      await client.query(`DELETE FROM financial_statements WHERE id = $1`, [STMT_ID]);
      await client.query(`DELETE FROM financial_statement_packs WHERE id = $1`, [PACK_ID]);
      await client.query(`DELETE FROM financial_statement_values WHERE statement_id = $1`, [
        STMT_ID2,
      ]);
      await client.query(`DELETE FROM financial_statements WHERE id = $1`, [STMT_ID2]);
      await client.query(`DELETE FROM financial_statement_packs WHERE id = $1`, [PACK_ID2]);
      // Restore the org's pre-test industry so this file doesn't leak state
      // into other acceptance files sharing SEED.ORG_ID.
      await client.query(`UPDATE organizations SET industry = $1 WHERE id = $2`, [
        originalIndustry,
        SEED.ORG_ID,
      ]);
    } finally {
      await client.end();
    }
  }, 30_000);

  it('GET /:id/ratios returns a REAL (non-fabricated) industry benchmark band with O6.3 disclaimer + refresh owner', async () => {
    const res = await request(app)
      .get(`/api/finance-statements/${STMT_ID}/ratios`)
      .set('Authorization', `Bearer ${token}`);

    // eslint-disable-next-line no-console
    console.log('[o6] /ratios status', res.status, JSON.stringify(res.body).slice(0, 1500));
    expect(res.status).toBe(200);

    const ratios: any[] = res.body?.ratios;
    expect(Array.isArray(ratios)).toBe(true);

    const currentRatio = ratios.find((r) => r.code === 'CURRENT_RATIO');
    expect(currentRatio).toBeTruthy();

    // The ratio itself was computed from the REAL statement values (900000/1000000).
    expect(currentRatio.value).toBe(0.9);

    const bench = currentRatio.benchmark;
    expect(bench).toBeTruthy();
    // No org-entered benchmark row was seeded → must have fallen back to the
    // static per-industry band (O6.2), not silently disappeared.
    expect(bench.origin).toBe('industry');
    expect(bench.industry).toBe('industrial-manufacturing');
    expect(bench.industryLabelPl).toMatch(/produkcja/i);

    // O6.2 — matches the NAMED, checked-in band exactly (not invented at request time).
    expect(bench.p25).toBe(1.1);
    expect(bench.median).toBe(1.5);
    expect(bench.p75).toBe(2.1);
    expect(bench.source).toMatch(/GUS|Eurostat/);
    expect(bench.asOf).toBeTruthy();
    expect(['sourced', 'expert-estimate']).toContain(bench.confidence);

    // O6.3 — disclaimer + refresh-owner metadata, bilingual, non-empty, and
    // honestly names the n≥10 calibration trigger + the source-review cadence.
    expect(typeof bench.disclaimerPl).toBe('string');
    expect(bench.disclaimerPl.length).toBeGreaterThan(20);
    expect(bench.disclaimerPl).toMatch(/n ?≥ ?10|kalibrac/i);
    expect(typeof bench.disclaimerEn).toBe('string');
    expect(bench.disclaimerEn.length).toBeGreaterThan(20);
    expect(typeof bench.refreshOwnerPl).toBe('string');
    expect(bench.refreshOwnerPl).toMatch(/DBR77|Piotr/);
    expect(typeof bench.refreshOwnerEn).toBe('string');

    // The narrative sentence cites the real value + real industry median —
    // not a flat percentage-variance placeholder (this is the ±15%-bar gap
    // the module doc says it replaces).
    expect(bench.narrativePl).toMatch(/0\.9/);
    expect(bench.narrativePl).toMatch(/1\.5/);

    // 0.9x is numerically below the 1.1x p25 lower bound (ratioAnalysisService's
    // `describeRatioAgainstBenchmark` narrative states value/range/source but not
    // a below/above verdict word — that richer verdict vocabulary lives in
    // `benchmarkFinancial()`, exercised directly in the next test). Confirming
    // the numeric relationship here proves this is not a happy-path in-range
    // fixture — the endpoint really is being asked to place a below-band value.
    expect(currentRatio.value).toBeLessThan(bench.p25);
    // The ratio's own universal-threshold status also flags this as bad (independent
    // signal, not derived from the industry band) — confirms real evaluation ran.
    expect(currentRatio.status).toBe('critical');
  });

  it('benchmarkFinancial() called directly with the SAME real value agrees with the endpoint (single source of truth, no drift)', async () => {
    const { benchmarkFinancial } = await import(
      '../../server/src/services/financeIndustryBenchmarks.js'
    );
    const result = benchmarkFinancial({
      industrySegment: 'Produkcja przemysłowa — komponenty motoryzacyjne',
      ratioCode: 'CURRENT_RATIO',
      value: 0.9,
      higherIsBetter: true,
    });

    expect(result.verdict).toBe('below-p25');
    expect(result.industry).toBe('industrial-manufacturing');
    expect(result.band).toBeTruthy();
    expect(result.band!.p25).toBe(1.1);
    expect(result.sourceMetadata).toBeTruthy();
    expect(result.sourceMetadata!.disclaimer.pl).toMatch(/expert-estimate|sourced/i);
    expect(result.sourceMetadata!.calibrationThresholdN).toBe(10);
    // Honest — not a fabricated statistical claim: the disclaimer says the
    // 'sourced' bands come from named public sources, not DBR77 transactions.
    expect(result.sourceMetadata!.disclaimer.pl).toMatch(/NIE benchmark statystyczny|Damodaran|GUS/);
  });

  it('a SECOND industry (retail-ecommerce) gets its own real, distinct GUS/Eurostat-sourced band through the SAME real endpoint (proves >= 2 branż, not a single hardcoded fixture)', async () => {
    const client = pgClient();
    await client.connect();
    try {
      // Re-point the SAME seeded org to a retail free-text label —
      // resolveBenchmarkIndustry maps 'sklep'/'handel detaliczny' -> 'retail-ecommerce'.
      await client.query(`UPDATE organizations SET industry = $1 WHERE id = $2`, [
        'Sklep internetowy — handel detaliczny odzieżą',
        SEED.ORG_ID,
      ]);

      const lineRows = await client.query<{ id: string; line_code: string }>(
        `SELECT id, line_code FROM financial_statement_lines
         WHERE line_code IN ('CURRENT_ASSETS', 'CURRENT_LIABILITIES')`
      );
      const lineIdByCode = new Map(lineRows.rows.map((r) => [r.line_code, r.id]));
      const currentAssetsLineId = lineIdByCode.get('CURRENT_ASSETS')!;
      const currentLiabilitiesLineId = lineIdByCode.get('CURRENT_LIABILITIES')!;

      await client.query(`DELETE FROM financial_statement_values WHERE statement_id = $1`, [
        STMT_ID2,
      ]);
      await client.query(`DELETE FROM financial_statements WHERE id = $1`, [STMT_ID2]);
      await client.query(`DELETE FROM financial_statement_packs WHERE id = $1`, [PACK_ID2]);

      await client.query(
        `INSERT INTO financial_statement_packs
           (id, organization_id, entity_name, period_start, period_end, period_label,
            currency, pack_status, pack_readiness_status, source_statement_count)
         VALUES ($1, $2, 'Odbior O6 Retail Sp. z o.o.', '2025-01-01', '2025-12-31', 'FY2025', 'PLN', 'confirmed', 'ready', 1)`,
        [PACK_ID2, SEED.ORG_ID]
      );
      await client.query(
        `INSERT INTO financial_statements
           (id, organization_id, entity_name, statement_type, period_start, period_end,
            period_label, currency, status, readiness_status, statement_pack_id)
         VALUES ($1, $2, 'Odbior O6 Retail Sp. z o.o.', 'BS', '2025-01-01', '2025-12-31', 'FY2025', 'PLN', 'confirmed', 'ready', $3)`,
        [STMT_ID2, SEED.ORG_ID, PACK_ID2]
      );
      // CURRENT_ASSETS / CURRENT_LIABILITIES = 700,000 / 1,000,000 = 0.7x —
      // deliberately BELOW the retail-ecommerce CURRENT_RATIO p25 (0.9x, see
      // INDUSTRY_BENCHMARK_PROFILES['retail-ecommerce'].ratios.CURRENT_RATIO).
      await client.query(
        `INSERT INTO financial_statement_values
           (id, statement_id, canonical_line_id, original_label, value, confidence, mapping_status, value_origin)
         VALUES
           ($1, $2, $3, 'Aktywa obrotowe', 700000, 1, 'manual', 'manual'),
           ($4, $2, $5, 'Zobowiązania krótkoterminowe', 1000000, 1, 'manual', 'manual')`,
        [`${STMT_ID2}-ca`, STMT_ID2, currentAssetsLineId, `${STMT_ID2}-cl`, currentLiabilitiesLineId]
      );
    } finally {
      await client.end();
    }

    const res = await request(app)
      .get(`/api/finance-statements/${STMT_ID2}/ratios`)
      .set('Authorization', `Bearer ${token}`);

    // eslint-disable-next-line no-console
    console.log('[o6-2nd-industry] /ratios status', res.status, JSON.stringify(res.body).slice(0, 1500));
    expect(res.status).toBe(200);

    const ratios: any[] = res.body?.ratios;
    const currentRatio = ratios.find((r) => r.code === 'CURRENT_RATIO');
    expect(currentRatio).toBeTruthy();
    expect(currentRatio.value).toBe(0.7);

    const bench = currentRatio.benchmark;
    expect(bench).toBeTruthy();
    expect(bench.origin).toBe('industry');
    // Different industry resolved from the free-text org.industry label.
    expect(bench.industry).toBe('retail-ecommerce');
    expect(bench.industryLabelPl).toMatch(/retail|handel/i);

    // Real, checked-in retail-ecommerce band — numerically DIFFERENT from the
    // industrial-manufacturing band asserted in the first test (1.1/1.5/2.1),
    // proving this is not one fixture reused under a different label.
    expect(bench.p25).toBe(0.9);
    expect(bench.median).toBe(1.2);
    expect(bench.p75).toBe(1.6);
    expect(bench.source).toMatch(/GUS|Eurostat/);
    expect(bench.asOf).toBeTruthy();

    expect(currentRatio.value).toBeLessThan(bench.p25);
    expect(currentRatio.status).toBe('critical');
  }, 30_000);
});
