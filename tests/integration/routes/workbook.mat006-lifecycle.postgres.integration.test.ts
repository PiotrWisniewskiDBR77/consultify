/** @vitest-environment node */

/**
 * MAT-006 — Workbook lifecycle (revisions/restore/share/revoke/
 * export) against a REAL Postgres database (per the MAT-006 spec: "Tests —
 * required, real Postgres, not mocked"). Boots the real, production
 * `workbook.routes.ts` router + real `queryHelpers`/`PostgresDatabase`/
 * `withPgTransaction` against whatever Postgres `DATABASE_URL` points at.
 *
 * Only infrastructure edges unrelated to what this suite proves are stubbed:
 * auth (parametrized per-request via test headers, so cross-tenant/negative
 * auth cases can be exercised from the same mock), rbac/demoGuard/
 * rate-limiting (no-ops — this suite issues many requests per test and real
 * per-IP rate limiting would make the suite flaky, not more correct), the
 * artifact registry (v8_artifact_runs is a different subsystem, out of
 * MAT-006's scope), and Logger (silenced, not behaviourally mocked).
 *
 * REQUIRES a real, migrated Postgres reachable via `DATABASE_URL` with
 * `NODE_ENV=test RUN_DB_TESTS=1` (see `server/src/database/Database.ts` —
 * `NODE_ENV=test` WITHOUT `RUN_DB_TESTS=1` silently swaps in a mock DB and
 * this whole suite would pass against nothing). Run:
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:<port>/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run tests/integration/routes/workbook.mat006-lifecycle.postgres.integration.test.ts
 */
import ExcelJS from 'exceljs';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// vi.mock calls are hoisted by vitest to the top of the module regardless of
// where they textually appear in the file.
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
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

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn().mockResolvedValue({ artifactId: 'artifact-mat006' }),
  adoptRunArtifactForWorkbook: vi.fn().mockResolvedValue(null),
  getArtifactRun: vi.fn().mockResolvedValue(null),
  mapPresentationStatusToDeliveryState: vi.fn().mockReturnValue('draft'),
  deriveArtifactVisibilityScope: vi.fn().mockReturnValue('private'),
}));

const RUN_ID = uuidv4().slice(0, 8);
const ORG_A = `org-mat006-a-${uuidv4().slice(0, 8)}`;
const ORG_B = `org-mat006-b-${uuidv4().slice(0, 8)}`;
const USER_A = `user-mat006-a-${uuidv4().slice(0, 8)}`;
const USER_B = `user-mat006-b-${uuidv4().slice(0, 8)}`;

function authHeaders(orgId: string, userId: string) {
  return { 'x-test-org-id': orgId, 'x-test-user-id': userId };
}

describe('MAT-006 workbook lifecycle (real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;
  const createdWorkbookIds: string[] = [];

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real, migrated Postgres.'
      );
    }
    const { default: workbookRoutes } = await import('../../../server/src/routes/workbook.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/workbook', workbookRoutes);

    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    // Hygiene: probes clean up after themselves (CLAUDE.md — "probe'y
    // sprzątają po sobie, zero rekordów testowych"). CASCADE takes the
    // version-history rows with it.
    if (createdWorkbookIds.length) {
      await pool.query(`DELETE FROM artifact_export_receipts WHERE source_record_id = ANY($1)`, [
        createdWorkbookIds,
      ]);
      await pool.query(`DELETE FROM generated_workbooks WHERE id = ANY($1)`, [createdWorkbookIds]);
    }
    // MAT-010 G12 fix: this suite predates the MAT-010 lineage hooks now
    // wired into workbook.routes.ts (frozen — not touched here). Every
    // `createBlankWorkbook` call above, plus every checkpoint/restore/
    // share/revoke/export exercised by the tests, also appends a lineage
    // receipt/event under ORG_A/ORG_B, which nothing in this file used to
    // clean up (confirmed as 20 receipts / 62 events left behind under
    // org-mat006-* after a full run). Deleting by org scope rather than by
    // workbook id keeps this correct even if a future test in this file
    // creates a workbook the `createdWorkbookIds` array doesn't track.
    await pool.query(`DELETE FROM artifact_lineage_events WHERE organization_id = ANY($1)`, [
      [ORG_A, ORG_B],
    ]);
    await pool.query(`DELETE FROM artifact_lineage_receipts WHERE organization_id = ANY($1)`, [
      [ORG_A, ORG_B],
    ]);
    await pool.end();
  });

  async function createBlankWorkbook(orgId: string, userId: string, title: string) {
    const res = await request(app)
      .post('/api/workbook/blank')
      .set(authHeaders(orgId, userId))
      .send({ title })
      .expect(201);
    createdWorkbookIds.push(res.body.id);
    return res.body.id as string;
  }

  // ---------------------------------------------------------------------
  // GOLDEN FLOW
  // ---------------------------------------------------------------------
  it('golden flow: create -> atomic edit+formula -> edit -> revision history -> restore -> same id -> new version -> hard reread', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Golden Flow');

    const first = await request(app)
      .post(`/api/workbook/${id}/commands`)
      .set(authHeaders(ORG_A, USER_A))
      .send({
        commandId: `golden-first-${RUN_ID}`,
        baseVersion: 1,
        idempotencyKey: `golden-first-${RUN_ID}`,
        operations: [
          { type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 21 },
          { type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'B', formula: '=A2*2' },
        ],
      })
      .expect(200);
    expect(first.body.version).toBe(2);

    const afterFormula = await request(app)
      .get(`/api/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(afterFormula.body.version).toBe(2);
    const cellsAfterFormula = afterFormula.body.schema_json.sheets[0].rows[0].cells;
    expect(cellsAfterFormula.A).toEqual(expect.objectContaining({ value: 21 }));
    expect(cellsAfterFormula.B).toEqual(expect.objectContaining({ formula: 'A2*2' }));

    const second = await request(app)
      .post(`/api/workbook/${id}/commands`)
      .set(authHeaders(ORG_A, USER_A))
      .send({
        commandId: `golden-second-${RUN_ID}`,
        baseVersion: 2,
        idempotencyKey: `golden-second-${RUN_ID}`,
        operations: [
          { type: 'setCell', sheetIndex: 0, rowIndex: 1, columnKey: 'A', value: 'second edit' },
        ],
      })
      .expect(200);
    expect(second.body.version).toBe(3);
    const versionToRestoreTo = 2;

    // 6) GET/history shows both versions (at least the pre-checkpoint and
    // pre-second-edit snapshots)
    const history = await request(app)
      .get(`/api/workbook/${id}/revisions`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(Array.isArray(history.body.revisions)).toBe(true);
    expect(history.body.revisions).toHaveLength(2);
    const versionNumbersInHistory = history.body.revisions.map((v: any) => v.version);
    expect(versionNumbersInHistory).toContain(versionToRestoreTo);

    const beforeRestore = await request(app)
      .get(`/api/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    const versionBeforeRestore = beforeRestore.body.version; // 3

    // 7) restore brings back the earlier content
    const restore = await request(app)
      .post(`/api/workbook/${id}/revisions/${versionToRestoreTo}/restore`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ baseVersion: versionBeforeRestore })
      .expect(200);

    // 8) artifact id stays the same across restore
    expect(restore.body.ok).toBe(true);
    // 9) restore creates a NEW version instead of rewriting history
    expect(restore.body.version).toBe(versionBeforeRestore + 1);
    expect(restore.body.sourceVersion).toBe(versionToRestoreTo);

    // 10) hard reload shows the restored state (fresh GET, same id)
    const afterRestore = await request(app)
      .get(`/api/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(afterRestore.body.id).toBe(id); // same artifact id
    expect(afterRestore.body.version).toBe(versionBeforeRestore + 1);
    const restoredCells = afterRestore.body.schema_json.sheets[0].rows[0].cells;
    expect(restoredCells.A).toEqual(expect.objectContaining({ value: 21 }));
    expect(restoredCells.B).toEqual(expect.objectContaining({ formula: 'A2*2' }));
    // row 1's "second edit" must be GONE (that's what makes this a real restore)
    const restoredRow1 = afterRestore.body.schema_json.sheets[0].rows[1]?.cells || {};
    expect(restoredRow1.A).toBeUndefined();

    // History must still contain the OLD version-5 (post-second-edit, pre-
    // restore) content — restore snapshots forward, never deletes/rewrites.
    const historyAfterRestore = await request(app)
      .get(`/api/workbook/${id}/revisions`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    const preRestoreSnapshot = historyAfterRestore.body.revisions.find(
      (v: any) => v.version === versionBeforeRestore
    );
    expect(preRestoreSnapshot).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // NEGATIVE CONTROL 1 — CAS conflict on cell PATCH (concurrent edit)
  // ---------------------------------------------------------------------
  it('NEGATIVE CONTROL: concurrent edits with the same baseVersion — exactly one winner, one 409, DB holds only the winner content', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Concurrency');
    // version is 1 right after /blank.
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
    // Exactly one winner (200) and one conflict (409) — this is the concrete
    // proof the CAS guard is real: if it were absent, BOTH would return 200
    // (last-write-wins) and this assertion would fail.
    expect(statuses).toEqual([200, 409]);

    const winner = r1.status === 200 ? r1 : r2;
    const dbRow = await pool.query(`SELECT schema_json, version FROM generated_workbooks WHERE id = $1`, [id]);
    const cellA = JSON.parse(dbRow.rows[0].schema_json).sheets[0].rows[0].cells.A;
    // Real DB state (not just HTTP status) proves only the WINNER's write landed.
    expect(cellA.value).toBe(winner.body.cell.value);
    expect(Number(dbRow.rows[0].version)).toBe(2); // only ONE version bump happened, not two
  });

  // ---------------------------------------------------------------------
  // NEGATIVE CONTROL 2 — stale baseVersion rejected outright
  // ---------------------------------------------------------------------
  it('NEGATIVE CONTROL: stale baseVersion on cell PATCH is rejected with 409 before any write', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Stale Version');
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'first', baseVersion: 1 })
      .expect(200); // version now 2

    const stale = await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'stale-write', baseVersion: 1 })
      .expect(409);
    expect(stale.body.code).toBe('WORKBOOK_VERSION_CONFLICT');

    const dbRow = await pool.query(`SELECT schema_json FROM generated_workbooks WHERE id = $1`, [id]);
    const cellA = JSON.parse(dbRow.rows[0].schema_json).sheets[0].rows[0].cells.A;
    expect(cellA.value).toBe('first'); // stale write never landed
  });

  // ---------------------------------------------------------------------
  // NEGATIVE CONTROL 3 — stale restore is rejected atomically
  // ---------------------------------------------------------------------
  it('NEGATIVE CONTROL: stale restore leaves head and revision history byte-identical', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Fault Injection');
    await request(app)
      .post(`/api/workbook/${id}/commands`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ commandId: `restore-v2-${RUN_ID}`, baseVersion: 1, idempotencyKey: `restore-v2-${RUN_ID}`, operations: [{ type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'v2' }] })
      .expect(200);
    await request(app)
      .post(`/api/workbook/${id}/commands`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ commandId: `restore-v3-${RUN_ID}`, baseVersion: 2, idempotencyKey: `restore-v3-${RUN_ID}`, operations: [{ type: 'setCell', sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'v3' }] })
      .expect(200);

    const historyBefore = await pool.query(
      `SELECT COUNT(*)::int AS n FROM generated_workbook_revisions WHERE workbook_id = $1`,
      [id]
    );
    const dbBefore = await pool.query(
      `SELECT schema_json, version FROM generated_workbooks WHERE id = $1`,
      [id]
    );

    const historyCountBefore = historyBefore.rows[0].n;

    const faulted = await request(app)
      .post(`/api/workbook/${id}/revisions/2/restore`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ baseVersion: 2 });
    expect(faulted.status).toBe(409);
    expect(faulted.body.code).toBe('WORKBOOK_VERSION_CONFLICT');

    const dbAfter = await pool.query(
      `SELECT schema_json, version FROM generated_workbooks WHERE id = $1`,
      [id]
    );
    const historyAfter = await pool.query(
      `SELECT COUNT(*)::int AS n FROM generated_workbook_revisions WHERE workbook_id = $1`,
      [id]
    );

    expect(Number(dbAfter.rows[0].version)).toBe(Number(dbBefore.rows[0].version));
    expect(dbAfter.rows[0].schema_json).toBe(dbBefore.rows[0].schema_json);
    expect(historyAfter.rows[0].n).toBe(historyCountBefore);
  });

  // ---------------------------------------------------------------------
  // NEGATIVE CONTROL 4 — cross-tenant denial
  // ---------------------------------------------------------------------
  it('NEGATIVE CONTROL: cross-tenant read/write/restore/share are 404 and revision listing is empty', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Cross Tenant');

    const getRes = await request(app).get(`/api/workbook/${id}`).set(authHeaders(ORG_B, USER_B));
    expect(getRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_B, USER_B))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'intruder' });
    expect(patchRes.status).toBe(404);

    const revisionsRes = await request(app)
      .get(`/api/workbook/${id}/revisions`)
      .set(authHeaders(ORG_B, USER_B))
    expect(revisionsRes.status).toBe(200);
    expect(revisionsRes.body.revisions).toEqual([]);

    const restoreRes = await request(app)
      .post(`/api/workbook/${id}/revisions/2/restore`)
      .set(authHeaders(ORG_B, USER_B))
      .send({ baseVersion: 1 });
    expect(restoreRes.status).toBe(404);

    const shareRes = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_B, USER_B))
      .send({});
    expect(shareRes.status).toBe(404);

    // Real DB state: org A's row is completely untouched by org B's attempts.
    const dbRow = await pool.query(
      `SELECT organization_id, version, share_token FROM generated_workbooks WHERE id = $1`,
      [id]
    );
    expect(dbRow.rows[0].organization_id).toBe(ORG_A);
    expect(Number(dbRow.rows[0].version)).toBe(1);
    expect(dbRow.rows[0].share_token).toBeNull();
  });

  // ---------------------------------------------------------------------
  // NEGATIVE CONTROL 5 — missing auth
  // ---------------------------------------------------------------------
  it('NEGATIVE CONTROL: unauthenticated requests are rejected (401) before touching the DB', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Unauth');
    const res = await request(app).get(`/api/workbook/${id}`).set('x-test-unauth', '1');
    expect(res.status).toBe(401);
  });

  // ---------------------------------------------------------------------
  // SHARE / PUBLIC READ / REVOKE
  // ---------------------------------------------------------------------
  it('share -> public read (sanitized) -> revoke -> public read 404, revoked token cannot resurrect via retry', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Share Flow');
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'shared-content' })
      .expect(200);
    await request(app)
      .patch(`/api/workbook/${id}/governance`)
      .set(authHeaders(ORG_A, USER_A))
      .send({
        field: 'classification',
        value: 'public',
        baseVersion: 2,
        reason: 'MAT-006 public-share compatibility proof',
      })
      .expect(200);

    const share = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);
    const token = share.body.shareToken as string;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(32);
    // crypto-random, not sequential/guessable: two mints for the same
    // workbook produce completely different tokens.
    const reShare = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);
    expect(reShare.body.shareToken).not.toBe(token);

    // 12) public read shows ONLY allowed data, no tenant/internal fields.
    const publicRead = await request(app).get(`/api/workbook/shared/${reShare.body.shareToken}`).expect(200);
    const publicData = publicRead.body.data;
    expect(publicData.organization_id).toBeUndefined();
    expect(publicData.created_by).toBeUndefined();
    expect(publicData.share_token).toBeUndefined();
    expect(publicData.share_created_by).toBeUndefined();
    expect(publicData.prompt).toBeUndefined();
    expect(publicData.sheets[0].rows[0].cells.A.value).toBe('shared-content');

    // The FIRST (now-superseded) token must already be dead — re-sharing
    // atomically replaces it, no window where both are valid.
    const oldTokenRead = await request(app).get(`/api/workbook/shared/${token}`);
    expect(oldTokenRead.status).toBe(404);

    // 15) revoke invalidates the (current) token
    await request(app)
      .delete(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);

    // 16) public read after revoke -> 404
    const afterRevoke = await request(app).get(`/api/workbook/shared/${reShare.body.shareToken}`);
    expect(afterRevoke.status).toBe(404);

    // Retry revoke (idempotent, no resurrect race) — still 200, still dead.
    await request(app)
      .delete(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);
    const stillRevoked = await request(app).get(`/api/workbook/shared/${reShare.body.shareToken}`);
    expect(stillRevoked.status).toBe(404);

    // Real DB state: share_token column is genuinely NULL, not just "the API
    // says 404" — proves the revoke actually wrote NULL, not merely an
    // expiry/soft-delete flag we're not checking.
    const dbRow = await pool.query(`SELECT share_token FROM generated_workbooks WHERE id = $1`, [id]);
    expect(dbRow.rows[0].share_token).toBeNull();
  });

  // ---------------------------------------------------------------------
  // NEGATIVE CONTROL 6 — token enumeration resistance
  // ---------------------------------------------------------------------
  it('NEGATIVE CONTROL: an unknown/guessed share token returns 404 (no enumeration signal, no crash)', async () => {
    const res = await request(app).get(`/api/workbook/shared/${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`);
    expect(res.status).toBe(404);
  });

  // ---------------------------------------------------------------------
  // XLSX injection + parse-back
  // ---------------------------------------------------------------------
  it('XLSX export: formula/value round-trip AND formula-injection payload is neutralized, not executable', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 XLSX Injection');
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 21 })
      .expect(200);
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'B', formula: '=A2*2' })
      .expect(200);
    // Injection payload typed as ordinary DATA (not entered via `formula`).
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'C', value: "=cmd|'/c calc'!A1" })
      .expect(200);

    const download = await request(app)
      .get(`/api/workbook/${id}/download`)
      .set(authHeaders(ORG_A, USER_A))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
        response.on('error', callback);
      })
      .expect(200);
    expect(download.headers['content-type']).toContain('spreadsheetml');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(download.body as Buffer);
    const values: unknown[] = [];
    const formulas: string[] = [];
    wb.eachSheet((sheet) =>
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          values.push(cell.value);
          const formula = (cell.value as { formula?: string } | null)?.formula;
          if (typeof formula === 'string') formulas.push(formula);
        })
      )
    );
    expect(values).toContain(21);
    expect(formulas).toContain('A2*2');
    const injection = values.find(
      (value) => typeof value === 'string' && value.includes("cmd|'/c calc'!A1")
    );
    expect(typeof injection).toBe('string');
    expect(/^[=+\-@]/.test(injection as string)).toBe(false);
  });

  // ---------------------------------------------------------------------
  // Retired CSV compatibility surface + canonical XLSX replacement
  // ---------------------------------------------------------------------
  it('retired CSV path is absent while canonical XLSX preserves comma/UTF-8 data safely', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 CSV, with a comma in the title');
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'contains, a comma' })
      .expect(200);
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 1, columnKey: 'A', value: '=HYPERLINK("evil")' })
      .expect(200);

    const retiredCsv = await request(app)
      .get(`/api/workbook/${id}/export/csv?sheetIndex=0`)
      .set(authHeaders(ORG_A, USER_A));
    expect(retiredCsv.status).toBe(404);

    const xlsx = await request(app)
      .get(`/api/workbook/${id}/download`)
      .set(authHeaders(ORG_A, USER_A))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
        response.on('error', callback);
      })
      .expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.body as Buffer);
    const strings: string[] = [];
    workbook.eachSheet((sheet) =>
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          if (typeof cell.value === 'string') strings.push(cell.value);
        })
      )
    );
    expect(strings).toContain('contains, a comma');
    const injection = strings.find((value) => value.includes('HYPERLINK("evil")'));
    expect(injection).toBeTruthy();
    expect(injection?.startsWith('=')).toBe(false);
  });

  // ---------------------------------------------------------------------
  // Retired CSV route remains a clean 404, never a crash
  // ---------------------------------------------------------------------
  it('retired CSV route with arbitrary sheetIndex is a clean 404, not a 500 crash', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 CSV OOB');
    const res = await request(app)
      .get(`/api/workbook/${id}/export/csv?sheetIndex=99`)
      .set(authHeaders(ORG_A, USER_A));
    expect(res.status).toBe(404);
  });
});
