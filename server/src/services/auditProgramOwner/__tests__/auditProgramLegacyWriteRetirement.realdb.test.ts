/**
 * AUD-MVP-OWNER-001 — real-Postgres proof that the legacy `audit_programs`
 * CRUD write surface (POST/PATCH/DELETE on server/src/routes/
 * audit-programs.routes.ts) is retired, while reads and the Audits kernel
 * writer keep working. Runs against a REAL local Postgres (no DB mocks) —
 * see the harness in tests/acceptance/harness.ts, reused here as-is.
 *
 * Location note: this file intentionally lives under
 * server/src/services/auditProgramOwner/__tests__/ rather than a top-level
 * tests/ directory. Root vitest.config.ts's `include` globs are intersected
 * with (not additive to) any positional path filter, and a top-level
 * tests/auditProgramOwner tree is not one of the listed globs — a suite
 * there would collect ZERO tests and print a false, silent-green PASS. Two
 * globs DO cover this path: the "services, any __tests__ subtree" glob and
 * the lane-A path lease's allowed-new-root regex
 * `server/src/(?:...)/(?:auditPrograms?)[^/]*\/` (auditProgramOwner matches
 * `auditPrograms?` + `[^/]*`).
 *
 * DoD checklist this file proves (server/src/routes/audit-programs.routes.ts
 * + server/src/services/auditProgramService.ts):
 *   1. NEGATIVE — legacy POST/PATCH/DELETE, AND generate-surveys's
 *      bookkeeping UPDATE (closed per lead decision 2026-08-16: the task's
 *      acceptance bar is a writer inventory of exactly 1, so this path is
 *      retired too, not left as a "bookkeeping-only" exception), no longer
 *      mutate audit_programs (exact 410 + AUDIT_PROGRAM_LEGACY_WRITE_DISABLED,
 *      row byte-unchanged by SELECT diff).
 *   2. POSITIVE control — legacy GET (list + by id) still return existing
 *      programs.
 *   3. POSITIVE control — the Audits kernel writer
 *      (createProgramFromPack) still creates a program.
 *   4. Tenant negative — org B cannot read org A's program through the
 *      legacy surface, and org A's program never appears in org B's list.
 *   5. Auth negative — this route has NO capability/role gate beyond
 *      requireOrgAccess() (verified by reading rbac.middleware.ts +
 *      audit-programs.routes.ts: only apiAuthRateLimiter/verifyToken/
 *      requireOrgAccess()/demoContextMiddleware are mounted; no
 *      requireCapability/validateOrgMembership call exists on this router).
 *      So the honest "role negative" this route actually enforces is: no
 *      token -> 401, and a token with no resolvable organization context ->
 *      403 ORGANIZATION_ACCESS_REQUIRED. Both are proven below instead of a
 *      fabricated capability check that doesn't exist in the code.
 *   6. Stale/replay — repeating the identical legacy mutation attempt is
 *      refused every time and never writes.
 *   7. Cold readback — using a FRESH pg.Client (not the app's pool), the
 *      kernel-created program from #3 is still present after the fact, and
 *      the legacy surface still refuses to mutate it.
 *   8. Flag OFF/ON — both states proven in the SAME run, for BOTH the CRUD
 *      trio and generate-surveys: AUDIT_PROGRAM_LEGACY_WRITES_ENABLED
 *      unset/false (default, safe) blocks writes; =true restores the
 *      pre-retirement legacy write (and is cleaned up / flipped back),
 *      demonstrating the rollback story is real for the whole write surface.
 */
import { mintToken, pgClient, requireLocalDbUrl } from '../../../../../tests/acceptance/harness.js';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

requireLocalDbUrl();

const PREFIX = 'claude-a-aud-owner--';
const ORG_B_ID = `${PREFIX}org-b`;
const USER_B_ID = `${PREFIX}user-b`;
const MEMBER_B_ID = `${PREFIX}member-b`;
const NO_ORG_USER_ID = `${PREFIX}user-noorg`;
const LEGACY_PROGRAM_ID = `${PREFIX}legacy-prog-1`;
const REPLAY_PROGRAM_ID = `${PREFIX}legacy-prog-replay`;
const GENSURVEYS_PROGRAM_ID = `${PREFIX}legacy-prog-gensurveys`;
const PACK_ID = `${PREFIX}pack-1`;
const ROLLBACK_CREATE_NAME = `${PREFIX}rollback-created`;

let app: Express;
let orgAId: string;
let userAId: string;

async function cleanup(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`DELETE FROM audit_programs WHERE id LIKE $1 OR name = $2`, [
      `${PREFIX}%`,
      ROLLBACK_CREATE_NAME,
    ]);
    await client.query(`DELETE FROM audit_packs WHERE id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM organization_members WHERE id = $1`, [MEMBER_B_ID]);
    await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_B_ID]);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  const { seed, SEED } = await import('../../../../../tests/acceptance/seed.mjs');
  await seed();
  orgAId = SEED.ORG_ID;
  userAId = SEED.USER_ID;

  await cleanup();

  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    // Foreign org + user + ACTIVE membership (tenant negative, DoD #4).
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'CLAUDE-A audit-owner foreign org', 'enterprise', 'active', 1, $2)`,
      [ORG_B_ID, now]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, 'claude-a-aud-owner-foreign@acceptance.local', 'acceptance-only',
               'ADMIN', 'active', 'ClaudeA', 'ForeignOrg', $3)`,
      [USER_B_ID, ORG_B_ID, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', $4)`,
      [MEMBER_B_ID, ORG_B_ID, USER_B_ID, now]
    );

    // One pre-existing LEGACY row (pack_id IS NULL) for org A — read-path +
    // mutation-refusal fixtures (DoD #1, #2, #6).
    await client.query(
      `INSERT INTO audit_programs
         (id, organization_id, name, description, objective, status, preset, config,
          created_by, created_at, updated_at)
       VALUES ($1, $2, 'CLAUDE-A legacy fixture program', NULL, NULL, 'draft', NULL, '{}',
               $3, $4, $4)`,
      [LEGACY_PROGRAM_ID, orgAId, userAId, now]
    );
    await client.query(
      `INSERT INTO audit_programs
         (id, organization_id, name, description, objective, status, preset, config,
          created_by, created_at, updated_at)
       VALUES ($1, $2, 'CLAUDE-A replay fixture program', NULL, NULL, 'draft', NULL, '{}',
               $3, $4, $4)`,
      [REPLAY_PROGRAM_ID, orgAId, userAId, now]
    );
    // Dedicated fixture for the generate-surveys flag-ON positive control
    // (kept separate from LEGACY_PROGRAM_ID/REPLAY_PROGRAM_ID so that test's
    // real UPDATE write can't interfere with the byte-unchanged assertions
    // those other fixtures are used for).
    await client.query(
      `INSERT INTO audit_programs
         (id, organization_id, name, description, objective, status, preset, config,
          created_by, created_at, updated_at)
       VALUES ($1, $2, 'CLAUDE-A gen-surveys fixture program', NULL, NULL, 'draft', NULL, '{}',
               $3, $4, $4)`,
      [GENSURVEYS_PROGRAM_ID, orgAId, userAId, now]
    );

    // A published pack for org A, so the Audits kernel's createProgramFromPack
    // (the canonical writer, DoD #3) has something valid to attach to.
    await client.query(
      `INSERT INTO audit_packs
         (id, organization_id, pack_key, version, title, classification, publication_status,
          created_by, created_at, updated_at)
       VALUES ($1, $2, $3, 1, 'CLAUDE-A audit-owner test pack', 'DEMONSTRATION', 'published',
               $4, $5, $5)`,
      [PACK_ID, orgAId, `${PREFIX}pack-key`, userAId, now]
    );
  } finally {
    await client.end();
  }

  const { default: router } = await import('../../../routes/audit-programs.routes.js');
  app = express();
  app.use(express.json());
  app.use('/api/audit', router);
});

afterAll(cleanup);

afterEach(() => {
  vi.unstubAllEnvs();
});

const authA = () => ({ Authorization: `Bearer ${mintToken()}` });
const authB = () => ({
  Authorization: `Bearer ${mintToken({
    id: USER_B_ID,
    organizationId: ORG_B_ID,
    organization_id: ORG_B_ID,
    email: 'claude-a-aud-owner-foreign@acceptance.local',
  })}`,
});
/** No resolvable org context: neither a token claim nor any DB membership row. */
const authNoOrg = () => ({
  Authorization: `Bearer ${mintToken({
    id: NO_ORG_USER_ID,
    organizationId: undefined,
    organization_id: undefined,
  })}`,
});

async function fetchProgramRow(id: string): Promise<Record<string, unknown> | undefined> {
  const client = pgClient();
  await client.connect();
  try {
    const res = await client.query(`SELECT * FROM audit_programs WHERE id = $1`, [id]);
    return res.rows[0];
  } finally {
    await client.end();
  }
}

async function countProgramsForOrg(orgId: string): Promise<number> {
  const client = pgClient();
  await client.connect();
  try {
    const res = await client.query(
      `SELECT COUNT(*)::int AS n FROM audit_programs WHERE organization_id = $1`,
      [orgId]
    );
    return res.rows[0].n;
  } finally {
    await client.end();
  }
}

describe('AUD-MVP-OWNER-001 — legacy audit_programs write retirement (real Postgres)', () => {
  // ── #1 NEGATIVE: legacy POST/PATCH/DELETE no longer mutate ─────────────────
  it('POST /api/audit/programs — default: 410 AUDIT_PROGRAM_LEGACY_WRITE_DISABLED, no row created', async () => {
    const before = await countProgramsForOrg(orgAId);
    const res = await request(app)
      .post('/api/audit/programs')
      .set(authA())
      .send({ name: `${PREFIX}should-not-exist` });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    const after = await countProgramsForOrg(orgAId);
    expect(after).toBe(before);
  });

  it('PATCH /api/audit/programs/:id — default: 410, row unchanged (name/updated_at identical)', async () => {
    const before = await fetchProgramRow(LEGACY_PROGRAM_ID);
    const res = await request(app)
      .patch(`/api/audit/programs/${LEGACY_PROGRAM_ID}`)
      .set(authA())
      .send({ name: 'MUTATED-SHOULD-NOT-PERSIST' });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    const after = await fetchProgramRow(LEGACY_PROGRAM_ID);
    expect(after?.name).toBe(before?.name);
    expect(String(after?.updated_at)).toBe(String(before?.updated_at));
  });

  it('DELETE /api/audit/programs/:id — default: 410, row still exists', async () => {
    const res = await request(app)
      .delete(`/api/audit/programs/${LEGACY_PROGRAM_ID}`)
      .set(authA());
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    const row = await fetchProgramRow(LEGACY_PROGRAM_ID);
    expect(row).toBeDefined();
    expect(row?.id).toBe(LEGACY_PROGRAM_ID);
  });

  // AUD-MVP-OWNER-001 (lead decision 2026-08-16): generate-surveys's
  // bookkeeping updateProgram() call is retired too — closing the judgment
  // call flagged in the first pass. Leaving it live kept the legacy service
  // as a second writer of audit_programs (inventory=2, not 1); there is no
  // legitimate way to reach it anymore once create/update/delete refuse.
  it('POST .../generate-surveys — default: 410 AUDIT_PROGRAM_LEGACY_WRITE_DISABLED, row byte-unchanged', async () => {
    const before = await fetchProgramRow(GENSURVEYS_PROGRAM_ID);
    const res = await request(app)
      .post(`/api/audit/programs/${GENSURVEYS_PROGRAM_ID}/generate-surveys`)
      .set(authA());
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    const after = await fetchProgramRow(GENSURVEYS_PROGRAM_ID);
    // Byte-unchanged: every column identical, not just name/updated_at.
    expect(after).toEqual(before);
  });

  // ── #2 POSITIVE control: reads keep working ─────────────────────────────────
  it('GET /api/audit/programs/:id — still returns the pre-existing legacy program', async () => {
    const res = await request(app)
      .get(`/api/audit/programs/${LEGACY_PROGRAM_ID}`)
      .set(authA());
    expect(res.status).toBe(200);
    expect(res.body.program.id).toBe(LEGACY_PROGRAM_ID);
    expect(res.body.program.name).toBe('CLAUDE-A legacy fixture program');
  });

  it('GET /api/audit/programs — list still includes the pre-existing legacy program for org A', async () => {
    const res = await request(app).get('/api/audit/programs?limit=200').set(authA());
    expect(res.status).toBe(200);
    const ids = (res.body.programs as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(LEGACY_PROGRAM_ID);
  });

  // ── #3 POSITIVE control: the Audits kernel writer still creates a program ──
  let kernelProgramId: string;
  it('kernel createProgramFromPack (canonical writer) still creates a program', async () => {
    const kernel = await import('../../audits/programService.js');
    const detail = await kernel.createProgramFromPack(
      orgAId,
      { userId: userAId, organizationId: orgAId, platformRole: 'user' },
      { packId: PACK_ID, name: `${PREFIX}kernel-created` }
    );
    expect(detail.program.id).toBeTruthy();
    kernelProgramId = detail.program.id;
    const row = await fetchProgramRow(detail.program.id);
    expect(row).toBeDefined();
    expect(row?.organization_id).toBe(orgAId);
    // pack_id is the kernel-authorship marker the migration comment describes —
    // the legacy writer never sets it.
    expect(row?.pack_id).toBe(PACK_ID);
  });

  // ── #7 Cold readback: fresh pg.Client sees the kernel row; legacy write still refused ──
  it('cold readback: a FRESH pg.Client still sees the kernel-created program, and legacy PATCH on it is still refused', async () => {
    expect(kernelProgramId).toBeTruthy();
    const freshClient = pgClient();
    await freshClient.connect();
    let row: Record<string, unknown> | undefined;
    try {
      const res = await freshClient.query(`SELECT * FROM audit_programs WHERE id = $1`, [
        kernelProgramId,
      ]);
      row = res.rows[0];
    } finally {
      await freshClient.end();
    }
    expect(row).toBeDefined();
    expect(row?.id).toBe(kernelProgramId);

    const patchRes = await request(app)
      .patch(`/api/audit/programs/${kernelProgramId}`)
      .set(authA())
      .send({ name: 'MUTATED-VIA-LEGACY-SHOULD-NOT-PERSIST' });
    expect(patchRes.status).toBe(410);
    const after = await fetchProgramRow(kernelProgramId);
    expect(after?.name).toBe(row?.name);
  });

  // ── #4 Tenant negative ───────────────────────────────────────────────────────
  it('GET /api/audit/programs/:id — org B gets 404 for org A program (no cross-tenant leak)', async () => {
    const res = await request(app)
      .get(`/api/audit/programs/${LEGACY_PROGRAM_ID}`)
      .set(authB());
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('legacy fixture program');
  });

  it('GET /api/audit/programs — org A program never appears in org B list', async () => {
    const res = await request(app).get('/api/audit/programs?limit=200').set(authB());
    expect(res.status).toBe(200);
    const ids = (res.body.programs as Array<{ id: string }>).map((p) => p.id);
    expect(ids).not.toContain(LEGACY_PROGRAM_ID);
  });

  it('PATCH /api/audit/programs/:id — org B mutating org A id is refused identically (410) and writes nothing', async () => {
    const before = await fetchProgramRow(LEGACY_PROGRAM_ID);
    const res = await request(app)
      .patch(`/api/audit/programs/${LEGACY_PROGRAM_ID}`)
      .set(authB())
      .send({ name: 'CROSS-TENANT-SHOULD-NOT-PERSIST' });
    expect(res.status).toBe(410);
    const after = await fetchProgramRow(LEGACY_PROGRAM_ID);
    expect(after?.name).toBe(before?.name);
  });

  // ── #5 Auth negative (see file header: no capability gate exists on this
  // route today, so this proves the actual enforced gate instead) ────────────
  it('no token: 401', async () => {
    const res = await request(app).get('/api/audit/programs');
    expect(res.status).toBe(401);
  });

  it('token with no resolvable organization context: 403 ORGANIZATION_ACCESS_REQUIRED', async () => {
    const res = await request(app).get('/api/audit/programs').set(authNoOrg());
    expect(res.status).toBe(403);
  });

  // ── #6 Stale/replay ──────────────────────────────────────────────────────────
  it('repeating the identical PATCH attempt 3x is refused every time and never writes', async () => {
    const before = await fetchProgramRow(REPLAY_PROGRAM_ID);
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .patch(`/api/audit/programs/${REPLAY_PROGRAM_ID}`)
        .set(authA())
        .send({ name: `REPLAY-ATTEMPT-${i}` });
      expect(res.status).toBe(410);
      expect(res.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    }
    const after = await fetchProgramRow(REPLAY_PROGRAM_ID);
    expect(after?.name).toBe(before?.name);
    expect(String(after?.updated_at)).toBe(String(before?.updated_at));
  });

  // ── #8 Flag OFF/ON — both states, same run: the rollback story is real ─────
  it('flag ON (AUDIT_PROGRAM_LEGACY_WRITES_ENABLED=true) restores the legacy write; flag back OFF blocks it again', async () => {
    vi.stubEnv('AUDIT_PROGRAM_LEGACY_WRITES_ENABLED', 'true');
    const before = await countProgramsForOrg(orgAId);
    const createRes = await request(app)
      .post('/api/audit/programs')
      .set(authA())
      .send({ name: ROLLBACK_CREATE_NAME, status: 'draft' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.program.name).toBe(ROLLBACK_CREATE_NAME);
    const afterCreate = await countProgramsForOrg(orgAId);
    expect(afterCreate).toBe(before + 1);
    const createdId = createRes.body.program.id as string;

    const deleteRes = await request(app)
      .delete(`/api/audit/programs/${createdId}`)
      .set(authA());
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    const afterDelete = await countProgramsForOrg(orgAId);
    expect(afterDelete).toBe(before);

    vi.unstubAllEnvs();
    const blockedRes = await request(app)
      .post('/api/audit/programs')
      .set(authA())
      .send({ name: `${PREFIX}should-not-exist-again` });
    expect(blockedRes.status).toBe(410);
    const afterFlagOff = await countProgramsForOrg(orgAId);
    expect(afterFlagOff).toBe(before);
  });

  // ── generate-surveys flag-ON positive control — proves the SAME switch that
  // unblocks POST/PATCH/DELETE also unblocks the bookkeeping UPDATE, so the
  // rollback story for the whole write surface (not just the CRUD trio) is
  // real. Uses its own dedicated fixture row (GENSURVEYS_PROGRAM_ID) so this
  // real write can't interfere with the byte-unchanged assertions other
  // tests make against LEGACY_PROGRAM_ID/REPLAY_PROGRAM_ID. ────────────────
  it('POST .../generate-surveys — flag ON: performs a real bookkeeping UPDATE (row changes), flag back OFF refuses again on the same row', async () => {
    const before = await fetchProgramRow(GENSURVEYS_PROGRAM_ID);
    vi.stubEnv('AUDIT_PROGRAM_LEGACY_WRITES_ENABLED', 'true');
    const res = await request(app)
      .post(`/api/audit/programs/${GENSURVEYS_PROGRAM_ID}/generate-surveys`)
      .set(authA());
    expect(res.status).toBe(200);
    // No templates/assignees configured on this fixture (config='{}'), so
    // nothing fans out — but generateSurveys() still persists the bookkeeping
    // snapshot (surveysGenerated:false, generation:{...}) via a real UPDATE,
    // which is exactly the write this task retires by default. Prove the row
    // actually changed.
    const afterEnabled = await fetchProgramRow(GENSURVEYS_PROGRAM_ID);
    expect(String(afterEnabled?.updated_at)).not.toBe(String(before?.updated_at));
    expect(afterEnabled?.config).not.toEqual(before?.config);

    vi.unstubAllEnvs();
    const blockedRes = await request(app)
      .post(`/api/audit/programs/${GENSURVEYS_PROGRAM_ID}/generate-surveys`)
      .set(authA());
    expect(blockedRes.status).toBe(410);
    expect(blockedRes.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    const afterFlagOff = await fetchProgramRow(GENSURVEYS_PROGRAM_ID);
    expect(afterFlagOff).toEqual(afterEnabled);
  });
});
