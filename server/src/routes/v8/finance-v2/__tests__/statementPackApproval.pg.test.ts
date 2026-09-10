// CZERWONY Z ZAŁOŻENIA — E2, nie regresja tego bloku.
/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import type { TestContext } from 'vitest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../../tests/integration/_helpers/assertRealPostgres.js';

const connectionString = process.env.DATABASE_URL ?? '';
const realPg =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  connectionString.startsWith('postgresql://');
if (realPg) process.env.DB_TYPE = 'postgres';

describe.skipIf(!realPg)('CODEX3 E2 — statement-pack approval through real ApiGateway', { retry: 0 }, () => {
  const organizationId = `codex3-approval-${randomUUID()}`;
  const preparerId = `codex3-preparer-${randomUUID()}`;
  const approverId = `codex3-approver-${randomUUID()}`;
  const viewerId = `codex3-viewer-${randomUUID()}`;
  let app: express.Express;
  let verifyClient: Client;
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;

  const token = (id: string, role: string) =>
    jwt.sign(
      { id, userId: id, organizationId, organization_id: organizationId, role },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

  const auth = (id: string, role: string) => ({ Authorization: `Bearer ${token(id, role)}` });

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    await assertRealPostgresTestEnvironment();
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun('INSERT INTO organizations (id, name) VALUES (?, ?)', [organizationId, 'CODEX3 Finance']);
      for (const [id, role, membershipRole] of [
        [preparerId, 'FINANCE_ADMIN', 'ADMIN'],
        [approverId, 'OWNER', 'OWNER'],
        [viewerId, 'MEMBER', 'MEMBER'],
      ] as const) {
        await tx.queryRun(
          "INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, 'unused', ?, 'active')",
          [id, organizationId, `${id}@test.invalid`, role]
        );
        await tx.queryRun(
          "INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
          [`membership-${id}`, organizationId, id, membershipRole]
        );
      }
    });
    const { ApiGateway } = await import('../../../../Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    verifyClient = new Client({ connectionString, statement_timeout: 15_000, query_timeout: 15_000 });
    await verifyClient.connect();
  }, 120_000);

  afterAll(async () => {
    await verifyClient?.end();
  });

  async function createInReviewPack() {
    let response = await request(app)
      .post('/api/v8/finance-v2/artifacts')
      .set(auth(preparerId, 'FINANCE_ADMIN'))
      .send({ artifactType: 'STATEMENT_PACK', naturalKey: `codex3-pack-${randomUUID()}` });
    if (response.status !== 201) {
      throw new Error(JSON.stringify({ code: 'CREATE_STATEMENT_PACK_FAILED', status: response.status, body: response.body }));
    }
    const artifactId = response.body.data.artifactId as string;
    const businessVersionId = response.body.data.currentBusinessVersion.businessVersionId as string;
    let version = response.body.data.currentBusinessVersion.version as number;
    response = await request(app)
      .post(`/api/v8/finance-v2/versions/${businessVersionId}/transitions`)
      .set(auth(preparerId, 'FINANCE_ADMIN'))
      .send({ action: 'submit_for_review', expectedVersion: version });
    expect(response.status).toBe(200);
    version = response.body.data.version;
    response = await request(app)
      .post(`/api/v8/finance-v2/versions/${businessVersionId}/transitions`)
      .set(auth(approverId, 'OWNER'))
      .send({ action: 'start_review', expectedVersion: version });
    expect(response.status).toBe(200);
    version = response.body.data.version;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun("UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?", [businessVersionId])
    );
    return { artifactId, businessVersionId, version };
  }

  async function coldRead(businessVersionId: string) {
    const result = await verifyClient.query(
      'SELECT status, version, approved_by FROM finance_business_versions WHERE business_version_id = $1',
      [businessVersionId]
    );
    return result.rows[0];
  }

  // FIX-4 (odbiór W1/W2, 97_ODBIOR_W1_W2.md §8): `it.fails('rejects a viewer …')`
  // was inverted — it.fails reports PASS exactly when the test body throws, and
  // the body throws TODAY because `createInReviewPack()` itself fails on
  // `POST /artifacts` as FINANCE_ADMIN → 403 BETA_LOCKED (§6 STOP 2), before the
  // security assertion is ever reached. If BetaGate is opened later AND a real
  // hole lets `viewer` approve, `createInReviewPack()` would then succeed, the
  // assertion `expect(response.status).toBe(403)` would fail, and `it.fails`
  // would keep reporting PASS — "the bigger the hole, the easier it is to pass"
  // (the exact shape this FIX removes).
  //
  // Fix shape: fixture-building lives in its OWN plain `it`, which has every
  // right to be honestly RED today (`'creates a STATEMENT_PACK …'` below). The
  // security/behavior assertions are plain `it`s — never `it.fails` — each
  // guarded by a DYNAMIC `ctx.skip(...)` when today's fixture cannot be built,
  // so they report SKIPPED (not a false green, not a spurious red for an
  // unrelated fixture problem) until the fixture actually works. The moment it
  // does, these become real, defended assertions again.
  async function createInReviewPackOrSkip(
    ctx: TestContext
  ): Promise<{ artifactId: string; businessVersionId: string; version: number }> {
    try {
      return await createInReviewPack();
    } catch (error) {
      ctx.skip(
        `fixture unavailable — cannot create/advance a STATEMENT_PACK to IN_REVIEW today: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  it('uses PostgreSQL with the test-auth bypass disabled', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
  });

  it('runs verifyToken before the Finance route', async () => {
    const response = await request(app).post(`/api/v8/finance-v2/models/${randomUUID()}/approve`).send({ expectedVersion: 1 });
    expect(response.status).toBe(401);
  });

  // Dedicated fixture test — plain `it`, allowed to be honestly red (see comment
  // above). Today: RED, "CREATE_STATEMENT_PACK_FAILED … BETA_LOCKED" (§6 STOP 2:
  // no role maps to both "passes BetaGate" and "may submit_for_review").
  it('creates a STATEMENT_PACK through the mounted ApiGateway and drives DRAFT to IN_REVIEW', async () => {
    const state = await createInReviewPack();
    expect(await coldRead(state.businessVersionId)).toMatchObject({ status: 'IN_REVIEW', version: state.version });
  });

  it('rejects a viewer with 403 and leaves the row unchanged', async (ctx) => {
    const state = await createInReviewPackOrSkip(ctx);
    const before = await coldRead(state.businessVersionId);
    const response = await request(app)
      .post(`/api/v8/finance-v2/models/${state.artifactId}/approve`)
      .set(auth(viewerId, 'MEMBER'))
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: state.version });
    expect(response.status).toBe(403);
    expect(await coldRead(state.businessVersionId)).toEqual(before);
  });

  it('allows an owner and persists APPROVED for a separate pg client', async (ctx) => {
    const state = await createInReviewPackOrSkip(ctx);
    const response = await request(app)
      .post(`/api/v8/finance-v2/models/${state.artifactId}/approve`)
      .set(auth(approverId, 'OWNER'))
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: state.version });
    expect(response.status).toBe(200);
    expect(await coldRead(state.businessVersionId)).toMatchObject({ status: 'APPROVED', approved_by: approverId });
  });

  it('returns 409 for a stale expectedVersion without mutating the row', async (ctx) => {
    const state = await createInReviewPackOrSkip(ctx);
    const before = await coldRead(state.businessVersionId);
    const response = await request(app)
      .post(`/api/v8/finance-v2/models/${state.artifactId}/approve`)
      .set(auth(approverId, 'OWNER'))
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: state.version - 1 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('VERSION_CONFLICT');
    expect(await coldRead(state.businessVersionId)).toEqual(before);
  });

  it('allows exactly one of two concurrent approvals with the same expectedVersion', async (ctx) => {
    const state = await createInReviewPackOrSkip(ctx);
    const approve = () => request(app)
      .post(`/api/v8/finance-v2/models/${state.artifactId}/approve`)
      .set(auth(approverId, 'OWNER'))
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: state.version });
    const responses = await Promise.all([approve(), approve()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await coldRead(state.businessVersionId)).status).toBe('APPROVED');
  });
});
