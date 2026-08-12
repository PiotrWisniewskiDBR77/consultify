/**
 * Finance v3 canonical adapter — Pakiet ROUTES_EXPOSURE, Export/Import
 * (`/export/*`, `/import/*`), real PostgreSQL + real HTTP.
 *
 * Covers:
 *   1. Mount proof.
 *   2. A real .xlsx export of a Statement Pack with one real
 *      `finance_stmt_lines` row.
 *   3. The full round-trip: parse the downloaded buffer -> preview (no
 *      change) -> preview again after editing one cell's value (real diff)
 *      -> apply -> independent SQL confirms the new value actually landed
 *      in `finance_stmt_lines` and a new `finance_working_revisions` row
 *      was checkpointed.
 *   4. Cross-tenant: org B exporting org A's artifact -> 404.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

/** superagent has no default parser for the xlsx MIME type, so `res.body` would otherwise be `{}`
 * with the bytes dropped — this accumulates the raw response into a real `Buffer`. */
function binaryParser(res: any, callback: (err: Error | null, body: Buffer) => void) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk: string) => {
    data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'));
  });
}

describe.skipIf(!REAL_PG)('Finance v2 ROUTES_EXPOSURE — Export/Import (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let financeV2Router: express.Router;

  const orgA = `org-expimp-a-${randomUUID()}`;
  const orgB = `org-expimp-b-${randomUUID()}`;
  const userA = `user-expimp-a-${randomUUID()}`;
  const userB = `user-expimp-b-${randomUUID()}`;

  function appAsOrg(orgId: string, userId: string) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
      req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: String(err?.message || err) }));
    return a;
  }
  let appA: express.Express;
  let appB: express.Express;

  let artifactId = '';
  let bvId = '';
  let entityId = '';
  let entityCode = '';
  let canonicalLineId = '';
  let periodId = '';

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    av = await import('../../../../services/finance/canonical/artifactVersionService.js');
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [orgA, 'ExpImp Tenant A', orgB, 'ExpImp Tenant B'])
    );

    appA = appAsOrg(orgA, userA);
    appB = appAsOrg(orgB, userB);

    const artifact = await av.createArtifact({ organizationId: orgA, artifactType: 'STATEMENT_PACK', createdBy: userA });
    artifactId = artifact.artifact.artifact_id;
    bvId = artifact.businessVersion.business_version_id;

    entityCode = `PARENT-${randomUUID().slice(0, 8)}`;
    const entityRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities (
           organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by
         ) VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
         RETURNING id`,
        [orgA, bvId, entityCode, 'ExpImp Fixture Co', userA]
      )
    );
    entityId = entityRow!.id;

    const canonicalRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `SELECT id FROM financial_statement_lines WHERE statement_type = 'BS' AND is_system = true ORDER BY sort_order ASC LIMIT 1`
      )
    );
    if (!canonicalRow) throw new Error('fixture setup: no seeded financial_statement_lines row found (statement_type=BS)');
    canonicalLineId = canonicalRow.id;

    const cal = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgA, userA]
      )
    );
    const per = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2024, '2024-01-01', '2024-12-31', 'FY2024', ?) RETURNING period_id`,
        [orgA, cal!.fiscal_calendar_id, userA]
      )
    );
    periodId = per!.period_id;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO finance_stmt_lines (
           id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
           accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
           presentation_currency, unit, multiplier, is_adjustment, sign_convention, accounting_policy, created_by
         ) VALUES (?, ?, ?, 'BS', ?, ?, ?, 'FULL_YEAR', 'STANDALONE', 'PRESENT_NONZERO', '100', 'PLN', 'PLN', 'UNITS', '1', false, 'NATURAL', 'IFRS', ?)`,
        [randomUUID(), orgA, bvId, canonicalLineId, entityId, periodId, userA]
      )
    );
  }, 120000);

  // -----------------------------------------------------------------
  // Mount proof
  // -----------------------------------------------------------------

  it('MOUNT PROOF: valid context + REAL router, random artifact/version -> 404 WITH {code:"NOT_FOUND"}', async () => {
    const res = await request(appA).get(`/api/v8/finance-v2/export/statement-pack/${randomUUID()}/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });

  it('MOUNT PROOF: valid context, path no router in this tree handles -> 404 WITHOUT a code field', async () => {
    const res = await request(appA).get('/api/v8/finance-v2/this-path-truly-does-not-exist-anywhere');
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('code');
  });

  // -----------------------------------------------------------------
  // Real export + full round-trip
  // -----------------------------------------------------------------

  let exportedBuffer: Buffer;
  let exportedManifest: any;

  it('GET /export/statement-pack/:artifactId/:businessVersionId — real .xlsx with a Manifest sheet', async () => {
    const res = await request(appA)
      .get(`/api/v8/finance-v2/export/statement-pack/${artifactId}/${bvId}`)
      .buffer(true)
      .parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.headers['content-disposition']).toContain('attachment');
    exportedManifest = JSON.parse(res.headers['x-finance-export-manifest']);
    expect(exportedManifest.organizationId).toBe(orgA);
    expect(exportedManifest.artifactId).toBe(artifactId);
    expect(exportedManifest.businessVersionId).toBe(bvId);
    expect(exportedManifest.rowCount).toBe(1);
    exportedBuffer = res.body as Buffer;
    expect(exportedBuffer.length).toBeGreaterThan(0);
  });

  let parsedManifest: any;
  let parsedRows: any[];

  it('POST /import/parse — parses the downloaded buffer back into {manifest, rows}', async () => {
    const res = await request(appA)
      .post('/api/v8/finance-v2/import/parse')
      .attach('file', exportedBuffer, { filename: 'export.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(res.status).toBe(200);
    expect(res.body.data.manifestIssues).toEqual([]);
    expect(res.body.data.manifest.businessVersionId).toBe(bvId);
    expect(res.body.data.rows).toHaveLength(1);
    parsedManifest = res.body.data.manifest;
    parsedRows = res.body.data.rows;
  });

  it('POST /import/preview — unedited round-trip: no changes needed', async () => {
    const res = await request(appA)
      .post('/api/v8/finance-v2/import/preview')
      .send({ artifactId, businessVersionId: bvId, manifest: parsedManifest, rows: parsedRows });
    expect(res.status).toBe(200);
    expect(res.body.data.manifestCheck.ok).toBe(true);
    expect(res.body.data.diff.toChange).toEqual([]);
    expect(res.body.data.diff.toAdd).toEqual([]);
    expect(res.body.data.diff.unchangedCount).toBe(1);
    expect(res.body.data.ok).toBe(true);
  });

  it('POST /import/preview — after editing the Value cell, shows a real toChange diff', async () => {
    const editedRows = parsedRows.map((r: any) => (r['Value'] !== undefined ? { ...r, Value: 250 } : r));
    const res = await request(appA)
      .post('/api/v8/finance-v2/import/preview')
      .send({ artifactId, businessVersionId: bvId, manifest: parsedManifest, rows: editedRows });
    expect(res.status).toBe(200);
    expect(res.body.data.diff.toChange).toHaveLength(1);
    expect(res.body.data.diff.toChange[0].after.value.valueDecimal ?? res.body.data.diff.toChange[0].after.value.value_decimal).toBeDefined();
  });

  it('POST /import/apply — commits the edited value; SQL confirms finance_stmt_lines actually changed and a new working revision was checkpointed', async () => {
    const currentWr = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ working_revision_id: string }>(
        `SELECT working_revision_id FROM finance_working_revisions WHERE business_version_id = ? AND organization_id = ? AND is_current = true`,
        [bvId, orgA]
      )
    );
    expect(currentWr).toBeTruthy();

    const editedRows = parsedRows.map((r: any) => (r['Value'] !== undefined ? { ...r, Value: 250 } : r));
    const res = await request(appA)
      .post('/api/v8/finance-v2/import/apply')
      .send({
        artifactId,
        businessVersionId: bvId,
        expectedWorkingRevisionId: currentWr!.working_revision_id,
        manifest: parsedManifest,
        rows: editedRows,
        batchIdempotencyKey: `expimp-apply-${randomUUID()}`,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.appliedCount.changed).toBe(1);
    expect(res.body.data.newWorkingRevisionId).not.toBe(currentWr!.working_revision_id);

    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ value_decimal: string }>(
        `SELECT value_decimal FROM finance_stmt_lines
          WHERE organization_id = ? AND business_version_id = ? AND entity_id = ? AND canonical_line_id = ? AND period_id = ?`,
        [orgA, bvId, entityId, canonicalLineId, periodId]
      )
    );
    expect(Number(sqlRow!.value_decimal)).toBe(250);

    const newWr = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ working_revision_id: string }>(
        `SELECT working_revision_id FROM finance_working_revisions WHERE business_version_id = ? AND organization_id = ? AND is_current = true`,
        [bvId, orgA]
      )
    );
    expect(newWr!.working_revision_id).toBe(res.body.data.newWorkingRevisionId);
  });

  it('POST /import/apply — CAS protection: retrying with the now-stale expectedWorkingRevisionId (post-first-apply) is rejected 409 WORKING_REVISION_CONFLICT, not silently double-applied', async () => {
    const staleWr = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ working_revision_id: string }>(
        `SELECT working_revision_id FROM finance_working_revisions WHERE business_version_id = ? AND organization_id = ? AND is_current = true`,
        [bvId, orgA]
      )
    );
    const idempotencyKey = `expimp-replay-${randomUUID()}`;
    const editedRows = parsedRows.map((r: any) => (r['Value'] !== undefined ? { ...r, Value: 999 } : r));
    const first = await request(appA)
      .post('/api/v8/finance-v2/import/apply')
      .send({ artifactId, businessVersionId: bvId, expectedWorkingRevisionId: staleWr!.working_revision_id, manifest: parsedManifest, rows: editedRows, batchIdempotencyKey: idempotencyKey });
    expect(first.status).toBe(200);
    expect(first.body.data.idempotentReplay).toBe(false);
    expect(first.body.data.appliedCount.changed).toBe(1);

    // Retry with the SAME (now-stale, pre-first-apply) expectedWorkingRevisionId and the SAME
    // idempotency key — a naive implementation might treat "same idempotency key" as "safe to
    // replay" regardless of CAS; this proves the CAS pin is checked and wins, so a genuinely
    // stale retry cannot silently re-apply on top of a revision it never saw.
    const second = await request(appA)
      .post('/api/v8/finance-v2/import/apply')
      .send({ artifactId, businessVersionId: bvId, expectedWorkingRevisionId: staleWr!.working_revision_id, manifest: parsedManifest, rows: editedRows, batchIdempotencyKey: idempotencyKey });
    expect(second.status).toBe(409);
    expect(second.body).toHaveProperty('code', 'WORKING_REVISION_CONFLICT');
    expect(second.body.currentWorkingRevisionId).toBe(first.body.data.newWorkingRevisionId);

    // SQL confirms the value from the ONE successful apply, not double-touched by the rejected retry.
    const sqlRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ value_decimal: string }>(
        `SELECT value_decimal FROM finance_stmt_lines
          WHERE organization_id = ? AND business_version_id = ? AND entity_id = ? AND canonical_line_id = ? AND period_id = ?`,
        [orgA, bvId, entityId, canonicalLineId, periodId]
      )
    );
    expect(Number(sqlRow!.value_decimal)).toBe(999);
  });

  // -----------------------------------------------------------------
  // Cross-tenant
  // -----------------------------------------------------------------

  it('CROSS-TENANT: org B exporting org A\'s Statement Pack -> 404 NOT_FOUND', async () => {
    const res = await request(appB).get(`/api/v8/finance-v2/export/statement-pack/${artifactId}/${bvId}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });

  // Gate E FIX-B (proof-gaps pass, 2026-08-12) — LUKA 3: `/import/preview` used to have NO ownership
  // check at all — every cross-tenant attempt fell through to a 200 with `data.ok: false` (the
  // manifest-org-mismatch / empty-taxonomy-lookup shape below), a weak oracle compared to the
  // uniform 404 every other tenant-scoped denial in this surface returns. Fixed:
  // `export-import.routes.ts`'s `/import/preview` handler now checks (business_version_id,
  // organization_id, artifact_id) ownership BEFORE calling `previewFinanceImport()` at all.

  it('CROSS-TENANT: org B previewing an import against org A\'s businessVersionId -> uniform 404 NOT_FOUND, never a 200 diff-shaped response', async () => {
    const res = await request(appB)
      .post('/api/v8/finance-v2/import/preview')
      .send({ artifactId, businessVersionId: bvId, manifest: parsedManifest, rows: parsedRows });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body).not.toHaveProperty('data');
  });

  it('CROSS-TENANT: org B previewing an import against org A\'s businessVersionId with a MALFORMED body (missing rows) -> SAME uniform 404 NOT_FOUND, NOT 400 INVALID_BODY', async () => {
    const res = await request(appB)
      .post('/api/v8/finance-v2/import/preview')
      .send({ artifactId, businessVersionId: bvId, manifest: parsedManifest }); // no `rows` at all
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body.code).not.toBe('INVALID_BODY');
  });
});
