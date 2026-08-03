/** @vitest-environment node */

/**
 * MAT-006 — Workbook lifecycle (versions/checkpoint/restore/share/revoke/
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

const ORG_A = `org-mat006-a-${uuidv4().slice(0, 8)}`;
const ORG_B = `org-mat006-b-${uuidv4().slice(0, 8)}`;
const USER_A = `user-mat006-a-${uuidv4().slice(0, 8)}`;
const USER_B = `user-mat006-b-${uuidv4().slice(0, 8)}`;

function authHeaders(orgId: string, userId: string) {
  return { 'x-test-org-id': orgId, 'x-test-user-id': userId };
}

/** Minimal, real RFC4180 field parser (quoted fields, doubled-`""`
 * escaping, embedded commas) for one already-newline-split CSV row — used to
 * genuinely parse back the CSV export in tests instead of a naive
 * `.split(',')` that breaks on quoted commas. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
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
  it('golden flow: create -> edit -> formula -> checkpoint -> edit -> history -> restore -> same id -> new version -> hard reread', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Golden Flow');

    // 2) change a cell value
    const v1 = await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 21 })
      .expect(200);
    expect(v1.body.version).toBe(2); // blank insert = version 1, first edit -> 2

    // 3) save a formula and confirm its computed result via the existing
    // GET /:id/schema read path (untouched, MAT-005 mechanism).
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'B', formula: '=A2*2' })
      .expect(200);

    const afterFormula = await request(app)
      .get(`/api/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(afterFormula.body.version).toBe(3);
    const cellsAfterFormula = afterFormula.body.schema_json.sheets[0].rows[0].cells;
    expect(cellsAfterFormula.A).toEqual(expect.objectContaining({ value: 21 }));
    expect(cellsAfterFormula.B).toEqual(expect.objectContaining({ formula: 'A2*2' }));

    // 4) create a checkpoint/version (explicit, no content change)
    const checkpoint = await request(app)
      .post(`/api/workbook/${id}/checkpoint`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ expectedVersion: 3 })
      .expect(200);
    expect(checkpoint.body.version).toBe(4);
    const versionToRestoreTo = checkpoint.body.checkpointedFromVersion; // 3, content = A=21,B=formula

    // 5) make another change
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 1, columnKey: 'A', value: 'second edit' })
      .expect(200);

    // 6) GET/history shows both versions (at least the pre-checkpoint and
    // pre-second-edit snapshots)
    const history = await request(app)
      .get(`/api/workbook/${id}/versions`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(Array.isArray(history.body.data)).toBe(true);
    expect(history.body.data.length).toBeGreaterThanOrEqual(3); // v1(blank),v2(cellA),v3(before checkpoint)... history rows are PRE-write snapshots
    const versionNumbersInHistory = history.body.data.map((v: any) => v.version);
    expect(versionNumbersInHistory).toContain(versionToRestoreTo);

    // Find the specific history row id whose `version` == versionToRestoreTo
    // (content: A=21, B=formula A2*2, no row1 edit yet) to restore to.
    const targetHistoryRow = history.body.data.find((v: any) => v.version === versionToRestoreTo);
    expect(targetHistoryRow).toBeTruthy();

    const beforeRestore = await request(app)
      .get(`/api/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    const versionBeforeRestore = beforeRestore.body.version; // 5

    // 7) restore brings back the earlier content
    const restore = await request(app)
      .post(`/api/workbook/${id}/versions/${targetHistoryRow.id}/restore`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ expectedVersion: versionBeforeRestore })
      .expect(200);

    // 8) artifact id stays the same across restore
    expect(restore.body.ok).toBe(true);
    // 9) restore creates a NEW version instead of rewriting history
    expect(restore.body.version).toBe(versionBeforeRestore + 1);
    expect(restore.body.restoredFromVersion).toBe(versionToRestoreTo);

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
      .get(`/api/workbook/${id}/versions`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    const preRestoreSnapshot = historyAfterRestore.body.data.find(
      (v: any) => v.version === versionBeforeRestore
    );
    expect(preRestoreSnapshot).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // NEGATIVE CONTROL 1 — CAS conflict on cell PATCH (concurrent edit)
  // ---------------------------------------------------------------------
  it('NEGATIVE CONTROL: concurrent edits with the same expectedVersion — exactly one winner, one 409, DB holds only the winner content', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Concurrency');
    // version is 1 right after /blank.
    const [r1, r2] = await Promise.all([
      request(app)
        .patch(`/api/workbook/${id}/cell`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'writer-1', expectedVersion: 1 }),
      request(app)
        .patch(`/api/workbook/${id}/cell`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'writer-2', expectedVersion: 1 }),
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
  // NEGATIVE CONTROL 2 — stale expectedVersion rejected outright
  // ---------------------------------------------------------------------
  it('NEGATIVE CONTROL: stale expectedVersion on cell PATCH is rejected with 409 before any write', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Stale Version');
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'first' })
      .expect(200); // version now 2

    const stale = await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'stale-write', expectedVersion: 1 })
      .expect(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');

    const dbRow = await pool.query(`SELECT schema_json FROM generated_workbooks WHERE id = $1`, [id]);
    const cellA = JSON.parse(dbRow.rows[0].schema_json).sheets[0].rows[0].cells.A;
    expect(cellA.value).toBe('first'); // stale write never landed
  });

  // ---------------------------------------------------------------------
  // NEGATIVE CONTROL 3 — restore fault-injection rollback (transactional)
  // ---------------------------------------------------------------------
  it('NEGATIVE CONTROL: fault-injected restore rolls back atomically — no partial state, pre-restore snapshot NOT leaked into history', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Fault Injection');
    await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'pre-fault' })
      .expect(200); // version 2

    const historyBefore = await pool.query(
      `SELECT COUNT(*)::int AS n FROM generated_workbook_versions WHERE workbook_id = $1`,
      [id]
    );
    const dbBefore = await pool.query(
      `SELECT schema_json, version FROM generated_workbooks WHERE id = $1`,
      [id]
    );

    // History currently has exactly 1 row (the pre-edit blank snapshot at
    // version 1, written by the PATCH above).
    const historyCountBefore = historyBefore.rows[0].n;

    const realHistory = await pool.query(
      `SELECT id FROM generated_workbook_versions WHERE workbook_id = $1 ORDER BY version ASC LIMIT 1`,
      [id]
    );
    const realVersionId = realHistory.rows[0].id;

    const faulted = await request(app)
      .post(`/api/workbook/${id}/versions/${realVersionId}/restore`)
      .set({ ...authHeaders(ORG_A, USER_A), 'x-mat006-force-restore-fault': '1' })
      .send({ expectedVersion: 2 });
    expect(faulted.status).toBe(500);

    const dbAfter = await pool.query(
      `SELECT schema_json, version FROM generated_workbooks WHERE id = $1`,
      [id]
    );
    const historyAfter = await pool.query(
      `SELECT COUNT(*)::int AS n FROM generated_workbook_versions WHERE workbook_id = $1`,
      [id]
    );

    // Real DB state proves atomicity: version UNCHANGED, schema_json
    // UNCHANGED, and — crucially — the history row count is UNCHANGED too.
    // If the transaction were NOT atomic (the exact "applied then errored"
    // gap this repo's institutional memory flags), the pre-restore snapshot
    // INSERT that ran before the forced fault would have landed even though
    // the overall operation failed — this assertion would then fail because
    // historyAfter.n would be historyCountBefore + 1 (or +2, once per
    // attempt) instead of unchanged.
    expect(Number(dbAfter.rows[0].version)).toBe(Number(dbBefore.rows[0].version));
    expect(dbAfter.rows[0].schema_json).toBe(dbBefore.rows[0].schema_json);
    expect(historyAfter.rows[0].n).toBe(historyCountBefore);
  });

  // ---------------------------------------------------------------------
  // NEGATIVE CONTROL 4 — cross-tenant denial
  // ---------------------------------------------------------------------
  it('NEGATIVE CONTROL: cross-tenant read/write/checkpoint/restore/share all 404 for a different org', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 Cross Tenant');

    const getRes = await request(app).get(`/api/workbook/${id}`).set(authHeaders(ORG_B, USER_B));
    expect(getRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_B, USER_B))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 'intruder' });
    expect(patchRes.status).toBe(404);

    const checkpointRes = await request(app)
      .post(`/api/workbook/${id}/checkpoint`)
      .set(authHeaders(ORG_B, USER_B))
      .send({});
    expect(checkpointRes.status).toBe(404);

    const restoreRes = await request(app)
      .post(`/api/workbook/${id}/versions/${uuidv4()}/restore`)
      .set(authHeaders(ORG_B, USER_B))
      .send({ expectedVersion: 1 });
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
    const ws = wb.worksheets[0];
    // 13) XLSX export opens and contains values/formulas.
    const cellA = ws.getRow(2).getCell('A');
    const cellB = ws.getRow(2).getCell('B');
    const cellC = ws.getRow(2).getCell('C');
    expect(cellA.value).toBe(21);
    expect((cellB.value as any)?.formula).toBe('A2*2');
    // Injection cell must NOT be typed as a formula (that's the whole
    // vulnerability — a DDE/formula-typed cell auto-executing on open).
    expect(cellC.type).not.toBe(ExcelJS.ValueType.Formula);
    const cellCText = typeof cellC.value === 'string' ? cellC.value : String(cellC.value);
    // Neutralized: no longer starts with a raw dangerous character.
    expect(/^[=+\-@]/.test(cellCText)).toBe(false);
    expect(cellCText).toContain("cmd|'/c calc'!A1");
  });

  // ---------------------------------------------------------------------
  // CSV export + parse-back + injection
  // ---------------------------------------------------------------------
  it('CSV export: single-sheet scope headers present, RFC4180 quoting, UTF-8, injection payload neutralized, actually parses back', async () => {
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

    const csvRes = await request(app)
      .get(`/api/workbook/${id}/export/csv?sheetIndex=0`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);

    // 14) explicit, machine-readable contract limitation (not just docs).
    expect(csvRes.headers['x-consultify-csv-scope']).toContain('sheet 1 of 1');
    expect(csvRes.headers['x-consultify-csv-limitation']).toMatch(/one sheet/i);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.headers['content-type']).toContain('utf-8');

    const csvText: string = csvRes.text;
    const withoutBom = csvText.replace(/^﻿/, '');
    const lines = withoutBom.trim().split('\r\n');
    // Real RFC4180 field parse (quoted fields, doubled-quote escaping,
    // embedded commas) — not a naive `.split(',')`, per the task's "actually
    // parse it, don't just check status" requirement.
    const dataRow0 = parseCsvLine(lines[1]);
    expect(dataRow0[0]).toBe('contains, a comma');
    const dataRow1 = parseCsvLine(lines[2]);
    // Injection payload neutralized with a leading apostrophe, never a bare "=".
    expect(dataRow1[0].startsWith('=')).toBe(false);
    expect(dataRow1[0]).toBe("'=HYPERLINK(\"evil\")");
  });

  // ---------------------------------------------------------------------
  // CSV export — out-of-range sheetIndex is a clean 400, not a crash
  // ---------------------------------------------------------------------
  it('CSV export: an out-of-range sheetIndex is rejected with 400, not a 500 crash', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-006 CSV OOB');
    const res = await request(app)
      .get(`/api/workbook/${id}/export/csv?sheetIndex=99`)
      .set(authHeaders(ORG_A, USER_A));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SHEET_INDEX_OUT_OF_RANGE');
  });
});
