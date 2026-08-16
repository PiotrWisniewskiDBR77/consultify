/**
 * @vitest-environment node
 *
 * ASM-BVP-001 (part 1) — Library -> Session bridge, real PostgreSQL.
 *
 * Proves the governed DRD pack bootstrap (`MethodPackRegistry.
 * ensureDrdPackRegistered`, called from `POST /api/method/sessions` in
 * `server/src/routes/method-core.routes.ts`) actually unblocks DRD session
 * creation on a FRESH deployment where `method_packs` starts empty — and
 * that it does so WITHOUT opening the gate for any other method (SIRI stays
 * fail-closed, the negative control).
 *
 * Deliberately does NOT pre-register the DRD pack in `beforeAll` (unlike
 * `http.integration.test.ts`, which registers its own throwaway test packs
 * by hand) — the entire point of this suite is that the FIRST
 * `POST /api/method/sessions` call for methodPackId='drd' against a
 * completely empty `method_packs` table is what makes the pack exist. If a
 * fixture registered it up front, the suite would never actually exercise
 * `ensureDrdPackRegistered`.
 *
 * Run (from the worktree ROOT — this file is collected by root vitest.config.ts's
 * "server/src/services glob-star __tests__" include pattern, NOT by a `server/`-relative config):
 *   DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34910/consultinity" \
 *   DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/assessmentMethodBootstrap/__tests__/asmBvp001DrdLibraryBootstrap.pg.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0
 *
 * `describe.skipIf(!REAL_DB)` — a structural no-op (reports "skipped", never
 * "passed") unless RUN_DB_TESTS=1/MOCK_DB=false/a postgres DATABASE_URL are
 * all present, matching this repo's `.pg.test.ts` convention.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealDatabase, fromPgPool } from '../../../testing/assertRealDatabase.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('ASM-BVP-001 — DRD Library bootstrap, real PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG_A = `org-bvp1-a-${SUFFIX}`;
  const ORG_B = `org-bvp1-b-${SUFFIX}`;
  const USER_A = `user-bvp1-a-${SUFFIX}`;
  const USER_B = `user-bvp1-b-${SUFFIX}`;

  let tokenA = '';
  let tokenB = '';

  let DRD_METHOD_PACK_ID: string;
  let DRD_METHOD_PACK_VERSION: string;
  let DRD_REGISTRATION_READINESS: string;

  beforeAll(async () => {
    if (!REAL_DB) {
      throw new Error('Requires DATABASE_URL (postgres) + RUN_DB_TESTS=1 + MOCK_DB=false.');
    }

    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    // Fail-closed proof this suite is hitting a REAL database, not the app's
    // mock DB layer — see assertRealDatabase.ts's own header for why this is
    // not redundant with the RUN_DB_TESTS/MOCK_DB env gate above.
    await assertRealDatabase(fromPgPool(pool));

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG_A,
      'ASM-BVP-001 test org A',
    ]);
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG_B,
      'ASM-BVP-001 test org B',
    ]);
    for (const [id, org] of [
      [USER_A, ORG_A],
      [USER_B, ORG_B],
    ] as const) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [id, org, `${id}@example.test`, 'user']
      );
    }

    const { default: config } = await import('../../../config/Config.js');
    const sign = (id: string, organizationId: string) =>
      jwt.sign({ id, organizationId, role: 'user' }, config.JWT_SECRET, {
        expiresIn: '15m',
        ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
        ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
      });
    tokenA = sign(USER_A, ORG_A);
    tokenB = sign(USER_B, ORG_B);

    const registryModule = await import('../../../method-core/MethodPackRegistry.js');
    DRD_METHOD_PACK_ID = registryModule.DRD_METHOD_PACK_ID;
    DRD_METHOD_PACK_VERSION = registryModule.DRD_METHOD_PACK_VERSION;
    DRD_REGISTRATION_READINESS = registryModule.DRD_REGISTRATION_READINESS;

    // Confirm the premise: NOTHING pre-registers the pack. Every test below
    // relies on the route itself calling `ensureDrdPackRegistered`.
    const preexisting = await pool.query(
      `SELECT count(*)::int AS n FROM method_packs WHERE organization_id = ANY($1) AND pack_id = $2`,
      [[ORG_A, ORG_B], DRD_METHOD_PACK_ID]
    );
    expect(preexisting.rows[0].n).toBe(0);

    const { default: methodCoreRoutes } = await import('../../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  });

  afterAll(async () => {
    // Additive-only cleanup — every method_* table cascades from
    // organizations (ON DELETE CASCADE, see
    // server/migrations/20260813_method_core_1_kernel.sql). users has no
    // cascade from organizations, so users must go first.
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[USER_A, USER_B]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[ORG_A, ORG_B]]);
    await pool.end();
  });

  function drdCreateBody(overrides: Record<string, unknown> = {}) {
    return {
      module: 'assessment',
      methodPackId: DRD_METHOD_PACK_ID,
      methodPackVersion: DRD_METHOD_PACK_VERSION,
      mode: 'guided_manual',
      projectId: null,
      ...overrides,
    };
  }

  // ---------------------------------------------------------------------------
  // 1. POST /sessions for DRD succeeds after bootstrap; a row lands in
  //    method_sessions (asserted by SELECT, not response body alone).
  // ---------------------------------------------------------------------------
  it('1. creating a DRD session against a fresh org succeeds and lands in method_sessions', async () => {
    const idemKey = `bvp1-create-1:${randomUUID()}`;
    const res = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', idemKey)
      .send(drdCreateBody());

    expect(res.status).toBe(201);
    const sessionId = res.body.session.id;
    expect(typeof sessionId).toBe('string');

    const row = await pool.query(`SELECT * FROM method_sessions WHERE id = $1`, [sessionId]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].organization_id).toBe(ORG_A);
    expect(row.rows[0].method_pack_id).toBe(DRD_METHOD_PACK_ID);
    expect(row.rows[0].method_pack_version).toBe(DRD_METHOD_PACK_VERSION);
    expect(row.rows[0].state).toBe('draft');

    // The bootstrap itself is now provably durable too.
    const pack = await pool.query(
      `SELECT readiness FROM method_packs WHERE organization_id = $1 AND pack_id = $2 AND version = $3`,
      [ORG_A, DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION]
    );
    expect(pack.rows).toHaveLength(1);
    expect(pack.rows[0].readiness).toBe(DRD_REGISTRATION_READINESS);
  });

  // ---------------------------------------------------------------------------
  // 2. Idempotency: the same key twice -> exactly ONE method_sessions row,
  //    the SAME id returned both times.
  // ---------------------------------------------------------------------------
  it('2. the same Idempotency-Key twice produces exactly ONE method_sessions row and the same id', async () => {
    const idemKey = `bvp1-idem-2:${randomUUID()}`;
    const first = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', idemKey)
      .send(drdCreateBody());
    expect(first.status).toBe(201);
    expect(first.body.idempotentReplay).toBe(false);

    const second = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', idemKey)
      .send(drdCreateBody());
    expect(second.status).toBe(200);
    expect(second.body.idempotentReplay).toBe(true);
    expect(second.body.session.id).toBe(first.body.session.id);

    const count = await pool.query(
      `SELECT count(*)::int AS n FROM method_session_create_idempotency WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG_A, idemKey]
    );
    expect(count.rows[0].n).toBe(1);

    const sessions = await pool.query(
      `SELECT count(*)::int AS n FROM method_sessions WHERE id = $1`,
      [first.body.session.id]
    );
    expect(sessions.rows[0].n).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // 3. Two CONCURRENT creates with the same Idempotency-Key -> still exactly
  //    ONE method_sessions row.
  // ---------------------------------------------------------------------------
  it('3. two concurrent creates with the same Idempotency-Key produce exactly ONE row', async () => {
    const idemKey = `bvp1-concurrent-3:${randomUUID()}`;
    const fire = () =>
      request(app)
        .post('/api/method/sessions')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Idempotency-Key', idemKey)
        .send(drdCreateBody());

    const [resA, resB] = await Promise.all([fire(), fire()]);

    expect([resA.status, resB.status].sort()).toEqual([200, 201]);
    const sessionIdA = resA.body.session.id;
    const sessionIdB = resB.body.session.id;
    expect(sessionIdA).toBe(sessionIdB);

    const rows = await pool.query(`SELECT id FROM method_sessions WHERE id = $1`, [sessionIdA]);
    expect(rows.rows).toHaveLength(1);

    const anchors = await pool.query(
      `SELECT count(*)::int AS n FROM method_session_create_idempotency WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG_A, idemKey]
    );
    expect(anchors.rows[0].n).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // 4. Tenant negative: a session created for org A is not readable, and not
  //    creatable, cross-org by org B.
  // ---------------------------------------------------------------------------
  it('4. a session created for org A is neither readable nor creatable cross-org by org B', async () => {
    const sharedIdemKey = `bvp1-tenant-4:${randomUUID()}`;

    const createdByA = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', sharedIdemKey)
      .send(drdCreateBody());
    expect(createdByA.status).toBe(201);
    const sessionIdA = createdByA.body.session.id;

    // --- not READABLE cross-org --------------------------------------------
    const readAsB = await request(app)
      .get(`/api/method/sessions/${sessionIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(readAsB.status).toBe(403);
    expect(readAsB.body.session).toBeUndefined();

    // --- not CREATABLE cross-org (reusing the SAME Idempotency-Key does NOT
    //     leak org A's session to org B — idempotency is scoped per-org) ----
    const createdByB = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('Idempotency-Key', sharedIdemKey)
      .send(drdCreateBody());
    expect(createdByB.status).toBe(201);
    const sessionIdB = createdByB.body.session.id;
    expect(sessionIdB).not.toBe(sessionIdA);

    const crossOrgRow = await pool.query(
      `SELECT count(*)::int AS n FROM method_sessions WHERE id = $1 AND organization_id = $2`,
      [sessionIdA, ORG_B]
    );
    expect(crossOrgRow.rows[0].n).toBe(0);

    const ownRowB = await pool.query(
      `SELECT organization_id FROM method_sessions WHERE id = $1`,
      [sessionIdB]
    );
    expect(ownRowB.rows[0].organization_id).toBe(ORG_B);
  });

  // ---------------------------------------------------------------------------
  // 5. Pack fail-closed negative: SIRI create is refused. Proves the DRD
  //    bootstrap did not open the gate for every method.
  // ---------------------------------------------------------------------------
  it('5. a non-DRD method (SIRI) is refused with pack_not_released — the bootstrap did not open everything', async () => {
    const res = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', `bvp1-siri-5:${randomUUID()}`)
      .send(drdCreateBody({ methodPackId: 'siri', methodPackVersion: '1.0.0' }));

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('pack_not_released');

    const pack = await pool.query(
      `SELECT count(*)::int AS n FROM method_packs WHERE organization_id = $1 AND pack_id = $2`,
      [ORG_A, 'siri']
    );
    expect(pack.rows[0].n).toBe(0);

    const sessions = await pool.query(
      `SELECT count(*)::int AS n FROM method_sessions WHERE organization_id = $1 AND method_pack_id = $2`,
      [ORG_A, 'siri']
    );
    expect(sessions.rows[0].n).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 6. Bootstrap idempotency: running ensureDrdPackRegistered twice leaves
  //    exactly ONE method_packs row (called directly, not via HTTP, and
  //    against a THIRD org so it cannot ride on tests 1-5's side effects).
  // ---------------------------------------------------------------------------
  it('6. ensureDrdPackRegistered run twice leaves exactly one method_packs row and does not churn the version', async () => {
    const org = `org-bvp1-bootstrap-${SUFFIX}`;
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      org,
      'ASM-BVP-001 bootstrap-only test org',
    ]);
    try {
      const { ensureDrdPackRegistered } = await import('../../../method-core/MethodPackRegistry.js');
      const first = await ensureDrdPackRegistered(org);
      const second = await ensureDrdPackRegistered(org);

      expect(second.id).toBe(first.id);
      expect(second.version).toBe(first.version);
      expect(second.readiness).toBe(DRD_REGISTRATION_READINESS);

      const rows = await pool.query(
        `SELECT id, version FROM method_packs WHERE organization_id = $1 AND pack_id = $2`,
        [org, DRD_METHOD_PACK_ID]
      );
      expect(rows.rows).toHaveLength(1);
      expect(rows.rows[0].id).toBe(first.id);
      expect(rows.rows[0].version).toBe(DRD_METHOD_PACK_VERSION);
    } finally {
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [org]);
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Cold readback: after creating, re-querying through a FRESH
  //    MethodSessionService instance (own MethodPackRegistry instance, not
  //    the process-wide singleton the route uses) confirms the session is
  //    still there with the same id and state.
  // ---------------------------------------------------------------------------
  it('7. cold readback via a fresh MethodSessionService instance sees the same session id/state', async () => {
    const created = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', `bvp1-cold-7:${randomUUID()}`)
      .send(drdCreateBody());
    expect(created.status).toBe(201);
    const sessionId = created.body.session.id;
    const originalState = created.body.session.state;

    const { MethodPackRegistry: RegistryCtor } = await import('../../../method-core/MethodPackRegistry.js');
    const { MethodSessionService } = await import('../../../method-core/MethodSessionService.js');
    const { methodEventStore } = await import('../../../method-core/MethodEventStore.js');

    const freshRegistry = new RegistryCtor();
    const freshSessionService = new MethodSessionService(freshRegistry, methodEventStore);

    const reread = await freshSessionService.getSession(sessionId);
    expect(reread).not.toBeNull();
    expect(reread?.id).toBe(sessionId);
    expect(reread?.state).toBe(originalState);
    expect(reread?.organizationId).toBe(ORG_A);
  });
});
