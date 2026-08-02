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
});
