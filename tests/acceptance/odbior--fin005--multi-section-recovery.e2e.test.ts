/**
 * FIN-005 — MULTI-SECTION recovery — real router + real local PostgreSQL.
 *
 * THE DEFECT THIS PINS DOWN
 * -------------------------
 * A keyed multi-section ("smart") upload creates one Statement PER SECTION.
 * Until round 5, the abandoned-attempt bookkeeping tracked only
 * `primaryStatementId` — the FIRST section — so when the finalize step failed
 * and the client retried with the same Idempotency-Key, recovery rebuilt the
 * response from that one id and answered `mode: 'fallback'` with a single
 * `statementIds` entry. The other sections still existed in PostgreSQL but
 * were absent from the receipt: the client got a truthful-looking 201 that
 * under-reported the operation and could never read the missing sections back.
 *
 * WHAT IS REAL HERE AND WHAT IS NOT
 * ---------------------------------
 * Everything that this packet is about is REAL: the Express routers, the auth
 * middleware, `reserveIdempotentUpload`/`finalize`/`fail`, the advisory lock,
 * `createStatement`, `syncStatementToPack`, and every row in local PostgreSQL.
 * The uploaded file is a REAL two-sheet XLSX workbook.
 *
 * The ONLY stub is `analyzeAndExtractFullDocument` — the OpenAI call that
 * decides how many sections a document has. It is stubbed because it is a
 * paid, non-deterministic network dependency, and because without a key it
 * returns null, which silently routes every upload down the SINGLE-statement
 * fallback path — i.e. the multi-section code would never execute at all and
 * the suite would be green while proving nothing. The stub returns a fixed
 * two-section analysis derived from the workbook's own numbers; every
 * Statement, pack, value and idempotency row it leads to is genuinely written
 * to and read back from PostgreSQL.
 */
import path from 'path';

import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

import { mintToken } from './harness.js';
import { SEED, seed } from './seed.mjs';

const MARK = 'odbior--fin005-multi--';

const PL_LINES = [
  { originalLabel: 'Przychody ze sprzedaży', value: 1_250_000, confidence: 0.95, sourceRow: 1 },
  { originalLabel: 'Koszt własny sprzedaży', value: -700_000, confidence: 0.95, sourceRow: 2 },
  { originalLabel: 'EBIT', value: 200_000, confidence: 0.92, sourceRow: 3 },
  { originalLabel: 'Zysk netto', value: 162_000, confidence: 0.94, sourceRow: 4 },
];

const BS_LINES = [
  { originalLabel: 'Aktywa trwałe', value: 2_400_000, confidence: 0.95, sourceRow: 1 },
  { originalLabel: 'Aktywa obrotowe', value: 1_100_000, confidence: 0.95, sourceRow: 2 },
  { originalLabel: 'Suma aktywów', value: 3_500_000, confidence: 0.96, sourceRow: 3 },
  { originalLabel: 'Kapitał własny', value: 1_900_000, confidence: 0.93, sourceRow: 4 },
];

/** The deterministic stand-in for the LLM's document analysis — TWO sections. */
const TWO_SECTION_ANALYSIS = {
  entityName: 'Odbior Multi-Section Sp. z o.o.',
  periodLabel: 'FY2025',
  periodStart: '2025-01-01',
  periodEnd: '2025-12-31',
  currency: 'PLN',
  scaling: 'units',
  language: 'pl',
  documentDescription: 'Two-section report: P&L + Balance Sheet',
  sections: [
    { statementType: 'P&L' as const, lines: PL_LINES, warnings: [] },
    { statementType: 'BS' as const, lines: BS_LINES, warnings: [] },
  ],
  warnings: [],
};

vi.mock('../../server/src/services/openAIFinancialExtractionService.js', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../server/src/services/openAIFinancialExtractionService.js')
  >();
  return {
    ...actual,
    // Only the document-analysis boundary is replaced. Extraction helpers and
    // everything else stay genuinely wired.
    analyzeAndExtractFullDocument: vi.fn(async () => TWO_SECTION_ANALYSIS),
  };
});

function guardedDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('[FIN-005] DATABASE_URL is unset');
  const url = new URL(raw);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || dbName !== 'consultinity_test') {
    throw new Error(`[FIN-005] REFUSING database target host=${url.hostname} db=${dbName}`);
  }
  return raw;
}

function client(): pg.Client {
  return new pg.Client({ connectionString: guardedDatabaseUrl() });
}

/** A REAL two-sheet workbook — P&L on one sheet, Balance Sheet on the other. */
function makeTwoSectionXlsx(salt = 'base'): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Rachunek zysków i strat', 'FY2025', salt],
      ...PL_LINES.map((line) => [line.originalLabel, line.value, 'PLN']),
    ]),
    'P&L'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Bilans', 'FY2025', salt],
      ...BS_LINES.map((line) => [line.originalLabel, line.value, 'PLN']),
    ]),
    'Bilans'
  );
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function buildLegacyApp(): Promise<Express> {
  const router = (await import('../../server/src/routes/finance-statements.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/finance-statements', router);
  return app;
}

async function buildV8App(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const financeRouter = (await import('../../server/src/routes/v8/finance.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(
    '/api/v8/finance',
    verifyToken as any,
    requireV8OrgContext as any,
    attachV8Context as any,
    financeRouter as unknown as express.Router
  );
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
      for (const table of [
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
      ]) {
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

const ENDPOINTS = [
  {
    label: 'v8',
    build: buildV8App,
    path: '/api/v8/finance/statements/upload-and-analyze',
    unwrap: (body: any) => body?.data ?? body,
    readBack: (id: string) => `/api/v8/finance/statements/${id}`,
  },
  {
    label: 'legacy',
    build: buildLegacyApp,
    path: '/api/finance-statements/upload-and-analyze',
    unwrap: (body: any) => body?.data ?? body,
    readBack: (id: string) => `/api/finance-statements/${id}`,
  },
];

describe.each(ENDPOINTS)(
  'FIN-005 multi-section recovery ($label)',
  ({ label, build, path: endpointPath, unwrap, readBack }) => {
    let app: Express;
    let token: string;

    beforeAll(async () => {
      guardedDatabaseUrl();
      await seed();
      await cleanup();
      app = await build();
      token = mintToken();
    });

    afterAll(async () => {
      await cleanup();
    });

    it(`${label}: finalize failure after ALL sections are created → retry replays the COMPLETE multi-section receipt (same ids, no new Statements/Packs, every id readable)`, async () => {
      const idempotencyKey = `${MARK}${label}-complete-receipt`;
      const filename = `${MARK}${label}-complete-receipt.xlsx`;
      const fixture = makeTwoSectionXlsx();
      const escapedKey = idempotencyKey.replace(/'/g, "''");
      const constraintName = `chk_test_multi_${label}_finalize`;
      const db = client();
      await db.connect();

      try {
        // ── Attempt 1: force the finalize UPDATE for THIS key to fail, after
        // every section has already been created and synced to a pack.
        await db.query(
          `ALTER TABLE financial_statement_upload_idempotency
             ADD CONSTRAINT ${constraintName}
             CHECK (idempotency_key <> '${escapedKey}' OR status <> 'completed') NOT VALID`
        );

        const failed = await request(app)
          .post(endpointPath)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .attach('file', fixture, { filename, contentType: XLSX_MIME });

        expect(failed.status).toBe(500);
        expect(failed.body.code).toBe('STATEMENT_UPLOAD_FINALIZE_FAILED');

        // Both sections really were persisted by that attempt.
        const afterAttempt1 = await db.query(
          `SELECT id, statement_type, statement_pack_id FROM financial_statements
            WHERE source_file_name = $1 AND organization_id = $2 ORDER BY id`,
          [filename, SEED.ORG_ID]
        );
        expect(afterAttempt1.rows.length).toBe(2);
        expect(afterAttempt1.rows.every((r) => r.statement_pack_id)).toBe(true);
        const originalIds = afterAttempt1.rows.map((r) => r.id).sort();
        expect(new Set(afterAttempt1.rows.map((r) => r.statement_type))).toEqual(
          new Set(['P&L', 'BS'])
        );

        const packsAfterAttempt1 = await db.query(
          `SELECT DISTINCT statement_pack_id FROM financial_statements
            WHERE source_file_name = $1 AND organization_id = $2`,
          [filename, SEED.ORG_ID]
        );

        // The marker recorded the COMPLETE receipt, not just the first id.
        const marker = await db.query(
          `SELECT status, statement_id, response_json FROM financial_statement_upload_idempotency
            WHERE organization_id = $1 AND idempotency_key = $2`,
          [SEED.ORG_ID, idempotencyKey]
        );
        expect(marker.rows.length).toBe(1);
        expect(marker.rows[0].status).toBe('failed');
        const envelope = JSON.parse(marker.rows[0].response_json)['__fin005_failed_attempt'];
        expect([...envelope.statementIds].sort()).toEqual(originalIds);
        expect(envelope.result).toBeTruthy();
        expect(unwrap(envelope.result.body).mode).toBe('smart');

        // ── Attempt 2: fault gone, SAME key, SAME payload.
        await db.query(
          `ALTER TABLE financial_statement_upload_idempotency DROP CONSTRAINT ${constraintName}`
        );

        const retry = await request(app)
          .post(endpointPath)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .attach('file', fixture, { filename, contentType: XLSX_MIME })
          .expect(201);

        const recovered = unwrap(retry.body);

        // (1) COMPLETE multi-section response — the whole point of round 5.
        expect(recovered.mode).toBe('smart');
        expect(Array.isArray(recovered.statementIds)).toBe(true);
        expect(recovered.statementIds.length).toBe(2);
        // (2) EXACTLY the same owner ids as the original attempt.
        expect([...recovered.statementIds].sort()).toEqual(originalIds);
        // The multi-section payload a client needs is present, not nulled out.
        expect(recovered.analysis).toBeTruthy();
        expect(recovered.analysis.sectionTypes).toEqual(['P&L', 'BS']);
        expect(recovered.statements.length).toBe(2);
        expect(recovered.statementPackId).toBeTruthy();

        // (3) Recovery re-ran NOTHING: no extra Statements, no extra packs.
        const afterRetry = await db.query(
          `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
          [filename, SEED.ORG_ID]
        );
        expect(afterRetry.rows.length).toBe(2);
        expect(afterRetry.rows.map((r) => r.id).sort()).toEqual(originalIds);

        const packsAfterRetry = await db.query(
          `SELECT DISTINCT statement_pack_id FROM financial_statements
            WHERE source_file_name = $1 AND organization_id = $2`,
          [filename, SEED.ORG_ID]
        );
        expect(packsAfterRetry.rows.length).toBe(packsAfterAttempt1.rows.length);

        // (4) FRESH read-back of EVERY advertised id, through the app's own
        // connection — a receipt whose ids cannot be read is not a receipt.
        for (const id of recovered.statementIds as string[]) {
          await request(app)
            .get(readBack(id))
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        }

        // (5) The marker is now genuinely completed and replayable.
        const finalMarker = await db.query(
          `SELECT status, response_json FROM financial_statement_upload_idempotency
            WHERE organization_id = $1 AND idempotency_key = $2`,
          [SEED.ORG_ID, idempotencyKey]
        );
        expect(finalMarker.rows[0].status).toBe('completed');
        expect(unwrap(JSON.parse(finalMarker.rows[0].response_json)).statementIds.sort()).toEqual(
          originalIds
        );

        // (6) A third call with the same key+payload is a plain replay of the
        // same complete body — semantically identical to the original success.
        const replay = await request(app)
          .post(endpointPath)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .attach('file', fixture, { filename, contentType: XLSX_MIME })
          .expect(201);
        expect(replay.headers['idempotency-replayed']).toBe('true');
        expect([...unwrap(replay.body).statementIds].sort()).toEqual(originalIds);

        const afterReplay = await db.query(
          `SELECT count(*)::int AS n FROM financial_statements
            WHERE source_file_name = $1 AND organization_id = $2`,
          [filename, SEED.ORG_ID]
        );
        expect(afterReplay.rows[0].n).toBe(2);
      } finally {
        await db.query(
          `ALTER TABLE financial_statement_upload_idempotency DROP CONSTRAINT IF EXISTS ${constraintName}`
        );
        await db.end();
      }
    }, 60_000);

    it(`${label}: after a recovered multi-section upload, the SAME key with a DIFFERENT payload is still a hard 409`, async () => {
      const idempotencyKey = `${MARK}${label}-mismatch`;
      const filename = `${MARK}${label}-mismatch.xlsx`;
      const db = client();
      await db.connect();
      try {
        await request(app)
          .post(endpointPath)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .attach('file', makeTwoSectionXlsx('first'), { filename, contentType: XLSX_MIME })
          .expect(201);

        const mismatch = await request(app)
          .post(endpointPath)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .attach('file', makeTwoSectionXlsx('DIFFERENT'), {
            filename: `${MARK}${label}-mismatch-other.xlsx`,
            contentType: XLSX_MIME,
          });

        expect(mismatch.status).toBe(409);
        expect(mismatch.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

        // The rejected payload wrote nothing.
        const rows = await db.query(
          `SELECT count(*)::int AS n FROM financial_statements
            WHERE source_file_name = $1 AND organization_id = $2`,
          [`${MARK}${label}-mismatch-other.xlsx`, SEED.ORG_ID]
        );
        expect(rows.rows[0].n).toBe(0);
      } finally {
        await db.end();
      }
    }, 60_000);

    it(`${label}: a multi-section attempt that died WITHOUT recording a complete response is compensated, never answered with a single-section fallback`, async () => {
      // Contract item 5: if a complete receipt cannot be reconstructed
      // honestly, the operation must not fake one. Here the attempt created
      // both sections but recorded no result body (simulating a crash between
      // the business writes and the receipt), so recovery must NOT return a
      // one-id 'fallback' success — it must compensate and redo cleanly.
      const idempotencyKey = `${MARK}${label}-no-receipt`;
      const filename = `${MARK}${label}-no-receipt.xlsx`;
      const fixture = makeTwoSectionXlsx();
      const db = client();
      await db.connect();
      try {
        await request(app)
          .post(endpointPath)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .attach('file', fixture, { filename, contentType: XLSX_MIME })
          .expect(201);

        const first = await db.query(
          `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2 ORDER BY id`,
          [filename, SEED.ORG_ID]
        );
        expect(first.rows.length).toBe(2);
        const firstIds = first.rows.map((r) => r.id).sort();

        // Rewrite history: the marker looks like an attempt that persisted two
        // sections and then died before recording any response body, and is
        // old enough to be reclaimable.
        await db.query(
          `UPDATE financial_statement_upload_idempotency
              SET status = 'failed', response_json = $3, statement_id = $4
            WHERE organization_id = $1 AND idempotency_key = $2`,
          [
            SEED.ORG_ID,
            idempotencyKey,
            JSON.stringify({ __fin005_failed_attempt: { statementIds: firstIds } }),
            firstIds[0],
          ]
        );

        const retry = await request(app)
          .post(endpointPath)
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', idempotencyKey)
          .attach('file', fixture, { filename, contentType: XLSX_MIME })
          .expect(201);

        const body = unwrap(retry.body);
        // NOT a single-id fallback receipt.
        expect(body.mode).toBe('smart');
        expect(body.statementIds.length).toBe(2);
        // The stale pair was compensated, not left behind as duplicates.
        const after = await db.query(
          `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
          [filename, SEED.ORG_ID]
        );
        expect(after.rows.length).toBe(2);
        for (const oldId of firstIds) {
          expect(after.rows.map((r) => r.id)).not.toContain(oldId);
        }
      } finally {
        await db.end();
      }
    }, 60_000);
  }
);
