/**
 * FIN-005 — cross-tenant regression suite for the statement upload+analyze
 * ingress: real router + real local PostgreSQL acceptance.
 *
 * This is the FIRST automated, checked-in regression test for the specific
 * claim (previously only verified once, manually, by a read-only security
 * audit against a live process) that both
 *   POST /api/finance-statements/upload-and-analyze          (legacy)
 *   POST /api/v8/finance/statements/upload-and-analyze        (v8)
 * derive `organizationId`/`createdBy` EXCLUSIVELY from server-side session
 * context (never from request-body fields), and that a genuinely different
 * (org, user) can never read or leak another org's Statement/Pack data.
 *
 * Covers, for BOTH endpoints via `describe.each`:
 *  1. Independent idempotency reservations across two different orgs using
 *     the IDENTICAL literal Idempotency-Key — must never collide (the
 *     underlying UNIQUE index is (organization_id, idempotency_key), see
 *     server/migrations/20260802_fin005_statement_upload_idempotency.sql).
 *  2. No replay leak: org B's own repeat with the same key replays ONLY
 *     their own reservation, never org A's.
 *  3. Spoofed multipart body fields (organizationId/createdBy/userId
 *     pointing at the OTHER org/user) are ignored — the persisted row's
 *     organization_id/created_by always matches the authenticated SESSION,
 *     never the request body.
 *  4. Foreign read denial without leakage: a genuinely different (org,
 *     user) reading another org's Statement/Pack gets a generic 403/404,
 *     never a body containing the other org's filename/data.
 *
 * Deliberately uses TWO BRAND-NEW synthetic organizations (not the shared
 * `SEED.ORG_ID` from seed.mjs, and not the golden-flow suite's
 * `${MARK}foreign-org`) so this file can run standalone or alongside
 * odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts and
 * odbior--fin003a--statement-import.e2e.test.ts with zero fixture/db-state
 * collisions.
 *
 * Run with a LOCAL-only DATABASE_URL pointed at `consultinity_test`,
 * mirroring the guard pattern in the golden-flow suite and
 * tests/acceptance/harness.ts's requireLocalDbUrl().
 *
 * IMPORTANT: this file does NOT edit
 *   server/src/services/financialStatementService.ts
 *   server/src/routes/finance-statements.routes.ts
 *   server/src/routes/v8/finance.routes.ts
 * (a concurrent agent owns those). It only imports/exercises them as-is.
 */
import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { mintToken } from './harness.js';
import { seed } from './seed.mjs';

const MARK = 'odbior--fin005-tenant--';

const ORG_A_ID = `${MARK}org-a`;
const USER_A_ID = `${MARK}user-a`;
const ORG_B_ID = `${MARK}org-b`;
const USER_B_ID = `${MARK}user-b`;

function guardedDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('[FIN-005 tenant-isolation] DATABASE_URL is unset');
  const url = new URL(raw);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || dbName !== 'consultinity_test') {
    throw new Error(
      `[FIN-005 tenant-isolation] REFUSING database target host=${url.hostname} db=${dbName}`
    );
  }
  return raw;
}

function client(): pg.Client {
  return new pg.Client({ connectionString: guardedDatabaseUrl() });
}

// Two-period comparative P&L, matching the shape the real extractor's
// >=2-numeric-tokens-per-line gate requires (see the golden-flow suite's
// header for why a single-value-column layout does not reach it).
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

/** `label` is embedded in the sheet name AND a distinguishing row so two
 * fixtures for two different orgs are byte-different (different content). */
function makeXlsxFixture(label: string): Buffer {
  const rows: Array<Array<string | number>> = [
    ['Rachunek zysków i strat', 'FY2025', 'FY2024', 'PLN'],
    [`Tenant marker: ${label}`, 1, 1, 'PLN'],
    ...PL_ROWS.map(([l, v1, v2]) => [l, v1, v2, 'PLN']),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), `P&L ${label}`.slice(0, 31));
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function buildFinanceApp(): Promise<Express> {
  const router = (await import('../../server/src/routes/finance-statements.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/finance-statements', router);
  return app;
}

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

async function seedTenants(): Promise<void> {
  const db = client();
  await db.connect();
  try {
    for (const { orgId, userId, email, name } of [
      { orgId: ORG_A_ID, userId: USER_A_ID, email: `${MARK}a@acceptance.local`, name: 'Tenant A' },
      { orgId: ORG_B_ID, userId: USER_B_ID, email: `${MARK}b@acceptance.local`, name: 'Tenant B' },
    ]) {
      await db.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $2, 'enterprise', 'active', 1, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [orgId, `${MARK}${name}`]
      );
      await db.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
         VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', $4, 'Harness', CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [userId, orgId, email, name]
      );
      await db.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
         SELECT $3, $1, $2, 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP
         WHERE NOT EXISTS (
           SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2
         )`,
        [orgId, userId, `${MARK}mem-${userId}`]
      );
    }
  } finally {
    await db.end();
  }
}

async function cleanupTenantData(): Promise<void> {
  const db = client();
  await db.connect();
  try {
    const statements = await db.query(
      `SELECT id, statement_pack_id FROM financial_statements WHERE organization_id = ANY($1::text[])`,
      [[ORG_A_ID, ORG_B_ID]]
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
    await db.query(
      `DELETE FROM financial_statement_upload_idempotency WHERE organization_id = ANY($1::text[])`,
      [[ORG_A_ID, ORG_B_ID]]
    );
  } finally {
    await db.end();
  }
}

async function cleanupTenants(): Promise<void> {
  const db = client();
  await db.connect();
  try {
    await db.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
      [ORG_A_ID, ORG_B_ID],
    ]);
    await db.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[USER_A_ID, USER_B_ID]]);
    await db.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[ORG_A_ID, ORG_B_ID]]);
  } finally {
    await db.end();
  }
}

const ENDPOINTS: Array<{
  label: 'legacy' | 'v8';
  buildApp: () => Promise<Express>;
  path: string;
  unwrap: (body: any) => any;
  getStatementPath: (id: string) => string;
  getPackPath: (id: string) => string;
}> = [
  {
    label: 'legacy',
    buildApp: buildFinanceApp,
    path: '/api/finance-statements/upload-and-analyze',
    unwrap: (body: any) => body,
    getStatementPath: (id) => `/api/finance-statements/${id}`,
    getPackPath: (id) => `/api/finance-statements/packs/${id}`,
  },
  {
    label: 'v8',
    buildApp: buildV8FinanceApp,
    path: '/api/v8/finance/statements/upload-and-analyze',
    unwrap: (body: any) => body?.data,
    getStatementPath: (id) => `/api/v8/finance/statements/${id}`,
    getPackPath: (id) => `/api/v8/finance/statement-packs/${id}`,
  },
];

describe.each(ENDPOINTS)(
  'FIN-005 tenant isolation — upload-and-analyze ($label)',
  ({ label, buildApp, path: endpointPath, unwrap, getStatementPath, getPackPath }) => {
    let app: Express;
    let tokenA: string;
    let tokenB: string;
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    beforeAll(async () => {
      guardedDatabaseUrl();
      await seed(); // SEED.ORG_ID/user — required by shared middleware bootstrap paths, unused directly here.
      await seedTenants();
      await cleanupTenantData();
      app = await buildApp();
      tokenA = mintToken({ id: USER_A_ID, organizationId: ORG_A_ID, organization_id: ORG_A_ID });
      tokenB = mintToken({ id: USER_B_ID, organizationId: ORG_B_ID, organization_id: ORG_B_ID });
    });

    afterAll(async () => {
      await cleanupTenantData();
      await cleanupTenants();
    });

    it(`(1) ${label}: independent idempotency reservations — identical literal Idempotency-Key across two different orgs never collide`, async () => {
      const sharedKey = `${MARK}${label}-shared-key-1`;
      const filenameA = `${MARK}${label}-shared-key-a.xlsx`;
      const filenameB = `${MARK}${label}-shared-key-b.xlsx`;

      const resA = await request(app)
        .post(endpointPath)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', sharedKey)
        .attach('file', makeXlsxFixture('org-a-upload-1'), { filename: filenameA, contentType })
        .expect(201);
      const bodyA = unwrap(resA.body);
      const statementIdA: string = bodyA.statementIds[0];
      expect(statementIdA).toBeTruthy();

      const resB = await request(app)
        .post(endpointPath)
        .set('Authorization', `Bearer ${tokenB}`)
        .set('Idempotency-Key', sharedKey)
        .attach('file', makeXlsxFixture('org-b-upload-1'), { filename: filenameB, contentType })
        .expect(201);
      const bodyB = unwrap(resB.body);
      const statementIdB: string = bodyB.statementIds[0];
      expect(statementIdB).toBeTruthy();
      expect(statementIdB).not.toBe(statementIdA);

      // Org B's response is a FRESH upload for org B (first time this key
      // has ever been used for org B) — never a replay, and never
      // referencing/containing anything derived from org A's upload.
      expect(resB.headers['idempotency-replayed']).not.toBe('true');
      const rawB = JSON.stringify(resB.body);
      expect(rawB).not.toContain(statementIdA);
      expect(rawB).not.toContain(filenameA);
      expect(rawB).not.toContain('org-a-upload-1');

      const db = client();
      await db.connect();
      try {
        const markerRows = await db.query(
          `SELECT organization_id, statement_id FROM financial_statement_upload_idempotency
            WHERE idempotency_key = $1 ORDER BY organization_id`,
          [sharedKey]
        );
        expect(markerRows.rows.length).toBe(2); // one independent marker row PER ORG
        const byOrg = Object.fromEntries(markerRows.rows.map((r: any) => [r.organization_id, r.statement_id]));
        expect(byOrg[ORG_A_ID]).toBe(statementIdA);
        expect(byOrg[ORG_B_ID]).toBe(statementIdB);

        const statementRows = await db.query(
          `SELECT id, organization_id, source_file_name FROM financial_statements WHERE id = ANY($1::text[])`,
          [[statementIdA, statementIdB]]
        );
        expect(statementRows.rows.length).toBe(2); // two independent Statement rows, not deduped
        const byId = Object.fromEntries(statementRows.rows.map((r: any) => [r.id, r]));
        expect(byId[statementIdA].organization_id).toBe(ORG_A_ID);
        expect(byId[statementIdA].source_file_name).toBe(filenameA);
        expect(byId[statementIdB].organization_id).toBe(ORG_B_ID);
        expect(byId[statementIdB].source_file_name).toBe(filenameB);
      } finally {
        await db.end();
      }
    }, 60_000);

    it(`(2) ${label}: no replay leak — org B's retry on the shared key replays ONLY org B's own reservation`, async () => {
      const sharedKey = `${MARK}${label}-shared-key-1`; // same key as test (1) — depends on it having run first
      const filenameB = `${MARK}${label}-shared-key-b.xlsx`;

      const dbBefore = client();
      await dbBefore.connect();
      let statementIdB: string;
      try {
        const row = await dbBefore.query(
          `SELECT statement_id FROM financial_statement_upload_idempotency
            WHERE organization_id = $1 AND idempotency_key = $2`,
          [ORG_B_ID, sharedKey]
        );
        expect(row.rows.length).toBe(1);
        statementIdB = row.rows[0].statement_id;
        expect(statementIdB).toBeTruthy();
      } finally {
        await dbBefore.end();
      }

      const replay = await request(app)
        .post(endpointPath)
        .set('Authorization', `Bearer ${tokenB}`)
        .set('Idempotency-Key', sharedKey)
        .attach('file', makeXlsxFixture('org-b-upload-1'), { filename: filenameB, contentType })
        .expect(201);

      expect(replay.headers['idempotency-replayed']).toBe('true');
      const replayBody = unwrap(replay.body);
      expect(replayBody.statementIds[0]).toBe(statementIdB); // replays THEIR OWN reservation

      const db = client();
      await db.connect();
      try {
        // Still exactly one marker per org for this key — the replay did not
        // create a second org-B row, and org A's row is untouched.
        const markerRows = await db.query(
          `SELECT organization_id FROM financial_statement_upload_idempotency WHERE idempotency_key = $1`,
          [sharedKey]
        );
        expect(markerRows.rows.length).toBe(2);

        const statementRows = await db.query(
          `SELECT id FROM financial_statements WHERE organization_id = $1 AND source_file_name = $2`,
          [ORG_B_ID, filenameB]
        );
        expect(statementRows.rows.length).toBe(1); // no duplicate Statement created by the replay
      } finally {
        await db.end();
      }
    }, 60_000);

    it(`(3) ${label}: spoofed multipart body fields (organizationId/createdBy/userId pointing at org B) are ignored — persisted row uses org A's SESSION identity`, async () => {
      const filename = `${MARK}${label}-spoofed-body.xlsx`;
      const res = await request(app)
        .post(endpointPath)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', `${MARK}${label}-spoofed-body-key`)
        .field('organizationId', ORG_B_ID)
        .field('organization_id', ORG_B_ID)
        .field('createdBy', USER_B_ID)
        .field('userId', USER_B_ID)
        .field('user_id', USER_B_ID)
        .attach('file', makeXlsxFixture('org-a-spoof-attempt'), { filename, contentType })
        .expect(201);

      const body = unwrap(res.body);
      const statementId: string = body.statementIds[0];
      expect(statementId).toBeTruthy();

      const db = client();
      await db.connect();
      try {
        const rows = await db.query(
          `SELECT organization_id, created_by, source_file_name FROM financial_statements WHERE id = $1`,
          [statementId]
        );
        expect(rows.rows.length).toBe(1);
        // The persisted row MUST use org A's real session identity — never
        // the spoofed org B ids from the multipart body fields.
        expect(rows.rows[0].organization_id).toBe(ORG_A_ID);
        expect(rows.rows[0].organization_id).not.toBe(ORG_B_ID);
        expect(rows.rows[0].created_by).toBe(USER_A_ID);
        expect(rows.rows[0].created_by).not.toBe(USER_B_ID);

        // And the idempotency marker (org-scoped) was written under org A,
        // not org B — the spoofed body field never redirected the reservation.
        const markerRows = await db.query(
          `SELECT organization_id FROM financial_statement_upload_idempotency
            WHERE idempotency_key = $1`,
          [`${MARK}${label}-spoofed-body-key`]
        );
        expect(markerRows.rows.length).toBe(1);
        expect(markerRows.rows[0].organization_id).toBe(ORG_A_ID);
      } finally {
        await db.end();
      }
    }, 30_000);

    it(`(4) ${label}: foreign read denial without leakage — org B reading org A's real Statement/Pack gets a generic error, never org A's data`, async () => {
      const filename = `${MARK}${label}-foreign-read.xlsx`;
      const upload = await request(app)
        .post(endpointPath)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', `${MARK}${label}-foreign-read-key`)
        .attach('file', makeXlsxFixture('org-a-foreign-read-secret'), { filename, contentType })
        .expect(201);
      const body = unwrap(upload.body);
      const statementId: string = body.statementIds[0];
      const packId: string = body.statementPackId;
      expect(statementId).toBeTruthy();
      expect(packId).toBeTruthy();

      // GET the Statement by id, authenticated as org B.
      const foreignStatementRes = await request(app)
        .get(getStatementPath(statementId))
        .set('Authorization', `Bearer ${tokenB}`);
      expect([403, 404]).toContain(foreignStatementRes.status);
      const statementRaw = JSON.stringify(foreignStatementRes.body);
      expect(statementRaw).not.toContain(filename);
      expect(statementRaw).not.toContain('org-a-foreign-read-secret');
      expect(statementRaw).not.toContain('1250000'); // a real P&L value from org A's sheet
      expect(statementRaw.length).toBeLessThan(500); // generic error body, not a real payload

      // GET the Pack detail by id, authenticated as org B.
      const foreignPackRes = await request(app)
        .get(getPackPath(packId))
        .set('Authorization', `Bearer ${tokenB}`);
      expect([403, 404]).toContain(foreignPackRes.status);
      const packRaw = JSON.stringify(foreignPackRes.body);
      expect(packRaw).not.toContain(filename);
      expect(packRaw).not.toContain('org-a-foreign-read-secret');
      expect(packRaw.length).toBeLessThan(500);

      // Sanity/control: org A reading its OWN Statement/Pack still works and
      // does contain its own data (proves the denial above is tenant-scoped,
      // not a generic breakage of the read routes).
      const ownStatementRes = await request(app)
        .get(getStatementPath(statementId))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(JSON.stringify(ownStatementRes.body)).toContain(filename);

      const ownPackRes = await request(app)
        .get(getPackPath(packId))
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(JSON.stringify(ownPackRes.body)).toContain(filename);
    }, 30_000);
  }
);
