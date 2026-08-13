/**
 * INTEGRATION GATE — R4-P1: conversation -> Case, driven over the
 * PRODUCTION Teresa router (`/api/v10/teresa`).
 *
 * ===========================================================================
 * WHY THIS SUITE EXISTS AT ALL, AND WHY IT IS NOT `chatIntake.pg.test.ts`
 * ===========================================================================
 * `chatIntake.pg.test.ts` (same directory) already drives `routes/v8/chat.routes.ts`
 * (`/api/v8/chat`, real production mount) and `routes/v8/teresa.routes.ts`
 * (`/api/v8/teresa`) and proves the full canon against BOTH. What it cannot
 * prove is the thing this suite exists for: `routes/v8/teresa.routes.ts` is
 * NEVER imported by `Gateway.ts` — `grep -rn "routes/v8/teresa" server/src`
 * (excluding tests) returns nothing. The router `Gateway.ts` actually mounts
 * for Teresa is `routes/v10/teresa.routes.ts` (`Gateway.ts:1246`,
 * `app.use('/api/v10/teresa', v10TeresaRoutes)`), and before this packet that
 * file contained voice-config/voice-event/tts and not one occurrence of the
 * word "case" — a real Teresa conversation had a working service
 * (`caseIntakeService`) and a working sibling route (`/api/v8/chat/...`) but
 * NO production path of its own to reach it.
 *
 * This suite drives EXACTLY the router `Gateway.ts` mounts, at the exact
 * path a real deployment serves it on, importing the production route module
 * unmodified (no test-only fork). Green here is the literal claim: "a real
 * user's request to `/api/v10/teresa/case-intake/...` creates exactly one
 * Case, on a real PostgreSQL."
 *
 * ===========================================================================
 * WHAT IS REAL HERE AND WHAT IS NOT — stated plainly, not buried
 * ===========================================================================
 * REAL: the router object imported from production source
 * (`routes/v10/teresa.routes.js`); the production `attachV8Context`
 * middleware; `caseWorkspaceHandler`'s error funnel; `caseIntakeService`
 * (propose/confirm/read, unmocked); a real PostgreSQL; every state assertion
 * made OUT OF BAND through a separate `pg.Pool`, never from a response body.
 *
 * SUBSTITUTED: the credential, in the SAME documented way
 * `chatIntake.pg.test.ts` substitutes it — `req.user` is set by a test
 * middleware BEFORE the real, per-route `verifyToken` middleware runs.
 * `verifyToken`'s own test-mode bypass (`auth.middleware.ts` — gated on
 * `NODE_ENV=test` AND `ENABLE_TEST_AUTH_BYPASS=true`) only fabricates a
 * default identity when `req.user` is NOT already set; since this harness
 * always sets it first, the bypass just calls `next()` and the REAL
 * `attachV8Context` derives `req.v8Context` from the harness's `req.user`,
 * exactly as it would from a real `verifyToken` in production. No JWT is
 * minted and no signature is verified in this process — that boundary is
 * proved separately (see `chatIntake.pg.test.ts`'s own header) and is not
 * re-proved here.
 *
 * NOT MOCKED ANYWHERE: no `vi.mock` in this file.
 *
 * ===========================================================================
 * GATE — `NODE_ENV=test` alone is a trap
 * ===========================================================================
 * `getDatabase()` returns an in-memory MOCK unless `RUN_DB_TESTS === '1'` AND
 * `MOCK_DB === 'false'`; every write then silently becomes a no-op. This
 * suite probes reachability first and SKIPS LOUDLY (never a false green) when
 * the database is not reachable.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   ENABLE_TEST_AUTH_BYPASS=true POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
 *   npx vitest run \
 *     server/src/services/caseWorkspace/__tests__/integration/teresaProductionIntake.pg.test.ts \
 *     --environment node
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { attachV8Context } from '../../../../middleware/v8Auth.middleware.js';
import chatRoutes from '../../../../routes/v8/chat.routes.js';
import v10TeresaRoutes from '../../../../routes/v10/teresa.routes.js';
import { errorHandlerMiddleware } from '../../../../utils/ErrorHandler.js';
import { correlationMiddleware } from '../../../../utils/RequestStore.js';
import {
  CONNECTION_STRING,
  ContractFixtures,
  isContractDbReachable,
  warnSkipped,
} from '../../../../routes/caseWorkspace/__tests__/contract/contractHarness.js';

// `verifyToken`'s bypass (auth.middleware.ts) only fires when this and
// NODE_ENV=test are both set, and only when it runs BEFORE it sees a
// pre-set req.user — see this file's header.
process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

const TERESA_V10 = '/api/v10/teresa';
// Mounted too, so one test can prove the v10 and v8/chat surfaces read and
// write the SAME work order for the SAME conversation — the concrete
// evidence that this packet did not build a second intake mechanism.
const CHAT_V8 = '/api/v8/chat';

const REACHABLE = await isContractDbReachable();
warnSkipped('teresaProductionIntake integration suite', REACHABLE);

const suite = REACHABLE ? describe.sequential : describe.skip;

interface Caller {
  organizationId: string;
  userId: string;
  userRole: string;
}

/**
 * Production middleware order for the ROUTES UNDER TEST: correlation ->
 * credential (substituted, see header) -> the real v10 Teresa router (whose
 * OWN route definitions apply `verifyToken` then the real `attachV8Context`
 * per route, exactly as `Gateway.ts` serves them — this router carries no
 * router-wide auth, unlike `v8Router`) -> the real chat router (for the
 * cross-surface proof) -> the real error mapper.
 *
 * The harness ALSO applies `attachV8Context` once, globally, before either
 * router: the v10 router re-derives it per route (harmless — same inputs,
 * same output) but `routes/v8/chat.routes.ts` does NOT call it itself (it
 * relies on `v8Router.use(attachV8Context)` upstream in production,
 * `routes/v8/index.ts:83`), so without this the cross-surface test below
 * would 500 on the chat router, not because of a production bug but because
 * this harness — unlike production — mounts that router in isolation.
 */
function createApp(caller: Caller): Express {
  const app = express();
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use((req: any, _res, next) => {
    req.user = {
      id: caller.userId,
      organizationId: caller.organizationId,
      role: caller.userRole,
      isSuperAdmin: false,
    };
    req.userRole = caller.userRole;
    req.get = (name: string) => req.headers[name.toLowerCase()];
    next();
  });
  app.use(attachV8Context);
  app.use(TERESA_V10, v10TeresaRoutes);
  app.use(CHAT_V8, chatRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

function workOrderBody(projectId: string, overrides: Record<string, unknown> = {}) {
  return {
    projectId,
    goal: 'Przygotowac plan optymalizacji kosztow logistyki dla oddzialu w Gdansku.',
    scope: [
      'Przeanalizowac koszty transportu z ostatnich 12 miesiecy.',
      'Porownac dwoch dostawcow logistycznych.',
    ],
    expectedOutcome: 'Rekomendacja dostawcy wraz z szacowana oszczednoscia rocznA.',
    constraints: ['Bez zmiany magazynu centralnego.'],
    successCriteria: ['Zarzad zatwierdza rekomendacje.'],
    contractedClosureType: 'DECISION_COMPLETED',
    caseProfile: 'STANDARD',
    governanceTier: 'STANDARD',
    autonomyPolicy: 'ASK_MATERIAL_ACTIONS',
    ...overrides,
  };
}

suite('Teresa production intake — /api/v10/teresa/case-intake, real router, real PostgreSQL (R4-P1)', () => {
  let control: Pool;
  let fixtures: ContractFixtures;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
    fixtures = new ContractFixtures(control);
  }, 60_000);

  afterAll(async () => {
    await fixtures?.teardown().catch(() => undefined);
    await control?.end().catch(() => undefined);
  }, 120_000);

  async function countCasesForOrg(orgId: string): Promise<number> {
    const r = await control.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_core WHERE organization_id = $1`,
      [orgId]
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  async function readCaseIds(orgId: string): Promise<string[]> {
    const r = await control.query<{ case_id: string }>(
      `SELECT case_id FROM case_core WHERE organization_id = $1 ORDER BY created_at ASC`,
      [orgId]
    );
    return r.rows.map((row) => row.case_id);
  }

  async function readOutbox(orgId: string, eventType?: string) {
    const r = await control.query<{
      event_id: string;
      event_type: string;
      case_id: string | null;
      redacted_summary: Record<string, unknown>;
    }>(
      eventType
        ? `SELECT event_id, event_type, case_id, redacted_summary
             FROM case_workspace_event_outbox
            WHERE organization_id = $1 AND event_type = $2
            ORDER BY created_at ASC, event_id ASC`
        : `SELECT event_id, event_type, case_id, redacted_summary
             FROM case_workspace_event_outbox
            WHERE organization_id = $1
            ORDER BY created_at ASC, event_id ASC`,
      eventType ? [orgId, eventType] : [orgId]
    );
    return r.rows;
  }

  // =========================================================================
  // 1. Propose ("summary") on the PRODUCTION router: zero Cases, one event
  // =========================================================================

  it('POST /api/v10/teresa/case-intake/conversations/:id/summary shows the work order and creates ZERO Cases (CW-CANON-01)', async () => {
    const f = await fixtures.seedFixture('v10-propose');
    const app = createApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;
    const body = workOrderBody(f.projectId);

    const res = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/summary`)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.data.caseCreated).toBe(false);
    expect(res.body.data.runCreated).toBe(false);
    expect(res.body.data.workOrder.goal).toBe(body.goal);
    expect(res.body.data.workOrderDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(res.body.meta.version).toBe('v10');

    expect(await countCasesForOrg(f.orgId)).toBe(0);
    const proposedEvents = await readOutbox(f.orgId, 'case.intake.work_order_proposed');
    expect(proposedEvents).toHaveLength(1);
    expect(proposedEvents[0].case_id).toBeNull();
  }, 60_000);

  it('GET /api/v10/teresa/case-intake/conversations/:id/work-order re-reads the SAME digest that was just shown', async () => {
    const f = await fixtures.seedFixture('v10-current');
    const app = createApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;

    const shown = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/summary`)
      .send(workOrderBody(f.projectId));

    const current = await request(app).get(
      `${TERESA_V10}/case-intake/conversations/${conversationId}/work-order`
    );

    expect(current.status).toBe(200);
    expect(current.body.data.workOrderDigest).toBe(shown.body.data.workOrderDigest);
    expect(current.body.data.caseCreated).toBe(false);
  }, 60_000);

  // =========================================================================
  // 2. Confirm on the PRODUCTION router: exactly ONE Case; refresh/retry reuse
  // =========================================================================

  it('POST .../confirm creates EXACTLY ONE Case (201), and a refresh/retry with the SAME digest reuses it (200, same caseId, no duplicate)', async () => {
    const f = await fixtures.seedFixture('v10-confirm');
    const app = createApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;

    const shown = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/summary`)
      .send(workOrderBody(f.projectId));
    const digest = shown.body.data.workOrderDigest as string;

    const firstConfirm = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/confirm`)
      .send({ confirmedDigest: digest });
    expect(firstConfirm.status).toBe(201);
    expect(firstConfirm.body.data.caseCreated).toBe(true);
    const caseId = firstConfirm.body.data.caseId as string;
    expect(typeof caseId).toBe('string');
    expect(caseId.length).toBeGreaterThan(0);

    // The click was lost / the page was refreshed / the request raced with
    // itself — same digest, same idempotent confirmation.
    const retryConfirm = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/confirm`)
      .send({ confirmedDigest: digest });
    expect(retryConfirm.status).toBe(200);
    expect(retryConfirm.body.data.caseCreated).toBe(false);
    expect(retryConfirm.body.data.caseId).toBe(caseId);

    // The claim that matters, read out of band: ONE row, not two.
    expect(await countCasesForOrg(f.orgId)).toBe(1);
    expect(await readCaseIds(f.orgId)).toEqual([caseId]);

    // Both directions of the conversation<->Case link resolve on the SAME router.
    const forward = await request(app).get(
      `${TERESA_V10}/case-intake/conversations/${conversationId}/case`
    );
    expect(forward.body.data.caseId).toBe(caseId);
    const backward = await request(app).get(
      `${TERESA_V10}/case-intake/cases/${caseId}/conversation`
    );
    expect(backward.body.data.conversationId).toBe(conversationId);
  }, 60_000);

  it('a redrafted work order stales the old digest: confirming it is refused (409) and creates nothing; confirming the NEW digest succeeds', async () => {
    const f = await fixtures.seedFixture('v10-stale');
    const app = createApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;

    const firstShown = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/summary`)
      .send(workOrderBody(f.projectId));
    const staleDigest = firstShown.body.data.workOrderDigest as string;

    // Teresa (or the human) redrafts before anyone clicked confirm.
    const secondShown = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/summary`)
      .send(workOrderBody(f.projectId, { goal: 'Zmieniony cel po przeredagowaniu.' }));
    const freshDigest = secondShown.body.data.workOrderDigest as string;
    expect(freshDigest).not.toBe(staleDigest);

    const staleConfirm = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/confirm`)
      .send({ confirmedDigest: staleDigest });
    expect(staleConfirm.status).toBe(409);
    // `toCaseWorkspaceAppError` uppercases domain codes (errors.ts:159).
    expect(staleConfirm.body.error.code).toBe('INTAKE_WORK_ORDER_DIGEST_STALE');
    expect(await countCasesForOrg(f.orgId)).toBe(0);

    const freshConfirm = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/confirm`)
      .send({ confirmedDigest: freshDigest });
    expect(freshConfirm.status).toBe(201);
    expect(await countCasesForOrg(f.orgId)).toBe(1);
  }, 60_000);

  // =========================================================================
  // 3. One intake, not two — the v10 Teresa surface and the v8 chat surface
  //    read and write the SAME work order for the SAME conversation
  // =========================================================================

  it('a summary shown on the v10 Teresa router is visible on the v8 chat router, and confirming on EITHER surface yields the SAME single Case', async () => {
    const f = await fixtures.seedFixture('v10-cross-surface');
    const app = createApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;
    const body = workOrderBody(f.projectId);

    // Teresa (v10, production) shows the summary.
    const shown = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/summary`)
      .send(body);
    const digest = shown.body.data.workOrderDigest as string;

    // The chat surface (v8, production) sees the IDENTICAL current order.
    const current = await request(app).get(
      `${CHAT_V8}/conversations/${conversationId}/case-intake/work-order`
    );
    expect(current.body.data.workOrderDigest).toBe(digest);

    // Confirming on the CHAT surface creates the Case…
    const confirmedOnChat = await request(app)
      .post(`${CHAT_V8}/conversations/${conversationId}/case-intake/confirm`)
      .send({ confirmedDigest: digest });
    expect(confirmedOnChat.status).toBe(201);
    const caseId = confirmedOnChat.body.data.caseId as string;

    // …and confirming AGAIN on the TERESA surface reuses it — never a second Case.
    const confirmedOnTeresa = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/confirm`)
      .send({ confirmedDigest: digest });
    expect(confirmedOnTeresa.status).toBe(200);
    expect(confirmedOnTeresa.body.data.caseId).toBe(caseId);

    expect(await countCasesForOrg(f.orgId)).toBe(1);
  }, 90_000);

  // =========================================================================
  // 4. Cross-tenant — refused on the production router, identically whether
  //    or not the thing being probed exists
  // =========================================================================

  it('a foreign-tenant actor is refused on the v10 confirm route and learns nothing about existence', async () => {
    const victim = await fixtures.seedFixture('v10-victim');
    const attackerOrg = await fixtures.seedOrg('v10-attacker');
    const attackerUser = await fixtures.seedUser(attackerOrg, 'v10-attacker');
    await fixtures.seedMembership(attackerOrg, attackerUser, 'ADMIN');

    const victimApp = createApp({
      organizationId: victim.orgId,
      userId: victim.memberUserId,
      userRole: 'MEMBER',
    });
    const conversationId = `conv-${randomUUID()}`;
    const shown = await request(victimApp)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/summary`)
      .send(workOrderBody(victim.projectId));
    const digest = shown.body.data.workOrderDigest as string;

    const attackerApp = createApp({
      organizationId: attackerOrg,
      userId: attackerUser,
      userRole: 'ADMIN',
    });
    const realConv = await request(attackerApp)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/confirm`)
      .send({ confirmedDigest: digest });
    const fakeConv = await request(attackerApp)
      .post(`${TERESA_V10}/case-intake/conversations/conv-${randomUUID()}/confirm`)
      .send({ confirmedDigest: digest });

    expect([realConv.status, fakeConv.status].every((s) => s >= 400 && s < 500)).toBe(true);
    expect(realConv.status).toBe(fakeConv.status);
    expect(realConv.body.error.code).toBe(fakeConv.body.error.code);

    expect(await countCasesForOrg(victim.orgId)).toBe(0);
    expect(await countCasesForOrg(attackerOrg)).toBe(0);
  }, 90_000);

  // =========================================================================
  // 5. Validation — an incomplete summary never reaches the digest
  // =========================================================================

  it('a work order missing goal, scope or expected outcome is rejected with 400 on the v10 route and creates nothing', async () => {
    const f = await fixtures.seedFixture('v10-validation');
    const app = createApp({ organizationId: f.orgId, userId: f.memberUserId, userRole: 'MEMBER' });
    const conversationId = `conv-${randomUUID()}`;

    for (const missing of ['goal', 'scope', 'expectedOutcome'] as const) {
      const body: Record<string, unknown> = workOrderBody(f.projectId);
      delete body[missing];
      const res = await request(app)
        .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/summary`)
        .send(body);
      expect(res.status).toBe(400);
    }

    const badDigest = await request(app)
      .post(`${TERESA_V10}/case-intake/conversations/${conversationId}/confirm`)
      .send({ confirmedDigest: 'not-a-digest' });
    expect(badDigest.status).toBe(400);

    expect(await countCasesForOrg(f.orgId)).toBe(0);
    expect(await readOutbox(f.orgId)).toHaveLength(0);
  }, 60_000);
});
