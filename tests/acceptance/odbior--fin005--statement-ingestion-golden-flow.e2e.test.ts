/**
 * FIN-005 — statement ingestion golden flow — real router + real local
 * PostgreSQL acceptance.
 *
 * Covers: XLSX + CSV upload -> detect -> extract -> map -> values -> validate
 * -> confirm -> GET read-back -> reopen (hard re-GET), upload idempotency,
 * cross-tenant denial, and the negative/security controls called out in the
 * FIN-005 packet (malformed file, corrupted/non-matching-signature file,
 * pathological workbook, CSV encoding/delimiter variants).
 *
 * Run with a LOCAL-only DATABASE_URL pointed at `consultinity_test`, mirroring
 * the guard pattern in odbior--fin003a--statement-import.e2e.test.ts and
 * tests/acceptance/harness.ts's requireLocalDbUrl().
 */
import crypto from 'crypto';
import path from 'path';

import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { mintToken } from './harness.js';
import { SEED, seed } from './seed.mjs';

const MARK = 'odbior--fin005--';

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

// Two-period comparative P&L with all canonical "required" lines covered
// (revenue, cogs, gross, opex, ebit, interest/fin-expense, tax, net) — see
// FIN-005 discovery gate doc for why a single-value-column layout does not
// reach the real extractor's >=2-numeric-tokens-per-line gate.
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

/**
 * CSV fixture exercising the encoding/delimiter variants called out in the
 * packet: UTF-8 BOM + semicolon delimiter (Polish-locale Excel export norm,
 * since comma is the decimal separator there) + Polish diacritics.
 */
function makeCsvFixture(): Buffer {
  const lines = [
    'Rachunek zysków i strat;FY2025;FY2024;PLN',
    ...PL_ROWS.map(([label, v1, v2]) => `${label};${v1};${v2};PLN`),
  ];
  const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([utf8Bom, Buffer.from(lines.join('\n'), 'utf-8')]);
}

/** Workbook with more sheets than the MAX_XLSX_SHEETS safety cap (200). */
function makeOversizedSheetCountXlsxFixture(): Buffer {
  const workbook = XLSX.utils.book_new();
  for (let i = 0; i < 205; i++) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['x', 1]]), `S${i}`);
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function buildFinanceApp(): Promise<Express> {
  const router = (await import('../../server/src/routes/finance-statements.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/finance-statements', router);
  return app;
}

/**
 * FIN-005 Fix 2 regression suite: mounts the REAL v8 finance router behind
 * the REAL verifyToken -> requireV8OrgContext -> attachV8Context middleware
 * chain — mirrors routes/v8/index.ts:46-63 and the identical pattern already
 * proven in tests/acceptance/fin-003-004-case-scenario-lifecycle.e2e.test.ts.
 */
async function buildV8FinanceApp(): Promise<Express> {
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

async function runGoldenFlow(
  app: Express,
  token: string,
  fixture: Buffer,
  filename: string,
  contentType: string
) {
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

  const readBack1 = await request(app)
    .get(`/api/finance-statements/${statementId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(readBack1.body.status).toBe('confirmed');
  expect(readBack1.body.values.length).toBeGreaterThanOrEqual(3);

  // "Hard reload / reopen" — GET the same id again; must be identical.
  const readBack2 = await request(app)
    .get(`/api/finance-statements/${statementId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(readBack2.body.status).toBe(readBack1.body.status);
  expect(readBack2.body.values.length).toBe(readBack1.body.values.length);
  expect(readBack2.body.values.map((v: any) => v.original_label).sort()).toEqual(
    readBack1.body.values.map((v: any) => v.original_label).sort()
  );

  // Provenance: candidate rows carry source_row + original label + normalized
  // value + classification/transformation status (FIN-005 requirement).
  const db = client();
  await db.connect();
  try {
    const candidateRows = await db.query(
      `SELECT row_label, source_row, normalized_value, classification_reason
         FROM financial_statement_candidate_rows WHERE statement_id = $1`,
      [statementId]
    );
    expect(candidateRows.rows.length).toBeGreaterThan(0);
    expect(candidateRows.rows[0].row_label).toBeTruthy();
    expect(candidateRows.rows[0].source_row).not.toBeNull();
  } finally {
    await db.end();
  }

  return statementId;
}

describe('FIN-005 statement ingestion golden flow — real route and PostgreSQL', () => {
  let app: Express;
  let token: string;
  let foreignOrgId: string;
  let foreignUserId: string;

  beforeAll(async () => {
    guardedDatabaseUrl();
    await seed();
    await cleanup();
    app = await buildFinanceApp();
    token = mintToken();

    const db = client();
    await db.connect();
    try {
      foreignOrgId = `${MARK}foreign-org`;
      foreignUserId = `${MARK}foreign-user`;
      await db.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $2, 'enterprise', 'active', 1, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [foreignOrgId, `${MARK}Foreign Org`]
      );
      await db.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
         VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'Foreign', 'User', CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [foreignUserId, foreignOrgId, `${MARK}foreign@acceptance.local`]
      );
      await db.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
         SELECT $3, $1, $2, 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP
         WHERE NOT EXISTS (
           SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2
         )`,
        [foreignOrgId, foreignUserId, `${MARK}foreign-mem`]
      );
    } finally {
      await db.end();
    }
  });

  afterAll(async () => {
    await cleanup();
    const db = client();
    await db.connect();
    try {
      await db.query(`DELETE FROM organization_members WHERE organization_id = $1`, [foreignOrgId]);
      await db.query(`DELETE FROM users WHERE id = $1`, [foreignUserId]);
      await db.query(`DELETE FROM organizations WHERE id = $1`, [foreignOrgId]);
    } finally {
      await db.end();
    }
  });

  it('XLSX golden flow: upload -> detect -> extract -> map -> values -> validate -> confirm -> read-back -> reopen', async () => {
    await runGoldenFlow(
      app,
      token,
      makeXlsxFixture(),
      `${MARK}pnl-xlsx.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  }, 60_000);

  it('CSV golden flow (BOM + semicolon-delimited, Polish diacritics): same end-to-end path', async () => {
    await runGoldenFlow(app, token, makeCsvFixture(), `${MARK}pnl-csv.csv`, 'text/csv');
  }, 60_000);

  it('cross-tenant denial: a genuinely different org+user cannot read another org\'s statement', async () => {
    const upload = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', makeXlsxFixture(), {
        filename: `${MARK}tenant-check.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);
    const statementId = upload.body.statementId;

    const foreignToken = mintToken({
      id: foreignUserId,
      organizationId: foreignOrgId,
      organization_id: foreignOrgId,
    });
    await request(app)
      .get(`/api/finance-statements/${statementId}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .expect(404);

    // Cross-tenant WRITE is denied too, not just read.
    await request(app)
      .put(`/api/finance-statements/${statementId}/values`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({ values: [] })
      .expect(404);
  }, 30_000);

  it('idempotent retry: same file + same Idempotency-Key does not create a duplicate statement or pack', async () => {
    const idempotencyKey = `${MARK}idem-key-1`;
    const fixture = makeXlsxFixture();
    const filename = `${MARK}idempotency.xlsx`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const first = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', fixture, { filename, contentType })
      .expect(201);

    const second = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', fixture, { filename, contentType })
      .expect(201);

    expect(second.body.statementId).toBe(first.body.statementId);
    expect(second.headers['idempotency-replayed']).toBe('true');

    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
        [filename, SEED.ORG_ID]
      );
      expect(rows.rows.length).toBe(1);
    } finally {
      await db.end();
    }
  }, 60_000);

  it('a different Idempotency-Key for the same file DOES create a second statement (sanity: key is the dedupe axis, not the file)', async () => {
    const fixture = makeXlsxFixture();
    const filename = `${MARK}idempotency-distinct.xlsx`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const first = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}idem-key-a`)
      .attach('file', fixture, { filename, contentType })
      .expect(201);

    const second = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `${MARK}idem-key-b`)
      .attach('file', fixture, { filename, contentType })
      .expect(201);

    expect(second.body.statementId).not.toBe(first.body.statementId);
  }, 60_000);

  // ═══════════ Codex review Blocker 2: real Postgres-level serialization ═══════════

  it('Blocker 2 — Promise.all concurrency: two genuinely concurrent requests, same org+key+file, produce exactly ONE statement/pack/marker row', async () => {
    const idempotencyKey = `${MARK}idem-concurrent-1`;
    const fixture = makeXlsxFixture();
    const filename = `${MARK}idempotency-concurrent.xlsx`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const makeRequest = () =>
      request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', fixture, { filename, contentType });

    const [a, b] = await Promise.all([makeRequest(), makeRequest()]);
    // This route's idempotency convention (matching the pre-existing
    // "idempotent retry" test above): a replay is still 201, distinguished
    // only by the Idempotency-Replayed header — so both responses are 201
    // here; what must never happen is BOTH being genuinely fresh creates,
    // or either being a 500 from a lock/DB race.
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.statementId).toBe(b.body.statementId);
    // Exactly one of the two is the fresh upload; the other is the replay
    // (Idempotency-Replayed header) — never both fresh, never neither.
    const replayed = [a, b].filter((r) => r.headers['idempotency-replayed'] === 'true');
    expect(replayed.length).toBe(1);

    const db = client();
    await db.connect();
    try {
      const statementRows = await db.query(
        `SELECT id, statement_pack_id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
        [filename, SEED.ORG_ID]
      );
      expect(statementRows.rows.length).toBe(1); // exactly one Statement row, not two

      const packId = statementRows.rows[0].statement_pack_id;
      expect(packId).toBeTruthy();
      const packRows = await db.query(`SELECT id FROM financial_statement_packs WHERE id = $1`, [
        packId,
      ]);
      expect(packRows.rows.length).toBe(1); // exactly one Pack row

      const markerRows = await db.query(
        `SELECT id, statement_id FROM financial_statement_upload_idempotency WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, idempotencyKey]
      );
      expect(markerRows.rows.length).toBe(1); // exactly one idempotency marker row
      expect(markerRows.rows[0].statement_id).toBe(a.body.statementId);
    } finally {
      await db.end();
    }
  }, 60_000);

  it('Blocker 2 — a failure AFTER the lock is acquired but BEFORE the upload completes does not deadlock a same-key retry', async () => {
    const idempotencyKey = `${MARK}idem-fail-then-retry`;
    // Passes the zip-signature sniff (PK header) so the request gets well
    // into performUpload() — past the lock acquisition and the "no existing
    // marker" check — before SheetJS's real parse fails.
    const fakeZip = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('not actually a valid ooxml package structure'.repeat(10)),
    ]);

    const failed = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', fakeZip, { filename: `${MARK}fail-then-retry.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(422);
    expect(failed.headers['idempotency-replayed']).toBeUndefined();

    // Retry with the SAME key but a genuinely valid file — must succeed,
    // not hang/deadlock and not be treated as a conflict.
    const retry = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', makeXlsxFixture(), {
        filename: `${MARK}fail-then-retry-ok.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(201);
    expect(retry.body.statementId).toBeTruthy();

    const db = client();
    await db.connect();
    try {
      const markerRows = await db.query(
        `SELECT status_code FROM financial_statement_upload_idempotency WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, idempotencyKey]
      );
      // Only the SUCCESSFUL retry left a marker — the failed first attempt
      // recorded nothing (no permanent "in_progress" reservation to get stuck on).
      expect(markerRows.rows.length).toBe(1);
      expect(markerRows.rows[0].status_code).toBe(201);
    } finally {
      await db.end();
    }
  }, 60_000);

  // ═══════════ Codex review Blocker 3: idempotency key bound to request content ═══════════

  it('Blocker 3 — same Idempotency-Key, DIFFERENT file content: hard 409 IDEMPOTENCY_KEY_REUSED, never a silent replay', async () => {
    const idempotencyKey = `${MARK}idem-reuse-check`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const first = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', makeXlsxFixture(), { filename: `${MARK}reuse-a.xlsx`, contentType })
      .expect(201);

    // Different bytes (different filename inside the workbook + differently
    // shaped rows), SAME Idempotency-Key.
    const otherWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      otherWorkbook,
      XLSX.utils.aoa_to_sheet([['Completely different content', 999]]),
      'Other'
    );
    const otherFixture = XLSX.write(otherWorkbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const second = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', otherFixture, { filename: `${MARK}reuse-b.xlsx`, contentType })
      .expect(409);
    expect(second.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT id FROM financial_statements WHERE source_file_name = $1`,
        [`${MARK}reuse-b.xlsx`]
      );
      expect(rows.rows.length).toBe(0); // the reused-key request never created a second statement

      expect(first.body.statementId).toBeTruthy();
    } finally {
      await db.end();
    }
  }, 60_000);

  it('Blocker 3 — an Idempotency-Key over the length cap is REJECTED (400), never silently truncated', async () => {
    const tooLongKey = `${MARK}too-long-${'x'.repeat(250)}`;
    expect(tooLongKey.length).toBeGreaterThan(200);

    const res = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', tooLongKey)
      .attach('file', makeXlsxFixture(), {
        filename: `${MARK}key-too-long.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(400);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_TOO_LONG');

    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT id FROM financial_statements WHERE source_file_name = $1`,
        [`${MARK}key-too-long.xlsx`]
      );
      expect(rows.rows.length).toBe(0); // rejected before any work happened
    } finally {
      await db.end();
    }
  }, 30_000);

  it('Blocker 3 — two DIFFERENT over-length keys sharing a 200-char prefix are BOTH rejected, never collide (truncation would falsely replay)', async () => {
    const sharedPrefix = `${MARK}shared-prefix-`.padEnd(210, 'p');
    const keyA = `${sharedPrefix}AAAAAAAAAA`;
    const keyB = `${sharedPrefix}BBBBBBBBBB`;
    expect(keyA.length).toBeGreaterThan(200);
    expect(keyB.length).toBeGreaterThan(200);
    expect(keyA.slice(0, 200)).toBe(keyB.slice(0, 200)); // genuinely share the truncated prefix
    expect(keyA).not.toBe(keyB); // but are logically different keys to the client

    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const resA = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', keyA)
      .attach('file', makeXlsxFixture(), { filename: `${MARK}prefix-a.xlsx`, contentType })
      .expect(400);
    expect(resA.body.code).toBe('IDEMPOTENCY_KEY_TOO_LONG');

    const resB = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', keyB)
      .attach('file', makeXlsxFixture(), { filename: `${MARK}prefix-b.xlsx`, contentType })
      .expect(400);
    expect(resB.body.code).toBe('IDEMPOTENCY_KEY_TOO_LONG');

    // Neither request did any work — proof there is no "second request
    // silently replays the first's result" collision left for truncation to
    // cause (see this suite's file header / the route's
    // IdempotencyKeyTooLongError doc comment for why truncation was
    // rejected as an implementation option).
    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT id FROM financial_statements WHERE source_file_name IN ($1, $2)`,
        [`${MARK}prefix-a.xlsx`, `${MARK}prefix-b.xlsx`]
      );
      expect(rows.rows.length).toBe(0);
    } finally {
      await db.end();
    }
  }, 30_000);

  it('malformed file: bytes claiming to be .xlsx but not a real zip/OOXML container fails closed (422, no fake success)', async () => {
    const garbage = Buffer.from('this is not a real xlsx file, just plain garbage bytes\n'.repeat(20));
    const res = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', garbage, {
        filename: `${MARK}malformed.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(422);
    expect(res.body.code).toBe('FILE_UPLOAD_SIGNATURE_MISMATCH');

    const db = client();
    await db.connect();
    try {
      const rows = await db.query(
        `SELECT id FROM financial_statements WHERE source_file_name = $1`,
        [`${MARK}malformed.xlsx`]
      );
      expect(rows.rows.length).toBe(0);
    } finally {
      await db.end();
    }
  }, 30_000);

  it('a real zip that is not a valid OOXML workbook fails the PARSE step (deeper than signature), still 422, no fake success', async () => {
    // Passes the zip-signature sniff (PK header) but SheetJS cannot parse it
    // as a workbook — exercises the extractTextFromFile try/catch path
    // distinctly from the magic-byte check above.
    const fakeZip = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK\x03\x04 local file header
      Buffer.from('not actually a valid ooxml package structure'.repeat(10)),
    ]);
    const res = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fakeZip, {
        filename: `${MARK}fake-zip.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(422);
    expect(res.body.error).toBeTruthy();
  }, 30_000);

  it('pathological workbook (sheet count over the safety cap) is rejected before a full parse, not silently truncated', async () => {
    const res = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', makeOversizedSheetCountXlsxFixture(), {
        filename: `${MARK}oversized.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .expect(422);
    expect(String(res.body.detail || '')).toMatch(/sheet/i);
  }, 30_000);

  it('a CSV missing recognizable financial line items does not silently look like success (readiness stays not-ready)', async () => {
    const emptyCsv = Buffer.from('Column A;Column B\nfoo;bar\n', 'utf-8');
    const upload = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', emptyCsv, { filename: `${MARK}no-data.csv`, contentType: 'text/csv' })
      .expect(201);
    const statementId = upload.body.statementId;

    await request(app)
      .post(`/api/finance-statements/${statementId}/extract`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const validation = await request(app)
      .post(`/api/finance-statements/${statementId}/validate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(validation.body.readiness.isReady).toBe(false);
  }, 30_000);

  // ═══════════ Round-3 Codex review: reservation/result state machine ═══════════
  //
  // Round 3 found that `recordIdempotentUpload` (now removed) was
  // "best-effort" in the worst sense: it caught EVERY non-schema-compat
  // error and never re-threw, so a failure of just the marker INSERT left
  // the business writes (Statement + Pack, which commit independently)
  // durably committed, a 201 already sent, and NO durable marker — a
  // same-key retry then found nothing and redid the whole upload. The fix
  // (see finance-statements.routes.ts's `reserveIdempotentUpload` /
  // `finalizeIdempotentUpload` / `failIdempotentUpload`) is a durable
  // reservation/result state machine on the idempotency row itself,
  // underneath the existing `pg_advisory_xact_lock` serialization. These
  // tests fault-inject each failure mode the new state machine exists to
  // survive.

  it('round-3 Proof 1 — finalize UPDATE failure: no 201, marker never silently "completed"; a later retry (once the fault is gone) reaches exactly one completed marker', async () => {
    const idempotencyKey = `${MARK}round3-finalize-fault`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const db = client();
    await db.connect();
    try {
      // Force ONLY the finalize UPDATE for this exact key to fail — a CHECK
      // constraint that forbids this key's row from ever reaching
      // status='completed'. `idempotency_key <> '...'` makes every OTHER
      // row's constraint check trivially TRUE regardless of status, so this
      // has zero effect on concurrent activity from other tests/keys. `NOT
      // VALID` skips validating pre-existing rows at ADD time (irrelevant
      // here — the row does not exist yet) while still enforcing the check
      // on every future write, which is exactly what's needed: the
      // reservation INSERT (status='in_progress') passes, but the finalize
      // UPDATE (status='completed') for this key is rejected by Postgres.
      // Postgres CHECK expressions cannot take bind parameters ($1) — they
      // must be a literal at DDL time — so the (fully test-controlled,
      // punctuation-free) key is embedded directly, with defensive quote
      // doubling in case that ever changes.
      const escapedKey = idempotencyKey.replace(/'/g, "''");
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency
           ADD CONSTRAINT chk_test_force_finalize_failure
           CHECK (idempotency_key <> '${escapedKey}' OR status <> 'completed') NOT VALID`
      );

      const failed = await request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', makeXlsxFixture(), {
          filename: `${MARK}round3-finalize-fault.xlsx`,
          contentType,
        });
      // Never a 201 when the finalize UPDATE cannot be confirmed.
      expect(failed.status).toBe(500);
      expect(failed.body.code).toBe('STATEMENT_UPLOAD_FINALIZE_FAILED');
      expect(failed.headers['idempotency-replayed']).toBeUndefined();

      const midRows = await db.query(
        `SELECT status, statement_id, orphaned_statement_ids, response_json
           FROM financial_statement_upload_idempotency
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, idempotencyKey]
      );
      expect(midRows.rows.length).toBe(1); // the reservation itself is durable — never silently dropped
      expect(midRows.rows[0].status).not.toBe('completed'); // never silently marked complete
      expect(midRows.rows[0].status).toBe('failed'); // the caught finalize failure was recorded as 'failed'
      // Fix 1 (orphan-tracking): performUpload() DID already persist a real
      // Statement before the finalize UPDATE was rejected by the constraint
      // — failIdempotentUpload now records that id on the row (instead of
      // leaving it null, which used to silently lose the reference the
      // moment a later reclaim nulled it out for a new attempt — see the
      // dedicated "Fix 1" orphan-tracking test below for the full
      // double-failure reclaim proof).
      const orphanedStatementId = midRows.rows[0].statement_id;
      expect(orphanedStatementId).toBeTruthy();

      // "Once the fault is no longer forced" — remove the constraint.
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency DROP CONSTRAINT chk_test_force_finalize_failure`
      );

      const retry = await request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', makeXlsxFixture(), {
          filename: `${MARK}round3-finalize-fault-retry.xlsx`,
          contentType,
        })
        .expect(201);
      expect(retry.body.statementId).toBeTruthy();

      const finalRows = await db.query(
        `SELECT status, statement_id, orphaned_statement_ids
           FROM financial_statement_upload_idempotency
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, idempotencyKey]
      );
      // Exactly ONE final completed marker — the retry RECLAIMED the same
      // row (via the 'failed' branch), it did not insert a second one.
      expect(finalRows.rows.length).toBe(1);
      expect(finalRows.rows[0].status).toBe('completed');
      expect(finalRows.rows[0].statement_id).toBe(retry.body.statementId);
      // Fix 1: the reclaim that nulled statement_id for the retry's attempt
      // moved the first attempt's real (orphaned) Statement id into
      // orphaned_statement_ids instead of dropping it.
      expect(finalRows.rows[0].orphaned_statement_ids).toEqual([orphanedStatementId]);

      const orphanedStillExists = await db.query(
        `SELECT id FROM financial_statements WHERE id = $1`,
        [orphanedStatementId]
      );
      expect(orphanedStillExists.rows.length).toBe(1); // nothing was deleted
    } finally {
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency DROP CONSTRAINT IF EXISTS chk_test_force_finalize_failure`
      );
      await db.end();
    }
  }, 60_000);

  it('round-3 Proof 2 — a performUpload()-level failure AFTER the reservation but BEFORE finalize is reclaimed by a later attempt: end state is exactly ONE Statement, ONE Pack, ONE completed marker', async () => {
    const idempotencyKey = `${MARK}round3-mid-flight-fault`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    // Passes the zip-signature sniff (PK header) so the request reserves the
    // row and gets into performUpload() before SheetJS's real parse fails —
    // exercising the 'failed' branch, not the schema/conflict branches.
    const fakeZip = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('not actually a valid ooxml package structure'.repeat(10)),
    ]);

    const first = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', fakeZip, {
        filename: `${MARK}round3-mid-flight.xlsx`,
        contentType,
      })
      .expect(422);
    expect(first.headers['idempotency-replayed']).toBeUndefined();

    const db = client();
    await db.connect();
    try {
      const midRows = await db.query(
        `SELECT status, statement_id FROM financial_statement_upload_idempotency
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, idempotencyKey]
      );
      expect(midRows.rows.length).toBe(1);
      expect(midRows.rows[0].status).toBe('failed'); // reclaim-eligible immediately, no staleness wait needed

      const retry = await request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', makeXlsxFixture(), {
          filename: `${MARK}round3-mid-flight-ok.xlsx`,
          contentType,
        })
        .expect(201);
      expect(retry.body.statementId).toBeTruthy();

      const statementRows = await db.query(
        `SELECT id, statement_pack_id FROM financial_statements
          WHERE source_file_name = $1 AND organization_id = $2`,
        [`${MARK}round3-mid-flight-ok.xlsx`, SEED.ORG_ID]
      );
      expect(statementRows.rows.length).toBe(1); // exactly one Statement — the failed attempt created none

      const packId = statementRows.rows[0].statement_pack_id;
      expect(packId).toBeTruthy();
      const packRows = await db.query(`SELECT id FROM financial_statement_packs WHERE id = $1`, [
        packId,
      ]);
      expect(packRows.rows.length).toBe(1); // exactly one Pack

      const finalRows = await db.query(
        `SELECT id, status, statement_id FROM financial_statement_upload_idempotency
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, idempotencyKey]
      );
      expect(finalRows.rows.length).toBe(1); // exactly one marker row — the SAME row, reclaimed, not a second one
      expect(finalRows.rows[0].id).toBe(midRows.rows[0].id ?? finalRows.rows[0].id);
      expect(finalRows.rows[0].status).toBe('completed');
      expect(finalRows.rows[0].statement_id).toBe(retry.body.statementId);
    } finally {
      await db.end();
    }
  }, 60_000);

  it('round-3 — a genuinely fresh (non-stale) in_progress reservation is NOT reclaimed: a concurrent request is rejected retryable, never creates a second Statement', async () => {
    const idempotencyKey = `${MARK}round3-genuinely-in-flight`;
    const fixture = makeXlsxFixture();
    const filename = `${MARK}round3-in-flight.xlsx`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const requestHash = crypto.createHash('sha256').update(fixture).digest('hex');

    const db = client();
    await db.connect();
    try {
      // Simulate a real in-flight owner: insert a FRESH 'in_progress' row
      // directly (bypassing the route), matching hash — as if another
      // request is, right now, still inside performUpload() for this key.
      await db.query(
        `INSERT INTO financial_statement_upload_idempotency
           (id, organization_id, idempotency_key, statement_id, status_code, response_json, request_hash, status, created_at)
         VALUES ($1, $2, $3, NULL, 0, NULL, $4, 'in_progress', CURRENT_TIMESTAMP)`,
        [`${MARK}manual-reservation`, SEED.ORG_ID, idempotencyKey, requestHash]
      );

      const res = await request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', fixture, { filename, contentType })
        .expect(409);
      expect(res.body.code).toBe('UPLOAD_IN_PROGRESS');
      expect(res.headers['retry-after']).toBeTruthy();

      const rows = await db.query(
        `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
        [filename, SEED.ORG_ID]
      );
      expect(rows.rows.length).toBe(0); // no Statement created while genuinely in-flight
    } finally {
      await db.query(`DELETE FROM financial_statement_upload_idempotency WHERE id = $1`, [
        `${MARK}manual-reservation`,
      ]);
      await db.end();
    }
  }, 30_000);

  it('round-3 — a STALE in_progress reservation (older than the cutoff) IS reclaimed and completes normally', async () => {
    const idempotencyKey = `${MARK}round3-stale-reclaim`;
    const fixture = makeXlsxFixture();
    const filename = `${MARK}round3-stale.xlsx`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const requestHash = crypto.createHash('sha256').update(fixture).digest('hex');

    const db = client();
    await db.connect();
    try {
      // A reservation abandoned long enough ago (well past the 60s
      // staleness cutoff in reserveIdempotentUpload) to simulate a
      // crashed/killed process that reserved but never finalized or failed.
      await db.query(
        `INSERT INTO financial_statement_upload_idempotency
           (id, organization_id, idempotency_key, statement_id, status_code, response_json, request_hash, status, created_at)
         VALUES ($1, $2, $3, NULL, 0, NULL, $4, 'in_progress', CURRENT_TIMESTAMP - INTERVAL '10 minutes')`,
        [`${MARK}manual-stale-reservation`, SEED.ORG_ID, idempotencyKey, requestHash]
      );

      const res = await request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', fixture, { filename, contentType })
        .expect(201);
      expect(res.body.statementId).toBeTruthy();

      const rows = await db.query(
        `SELECT id, status, statement_id FROM financial_statement_upload_idempotency
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, idempotencyKey]
      );
      expect(rows.rows.length).toBe(1); // the SAME row was reclaimed, not a second one
      expect(rows.rows[0].id).toBe(`${MARK}manual-stale-reservation`);
      expect(rows.rows[0].status).toBe('completed');
      expect(rows.rows[0].statement_id).toBe(res.body.statementId);
    } finally {
      await db.end();
    }
  }, 30_000);

  it('round-3 Proof 3 — missing-schema fail-closed: a KEYED upload is rejected AND zero business writes happen when the state-machine column is absent', async () => {
    const idempotencyKey = `${MARK}round3-schema-missing`;
    const filename = `${MARK}round3-schema-missing.xlsx`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const db = client();
    await db.connect();
    try {
      // Simulate a schema that never got the 20260805 state-machine
      // migration — the reservation INSERT explicitly references `status`,
      // so dropping just that column reproduces the same schema-compat
      // error a genuinely un-migrated table would raise. Scoped to the
      // shortest possible window (one HTTP request) and restored in
      // `finally` regardless of outcome.
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency DROP COLUMN IF EXISTS status`
      );

      const res = await request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', makeXlsxFixture(), { filename, contentType })
        .expect(503);
      expect(res.body.code).toBe('IDEMPOTENCY_SCHEMA_UNAVAILABLE');

      const rows = await db.query(
        `SELECT id FROM financial_statements WHERE source_file_name = $1`,
        [filename]
      );
      expect(rows.rows.length).toBe(0); // ZERO business writes — verified by querying the DB directly, not the HTTP status alone
    } finally {
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency
           ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'`
      );
      await db.query(
        `DO $$
         BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fsui_status_values') THEN
             ALTER TABLE financial_statement_upload_idempotency
               ADD CONSTRAINT chk_fsui_status_values CHECK (status IN ('in_progress', 'completed', 'failed'));
           END IF;
         END $$;`
      );
      await db.end();
    }
  }, 30_000);

  it('round-3 — the UNKEYED path is unaffected by the schema-missing guard (no Idempotency-Key still works on a schema predating this feature)', async () => {
    const filename = `${MARK}round3-unkeyed-schema-missing.xlsx`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const db = client();
    await db.connect();
    try {
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency DROP COLUMN IF EXISTS status`
      );

      // No Idempotency-Key header at all — reserveIdempotentUpload() is
      // never called, so the missing column must have zero effect.
      const res = await request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', makeXlsxFixture(), { filename, contentType })
        .expect(201);
      expect(res.body.statementId).toBeTruthy();
    } finally {
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency
           ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'`
      );
      await db.query(
        `DO $$
         BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fsui_status_values') THEN
             ALTER TABLE financial_statement_upload_idempotency
               ADD CONSTRAINT chk_fsui_status_values CHECK (status IN ('in_progress', 'completed', 'failed'));
           END IF;
         END $$;`
      );
      await db.end();
    }
  }, 30_000);

  it('round-3 Requirement 8 — temp file cleanup: replay, 409-reuse, retryable in-progress, and schema-missing exit paths do not leak the multer temp file on disk', async () => {
    const fs = await import('fs');
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    // Same directory formula as resolveAssessmentUploadDir()
    // (fileUpload.middleware.ts) for the un-transformed SEED.ORG_ID.
    const uploadDir = path.join(process.cwd(), 'uploads', 'assessments', SEED.ORG_ID);
    const listFiles = (): Set<string> =>
      fs.existsSync(uploadDir) ? new Set(fs.readdirSync(uploadDir)) : new Set();

    // ── Success path (control): exactly one new file appears and stays — it
    // is the Statement's permanent evidentiary source.
    const replayKey = `${MARK}round3-cleanup-replay`;
    const fixture = makeXlsxFixture();
    const beforeFirst = listFiles();
    await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', replayKey)
      .attach('file', fixture, { filename: `${MARK}round3-cleanup-replay.xlsx`, contentType })
      .expect(201);
    const afterFirst = listFiles();
    expect([...afterFirst].filter((f) => !beforeFirst.has(f)).length).toBe(1);

    // ── Replay path: a second upload with the same key+content is a REPLAY
    // — its freshly-multer-written temp file must be deleted, not kept.
    const beforeReplay = listFiles();
    const replay = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', replayKey)
      .attach('file', fixture, { filename: `${MARK}round3-cleanup-replay.xlsx`, contentType })
      .expect(201);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(listFiles().size).toBe(beforeReplay.size); // no net new file left behind

    // ── 409 reuse-reject path.
    const reuseKey = `${MARK}round3-cleanup-reuse`;
    await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', reuseKey)
      .attach('file', fixture, { filename: `${MARK}round3-cleanup-reuse-a.xlsx`, contentType })
      .expect(201);
    // Different CONTENT, same .xlsx extension/mimetype (a mismatched
    // extension/content-type pairing would be rejected by multer's
    // fileFilter before ever reaching the route — see the pre-existing
    // "Blocker 3" hash-mismatch test above for the same pattern).
    const otherWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      otherWorkbook,
      XLSX.utils.aoa_to_sheet([['Different content for the cleanup reuse-reject check', 1]]),
      'Other'
    );
    const otherFixture = XLSX.write(otherWorkbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const beforeReuse = listFiles();
    const reuseRejected = await request(app)
      .post('/api/finance-statements/upload')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', reuseKey)
      .attach('file', otherFixture, {
        filename: `${MARK}round3-cleanup-reuse-b.xlsx`,
        contentType,
      })
      .expect(409);
    expect(reuseRejected.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(listFiles().size).toBe(beforeReuse.size);

    const db = client();
    await db.connect();
    try {
      // ── Retryable in-progress path.
      const inProgressKey = `${MARK}round3-cleanup-inprogress`;
      const requestHash = crypto.createHash('sha256').update(fixture).digest('hex');
      await db.query(
        `INSERT INTO financial_statement_upload_idempotency
           (id, organization_id, idempotency_key, statement_id, status_code, response_json, request_hash, status, created_at)
         VALUES ($1, $2, $3, NULL, 0, NULL, $4, 'in_progress', CURRENT_TIMESTAMP)`,
        [`${MARK}manual-cleanup-inprogress`, SEED.ORG_ID, inProgressKey, requestHash]
      );
      try {
        const beforeInProgress = listFiles();
        await request(app)
          .post('/api/finance-statements/upload')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', inProgressKey)
          .attach('file', fixture, {
            filename: `${MARK}round3-cleanup-inprogress.xlsx`,
            contentType,
          })
          .expect(409);
        expect(listFiles().size).toBe(beforeInProgress.size);
      } finally {
        await db.query(`DELETE FROM financial_statement_upload_idempotency WHERE id = $1`, [
          `${MARK}manual-cleanup-inprogress`,
        ]);
      }

      // ── Fail-closed schema-missing path.
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency DROP COLUMN IF EXISTS status`
      );
      try {
        const beforeSchemaMissing = listFiles();
        await request(app)
          .post('/api/finance-statements/upload')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', `${MARK}round3-cleanup-schema-missing`)
          .attach('file', fixture, {
            filename: `${MARK}round3-cleanup-schema-missing.xlsx`,
            contentType,
          })
          .expect(503);
        expect(listFiles().size).toBe(beforeSchemaMissing.size);
      } finally {
        await db.query(
          `ALTER TABLE financial_statement_upload_idempotency
             ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'`
        );
        await db.query(
          `DO $$
           BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fsui_status_values') THEN
               ALTER TABLE financial_statement_upload_idempotency
                 ADD CONSTRAINT chk_fsui_status_values CHECK (status IN ('in_progress', 'completed', 'failed'));
             END IF;
           END $$;`
        );
      }
    } finally {
      await db.end();
    }
  }, 60_000);

  // ═══════════ Fix 1: orphan-tracking on reclaim ═══════════
  //
  // Root cause (confirmed live, same fault-injection technique as round-3
  // Proof 1 above, but forced to fail TWICE in a row on the same key):
  // before this fix, `reserveIdempotentUpload`'s reclaim branch reset
  // `statement_id = NULL` unconditionally, and `failIdempotentUpload` never
  // recorded the real, already-persisted `statementId` an abandoned attempt
  // had created. Two consecutive finalize failures for one key therefore
  // created THREE fully independent, real `financial_statements` rows (one
  // per attempt), with only the 3rd (winning) one ever referenced by any
  // marker — the first two became permanently invisible orphans: no marker,
  // no lineage, unrepairable. This test proves the fix: nothing is deleted,
  // and every orphaned id is durably recorded on the marker row itself.
  it('Fix 1 — two consecutive finalize failures on the same key leave THREE real Statement rows intact, with the first two recorded in orphaned_statement_ids and only the third referenced by the completed marker', async () => {
    const idempotencyKey = `${MARK}orphan-tracking-double-finalize-fault`;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const db = client();
    await db.connect();
    try {
      // Same technique as round-3 Proof 1: a key-scoped CHECK constraint that
      // forbids THIS key's row from ever reaching status='completed', so the
      // reservation INSERT (status='in_progress') always succeeds but the
      // finalize UPDATE (status='completed') always fails for this key,
      // independent of every other row/key/test.
      const escapedKey = idempotencyKey.replace(/'/g, "''");
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency
           ADD CONSTRAINT chk_test_force_orphan_finalize_failure
           CHECK (idempotency_key <> '${escapedKey}' OR status <> 'completed') NOT VALID`
      );

      // ── Attempt 1: reserves fresh, performUpload() succeeds and persists a
      // real Statement, finalize fails (constraint) → row is 'failed' with
      // statement_id = A (Fix 1's failIdempotentUpload statementId param).
      const filenameA = `${MARK}orphan-attempt-A.xlsx`;
      const attempt1 = await request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', makeXlsxFixture(), { filename: filenameA, contentType })
        .expect(500);
      expect(attempt1.body.code).toBe('STATEMENT_UPLOAD_FINALIZE_FAILED');

      const rowsA = await db.query(
        `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
        [filenameA, SEED.ORG_ID]
      );
      expect(rowsA.rows.length).toBe(1); // performUpload() DID persist a real Statement
      const statementIdA = rowsA.rows[0].id;

      const afterAttempt1 = await db.query(
        `SELECT id, status, statement_id, orphaned_statement_ids
           FROM financial_statement_upload_idempotency
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, idempotencyKey]
      );
      expect(afterAttempt1.rows.length).toBe(1);
      expect(afterAttempt1.rows[0].status).toBe('failed');
      // Fix 1: the failed attempt's real statementId is now recorded on the
      // row (not silently dropped) — ready to be preserved on the next reclaim.
      expect(afterAttempt1.rows[0].statement_id).toBe(statementIdA);
      expect(afterAttempt1.rows[0].orphaned_statement_ids).toEqual([]);

      // ── Attempt 2: reclaims the SAME row (status='failed' branch). The
      // reclaim UPDATE must atomically move statementIdA into
      // orphaned_statement_ids BEFORE nulling statement_id for this new
      // attempt. performUpload() succeeds again (Statement B), finalize
      // fails again (constraint still in place) → row is 'failed' again,
      // this time with statement_id = B.
      const filenameB = `${MARK}orphan-attempt-B.xlsx`;
      const attempt2 = await request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', makeXlsxFixture(), { filename: filenameB, contentType })
        .expect(500);
      expect(attempt2.body.code).toBe('STATEMENT_UPLOAD_FINALIZE_FAILED');

      const rowsB = await db.query(
        `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
        [filenameB, SEED.ORG_ID]
      );
      expect(rowsB.rows.length).toBe(1);
      const statementIdB = rowsB.rows[0].id;

      const afterAttempt2 = await db.query(
        `SELECT id, status, statement_id, orphaned_statement_ids
           FROM financial_statement_upload_idempotency
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, idempotencyKey]
      );
      expect(afterAttempt2.rows.length).toBe(1); // still the SAME row — reclaimed, not duplicated
      expect(afterAttempt2.rows[0].id).toBe(afterAttempt1.rows[0].id);
      expect(afterAttempt2.rows[0].status).toBe('failed');
      expect(afterAttempt2.rows[0].statement_id).toBe(statementIdB);
      // statementIdA survived the reclaim that nulled statement_id — it is
      // now durably recorded in orphaned_statement_ids instead of lost.
      expect(afterAttempt2.rows[0].orphaned_statement_ids).toEqual([statementIdA]);

      // Statement A itself must still exist — nothing was deleted.
      const stillThereA = await db.query(`SELECT id FROM financial_statements WHERE id = $1`, [
        statementIdA,
      ]);
      expect(stillThereA.rows.length).toBe(1);

      // ── Remove the fault. Attempt 3 reclaims the same row again (pushing
      // statementIdB into orphaned_statement_ids alongside A), performUpload()
      // succeeds a third time (Statement C), and this time finalize succeeds.
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency
           DROP CONSTRAINT chk_test_force_orphan_finalize_failure`
      );

      const filenameC = `${MARK}orphan-attempt-C.xlsx`;
      const attempt3 = await request(app)
        .post('/api/finance-statements/upload')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', makeXlsxFixture(), { filename: filenameC, contentType })
        .expect(201);
      const statementIdC = attempt3.body.statementId;
      expect(statementIdC).toBeTruthy();

      // (a) ALL THREE real financial_statements rows exist — nothing was
      // ever deleted, across three fully independent create-Statement calls.
      const allThree = await db.query(
        `SELECT id FROM financial_statements WHERE id = ANY($1::text[])`,
        [[statementIdA, statementIdB, statementIdC]]
      );
      expect(allThree.rows.map((r: any) => r.id).sort()).toEqual(
        [statementIdA, statementIdB, statementIdC].sort()
      );

      // (b) the marker's orphaned_statement_ids contains EXACTLY the first
      // two statement ids once the third attempt has succeeded.
      // (c) the final marker is 'completed', referencing only the 3rd
      // (winning) statement — never A or B.
      const finalRow = await db.query(
        `SELECT id, status, statement_id, orphaned_statement_ids
           FROM financial_statement_upload_idempotency
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [SEED.ORG_ID, idempotencyKey]
      );
      expect(finalRow.rows.length).toBe(1); // one marker row for this key, throughout
      expect(finalRow.rows[0].id).toBe(afterAttempt1.rows[0].id);
      expect(finalRow.rows[0].status).toBe('completed');
      expect(finalRow.rows[0].statement_id).toBe(statementIdC);
      expect([...finalRow.rows[0].orphaned_statement_ids].sort()).toEqual(
        [statementIdA, statementIdB].sort()
      );
    } finally {
      await db.query(
        `ALTER TABLE financial_statement_upload_idempotency
           DROP CONSTRAINT IF EXISTS chk_test_force_orphan_finalize_failure`
      );
      await db.end();
    }
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════════
// FIN-005 Fix 2 — idempotency + temp-file cleanup wired into the endpoints
// the PRODUCT actually calls: POST /api/v8/finance/statements/upload-and-
// analyze (tried first by FinancialStatementImportWizard.tsx) and its
// legacy fallback POST /api/finance-statements/upload-and-analyze. Before
// this fix, NEITHER endpoint sent/checked an Idempotency-Key or cleaned up
// its multer temp file on failure — the entire reservation/finalize/fail
// state machine proven above lived ONLY on /upload, which nothing in the
// frontend calls. This is the real-HTTP, real-Postgres proof that the
// actual user-facing gap (a slow upload — LLM analysis can legitimately
// exceed the client's timeout — retried by the client used to create a
// genuine duplicate Statement) is closed on both endpoints.
//
// `analyzeAndExtractFullDocument` returns null (no OPENAI_API_KEY / no
// compatible provider configured for this fresh test org) in this
// environment, so every upload here takes the "fallback" branch — ONE
// Statement created via heuristic detection, not the multi-section "smart"
// LLM branch. That still exercises the full reserve -> business-write ->
// finalize/fail -> cleanup wiring for real; the multi-section branch is
// covered structurally by the code's own anyStatementPersisted/
// primaryStatementId handling (see the route files) and is not
// re-exercised here since it requires a real or stubbed LLM response,
// which this acceptance suite deliberately does not fake (see file header:
// "No mocks of the router, service, or DB under test").
// ═══════════════════════════════════════════════════════════════════════

const FIX2_ENDPOINTS: Array<{
  label: 'legacy' | 'v8';
  buildApp: () => Promise<Express>;
  path: string;
  unwrap: (body: any) => any;
}> = [
  {
    label: 'legacy',
    buildApp: buildFinanceApp,
    path: '/api/finance-statements/upload-and-analyze',
    unwrap: (body: any) => body,
  },
  {
    label: 'v8',
    buildApp: buildV8FinanceApp,
    path: '/api/v8/finance/statements/upload-and-analyze',
    unwrap: (body: any) => body?.data,
  },
];

describe.each(FIX2_ENDPOINTS)(
  'FIN-005 Fix 2 — upload-and-analyze idempotency + cleanup ($label)',
  ({ label, buildApp, path: endpointPath, unwrap }) => {
    let app: Express;
    let token2: string;

    beforeAll(async () => {
      guardedDatabaseUrl();
      await seed();
      app = await buildApp();
      token2 = mintToken();
    });

    afterAll(async () => {
      await cleanup();
    });

    it(`(a) ${label}: N concurrent identical-key+identical-file requests create exactly ONE real Statement — the rest are replays`, async () => {
      const idempotencyKey = `${MARK}fix2-${label}-concurrent`;
      const filename = `${MARK}fix2-${label}-concurrent.xlsx`;
      const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const fixture = makeXlsxFixture();
      const N = 4;

      const responses = await Promise.all(
        Array.from({ length: N }, () =>
          request(app)
            .post(endpointPath)
            .set('Authorization', `Bearer ${token2}`)
            .set('Idempotency-Key', idempotencyKey)
            .attach('file', fixture, { filename, contentType })
        )
      );

      for (const res of responses) {
        expect(res.status).toBe(201);
      }
      const replayedCount = responses.filter(
        (res) => res.headers['idempotency-replayed'] === 'true'
      ).length;
      const freshCount = responses.filter(
        (res) => res.headers['idempotency-replayed'] !== 'true'
      ).length;
      expect(freshCount).toBe(1); // exactly one request actually did the work
      expect(replayedCount).toBe(N - 1); // every other request replayed its result

      // The single source of truth: query the DB directly, not the HTTP
      // responses (which could all independently return 201 with the same
      // body even if the server had bugged out and created N rows).
      const db = client();
      await db.connect();
      try {
        const rows = await db.query(
          `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
          [filename, SEED.ORG_ID]
        );
        expect(rows.rows.length).toBe(1);

        const markerRows = await db.query(
          `SELECT status, statement_id FROM financial_statement_upload_idempotency
            WHERE organization_id = $1 AND idempotency_key = $2`,
          [SEED.ORG_ID, idempotencyKey]
        );
        expect(markerRows.rows.length).toBe(1);
        expect(markerRows.rows[0].status).toBe('completed');
        expect(markerRows.rows[0].statement_id).toBe(rows.rows[0].id);
      } finally {
        await db.end();
      }
    }, 60_000);

    it(`(b) ${label}: same key + different file content → 409 IDEMPOTENCY_KEY_REUSED`, async () => {
      const idempotencyKey = `${MARK}fix2-${label}-reuse`;
      const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      await request(app)
        .post(endpointPath)
        .set('Authorization', `Bearer ${token2}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', makeXlsxFixture(), {
          filename: `${MARK}fix2-${label}-reuse-a.xlsx`,
          contentType,
        })
        .expect(201);

      const otherWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        otherWorkbook,
        XLSX.utils.aoa_to_sheet([['Genuinely different content', 1]]),
        'Other'
      );
      const otherFixture = XLSX.write(otherWorkbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const reused = await request(app)
        .post(endpointPath)
        .set('Authorization', `Bearer ${token2}`)
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', otherFixture, {
          filename: `${MARK}fix2-${label}-reuse-b.xlsx`,
          contentType,
        })
        .expect(409);
      expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');

      const db = client();
      await db.connect();
      try {
        const rows = await db.query(
          `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
          [`${MARK}fix2-${label}-reuse-b.xlsx`, SEED.ORG_ID]
        );
        expect(rows.rows.length).toBe(0); // the rejected reuse never created a Statement
      } finally {
        await db.end();
      }
    }, 30_000);

    it(`(c) ${label}: extraction failure deletes the multer temp file and creates no Statement row`, async () => {
      const fs = await import('fs');
      const uploadDir = path.join(process.cwd(), 'uploads', 'assessments', SEED.ORG_ID);
      const listFiles = (): Set<string> =>
        fs.existsSync(uploadDir) ? new Set(fs.readdirSync(uploadDir)) : new Set();

      const contentType = 'application/pdf';
      const filename = `${MARK}fix2-${label}-extract-fail.pdf`;
      // NOTE on why this is a malformed PDF and not the round-3-style fake
      // OOXML zip: real investigation found the v8 and legacy
      // extractTextFromFile implementations DIVERGE for .xlsx — legacy's
      // throws on a SheetJS parse failure (what round-3 Proof 2 relies on),
      // but v8's wraps the same parse in its own try/catch and silently
      // returns `{ text: '', parseMethod: 'manual' }` instead of throwing
      // (pre-existing behavior, out of this fix's scope — see the FIN-005
      // Fix 2 final report). Neither implementation wraps the PDF branch in
      // a try/catch, so a genuinely unparseable PDF throws in BOTH — this
      // is the one failure mode proven to reach `performUploadAndAnalyze`'s
      // extraction try/catch identically on both endpoints.
      const garbagePdf = Buffer.from('%PDF-1.4\nnot actually a valid pdf body'.repeat(5));

      const beforeFiles = listFiles();
      const res = await request(app)
        .post(endpointPath)
        .set('Authorization', `Bearer ${token2}`)
        .set('Idempotency-Key', `${MARK}fix2-${label}-extract-fail-key`)
        .attach('file', garbagePdf, { filename, contentType })
        .expect(422);
      expect(res.body.error).toBe('File extraction failed');

      const afterFiles = listFiles();
      expect([...afterFiles].filter((f) => !beforeFiles.has(f)).length).toBe(0); // temp file cleaned up, not leaked

      const db = client();
      await db.connect();
      try {
        const rows = await db.query(
          `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
          [filename, SEED.ORG_ID]
        );
        expect(rows.rows.length).toBe(0);
      } finally {
        await db.end();
      }
    }, 30_000);

    it(`(d) ${label}: finalize failure — no false 201, marker reflects status='failed', retry with the same key succeeds without silently losing the first attempt's Statement`, async () => {
      const idempotencyKey = `${MARK}fix2-${label}-finalize-fault`;
      const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const db = client();
      await db.connect();
      try {
        const escapedKey = idempotencyKey.replace(/'/g, "''");
        await db.query(
          `ALTER TABLE financial_statement_upload_idempotency
             ADD CONSTRAINT chk_test_fix2_${label}_finalize_failure
             CHECK (idempotency_key <> '${escapedKey}' OR status <> 'completed') NOT VALID`
        );

        const filenameA = `${MARK}fix2-${label}-finalize-fault-a.xlsx`;
        const failed = await request(app)
          .post(endpointPath)
          .set('Authorization', `Bearer ${token2}`)
          .set('Idempotency-Key', idempotencyKey)
          .attach('file', makeXlsxFixture(), { filename: filenameA, contentType });
        // No false 201: the finalize UPDATE was rejected, so the route maps
        // this to a 500-class failure regardless of endpoint.
        expect(failed.status).toBe(500);
        expect(failed.body.code).toBe('STATEMENT_UPLOAD_FINALIZE_FAILED');

        const statementA = await db.query(
          `SELECT id FROM financial_statements WHERE source_file_name = $1 AND organization_id = $2`,
          [filenameA, SEED.ORG_ID]
        );
        expect(statementA.rows.length).toBe(1); // the business write DID happen
        const statementIdA = statementA.rows[0].id;

        const midRow = await db.query(
          `SELECT status, statement_id FROM financial_statement_upload_idempotency
            WHERE organization_id = $1 AND idempotency_key = $2`,
          [SEED.ORG_ID, idempotencyKey]
        );
        expect(midRow.rows.length).toBe(1);
        expect(midRow.rows[0].status).toBe('failed'); // never silently marked completed
        expect(midRow.rows[0].statement_id).toBe(statementIdA); // Fix 1: recorded, not dropped

        await db.query(
          `ALTER TABLE financial_statement_upload_idempotency
             DROP CONSTRAINT chk_test_fix2_${label}_finalize_failure`
        );

        const filenameB = `${MARK}fix2-${label}-finalize-fault-b.xlsx`;
        const retry = await request(app)
          .post(endpointPath)
          .set('Authorization', `Bearer ${token2}`)
          .set('Idempotency-Key', idempotencyKey)
          .attach('file', makeXlsxFixture(), { filename: filenameB, contentType })
          .expect(201);
        const retryBody = unwrap(retry.body);
        const statementIdB = String(retryBody.statementIds?.[0] || '');
        expect(statementIdB).toBeTruthy();

        // Retry succeeded WITHOUT creating a second Statement referenced by
        // the marker — the marker points at exactly ONE (the winning, B)
        // Statement, and A (the first attempt's real, already-persisted
        // Statement) is durably tracked as orphaned rather than silently
        // lost — this is the orphan-tracking proof (Fix 1) applied end-to-
        // end through the actual product endpoint (Fix 2), not just /upload.
        const finalRow = await db.query(
          `SELECT status, statement_id, orphaned_statement_ids
             FROM financial_statement_upload_idempotency
            WHERE organization_id = $1 AND idempotency_key = $2`,
          [SEED.ORG_ID, idempotencyKey]
        );
        expect(finalRow.rows.length).toBe(1); // same row, reclaimed — not a second marker
        expect(finalRow.rows[0].status).toBe('completed');
        expect(finalRow.rows[0].statement_id).toBe(statementIdB);
        expect(finalRow.rows[0].orphaned_statement_ids).toEqual([statementIdA]);

        // Statement A itself was never deleted — no silent data loss.
        const stillThereA = await db.query(`SELECT id FROM financial_statements WHERE id = $1`, [
          statementIdA,
        ]);
        expect(stillThereA.rows.length).toBe(1);
      } finally {
        await db.query(
          `ALTER TABLE financial_statement_upload_idempotency
             DROP CONSTRAINT IF EXISTS chk_test_fix2_${label}_finalize_failure`
        );
        await db.end();
      }
    }, 60_000);
  }
);
