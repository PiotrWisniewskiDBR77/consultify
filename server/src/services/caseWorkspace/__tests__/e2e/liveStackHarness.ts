/**
 * Case Workspace — E2E harness for the LIVE STACK (Strumień E).
 *
 * ===========================================================================
 * WHAT THIS PROVES THAT NOTHING ELSE IN THE REPO PROVES
 * ===========================================================================
 * There are three layers of Case Workspace tests, and each one substitutes a
 * different thing:
 *
 *   1. `routes/caseWorkspace/__tests__/*.test.ts` — `vi.mock()` over the
 *      domain service. Proves zod/status mapping. Cannot tell you whether the
 *      endpoint works.
 *   2. `routes/caseWorkspace/__tests__/contract/**` — real router, real
 *      services, real Postgres, but `createContractApp()` SETS `req.v8Context`
 *      directly. It substitutes the CREDENTIAL: no token is ever minted or
 *      verified, and the process under test is the test process itself.
 *   3. THIS DIRECTORY — nothing is substituted. A separately running server
 *      process is driven over real HTTP with a real `Authorization: Bearer`
 *      token obtained from a real `POST /api/auth/login` (real bcrypt, real
 *      JWT signature). The assertions read the database out-of-band.
 *
 * Layer 3 is the only one that can catch: a route that was never mounted, an
 * auth middleware ordering bug, a feature gate that 404s the whole surface,
 * a response ENVELOPE the frontend cannot consume, and anything that only
 * appears when the server is a real process rather than an in-process app.
 *
 * ---------------------------------------------------------------------------
 * THE OWNER'S HARD RULE THIS FILE ENCODES
 * ---------------------------------------------------------------------------
 * `/api/*` is NEVER mocked here, and a 401, a mock, or sample data is NEVER
 * treated as a pass. The only recognised outcomes are: the scenario really
 * ran against the live stack, or the suite SKIPS LOUDLY saying the stack is
 * not up. There is deliberately no third path, because a suite that quietly
 * goes green when the backend is down is worse than no suite at all.
 *
 * ---------------------------------------------------------------------------
 * DATABASE — disposable local container ONLY
 * ---------------------------------------------------------------------------
 * `assertLocalDatabase()` refuses any host that is not loopback. Writing test
 * data into the demo/staging database is forbidden by the owner (demo data is
 * the product's face), so the refusal is a hard throw, not a warning.
 *
 * ---------------------------------------------------------------------------
 * HOW TO RUN (both processes must already be up — see LIVE_STACK_RUNBOOK.md)
 * ---------------------------------------------------------------------------
 *   bash scripts/dev/case-workspace-local-backend.sh        # :3001
 *
 *   cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 \
 *     MOCK_DB=false \
 *     DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
 *     npx vitest run src/services/caseWorkspace/__tests__/e2e --environment node
 *
 * NOTE ON `NODE_ENV=test` HERE: it applies to the VITEST process (which only
 * issues HTTP requests and SQL reads), NOT to the server under test. The
 * server runs `NODE_ENV=development` precisely so that the three test-only
 * auth backdoors (`ENABLE_TEST_AUTH_BYPASS`, `E2E_MODE`, the Gateway stub)
 * stay shut. `assertNoAuthBypass()` below re-proves that at runtime.
 */

import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import pg from 'pg';

export const BACKEND =
  process.env.CW_E2E_BACKEND ?? 'http://127.0.0.1:3001';

export const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test';

/** Credentials seeded by `scripts/dev/case-workspace-seed-local.mjs`. */
export const SEED_USER = {
  email: 'cw.local@local.test',
  password: 'CaseWorkspaceLocal!2026',
  userId: 'cw-local-user',
  organizationId: 'cw-local-org',
};

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1']);

/**
 * Hard barrier. The owner's standing instruction is that no test data may be
 * written to the demo/staging database under any circumstances, so this
 * throws rather than skipping — a misconfigured run must fail loudly, not
 * quietly do nothing.
 */
export function assertLocalDatabase(url: string = DATABASE_URL): void {
  const host = new URL(url).hostname;
  if (!LOOPBACK.has(host)) {
    throw new Error(
      `BLOCKED: DATABASE_URL points at "${host}", not the disposable local container. ` +
        'Case Workspace E2E never writes to demo/staging.'
    );
  }
}

export interface LiveStackStatus {
  up: boolean;
  reason?: string;
}

/**
 * Is the live stack actually serving? Checks the health endpoint AND that the
 * case-workspace surface is mounted and fail-closed.
 *
 * A 401 from the unauthenticated probe is the CORRECT answer and proves the
 * route is mounted: if the router were missing we would get 404, and if the
 * V8 gate were off we would ALSO get 404 ("V8 not enabled" — 404, not 403,
 * which is easy to misread as a missing route).
 */
export async function probeLiveStack(): Promise<LiveStackStatus> {
  try {
    const health = await fetch(`${BACKEND}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!health.ok) return { up: false, reason: `/api/health -> HTTP ${health.status}` };

    const guarded = await fetch(`${BACKEND}/api/v8/case-workspace/cases`, {
      signal: AbortSignal.timeout(5000),
    });
    if (guarded.status === 404) {
      return {
        up: false,
        reason:
          'GET /api/v8/case-workspace/cases -> 404. Either the router is not mounted or ' +
          'ENABLE_V8_GLOBAL is unset (the V8 gate answers 404, not 403).',
      };
    }
    if (guarded.status !== 401) {
      return {
        up: false,
        reason: `unauthenticated probe -> HTTP ${guarded.status}, expected 401 (fail-closed)`,
      };
    }
    return { up: true };
  } catch (error) {
    return { up: false, reason: `backend unreachable at ${BACKEND}: ${(error as Error).message}` };
  }
}

/** Real login. No hand-minted tokens — the JWT must carry a real signature. */
export async function login(
  email: string = SEED_USER.email,
  password: string = SEED_USER.password
): Promise<string> {
  const res = await fetch(`${BACKEND}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`login failed for ${email}: HTTP ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error(`login for ${email} returned no token`);
  return body.token;
}

/**
 * The negative control WITHOUT WHICH NONE OF THE GREEN RESULTS MEAN ANYTHING.
 *
 * `NODE_ENV=test` in this repo opens three doors (auth.middleware.ts:1136
 * `ENABLE_TEST_AUTH_BYPASS`, auth.middleware.ts:1191 `E2E_MODE`,
 * index.ts:1157 Gateway stub). If the server under test had any of them open,
 * a 200 would prove nothing at all. So we forge a token carrying `e2e: true`
 * with a garbage signature: it MUST be rejected. If this ever returns 200,
 * every other assertion in this directory is void.
 */
export async function assertNoAuthBypass(): Promise<void> {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const forged =
    `${b64({ alg: 'HS256', typ: 'JWT' })}.` +
    `${b64({
      id: SEED_USER.userId,
      organizationId: SEED_USER.organizationId,
      role: 'ADMIN',
      e2e: true,
      exp: 9999999999,
    })}.not-a-real-signature`;

  const res = await fetch(`${BACKEND}/api/v8/case-workspace/cases`, {
    headers: { Authorization: `Bearer ${forged}` },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status !== 401) {
    throw new Error(
      `AUTH BYPASS IS OPEN: a forged token with claim e2e:true got HTTP ${res.status} ` +
        '(expected 401). Every result from this suite is void until the server is ' +
        'restarted with NODE_ENV=development and E2E_MODE/ENABLE_TEST_AUTH_BYPASS unset.'
    );
  }
}

export interface ApiResponse<T> {
  status: number;
  body: T;
}

/** One authenticated HTTP call against the running server. */
export async function api<T = unknown>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BACKEND}/api/v8${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let parsed: unknown = undefined;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed as T };
}

/**
 * Out-of-band database access for readback. Deliberately a SEPARATE pool from
 * anything the server uses: an assertion must observe committed state, not the
 * value a service happened to return.
 */
export class ControlDb {
  private readonly pool: pg.Pool;

  constructor(url: string = DATABASE_URL) {
    assertLocalDatabase(url);
    this.pool = new pg.Pool({ connectionString: url, max: 4 });
  }

  async rows<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const res = await this.pool.query<T>(sql, params);
    return res.rows;
  }

  async one<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | null> {
    const rows = await this.rows<T>(sql, params);
    return rows[0] ?? null;
  }

  /**
   * Every event this Case emitted, oldest first. The third piece of evidence
   * the owner requires for each scenario: a mutation that leaves no trace in
   * the outbox has broken the event spine, whatever the HTTP status said.
   */
  async outboxForCase(caseId: string): Promise<
    Array<{ event_type: string; aggregate_type: string; aggregate_id: string; actor_user_id: string }>
  > {
    return this.rows(
      `SELECT event_type, aggregate_type, aggregate_id, actor_user_id
         FROM case_workspace_event_outbox
        WHERE case_id = $1
        ORDER BY occurred_at ASC`,
      [caseId]
    );
  }

  async outboxForAggregate(aggregateId: string): Promise<
    Array<{ event_type: string; aggregate_version: number | null; actor_user_id: string }>
  > {
    return this.rows(
      `SELECT event_type, aggregate_version, actor_user_id
         FROM case_workspace_event_outbox
        WHERE aggregate_id = $1
        ORDER BY occurred_at ASC`,
      [aggregateId]
    );
  }

  /** A `v8_execution_runs` row.
   *
   * `runBindingService.bindRunToPlanVersion` only READS this table (it throws
   * `run_not_found` for an invented runId) and no Case Workspace HTTP route
   * writes it — see GAP-E-01 in the suite. Seeding it here is therefore a
   * fixture, exactly as `contract/contractHarness.ts:214-229` documents for
   * the same reason, not a bypass of anything under test.
   */
  async seedExecutionRun(orgId: string, initiatorUserId: string, label: string): Promise<string> {
    const runId = `cw-e2e-run-${label}-${randomUUID()}`;
    await this.pool.query(
      `INSERT INTO v8_execution_runs
         (run_id, organization_id, context_snapshot_id, initiator_user_id, state, plan_version, goal)
       VALUES ($1, $2, $3, $4, 'drafting', 1, $5)`,
      [runId, orgId, `cw-e2e-ctx-${randomUUID()}`, initiatorUserId, `CW E2E run (${label})`]
    );
    return runId;
  }

  async ensureProject(projectId: string, orgId: string, name: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [projectId, orgId, name]
    );
  }

  /** Idempotent fixed-identity fixture required before a real login. */
  async ensureLoginUser(input: {
    userId: string; organizationId: string; email: string; password: string;
    role?: 'OWNER' | 'ADMIN' | 'MEMBER'; projectId?: string;
  }): Promise<void> {
    await this.pool.query(`INSERT INTO organizations (id,name) VALUES ($1,$2)
      ON CONFLICT (id) DO NOTHING`, [input.organizationId, `CW E2E ${input.organizationId}`]);
    if (input.projectId) await this.ensureProject(input.projectId, input.organizationId, `CW E2E ${input.projectId}`);
    const passwordHash = await bcrypt.hash(input.password, 10);
    await this.pool.query(`INSERT INTO users (id,organization_id,email,password,first_name,last_name,role,status)
      VALUES ($1,$2,$3,$4,'CW','E2E','ADMIN','active')
      ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email,password=EXCLUDED.password,status='active'`,
      [input.userId, input.organizationId, input.email.toLowerCase(), passwordHash]);
    await this.pool.query(`INSERT INTO organization_members (id,organization_id,user_id,role,status)
      VALUES ($1,$2,$3,$4,'ACTIVE') ON CONFLICT (organization_id,user_id)
      DO UPDATE SET role=EXCLUDED.role,status='ACTIVE'`,
      [`cw-e2e-member-${input.userId}`, input.organizationId, input.userId, input.role ?? 'OWNER']);
  }

  async setMembershipStatus(userId: string, orgId: string, status: string): Promise<void> {
    await this.pool.query(
      `UPDATE organization_members SET status = $3 WHERE user_id = $1 AND organization_id = $2`,
      [userId, orgId, status]
    );
  }

  /**
   * Mints a DISPOSABLE user, an ACTIVE member of `orgId`, with a real bcrypt
   * hash (same `bcryptjs` library `AuthController.comparePassword` verifies
   * against — see `scripts/dev/case-workspace-seed-local.mjs` for the same
   * pattern), so it can log in through the real `/api/auth/login` route.
   *
   * WHY THIS EXISTS: `SEED_USER` is the one identity every e2e file in this
   * directory authenticates as. Vitest runs test FILES as separate,
   * concurrent workers by default (no `fileParallelism: false` is set in
   * `vitest.config.ts`), so any test that mutates a property of `SEED_USER`'s
   * identity that is checked on EVERY authenticated request — its
   * `organization_members.status` — has a window where a sibling file's
   * in-flight request, authenticated with the very same token, observes the
   * mutation and fails with a spurious 403/404. Confirmed by running
   * `liveStack.e2e.pg.test.ts` + `liveStack.e2e.part2.pg.test.ts` together:
   * part 1's "revoking membership mid-chain" test suspends
   * `organization_members` for (`cw-local-user`, `cw-local-org`) for the
   * duration of a few HTTP round-trips, and part 2's requests — authenticated
   * as the SAME `cw-local-user` token — land inside that window and get 404
   * (single-resource read) / 403 (mutation), exactly the codes the revoke
   * test itself asserts for ITS OWN requests.
   *
   * A test that means to exercise "membership revoked" must therefore do so
   * on a throwaway co-member of the org, never on `SEED_USER` (or any other
   * identity a sibling file also authenticates as, e.g. `APPROVER`).
   */
  async createTestUser(orgId: string, tag: string): Promise<{
    userId: string;
    email: string;
    password: string;
  }> {
    const unique = randomUUID().slice(0, 8);
    const userId = `cw-e2e-user-${tag}-${unique}`;
    const email = `cw.e2e.${tag}.${unique}@local.test`;
    const password = `CwE2e!${unique}Aa1`;
    const passwordHash = await bcrypt.hash(password, 10);

    await this.pool.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
      [userId, orgId, email, passwordHash, 'CW', 'E2E', 'ADMIN']
    );
    await this.pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
      [`cw-e2e-member-${userId}`, orgId, userId]
    );

    return { userId, email, password };
  }

  /** Cleanup counterpart to {@link createTestUser}. */
  async deleteTestUser(userId: string): Promise<void> {
    await this.pool.query(`DELETE FROM organization_members WHERE user_id = $1`, [userId]);
    await this.pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** Unique-per-run ids so parallel agents on the shared container cannot collide. */
export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

/**
 * A structurally valid two-node plan graph (entry -> terminal), the same shape
 * `casePlanVersionService.pg.test.ts:321` uses.
 */
export function validGraph(tag: string): Record<string, unknown> {
  return {
    schemaVersion: '1',
    graphId: `graph-${tag}`,
    entryNodeIds: ['n1'],
    terminalNodeIds: ['n2'],
    nodes: [
      { nodeId: 'n1', type: 'TASK', metadata: { label: 'Krok pierwszy' } },
      { nodeId: 'n2', type: 'TASK', metadata: { label: 'Krok drugi' } },
    ],
    edges: [{ edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' }],
  };
}
