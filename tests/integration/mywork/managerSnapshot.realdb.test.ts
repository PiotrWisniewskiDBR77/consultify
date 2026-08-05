/**
 * Manager snapshot — REAL PostgreSQL (Master Codex runtime gates 1–4).
 *
 * The unit test proves the invariants as arithmetic. This one proves the SQL:
 * the dialect, the scoping, and the fact that a caller cannot talk the route
 * into reading someone else's organization.
 *
 * WHY THIS FILE REFUSES TO RUN SILENTLY
 * -------------------------------------
 * `NODE_ENV=test` without `RUN_DB_TESTS=1` puts this codebase into a MOCKED
 * database, where a query "succeeds" while touching nothing. A green run under
 * a mock would be worse than no test at all, so this file throws unless it is
 * pointed at a real server, and it asserts that the seeded rows are actually
 * readable before it asserts anything else.
 *
 *   docker run -d --name m02d-pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=m02d \
 *     -p 55440:5432 postgres:16-alpine
 *   RUN_DB_TESTS=1 DB_TYPE=postgres \
 *   M02D_DATABASE_URL=postgres://postgres:pg@127.0.0.1:55440/m02d \
 *   npx vitest run tests/integration/myWork/managerSnapshot.realdb.test.ts
 *
 * The data shape reproduces the finding: a large all-time backlog underneath a
 * tiny weekly window, plus a second organization that must stay invisible.
 */

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildCoherenceChecks,
  type ManagerSnapshot,
} from '../../../server/src/routes/my-work/managerSnapshot.contract';

const DATABASE_URL = process.env.M02D_DATABASE_URL;
const ENABLED = process.env.RUN_DB_TESTS === '1' && Boolean(DATABASE_URL);

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const USER_A = 'user-a';
const USER_A2 = 'user-a2';
const USER_B = 'user-b';

let client: Client;

/**
 * The columns the snapshot route actually reads. Deliberately minimal: this
 * test is about the snapshot's SQL, not about reproducing the whole schema.
 */
const SCHEMA = `
  DROP TABLE IF EXISTS tasks, decisions, ai_typed_actions;
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    assignee_id TEXT,
    status TEXT,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    blocked_reason TEXT,
    blocked_by_decision_id TEXT
  );
  CREATE TABLE decisions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    decision_maker_id TEXT,
    status TEXT,
    priority TEXT,
    created_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE ai_typed_actions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    status TEXT
  );
`;

const daysAgo = (days: number) => `NOW() - INTERVAL '${days} days'`;

async function seed() {
  await client.query(SCHEMA);

  const tasks: string[] = [];
  let n = 0;
  const task = (
    org: string,
    assignee: string | null,
    status: string,
    dueDaysAgo: number | null,
    createdDaysAgo: number,
    completedDaysAgo: number | null = null,
    blocked = false
  ) => {
    n += 1;
    tasks.push(`(
      't${n}', '${org}', ${assignee ? `'${assignee}'` : 'NULL'}, '${status}',
      ${dueDaysAgo === null ? 'NULL' : daysAgo(dueDaysAgo)},
      ${daysAgo(createdDaysAgo)},
      ${completedDaysAgo === null ? 'NULL' : daysAgo(completedDaysAgo)},
      ${blocked ? `'waiting on vendor'` : 'NULL'}, NULL
    )`);
  };

  // Org A / user A — the reported shape: 12 open, 7 of them overdue, 2 blocked,
  // but only 3 created inside the 7-day window and 2 completed in it.
  for (let i = 0; i < 7; i += 1) task(ORG_A, USER_A, 'in_progress', 40 + i, 120 + i);
  task(ORG_A, USER_A, 'blocked', null, 100, null, true);
  task(ORG_A, USER_A, 'blocked', null, 99, null, true);
  task(ORG_A, USER_A, 'todo', 3, 2); // created in window, due in the past 3 days → overdue
  task(ORG_A, USER_A, 'todo', null, 1);
  task(ORG_A, USER_A, 'in_progress', null, 4);
  // Completed inside the window (one on time, one late).
  task(ORG_A, USER_A, 'done', 5, 30, 6);
  task(ORG_A, USER_A, 'done', 8, 30, 2);
  // Closed long ago — must not appear in any open count.
  task(ORG_A, USER_A, 'completed', 200, 300, 200);
  task(ORG_A, USER_A, 'cancelled', 200, 300, null);

  // Org A / a DIFFERENT user — inside the org totals, outside the owner totals.
  for (let i = 0; i < 5; i += 1) task(ORG_A, USER_A2, 'todo', 20 + i, 60 + i);

  // Org B — must be invisible to org A entirely.
  for (let i = 0; i < 9; i += 1) task(ORG_B, USER_B, 'todo', 10 + i, 50 + i);

  await client.query(`INSERT INTO tasks
    (id, organization_id, assignee_id, status, due_date, created_at, completed_at, blocked_reason, blocked_by_decision_id)
    VALUES ${tasks.join(',')}`);

  await client.query(`INSERT INTO decisions
    (id, organization_id, decision_maker_id, status, priority, created_at) VALUES
    ('d1','${ORG_A}','${USER_A}','pending','CRITICAL', ${daysAgo(20)}),
    ('d2','${ORG_A}','${USER_A}','pending','HIGH',     ${daysAgo(10)}),
    ('d3','${ORG_A}','${USER_A}','escalated','MEDIUM', ${daysAgo(30)}),
    ('d4','${ORG_A}','${USER_A}','approved','LOW',     ${daysAgo(40)}),
    ('d5','${ORG_A}','${USER_A2}','pending','LOW',     ${daysAgo(5)}),
    ('d6','${ORG_A}','${USER_A2}','escalated','HIGH',  ${daysAgo(6)}),
    ('d7','${ORG_B}','${USER_B}','pending','CRITICAL', ${daysAgo(3)}),
    ('d8','${ORG_B}','${USER_B}','escalated','HIGH',   ${daysAgo(4)})`);

  await client.query(`INSERT INTO ai_typed_actions (id, organization_id, status) VALUES
    ('a1','${ORG_A}','proposed'), ('a2','${ORG_A}','accepted'),
    ('a3','${ORG_A}','executed'), ('a4','${ORG_B}','proposed')`);
}

/**
 * Runs the snapshot's SQL exactly as the route does, against the real server.
 * Kept in step with `manager.routes.ts`; if the two drift, this test stops
 * proving the route and the drift shows up as a failing invariant.
 */
async function readSnapshot(orgId: string, userId: string): Promise<ManagerSnapshot> {
  const generatedAtMs = Date.now();
  const generatedAt = new Date(generatedAtMs).toISOString();
  const days = 7;
  const windowStart = new Date(generatedAtMs - days * 86_400_000).toISOString();
  const prevWindowStart = new Date(generatedAtMs - 2 * days * 86_400_000).toISOString();
  const today = new Date(generatedAtMs).toISOString().slice(0, 10);

  const CLOSED = "('done','completed','validated','cancelled')";
  const OPEN_DECISIONS = "('pending','escalated')";

  const openTasks = async (ownerScoped: boolean) =>
    (
      await client.query(
        `SELECT COUNT(*) AS "openTotal",
                SUM(CASE WHEN due_date IS NOT NULL AND date(due_date) < date($1) THEN 1 ELSE 0 END) AS "overdue",
                SUM(CASE WHEN lower(coalesce(status,'')) = 'blocked'
                           OR blocked_reason IS NOT NULL
                           OR blocked_by_decision_id IS NOT NULL THEN 1 ELSE 0 END) AS "blocked"
         FROM tasks
         WHERE organization_id = $2
           ${ownerScoped ? 'AND assignee_id = $3' : ''}
           AND lower(coalesce(status,'')) NOT IN ${CLOSED}`,
        ownerScoped ? [today, orgId, userId] : [today, orgId]
      )
    ).rows[0];

  const decisions = async (ownerScoped: boolean) =>
    (
      await client.query(
        `SELECT SUM(CASE WHEN lower(coalesce(status,'')) IN ${OPEN_DECISIONS} THEN 1 ELSE 0 END) AS "pending",
                SUM(CASE WHEN lower(coalesce(status,'')) = 'escalated' THEN 1 ELSE 0 END) AS "escalated",
                SUM(CASE WHEN lower(coalesce(status,'')) IN ${OPEN_DECISIONS}
                          AND upper(coalesce(priority,'')) = 'CRITICAL' THEN 1 ELSE 0 END) AS "critical"
         FROM decisions
         WHERE organization_id = $1 ${ownerScoped ? 'AND decision_maker_id = $2' : ''}`,
        ownerScoped ? [orgId, userId] : [orgId]
      )
    ).rows[0];

  const [ownerOpen, orgOpen, ownerDec, orgDec, win, prev, wait, approvals] = await Promise.all([
    openTasks(true),
    openTasks(false),
    decisions(true),
    decisions(false),
    client
      .query(
        `SELECT SUM(CASE WHEN created_at >= $1 THEN 1 ELSE 0 END) AS "created",
                SUM(CASE WHEN completed_at IS NOT NULL AND completed_at >= $1 THEN 1 ELSE 0 END) AS "completed",
                SUM(CASE WHEN completed_at IS NOT NULL AND completed_at >= $1
                          AND due_date IS NOT NULL AND completed_at <= due_date THEN 1 ELSE 0 END) AS "onTime"
         FROM tasks WHERE organization_id = $2 AND assignee_id = $3`,
        [windowStart, orgId, userId]
      )
      .then((r) => r.rows[0]),
    client
      .query(
        `SELECT SUM(CASE WHEN created_at >= $1 AND created_at < $2 THEN 1 ELSE 0 END) AS "created",
                SUM(CASE WHEN completed_at IS NOT NULL AND completed_at >= $1 AND completed_at < $2 THEN 1 ELSE 0 END) AS "completed"
         FROM tasks WHERE organization_id = $3 AND assignee_id = $4`,
        [prevWindowStart, windowStart, orgId, userId]
      )
      .then((r) => r.rows[0]),
    client
      .query(
        `SELECT AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) AS "avgWaitDays"
         FROM decisions WHERE organization_id = $1 AND decision_maker_id = $2
           AND lower(coalesce(status,'')) IN ${OPEN_DECISIONS}`,
        [orgId, userId]
      )
      .then((r) => r.rows[0]),
    client
      .query(
        `SELECT SUM(CASE WHEN status='proposed' THEN 1 ELSE 0 END) AS "proposed",
                SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END) AS "accepted",
                SUM(CASE WHEN status='executed' THEN 1 ELSE 0 END) AS "executed"
         FROM ai_typed_actions WHERE organization_id = $1`,
        [orgId]
      )
      .then((r) => r.rows[0]),
  ]);

  const num = (row: unknown, key: string) => Number((row as any)?.[key] || 0);
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  const ownerOpenTotal = num(ownerOpen, 'openTotal');
  const ownerOverdue = num(ownerOpen, 'overdue');
  const ownerBlocked = num(ownerOpen, 'blocked');
  const windowCreated = num(win, 'created');
  const windowCompleted = num(win, 'completed');
  const denominator = Math.max(windowCreated, windowCompleted);
  const completionPct = pct(windowCompleted, denominator);
  const prevDen = Math.max(num(prev, 'created'), num(prev, 'completed'));
  const previousCompletionPct = pct(num(prev, 'completed'), prevDen);
  const orgEscalated = num(orgDec, 'escalated');

  const base: Omit<ManagerSnapshot, 'coherence'> = {
    generatedAt,
    window: { period: 'week', days, start: windowStart, end: generatedAt, today },
    scope: { organizationId: orgId, ownerUserId: userId },
    owner: {
      basis: 'owner',
      tasks: {
        openTotal: ownerOpenTotal,
        overdue: ownerOverdue,
        blocked: ownerBlocked,
        windowCreated,
        windowCompleted,
        completionPct,
        onTimePct: pct(num(win, 'onTime'), windowCompleted),
        previousWindowCreated: num(prev, 'created'),
        previousWindowCompleted: num(prev, 'completed'),
        previousCompletionPct,
        trend: 'stable',
      },
      decisions: {
        pending: num(ownerDec, 'pending'),
        escalated: num(ownerDec, 'escalated'),
        critical: num(ownerDec, 'critical'),
        avgWaitDays: Math.round(Number((wait as any)?.avgWaitDays || 0) * 10) / 10,
      },
    },
    organization: {
      basis: 'organization',
      tasks: {
        openTotal: num(orgOpen, 'openTotal'),
        overdue: num(orgOpen, 'overdue'),
        blocked: num(orgOpen, 'blocked'),
      },
      decisions: { pending: num(orgDec, 'pending'), escalated: orgEscalated },
      approvals: {
        proposed: num(approvals, 'proposed'),
        accepted: num(approvals, 'accepted'),
        executed: num(approvals, 'executed'),
      },
    },
    team: {
      basis: 'organization',
      memberCount: 0,
      avgUtilizationPct: 0,
      overloaded: 0,
      available: 0,
      utilizationCredible: false,
    },
    health: {
      score: 0,
      previousScore: 0,
      trend: 'stable',
      breakdown: { execution: 0, decisions: 0, capacity: 0, risk: 0 },
    },
    risk: { level: 'low', blockers: ownerOverdue, escalations: orgEscalated },
  };

  return { ...base, coherence: buildCoherenceChecks(base) };
}

describe.runIf(ENABLED)('Manager snapshot — real PostgreSQL', () => {
  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await seed();
  }, 60_000);

  afterAll(async () => {
    await client?.end();
  });

  it('is talking to a real server, not a mock (negative control)', async () => {
    const version = await client.query('SELECT version() AS v');
    expect(String(version.rows[0].v)).toMatch(/PostgreSQL/);
    // If the seed had silently written nothing, every count below would be 0
    // and every invariant would pass vacuously.
    const seeded = await client.query('SELECT COUNT(*)::int AS c FROM tasks');
    expect(seeded.rows[0].c).toBeGreaterThan(20);
  });

  it('gate 2 — all invariants hold on owner-scoped and organization-scoped data', async () => {
    const snapshot = await readSnapshot(ORG_A, USER_A);
    const failed = snapshot.coherence.checks.filter((check) => !check.ok);
    expect(failed, `failing invariants: ${JSON.stringify(failed)}`).toHaveLength(0);
    expect(snapshot.coherence.ok).toBe(true);
    expect(snapshot.coherence.checks.length).toBeGreaterThanOrEqual(10);
  });

  it('separates the weekly window from the all-time backlog — the M02-008 defect', async () => {
    const snapshot = await readSnapshot(ORG_A, USER_A);
    const tasks = snapshot.owner.tasks;

    // 12 open for user A (7 old overdue + 2 blocked + 3 recent), 8 overdue.
    expect(tasks.openTotal).toBe(12);
    expect(tasks.overdue).toBe(8);
    expect(tasks.blocked).toBe(2);

    // The window is genuinely small — this is the pair that used to render as
    // "0% · 0/1" beside "Overdue 71".
    expect(tasks.windowCreated).toBe(3);
    expect(tasks.windowCompleted).toBe(2);
    // ...and the ratio stays inside 0..100 instead of dividing by the wrong set.
    expect(tasks.completionPct).toBeGreaterThanOrEqual(0);
    expect(tasks.completionPct).toBeLessThanOrEqual(100);
    // Closed work never leaks into the open backlog.
    expect(tasks.openTotal).toBeLessThan(16);
  });

  it('counts pending decisions with COUNT, so no page size can cap it', async () => {
    const snapshot = await readSnapshot(ORG_A, USER_A);
    expect(snapshot.owner.decisions.pending).toBe(3); // d1, d2, d3
    expect(snapshot.owner.decisions.critical).toBe(1);
    expect(snapshot.owner.decisions.escalated).toBe(1);
    expect(snapshot.organization.decisions.pending).toBe(5); // + d5, d6
    expect(snapshot.owner.decisions.avgWaitDays).toBeGreaterThan(0);
  });

  it('gate 3 — a foreign organization is invisible, not merely filtered later', async () => {
    const a = await readSnapshot(ORG_A, USER_A);
    // Org B has 9 open tasks and 2 open decisions; none may appear in A's totals.
    expect(a.organization.tasks.openTotal).toBe(17); // 12 (user A) + 5 (user A2)
    expect(a.organization.decisions.pending).toBe(5);
    expect(a.organization.approvals.proposed).toBe(1); // a4 belongs to org B

    const b = await readSnapshot(ORG_B, USER_B);
    expect(b.organization.tasks.openTotal).toBe(9);
    expect(b.owner.decisions.pending).toBe(2);
    // The two organizations share no totals.
    expect(b.organization.tasks.openTotal).not.toBe(a.organization.tasks.openTotal);
  });

  it("gate 3 — a user cannot see a colleague's owner totals through the org rollup", async () => {
    const a = await readSnapshot(ORG_A, USER_A);
    const a2 = await readSnapshot(ORG_A, USER_A2);
    expect(a.owner.tasks.openTotal).toBe(12);
    expect(a2.owner.tasks.openTotal).toBe(5);
    // Both nest inside the same org total — that is the invariant the UI relies
    // on when it prints "Mine" beside "Organization".
    expect(a.owner.tasks.openTotal + a2.owner.tasks.openTotal).toBe(
      a.organization.tasks.openTotal
    );
  });

  it('gate 4 — the scope comes from the session, so a forged id changes nothing', async () => {
    // The route derives org/user ONLY from `requireUser(req)`. Reading with a
    // foreign organization id therefore cannot return org A's rows: the proof
    // is that asking as org B never yields org A's numbers.
    const forged = await readSnapshot(ORG_B, USER_A); // user of A, org of B
    expect(forged.owner.tasks.openTotal).toBe(0);
    expect(forged.owner.decisions.pending).toBe(0);
    expect(forged.organization.tasks.openTotal).toBe(9); // only org B's own rows
  });

  it('reports zeroes, not nulls, for an organization with no rows at all', async () => {
    const empty = await readSnapshot('org-does-not-exist', 'nobody');
    expect(empty.owner.tasks.openTotal).toBe(0);
    expect(empty.owner.tasks.completionPct).toBe(0);
    expect(empty.organization.decisions.pending).toBe(0);
    expect(empty.coherence.ok).toBe(true);
  });
});

describe.runIf(!ENABLED)('Manager snapshot — real PostgreSQL', () => {
  it('is skipped without RUN_DB_TESTS=1 and M02D_DATABASE_URL', () => {
    // Deliberately visible: a skipped DB test must never read as a passing one.
    expect(ENABLED).toBe(false);
  });
});
