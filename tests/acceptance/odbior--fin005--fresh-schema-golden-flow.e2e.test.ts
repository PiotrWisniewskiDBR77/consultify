/**
 * FIN-005 — fresh-schema bootstrap proof (Codex review Blocker 1).
 *
 * This file is NOT meant to be run against the shared `consultinity_test`
 * dev database — it is meant to be run by
 * `scripts/testing/run-fin005-fresh-schema-check.mjs`, which:
 *   1. drops and re-creates a dedicated, throwaway database,
 *   2. applies ONLY the sanctioned migration path
 *      (`npx tsx server/scripts/migrate.postgres.ts --safe` — the same
 *      runner `npm run db:migrate` wraps; nothing from
 *      `server/migrations/never-ran/` is ever touched),
 *   3. then runs this file against THAT database.
 *
 * If the golden flow (upload -> detect -> extract -> map -> values ->
 * validate -> confirm) works end-to-end here, for BOTH XLSX and CSV, it
 * proves the sanctioned migration path is self-sufficient — no one has to
 * manually reach into `never-ran/668_statement_ready_contract.sql` or
 * `never-ran/669_statement_import_rebuild.sql` for the package to work.
 *
 * Guard: refuses anything but a local Postgres target (same convention as
 * every other acceptance suite in this directory — never demo/prod), but
 * — unlike the other FIN-005 suite — does NOT require the db name to be
 * `consultinity_test`, since this is deliberately a SEPARATE, disposable
 * database so a leftover manual 668/669 application on the shared dev DB
 * can never quietly cover for a real gap in the sanctioned path.
 */
import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { mintToken } from './harness.js';
import { SEED, seed } from './seed.mjs';

const MARK = 'odbior--fin005-fresh--';

function guardedDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('[FIN-005 fresh-schema] DATABASE_URL is unset');
  const url = new URL(raw);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error(`[FIN-005 fresh-schema] REFUSING non-local database target host=${url.hostname}`);
  }
  return raw;
}

function client(): pg.Client {
  return new pg.Client({ connectionString: guardedDatabaseUrl() });
}

const PL_ROWS: Array<[string, number, number]> = [
  ['Przychody ze sprzedaży', 1_250_000, 1_100_000],
  ['Koszt własny sprzedaży', -700_000, -620_000],
  ['Zysk brutto', 550_000, 480_000],
  ['Koszty operacyjne', -300_000, -260_000],
  ['EBIT', 200_000, 175_000],
  ['Koszty finansowe', -12_000, -10_000],
  ['Podatek dochodowy', -38_000, -33_000],
  ['Zysk netto', 162_000, 142_000],
];

function makeXlsxFixture(): Buffer {
  const rows: Array<Array<string | number>> = [
    ['Rachunek zysków i strat', 'FY2025', 'FY2024', 'PLN'],
    ...PL_ROWS.map(([label, v1, v2]) => [label, v1, v2, 'PLN']),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'P&L FY2025');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function makeCsvFixture(): Buffer {
  const lines = [
    'Rachunek zysków i strat;FY2025;FY2024;PLN',
    ...PL_ROWS.map(([label, v1, v2]) => `${label};${v1};${v2};PLN`),
  ];
  const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([utf8Bom, Buffer.from(lines.join('\n'), 'utf-8')]);
}

async function buildFinanceApp(): Promise<Express> {
  const router = (await import('../../server/src/routes/finance-statements.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/finance-statements', router);
  return app;
}

async function cleanup(): Promise<void> {
  const db = client();
  await db.connect();
  try {
    const statements = await db.query(
      `SELECT id, statement_pack_id FROM financial_statements WHERE source_file_name LIKE $1`,
      [`${MARK}%`]
    );
    const packIds = new Set<string>();
    for (const { id, statement_pack_id } of statements.rows) {
      if (statement_pack_id) packIds.add(statement_pack_id);
      await db.query(
        `DELETE FROM financial_statement_value_evidence WHERE statement_value_id IN (SELECT id FROM financial_statement_values WHERE statement_id = $1)`,
        [id]
      );
      const childTables = [
        'financial_statement_mapping_candidates',
        'financial_statement_candidate_rows',
        'financial_statement_extracted_sections',
        'financial_statement_quality_runs',
        'financial_statement_repair_sessions',
        'financial_statement_source_artifacts',
        'financial_statement_validations',
        'financial_statement_versions',
        'financial_statement_ingest_runs',
        'financial_statement_values',
      ];
      for (const table of childTables) {
        await db.query(`DELETE FROM ${table} WHERE statement_id = $1`, [id]);
      }
      await db.query(`DELETE FROM financial_statements WHERE id = $1`, [id]);
    }
    if (packIds.size > 0) {
      await db.query(`DELETE FROM financial_statement_packs WHERE id = ANY($1::text[])`, [
        Array.from(packIds),
      ]);
    }
    await db.query(`DELETE FROM financial_statement_upload_idempotency WHERE organization_id = $1`, [
      SEED.ORG_ID,
    ]);
  } finally {
    await db.end();
  }
}

async function runGoldenFlow(app: Express, token: string, fixture: Buffer, filename: string, contentType: string) {
  const upload = await request(app)
    .post('/api/finance-statements/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', fixture, { filename, contentType })
    .expect(201);

  const statementId: string = upload.body.statementId;
  expect(statementId).toBeTruthy();
  expect(upload.body.detection.statementType).toBe('P&L');

  await request(app)
    .post(`/api/finance-statements/${statementId}/detect`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const extract = await request(app)
    .post(`/api/finance-statements/${statementId}/extract`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(extract.body.lines.length).toBeGreaterThanOrEqual(3);

  const mapping = await request(app)
    .post(`/api/finance-statements/${statementId}/map`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  const mapped = mapping.body.mappedLines.filter((line: any) => line.suggestedCanonicalId);
  expect(mapped.length).toBeGreaterThanOrEqual(3);

  const values = mapping.body.mappedLines.map((line: any) => ({
    canonicalLineId: line.suggestedCanonicalId || null,
    originalLabel: line.originalLabel,
    value: Number(line.value),
    confidence: Number(line.confidence || 0.8),
    sourceRow: line.sourceRow,
    mappingStatus: line.suggestedCanonicalId ? 'auto' : 'unmapped',
    valueOrigin: line.suggestedCanonicalId ? 'mapped' : 'source',
    isNonFinancial: Boolean(line.isNonFinancial),
  }));

  await request(app)
    .put(`/api/finance-statements/${statementId}/values`)
    .set('Authorization', `Bearer ${token}`)
    .send({ values })
    .expect(200);

  const validation = await request(app)
    .post(`/api/finance-statements/${statementId}/validate`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(['pass', 'warnings']).toContain(validation.body.validation.status);
  expect(validation.body.readiness.isReady).toBe(true);

  await request(app)
    .post(`/api/finance-statements/${statementId}/confirm`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const readBack = await request(app)
    .get(`/api/finance-statements/${statementId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(readBack.body.status).toBe('confirmed');
  expect(readBack.body.values.length).toBeGreaterThanOrEqual(3);

  return statementId;
}

describe('FIN-005 fresh-schema bootstrap — sanctioned migration path alone is sufficient', () => {
  let app: Express;
  let token: string;

  beforeAll(async () => {
    guardedDatabaseUrl();
    await seed();
    await cleanup();
    app = await buildFinanceApp();
    token = mintToken();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('XLSX golden flow works on a database that only ever ran the sanctioned migration path', async () => {
    await runGoldenFlow(
      app,
      token,
      makeXlsxFixture(),
      `${MARK}pnl-xlsx.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }, 60_000);

  it('CSV golden flow works on a database that only ever ran the sanctioned migration path', async () => {
    await runGoldenFlow(app, token, makeCsvFixture(), `${MARK}pnl-csv.csv`, 'text/csv');
  }, 60_000);
});
