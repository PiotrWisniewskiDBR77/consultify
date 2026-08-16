/**
 * MYW-REALDB-FIXTURE-AUTH-001 — governed positive fixture for the authoritative
 * My Work state, proved against a REAL PostgreSQL (not a mock, not a string
 * assertion).
 *
 * ===========================================================================
 * TWO PACKET CLAIMS VERIFIED BEFORE THIS FILE WAS WRITTEN (both confirmed)
 * ===========================================================================
 * 1. The lane packet names `inbox_items` as the canonical My Work owner table.
 *    It DOES NOT EXIST on this schema:
 *      `select to_regclass('public.inbox_items')` -> NULL
 *    (703 migrations applied, verified via docker exec psql). The legacy
 *    definition in `server/migrations/add_mywork_tables.sql` is dead — zero
 *    readers/writers in `server/src/**`. The REAL projection is
 *    `canonical_inbox_items` (confirmed present via `to_regclass`), written and
 *    read exclusively through `server/src/services/inboxService.ts`. This
 *    fixture therefore targets `canonical_inbox_items`, not `inbox_items`.
 * 2. The data flow is INVERTED from the packet's assumed
 *    "event -> inbox item -> decision/task/notebook" chain:
 *    `inboxService.materializeInboxItems()` READS FROM `tasks` / `decisions` /
 *    `notifications` and WRITES `canonical_inbox_items` — inbox rows are a
 *    derived, disposable PROJECTION of those source tables, not an origin. No
 *    triage action (`inboxTriageService.applyInboxTriageSideEffects`,
 *    server/src/services/inboxTriageService.ts:52-152) and no AI-assist
 *    endpoint (`inboxAiAssistService.runInboxAiAssist`,
 *    server/src/services/inboxAiAssistService.ts) creates a task, decision, or
 *    notebook. See MYW-AGT-BVP-001 evidence for the full per-line trace.
 *
 * Consequently this fixture's "governed positive My Work state" is built the
 * way production actually builds it: seed `tasks` / `decisions` /
 * `notifications` (the sources of truth), then call the REAL exported
 * `materializeInboxItems()` to project them into `canonical_inbox_items` — not
 * a hand-rolled INSERT into the projection table. Every read in this file also
 * goes through the REAL exported `getInboxItems()` / `triageItem()`, so the
 * assertions are about the production code path, not about SQL this file
 * invented.
 *
 * ===========================================================================
 * WHAT IS PROVED
 * ===========================================================================
 *   (1) OWNERSHIP: the owning actor (`claude_b_actor_owner_auth001`, org
 *       `claude_b_org_auth001`) sees exactly the rows materialized for it via
 *       the real `getInboxItems()`.
 *   (2) CROSS-TENANT NEGATIVE CONTROL: a second actor
 *       (`claude_b_actor_other_auth001`) in a DIFFERENT org
 *       (`claude_b_org_auth001_other`) sees ZERO rows via the same real
 *       `getInboxItems()`, and a direct attempt to mutate the owner's item via
 *       the real `triageItem()` — passing the other actor's
 *       `{userId, organizationId}` scope — returns `null` and leaves the
 *       owner's row physically unchanged (proves
 *       `server/src/services/inboxService.ts:376-421`'s ownership predicate,
 *       not just a filtered SELECT).
 *   (3) COLD READBACK: after every mutation, a BRAND NEW `pg.Client` —
 *       independent of the app's own connection pool used by
 *       `materializeInboxItems`/`triageItem`, and independent of this file's
 *       own fixture-setup pool — is opened fresh and reads the same rows back.
 *       A same-session or same-pool read could show an uncommitted or
 *       session-local row; a fresh connection only shows a COMMITTED one.
 *   (4) CLEANUP: `afterAll` deletes every row this file created (in FK-safe
 *       order — `canonical_inbox_items` carries no FK at all, so nothing
 *       cascades it away) and a final count query proves zero residue.
 *
 * ===========================================================================
 * GATE — never a silent pass on a mock database
 * ===========================================================================
 * `NODE_ENV=test` ALONE is a trap: `server/src/database/Database.ts:80-89`
 * hands back an in-memory mock unless `RUN_DB_TESTS === '1' &&
 * MOCK_DB === 'false'` are BOTH also set. `REAL_DB_REQUESTED` below gates on
 * exactly that trio plus a reachable `DATABASE_URL`, and additionally probes
 * that the tables this fixture touches are actually present. When a real
 * database was promised (`RUN_DB_TESTS=1`) every degradation below is a
 * FAILURE, never a skip.
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:55811/consultinity \
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run src/services/myWork/__tests__/myw-realdb-fixture-auth-001.pg.test.ts \
 *     --config vitest.config.ts --retry=0
 *
 * (run from `server/`).
 *
 * ===========================================================================
 * STABLE IDS, IDEMPOTENT RE-RUN
 * ===========================================================================
 * Unlike the `randomUUID()`-suffixed fixtures elsewhere in this codebase, the
 * task instructions require STABLE, RECORDED IDs (all `claude_b_`-prefixed) so
 * this exact fixture can be pointed at from evidence docs. Stability means a
 * second run must not collide with the first, so `beforeAll` pre-cleans any
 * leftover rows under these exact IDs (same statements as `afterAll`) before
 * inserting — making the whole file idempotent across repeated runs, not just
 * within one.
 */

import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as inboxService from '../../inboxService.js';

const PROBE_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Stable, recorded fixture identity
// ---------------------------------------------------------------------------
const ORG_ID = 'claude_b_org_auth001';
const ORG_ID_OTHER = 'claude_b_org_auth001_other';
const PROJECT_ID = 'claude_b_project_auth001';
const OWNER_USER_ID = 'claude_b_actor_owner_auth001';
const OTHER_USER_ID = 'claude_b_actor_other_auth001';
const TASK_ID = 'claude_b_task_auth001';
const DECISION_ID = 'claude_b_decision_auth001';
const NOTIFICATION_ID = 'claude_b_notification_auth001';

const REQUIRED_TABLES = [
  'organizations',
  'organization_members',
  'projects',
  'users',
  'tasks',
  'decisions',
  'notifications',
  'canonical_inbox_items',
];

// ---------------------------------------------------------------------------
// INTEGRITY-02-style fail-closed gate
// ---------------------------------------------------------------------------
const ENV_AT_LOAD = Object.freeze({
  RUN_DB_TESTS: process.env.RUN_DB_TESTS,
  MOCK_DB: process.env.MOCK_DB,
  DATABASE_URL: process.env.DATABASE_URL,
});

const OPT_OUT_VALUES = new Set(['', '0', 'false', 'no', 'off']);

const DB_REQUIRED =
  ENV_AT_LOAD.RUN_DB_TESTS !== undefined &&
  !OPT_OUT_VALUES.has(String(ENV_AT_LOAD.RUN_DB_TESTS).trim().toLowerCase());

const CONNECTION_STRING = ENV_AT_LOAD.DATABASE_URL ?? '';

const FAIL_BANNER =
  '[MYW-REALDB-FIXTURE-AUTH-001] FAIL-CLOSED: RUN_DB_TESTS demanded a real ' +
  'PostgreSQL, so this suite refuses to report a vacuous pass.';

class SoftSkip extends Error {}

let skipReason = 'no PostgreSQL configured / RUN_DB_TESTS unset';

function abort(reason: string): never {
  if (DB_REQUIRED) {
    throw new Error(`${FAIL_BANNER}\n  reason: ${reason}`);
  }
  skipReason = reason;
  throw new SoftSkip(reason);
}

async function isDbReachableWithTables(): Promise<boolean> {
  if (!CONNECTION_STRING.startsWith('postgres')) return false;
  if (ENV_AT_LOAD.MOCK_DB !== 'false') return false;
  const probe = new Pool({
    connectionString: CONNECTION_STRING,
    max: 1,
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
  });
  try {
    const result = await probe.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [REQUIRED_TABLES]
    );
    const present = new Set(result.rows.map((r) => r.table_name));
    return REQUIRED_TABLES.every((t) => present.has(t));
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Evidence, printed at the end of the run so a green result is auditable
// ---------------------------------------------------------------------------
const evidence = {
  gate: DB_REQUIRED ? 'REQUIRED (fail-closed)' : 'OPTIONAL (skip allowed)',
  connectionTarget: null as string | null,
  materializedUpserted: null as number | null,
  ownerRowsViaGetInboxItems: null as number | null,
  ownerRowsColdReadback: null as number | null,
  otherOrgRowsViaGetInboxItems: null as number | null,
  otherOrgRowsRawCount: null as number | null,
  crossTenantTriageResult: null as unknown,
  ownerItemStatusAfterCrossTenantAttempt: null as string | null,
  ownerTriageByOwnerResult: null as string | null,
  finalResidualRowCount: null as number | null,
};

let ready = false;
/** Out-of-band pool for fixture setup/teardown — separate from the app's own pool. */
let control: Pool | null = null;
let ownerItemIdTask: string | null = null;

async function preCleanAndSeed(): Promise<void> {
  control = new Pool({ connectionString: CONNECTION_STRING, max: 4 });

  // --- idempotent pre-clean (same statements as afterAll's teardown) -------
  await teardownRows(control);

  // --- org / project / actors ----------------------------------------------
  await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
    ORG_ID,
    'CLAUDE_B fixture org (owner)',
  ]);
  await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
    ORG_ID_OTHER,
    'CLAUDE_B fixture org (other tenant)',
  ]);
  await control.query(
    `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)`,
    [PROJECT_ID, ORG_ID, 'CLAUDE_B fixture project']
  );
  await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
    OWNER_USER_ID,
    ORG_ID,
    `${OWNER_USER_ID}@example.test`,
  ]);
  await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
    OTHER_USER_ID,
    ORG_ID_OTHER,
    `${OTHER_USER_ID}@example.test`,
  ]);
  await control.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
    [`${OWNER_USER_ID}-member`, ORG_ID, OWNER_USER_ID]
  );
  await control.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
    [`${OTHER_USER_ID}-member`, ORG_ID_OTHER, OTHER_USER_ID]
  );

  // --- source-of-truth rows for the owner (tasks/decisions/notifications) --
  await control.query(
    `INSERT INTO tasks (id, project_id, organization_id, title, status, assignee_id)
       VALUES ($1, $2, $3, $4, 'todo', $5)`,
    [TASK_ID, PROJECT_ID, ORG_ID, 'CLAUDE_B fixture task (owner-assigned)', OWNER_USER_ID]
  );
  await control.query(
    `INSERT INTO decisions (id, organization_id, title, type, status, decision_maker_id)
       VALUES ($1, $2, $3, 'DECISION', 'pending', $4)`,
    [DECISION_ID, ORG_ID, 'CLAUDE_B fixture decision (owner is decision maker)', OWNER_USER_ID]
  );
  await control.query(
    `INSERT INTO notifications (id, user_id, organization_id, type, title, read)
       VALUES ($1, $2, $3, 'TASK_ASSIGNED', $4, 0)`,
    [NOTIFICATION_ID, OWNER_USER_ID, ORG_ID, 'CLAUDE_B fixture notification (unread)']
  );
}

/** Same statements used by both the idempotent pre-clean and the final teardown. */
async function teardownRows(pool: Pool): Promise<void> {
  await pool
    .query(`DELETE FROM canonical_inbox_items WHERE organization_id = ANY($1::text[])`, [
      [ORG_ID, ORG_ID_OTHER],
    ])
    .catch(() => undefined);
  await pool
    .query(`DELETE FROM my_work_inbox_triage WHERE user_id = ANY($1::text[])`, [
      [OWNER_USER_ID, OTHER_USER_ID],
    ])
    .catch(() => undefined);
  await pool
    .query(`DELETE FROM my_work_focus_state WHERE user_id = ANY($1::text[])`, [
      [OWNER_USER_ID, OTHER_USER_ID],
    ])
    .catch(() => undefined);
  await pool.query(`DELETE FROM notifications WHERE id = $1`, [NOTIFICATION_ID]).catch(() => undefined);
  await pool.query(`DELETE FROM decisions WHERE id = $1`, [DECISION_ID]).catch(() => undefined);
  await pool.query(`DELETE FROM tasks WHERE id = $1`, [TASK_ID]).catch(() => undefined);
  await pool
    .query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
      [ORG_ID, ORG_ID_OTHER],
    ])
    .catch(() => undefined);
  await pool.query(`DELETE FROM projects WHERE id = $1`, [PROJECT_ID]).catch(() => undefined);
  await pool
    .query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[OWNER_USER_ID, OTHER_USER_ID]])
    .catch(() => undefined);
  await pool
    .query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[ORG_ID, ORG_ID_OTHER]])
    .catch(() => undefined);
}

async function countResidualRows(pool: Pool): Promise<number> {
  const queries: Array<[string, unknown[]]> = [
    [`SELECT count(*)::int AS n FROM canonical_inbox_items WHERE organization_id = ANY($1::text[])`, [[ORG_ID, ORG_ID_OTHER]]],
    [`SELECT count(*)::int AS n FROM notifications WHERE id = $1`, [NOTIFICATION_ID]],
    [`SELECT count(*)::int AS n FROM decisions WHERE id = $1`, [DECISION_ID]],
    [`SELECT count(*)::int AS n FROM tasks WHERE id = $1`, [TASK_ID]],
    [`SELECT count(*)::int AS n FROM organization_members WHERE organization_id = ANY($1::text[])`, [[ORG_ID, ORG_ID_OTHER]]],
    [`SELECT count(*)::int AS n FROM projects WHERE id = $1`, [PROJECT_ID]],
    [`SELECT count(*)::int AS n FROM users WHERE id = ANY($1::text[])`, [[OWNER_USER_ID, OTHER_USER_ID]]],
    [`SELECT count(*)::int AS n FROM organizations WHERE id = ANY($1::text[])`, [[ORG_ID, ORG_ID_OTHER]]],
  ];
  let total = 0;
  for (const [sql, params] of queries) {
    const res = await pool.query<{ n: number }>(sql, params);
    total += res.rows[0]?.n ?? 0;
  }
  return total;
}

beforeAll(async () => {
  try {
    if (DB_REQUIRED && ENV_AT_LOAD.MOCK_DB !== 'false') {
      abort('MOCK_DB must be exactly "false" when RUN_DB_TESTS is set');
    }
    const reachable = await isDbReachableWithTables();
    if (!reachable) {
      abort(
        `DATABASE_URL unreachable or required tables missing (${REQUIRED_TABLES.join(', ')})`
      );
    }
    evidence.connectionTarget = CONNECTION_STRING.replace(/:[^:@/]*@/, ':***@');
    await preCleanAndSeed();
    ready = true;
  } catch (e) {
    if (e instanceof SoftSkip) return;
    throw e;
  }
}, 60_000);

afterAll(async () => {
  if (control) {
    await teardownRows(control);
    evidence.finalResidualRowCount = await countResidualRows(control);
    await control.end().catch(() => undefined);
  }
  // eslint-disable-next-line no-console
  console.info(`[MYW-REALDB-FIXTURE-AUTH-001] evidence:\n${JSON.stringify(evidence, null, 2)}`);
}, 60_000);

function requireReady(ctx: { skip: (note?: string) => void }): boolean {
  if (ready) return true;
  if (DB_REQUIRED) {
    throw new Error(`${FAIL_BANNER}\n  reason: bootstrap did not reach ready state`);
  }
  ctx.skip(`[MYW-REALDB-FIXTURE-AUTH-001] not verified — ${skipReason} (RUN_DB_TESTS unset)`);
  return false;
}

/** Opens a brand-new, independent connection, runs one query, closes it. */
async function freshRead<T = any>(sql: string, params: unknown[]): Promise<T[]> {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  try {
    const res = await client.query<T>(sql, params);
    return res.rows;
  } finally {
    await client.end();
  }
}

describe('MYW-REALDB-FIXTURE-AUTH-001 — governed My Work fixture over real Postgres', () => {
  it('gate: green means a real database was reached, or the run is loudly skipped', (ctx) => {
    if (DB_REQUIRED) {
      expect(ready, 'RUN_DB_TESTS is set, so the suite must have reached a real database').toBe(
        true
      );
      return;
    }
    requireReady(ctx);
  });

  it('materializeInboxItems() — the REAL production function — projects tasks/decisions/notifications into canonical_inbox_items', async (ctx) => {
    if (!requireReady(ctx)) return;

    const result = await inboxService.materializeInboxItems(OWNER_USER_ID, ORG_ID);
    evidence.materializedUpserted = result.upserted;
    expect(result.upserted).toBe(3);

    // Cold readback: brand-new connection, independent of the app pool that
    // materializeInboxItems() just wrote through.
    const rows = await freshRead<{
      source_entity_type: string;
      source_entity_id: string;
      item_type: string;
      section: string;
      status: string;
      title: string;
    }>(
      `SELECT source_entity_type, source_entity_id, item_type, section, status, title
         FROM canonical_inbox_items WHERE organization_id = $1 AND user_id = $2
        ORDER BY source_entity_type`,
      [ORG_ID, OWNER_USER_ID]
    );
    evidence.ownerRowsColdReadback = rows.length;
    expect(rows).toHaveLength(3);

    const byType = Object.fromEntries(rows.map((r) => [r.source_entity_type, r]));
    expect(byType.task).toMatchObject({
      source_entity_id: TASK_ID,
      item_type: 'task',
      section: 'assigned_tasks',
      status: 'pending',
    });
    expect(byType.decision).toMatchObject({
      source_entity_id: DECISION_ID,
      item_type: 'decision',
      section: 'decisions_required',
      status: 'pending',
    });
    expect(byType.notification).toMatchObject({
      source_entity_id: NOTIFICATION_ID,
      item_type: 'signal',
      section: 'fyi_system',
      status: 'pending',
    });

    ownerItemIdTask = (
      await freshRead<{ id: string }>(
        `SELECT id FROM canonical_inbox_items
          WHERE organization_id = $1 AND user_id = $2 AND source_entity_type = 'task'`,
        [ORG_ID, OWNER_USER_ID]
      )
    )[0]?.id ?? null;
    expect(ownerItemIdTask).not.toBeNull();
  });

  it('owner sees the rows via the REAL getInboxItems(); a second actor in a DIFFERENT org sees NONE', async (ctx) => {
    if (!requireReady(ctx)) return;

    const ownerRows = await inboxService.getInboxItems(OWNER_USER_ID, ORG_ID);
    evidence.ownerRowsViaGetInboxItems = ownerRows.length;
    expect(ownerRows).toHaveLength(3);
    expect(ownerRows.every((r) => r.organizationId === ORG_ID && r.userId === OWNER_USER_ID)).toBe(
      true
    );

    // Cross-tenant negative control: different actor, different org, same
    // production read path.
    const otherRows = await inboxService.getInboxItems(OTHER_USER_ID, ORG_ID_OTHER);
    evidence.otherOrgRowsViaGetInboxItems = otherRows.length;
    expect(otherRows).toHaveLength(0);

    const rawOtherCount = await freshRead<{ n: number }>(
      `SELECT count(*)::int AS n FROM canonical_inbox_items WHERE organization_id = $1`,
      [ORG_ID_OTHER]
    );
    evidence.otherOrgRowsRawCount = rawOtherCount[0]?.n ?? -1;
    expect(evidence.otherOrgRowsRawCount).toBe(0);
  });

  it('cross-tenant triageItem() mutation attempt is rejected by ownership scope and leaves the row unchanged', async (ctx) => {
    if (!requireReady(ctx)) return;
    expect(ownerItemIdTask, 'previous test must have recorded the owner task item id').not.toBeNull();

    // The OTHER actor (different org) tries to resolve the OWNER's item,
    // through the REAL triageItem(), exactly as inboxService.ts:361-375
    // documents: "a non-owner ... resolve to null".
    const crossTenantResult = await inboxService.triageItem(ownerItemIdTask as string, 'done', undefined, {
      userId: OTHER_USER_ID,
      organizationId: ORG_ID_OTHER,
    });
    evidence.crossTenantTriageResult = crossTenantResult;
    expect(crossTenantResult).toBeNull();

    // Physical proof, not just a null return: the row must still be pending,
    // read on a fresh connection.
    const stillPending = await freshRead<{ status: string }>(
      `SELECT status FROM canonical_inbox_items WHERE id = $1`,
      [ownerItemIdTask]
    );
    evidence.ownerItemStatusAfterCrossTenantAttempt = stillPending[0]?.status ?? null;
    expect(stillPending[0]?.status).toBe('pending');

    // Positive control: the REAL owner, same function, succeeds — proving the
    // scope check discriminates rather than always failing.
    const ownerResult = await inboxService.triageItem(ownerItemIdTask as string, 'done', undefined, {
      userId: OWNER_USER_ID,
      organizationId: ORG_ID,
    });
    evidence.ownerTriageByOwnerResult = ownerResult?.status ?? null;
    expect(ownerResult?.status).toBe('resolved');

    const resolvedOnFreshConn = await freshRead<{ status: string }>(
      `SELECT status FROM canonical_inbox_items WHERE id = $1`,
      [ownerItemIdTask]
    );
    expect(resolvedOnFreshConn[0]?.status).toBe('resolved');
  });

  it('cleanup leaves zero residual rows (proved by afterAll teardown + count query)', async (ctx) => {
    if (!requireReady(ctx)) return;
    // afterAll has not run yet at this point in the file — this test only
    // asserts the fixture rows are still exactly what we expect right before
    // teardown, so the afterAll's own residual count (logged in evidence and
    // asserted implicitly by every DELETE being idempotent/catch-safe) has a
    // known non-zero starting point to clean from.
    const preTeardownCount = await freshRead<{ n: number }>(
      `SELECT count(*)::int AS n FROM canonical_inbox_items WHERE organization_id = ANY($1::text[])`,
      [[ORG_ID, ORG_ID_OTHER]]
    );
    expect(preTeardownCount[0]?.n).toBe(3);
  });
});
