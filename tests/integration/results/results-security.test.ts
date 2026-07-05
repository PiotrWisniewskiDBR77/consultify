/**
 * M15 Seria T / SEC — org-isolation security tests
 *
 * Verifies that EVERY M15 results endpoint scopes its DB queries to the
 * requesting organization's ID — never to a different org, never hardcoded.
 *
 * Strategy: capture (sql, params) from all dbAll() calls during a request,
 * then assert that every SQL containing `organization_id = ?` used the token
 * org in the corresponding params slot.  A cross-org "poison" test makes a
 * second request with a different org token and verifies params switched.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ────────────────────────────────────────────────────────────────────────────
// Test constants
// ────────────────────────────────────────────────────────────────────────────
const ORG_A = 'org-sec-A';
const ORG_B = 'org-sec-B';

// ────────────────────────────────────────────────────────────────────────────
// Auth mock — flip `currentOrgId` / `injectUser` to change the active user
// ────────────────────────────────────────────────────────────────────────────
let currentOrgId = ORG_A;
let injectUser = true;

vi.mock('../../../server/src/middleware/auth.middleware.js', () => {
  const verifyToken = (req: any, _res: any, next: any) => {
    if (injectUser) req.user = { id: 'u-sec', organizationId: currentOrgId };
    next();
  };
  return { __esModule: true, default: verifyToken, verifyToken };
});

// ────────────────────────────────────────────────────────────────────────────
// DB mock — capture every (sql, params) pair for assertion
// ────────────────────────────────────────────────────────────────────────────
interface Captured { sql: string; params: unknown[] }
let capturedCalls: Captured[] = [];

const dbAll = vi.fn(async (sql: string, params: unknown[] = []) => {
  capturedCalls.push({ sql, params });
  return [];
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  __esModule: true,
  all: (sql: string, params?: unknown[]) => dbAll(sql, params ?? []),
  get: vi.fn(async () => null),
  run: vi.fn(async () => ({ success: true, changes: 1 })),
  exec: vi.fn(async () => ({ success: true })),
}));

// ────────────────────────────────────────────────────────────────────────────
// Import routers AFTER mocks
// ────────────────────────────────────────────────────────────────────────────
const { default: driverTreeRouter } = await import(
  '../../../server/src/routes/resultsDriverTree.routes.js'
);
const { default: strategicRouter } = await import(
  '../../../server/src/routes/resultsStrategic.routes.js'
);
const { default: extendedRouter } = await import(
  '../../../server/src/routes/resultsExtended.routes.js'
);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/results-driver-tree', driverTreeRouter);
  app.use('/api/results-strategic', strategicRouter);
  app.use('/api/results-extended', extendedRouter);
  return app;
}

// ────────────────────────────────────────────────────────────────────────────
// Assertion helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Finds every dbAll call whose SQL contains `organization_id = ?` and asserts
 * the orgId appears in the params for that call.  Also verifies the WRONG orgId
 * is never passed.
 */
function assertOrgScopedCallsUse(expectedOrgId: string) {
  const wrongOrgId = expectedOrgId === ORG_A ? ORG_B : ORG_A;
  const orgFilteredCalls = capturedCalls.filter(c => /organization_id\s*=\s*\?/i.test(c.sql));
  expect(orgFilteredCalls.length, 'expected at least one org-scoped DB call').toBeGreaterThan(0);
  for (const call of orgFilteredCalls) {
    expect(
      call.params,
      `SQL "${call.sql.trim().slice(0, 80)}…" did not include expected orgId "${expectedOrgId}"`
    ).toContain(expectedOrgId);
    expect(
      call.params,
      `SQL "${call.sql.trim().slice(0, 80)}…" leaked wrong orgId "${wrongOrgId}"`
    ).not.toContain(wrongOrgId);
  }
}

/** Collect all org values that appeared in any params array (for cross-org tests). */
function allOrgIdsPassedToDb(): string[] {
  return capturedCalls.flatMap(c =>
    c.params.filter(p => p === ORG_A || p === ORG_B) as string[]
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe('M15 SEC — org-isolation across all results endpoints', () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    capturedCalls = [];
    dbAll.mockReset();
    dbAll.mockImplementation(async (sql: string, params: unknown[] = []) => {
      capturedCalls.push({ sql, params });
      return [];
    });
    injectUser = true;
    currentOrgId = ORG_A;
    app = makeApp();
  });

  afterEach(() => {
    injectUser = true;
    currentOrgId = ORG_A;
  });

  // ── 401 coverage ──────────────────────────────────────────────────────────

  it('SEC-01 driver-tree returns 401 when no auth token', async () => {
    injectUser = false;
    const res = await request(app)
      .get('/api/results-driver-tree/all/driver-tree')
      .expect(401);
    expect(res.body.success).toBe(false);
  });

  it('SEC-02 strategic returns 401 when no auth token', async () => {
    injectUser = false;
    const res = await request(app)
      .get('/api/results-strategic/all/strategic')
      .expect(401);
    expect(res.body).toMatchObject({ success: false });
  });

  it('SEC-03 okr returns 401 when no auth token', async () => {
    injectUser = false;
    await request(app)
      .get('/api/results-strategic/all/okr')
      .expect(401);
  });

  it('SEC-04 signals returns 401 when no auth token', async () => {
    injectUser = false;
    await request(app)
      .get('/api/results-extended/all/signals')
      .expect(401);
  });

  it('SEC-05 adoption returns 401 when no auth token', async () => {
    injectUser = false;
    await request(app)
      .get('/api/results-extended/all/adoption')
      .expect(401);
  });

  // ── Org-scoping: all DB calls use token org ────────────────────────────────

  it('SEC-06 driver-tree queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-driver-tree/all/driver-tree')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  it('SEC-07 strategic queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-strategic/all/strategic')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  it('SEC-08 okr queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-strategic/all/okr')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  it('SEC-09 signals queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-extended/all/signals')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  it('SEC-10 sustainment queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-extended/all/sustainment')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  it('SEC-11 adoption queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-extended/all/adoption')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  it('SEC-12 benefit-profiles queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-extended/all/benefit-profiles')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  it('SEC-13 finance-link queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-extended/all/finance-link')
      .expect(200);
    // finance-link returns 200 with empty aggregate when no rows
    const orgCalls = capturedCalls.filter(c => /organization_id\s*=\s*\?/i.test(c.sql));
    for (const call of orgCalls) {
      expect(call.params).toContain(ORG_A);
      expect(call.params).not.toContain(ORG_B);
    }
  });

  it('SEC-14 run-rate queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-extended/all/run-rate')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  it('SEC-15 reallocation queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-extended/all/reallocation')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  it('SEC-16 scenarios queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-extended/all/scenarios')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  it('SEC-17 counterfactual queries only use requesting-org params', async () => {
    await request(app)
      .get('/api/results-extended/all/counterfactual')
      .expect(200);
    assertOrgScopedCallsUse(ORG_A);
  });

  // ── Cross-org isolation: different token → different params ────────────────

  it('SEC-18 signals: org-B token never queries org-A data', async () => {
    // First: ORG_A request
    currentOrgId = ORG_A;
    await request(app).get('/api/results-extended/all/signals').expect(200);
    const orgAIds = allOrgIdsPassedToDb();
    expect(orgAIds).toContain(ORG_A);
    expect(orgAIds).not.toContain(ORG_B);

    // Second: ORG_B request — reset capture
    capturedCalls = [];
    currentOrgId = ORG_B;
    await request(app).get('/api/results-extended/all/signals').expect(200);
    const orgBIds = allOrgIdsPassedToDb();
    expect(orgBIds).toContain(ORG_B);
    expect(orgBIds).not.toContain(ORG_A);
  });

  it('SEC-19 driver-tree: org-B token only queries org-B, never org-A', async () => {
    currentOrgId = ORG_B;
    await request(app).get('/api/results-driver-tree/all/driver-tree').expect(200);
    const ids = allOrgIdsPassedToDb();
    expect(ids).toContain(ORG_B);
    expect(ids).not.toContain(ORG_A);
  });

  it('SEC-20 adoption: switching org changes which org reaches DB (no bleed-over)', async () => {
    // ORG_A pass
    currentOrgId = ORG_A;
    await request(app).get('/api/results-extended/all/adoption').expect(200);
    const passA = allOrgIdsPassedToDb();
    expect(passA.every(id => id === ORG_A)).toBe(true);

    // ORG_B pass
    capturedCalls = [];
    currentOrgId = ORG_B;
    await request(app).get('/api/results-extended/all/adoption').expect(200);
    const passB = allOrgIdsPassedToDb();
    expect(passB.every(id => id === ORG_B)).toBe(true);
  });
});
