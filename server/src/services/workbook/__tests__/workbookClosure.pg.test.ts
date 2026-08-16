/** @vitest-environment node */

/**
 * MAT-MVP-XLSX-001 — workbook closure lane C, against a REAL Postgres
 * database (never mocked; per CLAUDE.md "weryfikuj REALNY runtime").
 * Boots the real, production `workbook.routes.ts` router against whatever
 * Postgres `DATABASE_URL` points at and exercises it over real HTTP
 * (supertest), asserting on both HTTP responses AND direct `pg` reads of
 * `generated_workbooks` / the four collaboration tables — never trusting the
 * HTTP status alone (same discipline as
 * `tests/integration/routes/workbook.mat006-lifecycle.postgres.integration.test.ts`,
 * which this file's auth-mocking pattern mirrors).
 *
 * Covers the four MAT-MVP-XLSX-001 deliverables:
 *   (a) schema guard — no runtime DDL (proven separately by grep, see report)
 *   (b) share mint -> public read -> revoke -> read fails 404; expired token
 *       fails; cross-tenant mutation denied; classification gate enforced
 *   (c) CAS on PATCH /:id/cell — stale baseVersion 409; two concurrent
 *       writes -> exactly one 200 + one 409, DB holds only the winner
 *   (d) archive/unarchive — hidden from default GET /list, reversible, never
 *       deleted; cold GET /:id re-read after every mutation
 *
 * Run (repo root):
 *   DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:55432/consultinity \
 *   DB_TYPE=postgres CI=true \
 *   npx vitest run tests/workbook-xlsx --no-file-parallelism --maxWorkers=1
 *
 * Hygiene: every org/user id and workbook title is prefixed `claude_c_`;
 * `afterAll` deletes every row this suite created — across
 * `generated_workbooks` AND the four collaboration tables, which do NOT
 * cascade off it (deliberately no FK — see the migration's ordering-trap
 * note) — then asserts zero rows remain for this suite's ids.
 */
import express from 'express';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// vi.mock calls are hoisted by vitest to the top of the module regardless of
// where they textually appear in the file.
vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const orgId = req.headers['x-test-org-id'];
    const userId = req.headers['x-test-user-id'];
    if (req.headers['x-test-unauth'] === '1' || !orgId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.userId = userId;
    req.organizationId = orgId;
    req.user = { id: userId, organizationId: orgId, role: req.headers['x-test-role'] || 'admin' };
    next();
  },
}));

vi.mock('../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  invitePublicRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn().mockResolvedValue({ artifactId: 'artifact-claude-c-xlsx' }),
  adoptRunArtifactForWorkbook: vi.fn().mockResolvedValue(null),
  getArtifactRun: vi.fn().mockResolvedValue(null),
  mapPresentationStatusToDeliveryState: vi.fn().mockReturnValue('draft'),
  deriveArtifactVisibilityScope: vi.fn().mockReturnValue('private'),
}));

const RUN_ID = uuidv4().slice(0, 8);
const ORG_A = `claude_c_org_a_${RUN_ID}`;
const ORG_B = `claude_c_org_b_${RUN_ID}`;
const USER_A = `claude_c_user_a_${RUN_ID}`;
const USER_B = `claude_c_user_b_${RUN_ID}`;

function authHeaders(orgId: string, userId: string) {
  return { 'x-test-org-id': orgId, 'x-test-user-id': userId };
}

const AUX_TABLES = [
  'generated_workbook_revisions',
  'generated_workbook_comments',
  'generated_workbook_source_bindings',
  'generated_workbook_governance_events',
] as const;

describe('MAT-MVP-XLSX-001 workbook closure (real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;
  const createdWorkbookIds: string[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'This suite requires DATABASE_URL pointed at a real, migrated Postgres (CI=true, no NODE_ENV=test).'
      );
    }
    const { default: workbookRoutes } = await import('../../../routes/workbook.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/workbook', workbookRoutes);

    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    if (createdWorkbookIds.length) {
      await pool.query(`DELETE FROM artifact_export_receipts WHERE source_record_id = ANY($1)`, [
        createdWorkbookIds,
      ]);
      for (const table of AUX_TABLES) {
        await pool.query(`DELETE FROM ${table} WHERE workbook_id = ANY($1)`, [createdWorkbookIds]);
      }
      await pool.query(`DELETE FROM generated_workbooks WHERE id = ANY($1)`, [createdWorkbookIds]);

      // Zero-leftover proof (CLAUDE.md: "probe'y sprzątają po sobie, zero
      // rekordów testowych") — a real count query against the live DB, not
      // an assumption that the DELETEs above worked.
      const remainingMain = await pool.query(
        `SELECT count(*)::int AS n FROM generated_workbooks WHERE id = ANY($1)`,
        [createdWorkbookIds]
      );
      expect(remainingMain.rows[0].n).toBe(0);
      for (const table of AUX_TABLES) {
        const remaining = await pool.query(
          `SELECT count(*)::int AS n FROM ${table} WHERE workbook_id = ANY($1)`,
          [createdWorkbookIds]
        );
        expect(remaining.rows[0].n).toBe(0);
      }
    }
    await pool.end();
  });

  async function createBlankWorkbook(orgId: string, userId: string, title: string) {
    const res = await request(app)
      .post('/api/workbook/blank')
      .set(authHeaders(orgId, userId))
      .send({ title: `claude_c_${title}` })
      .expect(201);
    createdWorkbookIds.push(res.body.id);
    return res.body.id as string;
  }

  /** Governance PATCH to make a workbook `public` — required before a share
   * link is allowed to mint (see `evaluateArtifactExportPolicy` gate in
   * `POST /:id/share`). */
  async function makePublic(id: string, orgId: string, userId: string, baseVersion: number) {
    await request(app)
      .patch(`/api/workbook/${id}/governance`)
      .set(authHeaders(orgId, userId))
      .send({
        field: 'classification',
        value: 'public',
        baseVersion,
        reason: 'claude_c test setup — public for share flow',
      })
      .expect(200);
  }

  // -------------------------------------------------------------------
  // (a) SCHEMA GUARD — proven by migration run + grep in the report; a
  // quick positive sanity check here that every workbook route still works
  // end-to-end against the asserted (not runtime-created) schema.
  // -------------------------------------------------------------------
  it('sanity: blank workbook create + fresh GET round-trip against the migrated schema', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'schema-guard-sanity');
    const get = await request(app)
      .get(`/api/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(get.body.id).toBe(id);
    expect(get.body.version).toBe(1);
    expect(get.body.archived).toBe(false);
  });

  // -------------------------------------------------------------------
  // (b) SHARE / PUBLIC READ / REVOKE
  // -------------------------------------------------------------------
  it('share -> public read (sanitized) -> revoke -> public read 404', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'share-flow');
    await makePublic(id, ORG_A, USER_A, 1);

    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'shared-content', baseVersion: 1 })
      .expect(200);

    const share = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);
    const token = share.body.shareToken as string;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(32);

    const publicRead = await request(app).get(`/api/workbook/shared/${token}`).expect(200);
    const data = publicRead.body.data;
    expect(data.id).toBe(id);
    expect(data.organization_id).toBeUndefined();
    expect(data.created_by).toBeUndefined();
    expect(data.share_token).toBeUndefined();
    expect(data.prompt).toBeUndefined();
    expect(data.sheets[0].rows[0].cells.A.value).toBe('shared-content');

    // Re-minting atomically replaces the token — no window with two valid.
    const reShare = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);
    expect(reShare.body.shareToken).not.toBe(token);
    const oldTokenRead = await request(app).get(`/api/workbook/shared/${token}`);
    expect(oldTokenRead.status).toBe(404);

    await request(app)
      .delete(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);

    const afterRevoke = await request(app).get(
      `/api/workbook/shared/${reShare.body.shareToken}`
    );
    expect(afterRevoke.status).toBe(404);

    // Idempotent revoke — retry still 200, real DB state genuinely NULL.
    await request(app)
      .delete(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);
    const dbRow = await pool.query(`SELECT share_token FROM generated_workbooks WHERE id = $1`, [
      id,
    ]);
    expect(dbRow.rows[0].share_token).toBeNull();
  });

  it('NEGATIVE CONTROL: an expired share token is rejected with 404', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'share-expired');
    await makePublic(id, ORG_A, USER_A, 1);
    const share = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);

    // Force the token into the past directly in the DB — proves the route's
    // own expiry WHERE clause, not merely that the token is well-formed.
    await pool.query(
      `UPDATE generated_workbooks SET share_expires_at = NOW() - INTERVAL '1 day' WHERE id = $1`,
      [id]
    );

    const res = await request(app).get(`/api/workbook/shared/${share.body.shareToken}`);
    expect(res.status).toBe(404);
  });

  it('NEGATIVE CONTROL: sharing a non-public workbook is blocked (classification gate is real)', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'share-blocked-internal');
    // Default classification is 'internal' — never made public.
    const res = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PUBLIC_LINK_CLASSIFICATION_BLOCKED');

    const dbRow = await pool.query(`SELECT share_token FROM generated_workbooks WHERE id = $1`, [
      id,
    ]);
    expect(dbRow.rows[0].share_token).toBeNull();
  });

  it('NEGATIVE CONTROL: cross-tenant share mint/revoke denied (404), org A data untouched', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'share-cross-tenant');
    await makePublic(id, ORG_A, USER_A, 1);

    const crossMint = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_B, USER_B))
      .send({});
    expect(crossMint.status).toBe(404);

    const crossRevoke = await request(app)
      .delete(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_B, USER_B))
      .send({});
    expect(crossRevoke.status).toBe(404);

    const dbRow = await pool.query(
      `SELECT organization_id, share_token FROM generated_workbooks WHERE id = $1`,
      [id]
    );
    expect(dbRow.rows[0].organization_id).toBe(ORG_A);
    expect(dbRow.rows[0].share_token).toBeNull();
  });

  // -------------------------------------------------------------------
  // (c) CAS on PATCH /:id/cell
  // -------------------------------------------------------------------
  it('NEGATIVE CONTROL: stale baseVersion on cell PATCH is rejected with 409 before any write', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'cas-stale');
    const first = await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'first', baseVersion: 1 })
      .expect(200);
    expect(first.body.version).toBe(2);

    const stale = await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'stale-write', baseVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('WORKBOOK_VERSION_CONFLICT');
    expect(stale.body.currentVersion).toBe(2);

    const dbRow = await pool.query(`SELECT schema_json FROM generated_workbooks WHERE id = $1`, [
      id,
    ]);
    const cellA = JSON.parse(dbRow.rows[0].schema_json).sheets[0].rows[0].cells.A;
    expect(cellA.value).toBe('first'); // stale write never landed
  });

  it('NEGATIVE CONTROL: two concurrent cell writes, same baseVersion — exactly one 200, one 409, DB holds only the winner', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'cas-concurrent');
    // Both requests pin the SAME `baseVersion: 1` (the version right after
    // `/blank`) — this makes the assertion deterministic regardless of how
    // the two requests happen to interleave at the event-loop/DB-pool level:
    // whichever `UPDATE ... WHERE COALESCE(version,0) = 1` commits first
    // wins and bumps the row to version 2; the second, having explicitly
    // asserted baseVersion 1, is a genuine conflict against the now-current
    // version 2 no matter when it runs — not a race that might not trigger.
    const [r1, r2] = await Promise.all([
      request(app)
        .patch(`/api/workbook/${id}/cell`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'writer-1', baseVersion: 1 }),
      request(app)
        .patch(`/api/workbook/${id}/cell`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'writer-2', baseVersion: 1 }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    // If CAS were absent, BOTH would return 200 (last-write-wins) and this
    // assertion would fail — the concrete proof the guard is real.
    expect(statuses).toEqual([200, 409]);

    const winner = r1.status === 200 ? r1 : r2;
    const dbRow = await pool.query(
      `SELECT schema_json, version FROM generated_workbooks WHERE id = $1`,
      [id]
    );
    const cellA = JSON.parse(dbRow.rows[0].schema_json).sheets[0].rows[0].cells.A;
    expect(cellA.value).toBe(winner.body.cell.value);
    expect(Number(dbRow.rows[0].version)).toBe(2); // exactly one version bump
  });

  it('NEGATIVE CONTROL: two concurrent cell writes, no baseVersion sent (logged opt-out) — never both silently win over each other', async () => {
    // Without an explicit baseVersion, this route intentionally does NOT
    // pre-reject on a stale read (documented opt-out, logged) — but the
    // actual persistence is still the same atomic `UPDATE ... WHERE
    // COALESCE(version,0) = <version this request observed>`. Whether the
    // two requests truly interleave at the DB layer is a timing detail this
    // suite must not assume either way (the sibling test above pins an
    // explicit `baseVersion` specifically so it is NOT timing-dependent).
    // What must hold regardless of interleaving: the version count exactly
    // matches the number of writes that reported success — i.e. no write
    // is ever counted as "succeeded" while being silently overwritten
    // (which plain last-write-wins would allow: both return 200, but only
    // one version bump happens).
    const id = await createBlankWorkbook(ORG_A, USER_A, 'cas-concurrent-no-baseversion');
    const [r1, r2] = await Promise.all([
      request(app)
        .patch(`/api/workbook/${id}/cell`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'writer-1' }),
      request(app)
        .patch(`/api/workbook/${id}/cell`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'writer-2' }),
    ]);
    const successCount = [r1, r2].filter((r) => r.status === 200).length;
    const conflictCount = [r1, r2].filter((r) => r.status === 409).length;
    expect(successCount + conflictCount).toBe(2);
    const dbRow = await pool.query(`SELECT version FROM generated_workbooks WHERE id = $1`, [id]);
    // version started at 1; exactly `successCount` writes landed.
    expect(Number(dbRow.rows[0].version)).toBe(1 + successCount);
  });

  it('structural command preserves formulas, creates exactly one version, replays idempotently and cold-reopens', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'structural-formula-version');
    const initial = await request(app)
      .get(`/api/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    const initialRows = initial.body.schema_json.sheets[0].rows.length as number;

    const payload = {
      commandId: `cmd-${RUN_ID}-formula`,
      baseVersion: 1,
      idempotencyKey: `idem-${RUN_ID}-formula`,
      operations: [
        { type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'A', formula: '=SUM(A2:A2)' },
        { type: 'insertRows', sheetIndex: 0, atIndex: 0, count: 1 },
      ],
    };
    const applied = await request(app)
      .post(`/api/workbook/${id}/commands`)
      .set(authHeaders(ORG_A, USER_A))
      .send(payload)
      .expect(200);
    expect(applied.body).toMatchObject({ duplicate: false, version: 2, operationCount: 2 });

    const replay = await request(app)
      .post(`/api/workbook/${id}/commands`)
      .set(authHeaders(ORG_A, USER_A))
      .send(payload)
      .expect(200);
    expect(replay.body).toMatchObject({ duplicate: true, version: 2, operationCount: 2 });

    const revisions = await request(app)
      .get(`/api/workbook/${id}/revisions`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(revisions.body.revisions).toHaveLength(1);
    expect(revisions.body.revisions[0]).toMatchObject({ version: 2, command_id: payload.commandId });

    // A new HTTP read reconstructs the workbook exclusively from PostgreSQL;
    // command processing invalidates the runtime cache before this request.
    const reopened = await request(app)
      .get(`/api/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(reopened.body.version).toBe(2);
    expect(reopened.body.schema_json.sheets[0].rows).toHaveLength(initialRows + 1);
    expect(reopened.body.schema_json.sheets[0].rows[1].cells.A.formula).toBe('SUM(A3:A3)');

    const persisted = await pool.query(
      `SELECT version, last_mutation_key, schema_json FROM generated_workbooks WHERE id=$1`,
      [id]
    );
    expect(Number(persisted.rows[0].version)).toBe(2);
    expect(persisted.rows[0].last_mutation_key).toBe(payload.idempotencyKey);
  });

  it('mounted download exports current version with one immutable receipt; retry and tenant/auth negatives fail closed', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'governed-export-receipt');
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', formula: '=1+2', baseVersion: 1 })
      .expect(200);

    const requestKey = `download-${RUN_ID}`;
    const first = await request(app)
      .get(`/api/workbook/${id}/download`)
      .set(authHeaders(ORG_A, USER_A))
      .set('idempotency-key', requestKey)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const receiptId = first.headers['x-export-receipt-id'] as string;
    expect(receiptId).toBeTruthy();
    expect(Buffer.isBuffer(first.body)).toBe(true);
    expect(first.body.subarray(0, 2).toString('utf8')).toBe('PK');
    const exported = new ExcelJS.Workbook();
    await exported.xlsx.load(first.body);
    const formulas: string[] = [];
    exported.eachSheet((worksheet) =>
      worksheet.eachRow((row) =>
        row.eachCell((cell) => {
          const value = cell.value as { formula?: string } | null;
          if (value && typeof value === 'object' && typeof value.formula === 'string') {
            formulas.push(value.formula);
          }
        })
      )
    );
    expect(formulas).toContain('1+2');

    const second = await request(app)
      .get(`/api/workbook/${id}/download`)
      .set(authHeaders(ORG_A, USER_A))
      .set('idempotency-key', requestKey)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(second.headers['x-export-receipt-id']).toBe(receiptId);
    expect(Buffer.compare(first.body, second.body)).toBe(0);

    const receipts = await pool.query(
      `SELECT source_version,source_content_hash,provider_key,status,output_content_hash,
              output_byte_size,idempotency_key
         FROM artifact_export_receipts WHERE source_record_id=$1`,
      [id]
    );
    expect(receipts.rows).toHaveLength(1);
    expect(receipts.rows[0]).toMatchObject({
      source_version: 2,
      provider_key: 'native:exceljs',
      status: 'succeeded',
      output_content_hash: createHash('sha256').update(first.body).digest('hex'),
      output_byte_size: first.body.length,
    });
    expect(receipts.rows[0].source_content_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipts.rows[0].idempotency_key).toContain(requestKey);

    await request(app)
      .get(`/api/workbook/${id}/download`)
      .set(authHeaders(ORG_B, USER_B))
      .expect(404);
    await request(app)
      .get(`/api/workbook/${id}/download`)
      .set('x-test-unauth', '1')
      .expect(401);
    const afterNegatives = await pool.query(
      `SELECT count(*)::int AS n FROM artifact_export_receipts WHERE source_record_id=$1`,
      [id]
    );
    expect(afterNegatives.rows[0].n).toBe(1);
  });

  // -------------------------------------------------------------------
  // (d) ARCHIVE / UNARCHIVE
  // -------------------------------------------------------------------
  it('archive hides from default list, is reversible, never deletes the row; cold GET readback after every step', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'archive-flow');

    const beforeList = await request(app)
      .get('/api/workbook/list')
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(beforeList.body.workbooks.map((w: any) => w.id)).toContain(id);

    const archive = await request(app)
      .post(`/api/workbook/${id}/archive`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);
    expect(archive.body.archived).toBe(true);

    // Idempotent re-archive.
    await request(app)
      .post(`/api/workbook/${id}/archive`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);

    // Cold re-read (fresh GET, not the response above) proves persistence.
    const afterArchiveGet = await request(app)
      .get(`/api/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(afterArchiveGet.body.archived).toBe(true);
    expect(afterArchiveGet.body.archivedAt).toBeTruthy();

    const defaultListAfterArchive = await request(app)
      .get('/api/workbook/list')
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(defaultListAfterArchive.body.workbooks.map((w: any) => w.id)).not.toContain(id);

    const archivedOnlyList = await request(app)
      .get('/api/workbook/list?archived=true')
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(archivedOnlyList.body.workbooks.map((w: any) => w.id)).toContain(id);

    const includeArchivedList = await request(app)
      .get('/api/workbook/list?includeArchived=true')
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(includeArchivedList.body.workbooks.map((w: any) => w.id)).toContain(id);

    // Archived rows still exist untouched — NOT delete. Row is fully intact.
    const dbRowArchived = await pool.query(
      `SELECT id, title, archived_at, archived_by FROM generated_workbooks WHERE id = $1`,
      [id]
    );
    expect(dbRowArchived.rows[0].id).toBe(id);
    expect(dbRowArchived.rows[0].archived_by).toBe(USER_A);

    // Unarchive reverses it.
    const unarchive = await request(app)
      .post(`/api/workbook/${id}/unarchive`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);
    expect(unarchive.body.archived).toBe(false);

    const afterUnarchiveGet = await request(app)
      .get(`/api/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(afterUnarchiveGet.body.archived).toBe(false);
    expect(afterUnarchiveGet.body.archivedAt).toBeNull();

    const listAfterUnarchive = await request(app)
      .get('/api/workbook/list')
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(listAfterUnarchive.body.workbooks.map((w: any) => w.id)).toContain(id);

    const dbRowRestored = await pool.query(
      `SELECT archived_at, archived_by FROM generated_workbooks WHERE id = $1`,
      [id]
    );
    expect(dbRowRestored.rows[0].archived_at).toBeNull();
    expect(dbRowRestored.rows[0].archived_by).toBeNull();

    // Archive/unarchive left a real audit trail (reuses the existing
    // governance-events table/route, no new audit surface).
    const events = await request(app)
      .get(`/api/workbook/${id}/governance-events`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    const eventTypes = events.body.events.map((e: any) => e.eventType);
    expect(eventTypes).toContain('archive.changed');
  });

  it('NEGATIVE CONTROL: cross-tenant archive denied (404); archiving blocks sharing', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'archive-cross-tenant-and-share-block');
    await makePublic(id, ORG_A, USER_A, 1);

    const crossArchive = await request(app)
      .post(`/api/workbook/${id}/archive`)
      .set(authHeaders(ORG_B, USER_B))
      .send({});
    expect(crossArchive.status).toBe(404);

    await request(app)
      .post(`/api/workbook/${id}/archive`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);

    const shareAfterArchive = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({});
    expect(shareAfterArchive.status).toBe(409);
    expect(shareAfterArchive.body.code).toBe('WORKBOOK_ARCHIVED');
  });
});
