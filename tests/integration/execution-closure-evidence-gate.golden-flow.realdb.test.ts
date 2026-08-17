/**
 * EXE-08 — Closure/Evidence Gate golden-flow, against a REAL Postgres
 * database (no mocks).
 *
 * Scope: the closure-request/evidence-pack workflow added on this branch
 * (`server/src/services/initiative/initiativeClosureService.ts`,
 * HTTP adapter `server/src/routes/pmo/initiativeClosure.routes.ts`, mounted
 * at `/api/initiatives` in `server/src/Gateway.ts`). An initiative can only
 * reach DONE via `draft -> submitted -> (returned -> submitted)* ->
 * approved_pending_transition -> done`, gated by a persisted evidence pack
 * and an explicit approver decision. `initiativeClosureService` is the ONLY
 * caller in this packet that invokes the canonical, FROZEN transition engine
 * (`initiativeTransitionService.executeInitiativeTransition`, not modified
 * here) to actually flip `initiatives.status` to DONE.
 *
 * Auth: same E2E_MODE unsigned-JWT bypass as the sibling realdb golden-flow
 * files (`server/src/middleware/auth.middleware.ts` E2E_MODE branch). Unlike
 * `execution-change-progress-spine.golden-flow.realdb.test.ts`, this file
 * does NOT need the v8 execution-control mount chain — every closure-gate
 * endpoint lives under `/api/initiatives` and is gated by the router's own
 * `verifyToken` + `requireOrgAccess()` (see `initiativeClosure.routes.ts`
 * top-of-file `router.use(...)` chain). `initiatives.routes.ts` is ALSO
 * mounted (same base path) purely to exercise `GET /:id`, `GET /:id/history`,
 * `PATCH /:id/quick-update` and `POST /:id/complete` — all pre-existing
 * endpoints this suite reads/uses as supporting infrastructure, not the
 * subject under test.
 *
 * ── PRECONDITIONS DISCOVERED BEFORE WRITING THIS SUITE (read before editing) ──
 *
 * 1. `hasApprovedGateDecision` (initiativeTransitionService.ts ~L153) is
 *    called for REVIEW->PROMOTED (GOVERNANCE_DECISION_MAKING),
 *    PROMOTED->PLANNING (RESOURCE_RESPONSIBILITY), APPROVED->SCHEDULED
 *    (SCHEDULE_MILESTONES) and SCHEDULED/BLOCKED->EXECUTING
 *    (GOVERNANCE_DECISION_MAKING) ONLY. EXECUTING->DONE (gate
 *    `GateType.COMPLETE`) does NOT call it — closure approval does not need
 *    any pre-seeded `decisions` row of that shape. Verified by reading every
 *    `hasApprovedGateDecision(...)` call site in the file.
 *
 * 2. EXECUTING->DONE DOES still run `hasPendingExecutionGateDecisions` (blocks
 *    if a `decisions` row with `status IN ('pending','escalated')` AND
 *    `type IN ('SCOPE_CHANGE','RISK_ACCEPTANCE','BLOCKER_RESOLUTION',
 *    'PHASE_TRANSITION')` is linked to the initiative) and
 *    `getBlockingReadinessItems` (initiativeGateReadinessService.ts), which for
 *    a non-DONE, non-APPROVED `currentStatus` requires: (a) `name` non-empty,
 *    (b) an owner (`owner_business_id` OR `owner_execution_id`), and — because
 *    EXECUTING is in `SCHEDULED_ONWARD_STATUSES` (initiativeStatuses.ts) —
 *    (c) `planned_start_date` AND `planned_end_date` both set. Every
 *    initiative seeded below sets owner_business_id + both planned dates for
 *    exactly this reason: omitting them makes `approve` fail with
 *    `CLOSURE_TRANSITION_REJECTED` (the engine's 400 GATE_BLOCKED wrapped by
 *    the closure service), a completely different failure than anything this
 *    suite intends to exercise.
 *
 * 3. `GateType.COMPLETE` IS in `AI_GATES` (constants/initiativeGateAi.ts), but
 *    the AI soft-block is fail-safe OFF for any org without an explicit
 *    `initiative_feature_flags` row (`isInitiativeGateAiEnabled`) — the fresh
 *    E2E orgs created here never get one, so it never fires. No flag seeding
 *    required.
 *
 * 4. `assertActorCanApprove` (initiativeClosureService.ts) calls
 *    `resolveInitiativeAccessContext(orgId, initiativeId, actorId)` WITHOUT a
 *    role hint — unlike the engine's OWN internal RBAC check, which DOES
 *    receive `actorRole` from the request (`req.user?.role`, i.e. the E2E
 *    JWT's hardcoded `role: 'ADMIN'` claim). This means the closure-approval
 *    role gate is governed by the DB `users.role` column (read fresh via
 *    `readSystemRole`) plus derived roles (`owner_business_id`/
 *    `owner_execution_id` -> INITIATIVE_OWNER/BUSINESS_OWNER), NOT by the JWT.
 *    So this suite deliberately seeds `users.role = 'MEMBER'` (never ADMIN)
 *    for every actor and relies on `owner_business_id` to grant
 *    INITIATIVE_OWNER — proving the real authorization path, not an
 *    ADMIN-role bypass that the JWT's hardcoded claim would otherwise mask.
 *    `GATE_PERMISSIONS[GateType.COMPLETE]` (constants/initiativeStatuses.ts)
 *    = `[INITIATIVE_OWNER, PMO]`; `CLOSURE_APPROVER_ROLES` in the closure
 *    service adds `ADMIN` on top (belt-and-braces, matches the engine's own
 *    `isAdmin` bypass) — this suite's "no role" user gets NEITHER, to prove
 *    the 403 path.
 *
 * 5. ★ FIXED (was a real bug, Codex review): evidence ownership
 *    (`assertEvidenceRefBelongsToInitiative`, initiativeClosureService.ts)
 *    now checks that the referenced task/milestone/decision belongs to BOTH
 *    the caller's organization AND the SPECIFIC initiative under closure,
 *    AND is itself in a terminal/approved state (task done/completed,
 *    milestone COMPLETED, decision approved) — checked at
 *    add-evidence time, not just at readiness/submit time. The earlier
 *    version checked organization_id only, which let evidence from a
 *    DIFFERENT initiative in the same org close this one. This suite mints
 *    a FRESH task+milestone pair PER initiative that needs 2 satisfying
 *    evidence refs (`evidenceByInitiative` map in the harness) instead of
 *    sharing one pool — sharing would now itself be invalid (an evidence rig
 *    attached to initiative A can no longer satisfy initiative B's
 *    closure). See negative controls B2-B7 for the ownership/terminal
 *    -status matrix this enables testing.
 *
 * 6. `initiativeClosureService.approveClosureRequest` does NOT pass a
 *    `__testSyncHook` into its `executeInitiativeTransition` call (grepped —
 *    absent). `__testSyncHook` (initiativeTransitionService.ts ~L417) is the
 *    engine's own, existing test-injection point for synchronizing/failing a
 *    transition mid-flight; it is NOT reachable from this file without
 *    editing `initiativeClosureService.ts`, which is a different file this
 *    task is not the writer of (single-writer-per-file discipline). See the
 *    `NEEDS_FOLLOWUP` comment on the fault-injection test below for the
 *    concrete, scoped follow-up this implies.
 *
 * 7. ★★★ CONFIRMED BLOCKING BUG (found while writing this suite, NOT fixed
 *    here — out of this file's single-writer scope) — `approveUnit1OnClient`
 *    (initiativeClosureService.ts ~L749-765) compares
 *    `String(initiative.updatedAt) !== String(request.expectedInitiativeVersion)`.
 *    `initiative.updatedAt` is read fresh via the raw `pg` client as a JS
 *    `Date` object (default node-pg TIMESTAMP parsing — no custom type
 *    parser is registered anywhere in `server/src`, confirmed by grep), so
 *    `String(...)` on it invokes `Date.prototype.toString()` (e.g.
 *    `"Sun Aug 02 2026 07:29:35 GMT+0200 (Central European Summer Time)"`).
 *    `request.expectedInitiativeVersion` is a TEXT column whose value was
 *    written earlier by binding THAT SAME kind of `Date` object as a query
 *    PARAMETER — node-pg's outbound Date serialization for a plain
 *    (non-timestamp-typed) bind target produces an ISO-with-local-offset
 *    string instead (e.g. `"2026-08-02T05:29:35.437+02:00"`). These two
 *    string SHAPES can never be equal — confirmed empirically (see below) —
 *    regardless of server/session timezone, regardless of whether the
 *    initiative actually changed. Net effect: `String(a) !== String(b)` is
 *    TRUE unconditionally whenever `expectedInitiativeVersion` is set, which
 *    it always is by the time a request reaches `submitted` (both
 *    `createClosureRequest` and `submitClosureRequest` always populate it
 *    from a fresh, non-null `initiatives.updated_at` read). CONSEQUENCE: every
 *    `POST .../approve` call on a real, unmodified, legitimately-submitted
 *    closure request currently fails with `409 STALE_VERSION` — no
 *    initiative can reach DONE via this gate today. Empirical repro (ad hoc,
 *    outside this suite, against the same local Postgres):
 *      const r1 = await c.query('SELECT NOW()::timestamp as ts');
 *      const d = r1.rows[0].ts; // Date, e.g. 2026-08-02T05:31:49.632Z
 *      await c.query('INSERT INTO tmp(v) VALUES ($1)', [d]); // TEXT column
 *      const stored = (await c.query('SELECT v FROM tmp')).rows[0].v;
 *      // stored === "2026-08-02T05:31:49.632+02:00"
 *      // String(d)  === "Sun Aug 02 2026 05:31:49 GMT+0200 (...)"
 *      // stored !== String(d) — always, by construction.
 *    This suite deliberately does NOT paper over this — the golden-flow test
 *    and negative controls D/E assert the CORRECT/intended contract (a
 *    legitimate submit->approve reaches `done`) and will FAIL at the
 *    `approve` step until `initiativeClosureService.ts` is fixed (e.g.
 *    compare `new Date(initiative.updatedAt).getTime()` against
 *    `new Date(request.expectedInitiativeVersion).getTime()`, or store/compare
 *    a version token that round-trips losslessly, instead of two
 *    incompatible ad hoc string formats). Negative control F (deliberately
 *    staling the version) still asserts 409 STALE_VERSION and PASSES — its
 *    assertion is correct either way, so it does not distinguish "the guard
 *    works" from "the guard is stuck permanently on". Flagged as the single
 *    most important finding of this task; not fixed here (different file,
 *    single-writer discipline this branch has followed throughout).
 *
 * HOW TO RUN LOCALLY (Postgres already up + migrated):
 *   DATABASE_URL="postgresql://iris:iris_test@localhost:5450/iris_test" \
 *     NODE_ENV=test npx vitest run \
 *     tests/integration/execution-closure-evidence-gate.golden-flow.realdb.test.ts \
 *     --no-file-parallelism
 */

import { createHash, randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

// ---------------------------------------------------------------------------
// Force the app's database factory to use a REAL Postgres pool + enable the
// E2E auth bypass, but ONLY when a database is actually configured.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

// Routers imported AFTER the env guard above (informational — neither module
// touches the DB pool at import time).
import initiativesRoutes from '../../server/src/routes/pmo/initiatives.routes.js';
import initiativeClosureRoutes from '../../server/src/routes/pmo/initiativeClosure.routes.js';
import { approveClosureRequest } from '../../server/src/services/initiative/initiativeClosureService.js';

// ---------------------------------------------------------------------------
// Connection probe (same contract as the sibling realdb golden-flow files)
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 2_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 5_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 5_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await probe.end();
    } catch {
      // best-effort
    }
  }
}

async function findMissingTables(client: Client, names: readonly string[]): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.filter((n) => !found.has(n));
}

const REQUIRED_TABLES = [
  'organizations',
  'users',
  'projects',
  'initiatives',
  'initiative_history',
  'decisions',
  'tasks',
  'initiative_milestones',
  'initiative_closure_requests',
  'initiative_closure_evidence',
] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as the sibling realdb golden-flow files)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'EXE Closure Evidence Gate RealDB Test User',
    // NOTE: this claim only affects the ENGINE's own internal RBAC check
    // (which reads req.user.role as a hint) — the closure service's OWN
    // approver gate (`assertActorCanApprove`) ignores the JWT role entirely
    // and reads `users.role` from the DB instead. See file header point 4.
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

// ---------------------------------------------------------------------------
// App under test — REAL routers, REAL middleware chains, REAL controllers.
// ---------------------------------------------------------------------------

/**
 * Every app built here is bound to ONE listening socket.
 *
 * Passing an express app straight to supertest makes it boot an ephemeral server
 * per call and close it again. This suite's golden flow issues roughly thirty
 * sequential requests, and about one run in four lost one of them to
 * `ECONNRESET` — never a domain error, never a broken invariant, just the
 * measuring instrument dropping a socket. The same defect was already diagnosed
 * in the closure-evidence suites by hammering the service directly (320
 * concurrent calls, zero rejections). Binding once removes it without touching a
 * single assertion.
 */
const boundServers: import('node:http').Server[] = [];

async function buildApp() {
  const app = express();
  app.use(express.json());
  // Order matches server/src/Gateway.ts: initiativesRoutes mounted first,
  // initiativeClosureRoutes mounted after on the same base path (additive
  // slice, own auth/org middleware applied inside the router).
  app.use('/api/initiatives', initiativesRoutes);
  app.use('/api/initiatives', initiativeClosureRoutes);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  boundServers.push(server);
  return server;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string; // org A — closure requester + approver (owns every initiative below)
  userBId: string; // org B — cross-tenant attacker
  userCId: string; // org A — no closure-approver role (not an owner, role='MEMBER')
  projectAId: string;

  // All EXECUTING, org A, owner_business_id = userAId, planned dates set.
  initiativeGoldenId: string;
  initiativeIncompleteEvidenceId: string;
  initiativeWrongTenantEvidenceId: string;
  initiativeIdemApproveId: string;
  initiativeConcurrentApproveId: string;
  initiativeStaleVersionId: string;
  initiativeCrossTenantClosureId: string;
  initiativeCompleteBypassId: string;
  initiativeFaultInjectionId: string;
  initiativeEvidenceOwnershipId: string;
  // Two-unit recovery seam tests (scenarios A/B/C — see file header).
  initiativeRecoveryAId: string;
  initiativeRecoveryBId: string;
  initiativeRecoveryCId: string;
  allInitiativeIds: string[];

  // Evidence MUST belong to the SPECIFIC initiative under closure (see file
  // header point 5) — a fresh task+milestone pair, both terminal
  // (done/COMPLETED), minted PER initiative that needs 2 satisfying evidence
  // refs, keyed by that initiative's id. Sharing one pool across initiatives
  // would now itself be an invalid-evidence bug, not a convenience.
  evidenceByInitiative: Record<string, { taskId: string; milestoneId: string }>;
  // Org A, attached to initiativeGoldenId — decision-evidence-type coverage
  // (only the golden-flow test exercises the 'decision' evidenceType).
  decisionApprovedId: string;

  // Ownership/terminal-status negative-control fixtures, all on
  // initiativeEvidenceOwnershipId unless noted:
  taskIncompleteId: string; // belongs to this initiative, status='todo' (not terminal)
  milestoneIncompleteId: string; // belongs to this initiative, status='PENDING' (not terminal)
  decisionPendingId: string; // belongs to this initiative, status='pending' (not terminal)
  decisionNoInitiativeId: string; // org A, initiative_id = NULL ("no relation")

  // Org B evidence, used to prove cross-tenant evidence injection fails.
  taskOrgBId: string;

  cleanup: () => Promise<void>;
}

async function deleteOwnedImmutableGateFixtures(
  client: Client,
  initiativeIds: string[],
  forceFailureAfterDisable = false
): Promise<void> {
  if (process.env.CLOSURE_EVIDENCE_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1') {
    throw new Error('immutable fixture cleanup is not explicitly enabled');
  }
  const prefix = String(process.env.CLOSURE_EVIDENCE_DISPOSABLE_DB_PREFIX ?? '').trim();
  const db = await client.query<{ name: string }>('SELECT current_database() AS name');
  if (!prefix || !String(db.rows[0]?.name ?? '').startsWith(prefix)) {
    throw new Error('refusing immutable fixture cleanup outside the disposable database prefix');
  }
  await client.query('BEGIN');
  try {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('closure-evidence-fixture-cleanup'))`
    );
    await client.query('TRUNCATE TABLE initiative_closure_evidence');
    await client.query(
      'ALTER TABLE initiative_lifecycle_gate_decisions DISABLE TRIGGER initiative_lifecycle_gate_decisions_immutable'
    );
    if (forceFailureAfterDisable) throw new Error('forced-cleanup-failure');
    await client.query(
      `DELETE FROM initiative_lifecycle_gate_decisions WHERE decision_id = ANY($1::text[])`,
      [initiativeIds.map((id) => `gf_dec_${id}`)]
    );
    await client.query(
      'ALTER TABLE initiative_lifecycle_gate_decisions ENABLE TRIGGER initiative_lifecycle_gate_decisions_immutable'
    );
    await client.query(
      `DELETE FROM v8_agent_proposal_scope_reviews WHERE review_id = ANY($1::text[])`,
      [initiativeIds.map((id) => `gf_rev_${id}`)]
    );
    await client.query(
      `DELETE FROM v8_agent_proposal_versions WHERE proposal_version_id = ANY($1::text[])`,
      [initiativeIds.map((id) => `gf_pv_${id}`)]
    );
    await client.query(
      `DELETE FROM transformation_cases WHERE transformation_case_id = ANY($1::text[])`,
      [initiativeIds.map((id) => `gf_case_${id}`)]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const trigger = await client.query<{ enabled: string }>(
      `SELECT tgenabled AS enabled FROM pg_trigger WHERE tgname = 'initiative_lifecycle_gate_decisions_immutable'`
    );
    if (trigger.rows[0]?.enabled !== 'O') throw new Error('immutable trigger was not restored');
    throw error;
  }
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

async function setupHarness(): Promise<Harness | null> {
  // A completely unconfigured environment (no DATABASE_URL/PGHOST/DB_HOST at
  // all) is a legitimate "no Postgres available here" — vacuous pass, same
  // as the sibling realdb suites.
  const config = buildClientConfig();
  if (!config) return null;

  // From here on, the caller EXPLICITLY pointed this run at a database.
  // Connection failure (Postgres genuinely not up yet) still yields a
  // vacuous skip — but a *reachable* database with an *incomplete* schema is
  // a real bug, not an environment gap, and must fail the suite loudly
  // rather than silently reporting a false green (Codex review finding: a
  // schema-incomplete run was previously indistinguishable from "no DB
  // configured").
  if (!(await pgReachable())) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  let missing: string[];
  try {
    missing = await findMissingTables(client, REQUIRED_TABLES);
  } catch (err) {
    await client.end().catch(() => {});
    throw new Error(
      `DATABASE_URL is configured and reachable, but the fresh-schema check itself failed: ` +
        `${err instanceof Error ? err.message : String(err)}. Run the standard migration ` +
        `bootstrap (server/scripts/migrate.postgres.ts --safe) against this database before ` +
        `re-running this suite.`
    );
  }
  if (missing.length > 0) {
    await client.end().catch(() => {});
    throw new Error(
      `DATABASE_URL is configured and reachable, but the schema is incomplete — missing table(s): ` +
        `${missing.join(', ')}. This is a hard FAILURE, not a skip: a configured database must be ` +
        `fully migrated. Run the standard migration bootstrap ` +
        `(server/scripts/migrate.postgres.ts --safe, plus --only 293_initiative_milestones.sql,` +
        `247_initiative_enhancements.sql,063_raid_items.sql for a known pre-existing, unrelated ` +
        `fresh-install gap in those three specific files) against this database before re-running ` +
        `this suite.`
    );
  }

  const tag = suffix();
  const orgAId = `org_exe08_a_${tag}`;
  const orgBId = `org_exe08_b_${tag}`;
  const userAId = `user_exe08_a_${tag}`;
  const userBId = `user_exe08_b_${tag}`;
  const userCId = `user_exe08_c_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'EXE-08 Closure RealDB Org A', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'EXE-08 Closure RealDB Org B', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );

  // Deliberately role='MEMBER' (never ADMIN/PMO) for A and C — see file
  // header point 4. userA's authority to approve comes ONLY from being
  // owner_business_id on the initiatives below; userC gets no such grant.
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'EXE08', 'UserA')
     ON CONFLICT (id) DO NOTHING`,
    [userAId, orgAId, `${userAId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'EXE08', 'UserB')
     ON CONFLICT (id) DO NOTHING`,
    [userBId, orgBId, `${userBId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'EXE08', 'UserC')
     ON CONFLICT (id) DO NOTHING`,
    [userCId, orgAId, `${userCId}@local.test`]
  );

  const projectAId = `proj_exe08_a_${tag}`;
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, owner_id)
     VALUES ($1, $2, 'EXE-08 Closure RealDB Project (org A)', 'active', $3)`,
    [projectAId, orgAId, userAId]
  );

  const initiativeGoldenId = `init_exe08_golden_${tag}`;
  const initiativeIncompleteEvidenceId = `init_exe08_incev_${tag}`;
  const initiativeWrongTenantEvidenceId = `init_exe08_wrongev_${tag}`;
  const initiativeIdemApproveId = `init_exe08_idemap_${tag}`;
  const initiativeConcurrentApproveId = `init_exe08_concap_${tag}`;
  const initiativeStaleVersionId = `init_exe08_stale_${tag}`;
  const initiativeCrossTenantClosureId = `init_exe08_xtenant_${tag}`;
  const initiativeCompleteBypassId = `init_exe08_bypass_${tag}`;
  const initiativeFaultInjectionId = `init_exe08_fault_${tag}`;
  const initiativeEvidenceOwnershipId = `init_exe08_evown_${tag}`;
  const initiativeRecoveryAId = `init_exe08_recA_${tag}`;
  const initiativeRecoveryBId = `init_exe08_recB_${tag}`;
  const initiativeRecoveryCId = `init_exe08_recC_${tag}`;

  const allInitiativeIds = [
    initiativeGoldenId,
    initiativeIncompleteEvidenceId,
    initiativeWrongTenantEvidenceId,
    initiativeIdemApproveId,
    initiativeConcurrentApproveId,
    initiativeStaleVersionId,
    initiativeCrossTenantClosureId,
    initiativeCompleteBypassId,
    initiativeFaultInjectionId,
    initiativeEvidenceOwnershipId,
    initiativeRecoveryAId,
    initiativeRecoveryBId,
    initiativeRecoveryCId,
  ];

  // Every initiative: EXECUTING, owner_business_id=userAId (grants
  // INITIATIVE_OWNER — see file header point 4), planned_start/end_date set
  // (required by getBlockingReadinessItems for any SCHEDULED_ONWARD status —
  // see file header point 2). Seeded directly by SQL (frozen: no
  // transition/start endpoint call), same convention as the sibling realdb
  // golden-flow files.
  for (const [id, name] of [
    [initiativeGoldenId, 'EXE-08 Golden Flow Initiative'],
    [initiativeIncompleteEvidenceId, 'EXE-08 Incomplete Evidence Initiative'],
    [initiativeWrongTenantEvidenceId, 'EXE-08 Wrong-Tenant Evidence Initiative'],
    [initiativeIdemApproveId, 'EXE-08 Idempotent Approve Initiative'],
    [initiativeConcurrentApproveId, 'EXE-08 Concurrent Approve Initiative'],
    [initiativeStaleVersionId, 'EXE-08 Stale Version Initiative'],
    [initiativeCrossTenantClosureId, 'EXE-08 Cross-Tenant Closure Initiative'],
    [initiativeCompleteBypassId, 'EXE-08 Complete Bypass Initiative'],
    [initiativeFaultInjectionId, 'EXE-08 Fault Injection Initiative'],
    [initiativeEvidenceOwnershipId, 'EXE-08 Evidence Ownership Initiative'],
    [initiativeRecoveryAId, 'EXE-08 Recovery Scenario A Initiative'],
    [initiativeRecoveryBId, 'EXE-08 Recovery Scenario B Initiative'],
    [initiativeRecoveryCId, 'EXE-08 Recovery Scenario C Initiative'],
  ] as const) {
    await client.query(
      `INSERT INTO initiatives
        (id, organization_id, project_id, name, status, progress, owner_business_id,
         planned_start_date, planned_end_date)
       VALUES ($1, $2, $3, $4, 'EXECUTING', 0, $5, '2026-01-01', '2026-12-31')`,
      [id, orgAId, projectAId, name, userAId]
    );

    // The canonical transition engine refuses EXECUTING -> DONE without an
    // APPROVED CLOSURE gate decision (`CLOSURE_GATE_DECISION_REQUIRED`), and a
    // decision cannot exist without the A05 proposal chain that authorised it.
    // This fixture never seeded either, so every approve in this suite came back
    // 400 and six tests were red — a harness gap, not a product defect. The
    // sibling EXE-09 suite has seeded this chain all along, which is why it
    // passes; the recipe here mirrors it.
    const caseId = `gf_case_${id}`;
    const proposalVersionId = `gf_pv_${id}`;
    const reviewId = `gf_rev_${id}`;
    const digest = createHash('sha256').update(`gf|${id}`).digest('hex');
    await client.query(
      `INSERT INTO transformation_cases
         (transformation_case_id, organization_id, initiated_by_user_id, mandate,
          lineage_id, idempotency_key, version)
       VALUES ($1,$2,$3,'EXE-08 governed closure fixture',$4,$5,1)
       ON CONFLICT (transformation_case_id) DO NOTHING`,
      [caseId, orgAId, userAId, `gf_lineage_${id}`, `gf_caseidem_${id}`]
    );
    await client.query(
      `INSERT INTO v8_agent_proposal_versions
         (proposal_version_id, proposal_id, organization_id, canonical_run_id,
          proposal_version, plan_version, context_digest, before_json, after_json,
          approval_scopes_json, reviewer_authority_json, expires_at, status,
          created_by_user_id)
       VALUES ($1,$2,$3,$4,1,1,$5,'{}'::jsonb,'{}'::jsonb,$6::jsonb,$7::jsonb,
               NOW() + INTERVAL '1 day','approved',$8)
       ON CONFLICT (proposal_version_id) DO NOTHING`,
      [
        proposalVersionId,
        `gf_proposal_${id}`,
        orgAId,
        `gf_run_${id}`,
        digest,
        JSON.stringify(['closure_lock']),
        JSON.stringify({ userId: userAId, authority: 'closure_lock' }),
        userAId,
      ]
    );
    await client.query(
      `INSERT INTO v8_agent_proposal_scope_reviews
         (review_id, proposal_version_id, scope_key, decision, reason, reviewed_by_user_id)
       VALUES ($1,$2,'closure_lock','approved','EXE-08 governed fixture',$3)
       ON CONFLICT (review_id) DO NOTHING`,
      [reviewId, proposalVersionId, userAId]
    );
    await client.query(
      `INSERT INTO initiative_lifecycle_gate_decisions
         (decision_id, organization_id, initiative_id, transformation_case_id,
          pmo_domain, version, decision_status, source_digest, source_case_version,
          baseline_refs_json, a05_proposal_version_id, a05_approval_receipt_ref,
          human_actor_user_id, human_authority_ref, rationale, deadline_at,
          idempotency_key, input_digest)
       VALUES ($1,$2,$3,$4,'CLOSURE',1,'approved',$5,1,$6::jsonb,$7,$8,$9,
               'closure_lock','EXE-08 human-approved closure fixture',
               NOW() + INTERVAL '1 day',$10,$11)
       ON CONFLICT (decision_id) DO NOTHING`,
      [
        `gf_dec_${id}`,
        orgAId,
        id,
        caseId,
        digest,
        JSON.stringify([`initiative:${id}:execution-evidence`]),
        proposalVersionId,
        reviewId,
        userAId,
        `gf_closure_${id}`,
        createHash('sha256').update(`gf-input|${id}`).digest('hex'),
      ]
    );
  }

  // Per-initiative evidence pairs (see file header point 5 / Harness type
  // comment) — a fresh task (status='done') + milestone (status='COMPLETED')
  // MINTED FOR, AND ATTACHED TO, each specific initiative that needs 2
  // satisfying evidence refs. Using another initiative's pair to satisfy
  // THIS initiative's closure must be rejected (negative controls B2/B3).
  const evidenceByInitiative: Record<string, { taskId: string; milestoneId: string }> = {};
  for (const initiativeId of [
    initiativeGoldenId,
    initiativeIncompleteEvidenceId,
    initiativeIdemApproveId,
    initiativeConcurrentApproveId,
    initiativeStaleVersionId,
    initiativeRecoveryAId,
    initiativeRecoveryBId,
    initiativeRecoveryCId,
  ]) {
    const taskId = `task_exe08_ev_${initiativeId}`;
    await client.query(
      `INSERT INTO tasks (id, organization_id, initiative_id, title, status)
       VALUES ($1, $2, $3, 'EXE-08 evidence task (done)', 'done')`,
      [taskId, orgAId, initiativeId]
    );
    const milestoneId = `milestone_exe08_ev_${initiativeId}`;
    await client.query(
      `INSERT INTO initiative_milestones (id, initiative_id, organization_id, name, status)
       VALUES ($1, $2, $3, 'EXE-08 evidence milestone (completed)', 'COMPLETED')`,
      [milestoneId, initiativeId, orgAId]
    );
    evidenceByInitiative[initiativeId] = { taskId, milestoneId };
  }

  // Decision evidence — status='approved' (never 'pending'/'escalated') and a
  // type outside ('SCOPE_CHANGE','RISK_ACCEPTANCE','BLOCKER_RESOLUTION',
  // 'PHASE_TRANSITION') so it can never trip
  // `hasPendingExecutionGateDecisions` for any initiative under test (see
  // file header point 2). Attached to initiativeGoldenId — only the
  // golden-flow test exercises the 'decision' evidenceType.
  const decisionApprovedId = `decision_exe08_evidence_${tag}`;
  await client.query(
    `INSERT INTO decisions
      (id, organization_id, initiative_id, title, type, decision_maker_id, status, created_by)
     VALUES ($1, $2, $3, 'EXE-08 evidence decision (approved)', 'CLOSURE_EVIDENCE', $4, 'approved', $4)`,
    [decisionApprovedId, orgAId, initiativeGoldenId, userAId]
  );

  // Ownership/terminal-status negative-control fixtures — all attached to
  // initiativeEvidenceOwnershipId (so they legitimately belong to the
  // initiative under test in these controls) but each deliberately NOT
  // terminal, to prove `assertEvidenceRefBelongsToInitiative` rejects them
  // (409 EVIDENCE_NOT_TERMINAL, not silently accepted).
  const taskIncompleteId = `task_exe08_incomplete_${tag}`;
  await client.query(
    `INSERT INTO tasks (id, organization_id, initiative_id, title, status)
     VALUES ($1, $2, $3, 'EXE-08 evidence task (incomplete)', 'todo')`,
    [taskIncompleteId, orgAId, initiativeEvidenceOwnershipId]
  );
  const milestoneIncompleteId = `milestone_exe08_incomplete_${tag}`;
  await client.query(
    `INSERT INTO initiative_milestones (id, initiative_id, organization_id, name, status)
     VALUES ($1, $2, $3, 'EXE-08 evidence milestone (incomplete)', 'PENDING')`,
    [milestoneIncompleteId, initiativeEvidenceOwnershipId, orgAId]
  );
  const decisionPendingId = `decision_exe08_pending_${tag}`;
  await client.query(
    `INSERT INTO decisions
      (id, organization_id, initiative_id, title, type, decision_maker_id, status, created_by)
     VALUES ($1, $2, $3, 'EXE-08 evidence decision (pending)', 'CLOSURE_EVIDENCE', $4, 'pending', $4)`,
    [decisionPendingId, orgAId, initiativeEvidenceOwnershipId, userAId]
  );
  // Org A, but no initiative_id at all — "exists, but has no relation to any
  // initiative" (negative control B4).
  const decisionNoInitiativeId = `decision_exe08_noinit_${tag}`;
  await client.query(
    `INSERT INTO decisions
      (id, organization_id, initiative_id, title, type, decision_maker_id, status, created_by)
     VALUES ($1, $2, NULL, 'EXE-08 evidence decision (no initiative link)', 'CLOSURE_EVIDENCE', $3, 'approved', $3)`,
    [decisionNoInitiativeId, orgAId, userAId]
  );

  // Org B evidence — used ONLY to prove cross-tenant evidence injection is
  // rejected (never actually attached to any org A closure request).
  const taskOrgBId = `task_exe08_orgb_${tag}`;
  await client.query(
    `INSERT INTO tasks (id, organization_id, title, status)
     VALUES ($1, $2, 'EXE-08 org B task (bait)', 'todo')`,
    [taskOrgBId, orgBId]
  );

  const cleanup = async () => {
    /**
     * The evidence ledger has no scoped delete, and this teardown used to
     * assume it did.
     *
     * Once the ledger became genuinely append-only, the first statement below
     * started throwing, the blanket `catch` swallowed it, and every statement
     * after it was skipped — so a "successful" run left 12 organizations, 18
     * users and 78 initiatives behind while reporting nothing. That is the
     * failure mode a silent catch is for, and it is why the ledger is handled
     * separately and the rest is no longer hidden behind one.
     *
     * TRUNCATE, not DELETE: removal is DDL requiring ownership of the table,
     * which a runtime role does not have and a disposable test database does.
     */
    await expect(deleteOwnedImmutableGateFixtures(client, [], true)).rejects.toThrow(
      'forced-cleanup-failure'
    );
    await deleteOwnedImmutableGateFixtures(client, allInitiativeIds);
    try {
      await client.query(
        `DELETE FROM initiative_closure_requests WHERE organization_id = ANY($1)`,
        [[orgAId, orgBId]]
      );
      await client.query(`DELETE FROM initiative_history WHERE initiative_id = ANY($1)`, [
        allInitiativeIds,
      ]);
      await client.query(`DELETE FROM decisions WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      await client.query(`DELETE FROM tasks WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM initiative_milestones WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      await client.query(`DELETE FROM initiatives WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      await client.query(`DELETE FROM projects WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      // Best-effort: the E2E auth bypass also seeds `organization_members`
      // rows for whichever identities actually authenticate.
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } catch (error) {
      throw new Error(`EXE-08 fixture cleanup failed: ${String(error)}`);
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return {
    client,
    orgAId,
    orgBId,
    userAId,
    userBId,
    userCId,
    projectAId,
    initiativeGoldenId,
    initiativeIncompleteEvidenceId,
    initiativeWrongTenantEvidenceId,
    initiativeIdemApproveId,
    initiativeConcurrentApproveId,
    initiativeStaleVersionId,
    initiativeCrossTenantClosureId,
    initiativeCompleteBypassId,
    initiativeFaultInjectionId,
    initiativeEvidenceOwnershipId,
    initiativeRecoveryAId,
    initiativeRecoveryBId,
    initiativeRecoveryCId,
    allInitiativeIds,
    evidenceByInitiative,
    decisionApprovedId,
    taskIncompleteId,
    milestoneIncompleteId,
    decisionPendingId,
    decisionNoInitiativeId,
    taskOrgBId,
    cleanup,
  };
}

// ---------------------------------------------------------------------------
// Shared flow helper — drives a fresh closure request on `initiativeId` all
// the way to `submitted` (2 satisfying evidence refs + rationale/outcome),
// reused by the idempotent-retry / concurrent-approve / stale-version tests
// so each of those tests starts from an identical, known-good state.
// ---------------------------------------------------------------------------

async function driveClosureRequestToSubmitted(
  app: import('node:http').Server,
  initiativeId: string,
  ownerToken: string,
  h: Harness
): Promise<string> {
  const createRes = await request(app)
    .post(`/api/initiatives/${initiativeId}/closure-requests`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({});
  expect(createRes.status).toBe(201);
  const closureRequestId = createRes.body.id as string;
  expect(closureRequestId).toBeTruthy();

  const evidence = h.evidenceByInitiative[initiativeId];
  if (!evidence) {
    throw new Error(
      `driveClosureRequestToSubmitted: no evidence pair minted for initiative ${initiativeId} — ` +
        `add it to the evidenceByInitiative loop in setupHarness.`
    );
  }

  const ev1 = await request(app)
    .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/evidence`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ evidenceType: 'task', evidenceRefId: evidence.taskId });
  expect(ev1.status).toBe(201);

  const ev2 = await request(app)
    .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/evidence`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ evidenceType: 'milestone', evidenceRefId: evidence.milestoneId });
  expect(ev2.status).toBe(201);

  const submitRes = await request(app)
    .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/submit`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      closureRationale: 'Driven-to-submitted rationale',
      outcomeSummary: 'Driven-to-submitted outcome',
    });
  expect(submitRes.status).toBe(200);
  expect(submitRes.body.success).toBe(true);
  expect(submitRes.body.status).toBe('submitted');

  return closureRequestId;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EXE-08 — closure/evidence gate golden flow against a real Postgres database (no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — execution-closure-evidence-gate ' +
        'golden-flow realdb tests skipped. Set DATABASE_URL / PGHOST to a migrated Postgres to ' +
        'exercise this suite.'
    );
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    await Promise.all(
      boundServers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve())))
    );
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  /**
   * NO VACUOUS PASS.
   *
   * This used to be `if (!harness) { expect(true).toBe(true); return; }` — a
   * green tick for a test that never ran. That convention makes a required
   * release gate indistinguishable from an empty one: the summary reads 18/18
   * whether the ledger was exercised or the database was simply absent, and a
   * reader has no way to tell which run they are looking at.
   *
   * A gate that did not run is not a gate that passed. Without a database this
   * now fails, loudly and with the reason, so the only way to see a green
   * result here is to have produced one.
   */
  const itDB = (name: string, fn: (h: Harness) => Promise<void>, timeoutMs = 20_000) =>
    it(
      name,
      async () => {
        if (!harness) {
          throw new Error(
            'EVIDENCE_MISSING: this suite is a real-database closure/evidence gate and no ' +
              'usable Postgres was reachable, so nothing was verified. Point DATABASE_URL at a ' +
              'migrated database and re-run. Refusing to report a pass for a test that did not run.'
          );
        }
        await fn(harness);
      },
      timeoutMs
    );

  // -------------------------------------------------------------------------
  // 1) Golden flow — the full lifecycle on ONE closure request, embedding the
  //    "no approver role" 403 check (step 6) and the return->resubmit
  //    reviewRationale-visibility check (negative control C) inline, exactly
  //    where the task brief places them in the flow.
  // -------------------------------------------------------------------------

  itDB(
    'golden flow: draft -> readiness -> evidence -> submit(rejected) -> submit -> 403(no role) -> return -> resubmit -> approve -> DONE, coherent on reopen + history',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const noRoleToken = makeE2EToken(h.userCId, h.orgAId);
      const initiativeId = h.initiativeGoldenId;

      // 1. POST closure-request (draft).
      const createRes = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.idempotent).toBe(false);
      const closureRequestId = createRes.body.id as string;
      expect(closureRequestId).toBeTruthy();

      const readinessUrl = `/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/readiness`;
      const evidenceUrl = `/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/evidence`;
      const submitUrl = `/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/submit`;
      const returnUrl = `/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/return`;
      const approveUrl = `/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/approve`;
      const requestUrl = `/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}`;

      // 2. GET readiness -> ready:false (no rationale/outcome/evidence yet).
      const readiness0 = await request(app)
        .get(readinessUrl)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(readiness0.status).toBe(200);
      expect(readiness0.body.ready).toBe(false);
      const items0: Array<{ key: string; satisfied: boolean }> = readiness0.body.items;
      expect(items0.find((i) => i.key === 'closureRationale')?.satisfied).toBe(false);
      expect(items0.find((i) => i.key === 'outcomeSummary')?.satisfied).toBe(false);
      expect(items0.find((i) => i.key === 'evidenceMinimumTwo')?.satisfied).toBe(false);

      // 3. POST evidence x2 (real task + milestone in the same org), GET
      //    readiness after each, checking checklist progress.
      const goldenEvidence = h.evidenceByInitiative[initiativeId];
      const evTask = await request(app)
        .post(evidenceUrl)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ evidenceType: 'task', evidenceRefId: goldenEvidence.taskId });
      expect(evTask.status).toBe(201);
      expect(evTask.body.success).toBe(true);

      const readiness1 = await request(app)
        .get(readinessUrl)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(readiness1.status).toBe(200);
      expect(readiness1.body.ready).toBe(false);
      expect(
        readiness1.body.items.find((i: any) => i.key === 'evidenceMinimumTwo')?.satisfied
      ).toBe(false);

      const evMilestone = await request(app)
        .post(evidenceUrl)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ evidenceType: 'milestone', evidenceRefId: goldenEvidence.milestoneId });
      expect(evMilestone.status).toBe(201);
      expect(evMilestone.body.success).toBe(true);

      const readiness2 = await request(app)
        .get(readinessUrl)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(readiness2.status).toBe(200);
      expect(
        readiness2.body.items.find((i: any) => i.key === 'evidenceMinimumTwo')?.satisfied
      ).toBe(true);
      // Still not ready overall — rationale/outcome still missing.
      expect(readiness2.body.ready).toBe(false);

      // Bonus evidence-type coverage: attach the decision evidence too (still
      // draft, still allowed) — proves the 'decision' evidenceType path
      // works, on top of the 2 that satisfy the threshold.
      const evDecision = await request(app)
        .post(evidenceUrl)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ evidenceType: 'decision', evidenceRefId: h.decisionApprovedId });
      expect(evDecision.status).toBe(201);

      // 4. Submit WITHOUT rationale/outcome -> 422 CLOSURE_NOT_READY, checklist
      //    surfaces the still-unsatisfied items.
      const submitRejected = await request(app)
        .post(submitUrl)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(submitRejected.status).toBe(422);
      expect(submitRejected.body.code).toBe('CLOSURE_NOT_READY');
      const rejectedChecklist: Array<{ key: string; satisfied: boolean }> =
        submitRejected.body.details.checklist;
      expect(rejectedChecklist.find((i) => i.key === 'closureRationale')?.satisfied).toBe(false);
      expect(rejectedChecklist.find((i) => i.key === 'outcomeSummary')?.satisfied).toBe(false);
      expect(rejectedChecklist.find((i) => i.key === 'evidenceMinimumTwo')?.satisfied).toBe(true);

      // 5. Uzupełnij rationale+outcome, submit -> 200 status='submitted'.
      const closureRationale = `Golden flow closure rationale ${suffix()}`;
      const outcomeSummary = `Golden flow outcome summary ${suffix()}`;
      const submitOk = await request(app)
        .post(submitUrl)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ closureRationale, outcomeSummary });
      expect(submitOk.status).toBe(200);
      expect(submitOk.body.success).toBe(true);
      expect(submitOk.body.status).toBe('submitted');

      // 6. Non-approver (org A, no owner/PMO/ADMIN role) -> 403.
      const forbiddenApprove = await request(app)
        .post(approveUrl)
        .set('Authorization', `Bearer ${noRoleToken}`)
        .send({});
      expect(forbiddenApprove.status).toBe(403);
      expect(forbiddenApprove.body.code).toBe('CLOSURE_APPROVER_ROLE_REQUIRED');

      // 7. Approver (userA, INITIATIVE_OWNER via owner_business_id) returns
      //    the request with a rationale.
      const reviewRationale = `Golden flow return rationale ${suffix()}`;
      const returnRes = await request(app)
        .post(returnUrl)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reviewRationale });
      expect(returnRes.status).toBe(200);
      expect(returnRes.body.success).toBe(true);
      expect(returnRes.body.status).toBe('returned');

      // Negative control C: reviewRationale from the return is visible on GET.
      const afterReturnGet = await request(app)
        .get(requestUrl)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(afterReturnGet.status).toBe(200);
      expect(afterReturnGet.body.closureRequest.status).toBe('returned');
      expect(afterReturnGet.body.closureRequest.reviewRationale).toBe(reviewRationale);

      // 8. Author resubmits without changes — readiness is still satisfied
      //    (rationale/outcome/evidence all persisted from before).
      const resubmitRes = await request(app)
        .post(submitUrl)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.status).toBe('submitted');

      // 9. Approver approves -> done (directly, or self-heals to done on a
      //    single follow-up GET if the response itself reports an
      //    intermediate state).
      const approveRes = await request(app)
        .post(approveUrl)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.success).toBe(true);
      expect(approveRes.body.ok).toBe(true);
      expect(approveRes.body.idempotent).toBe(false);

      let finalStatus = approveRes.body.status as string;
      if (finalStatus !== 'done') {
        const healGet = await request(app)
          .get(requestUrl)
          .set('Authorization', `Bearer ${ownerToken}`);
        expect(healGet.status).toBe(200);
        finalStatus = healGet.body.closureRequest.status;
      }
      expect(finalStatus).toBe('done');

      // 10. GET initiative fresh ("reopen") -> DONE.
      const reopenApp = await buildApp();
      const reopenGet = await request(reopenApp)
        .get(`/api/initiatives/${initiativeId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(reopenGet.status).toBe(200);
      expect(reopenGet.body.status).toBe('DONE');

      // 11. GET history -> closure_requested + closure_approved both present
      //     (status_changed from the frozen engine may also be present — not
      //     asserted on by name, per the task brief).
      const historyGet = await request(reopenApp)
        .get(`/api/initiatives/${initiativeId}/history`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(historyGet.status).toBe(200);
      const eventTypes = new Set(
        (historyGet.body.events as Array<{ eventType: string }>).map((e) => e.eventType)
      );
      expect(eventTypes.has('closure_requested')).toBe(true);
      expect(eventTypes.has('closure_approved')).toBe(true);

      // 12. transitionAuditRef is non-empty and points at a real
      //     initiative_history row belonging to this initiative.
      const finalRequestGet = await request(reopenApp)
        .get(requestUrl)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(finalRequestGet.status).toBe(200);
      const transitionAuditRef = finalRequestGet.body.closureRequest.transitionAuditRef as string;
      expect(transitionAuditRef).toBeTruthy();
      const auditRow = await h.client.query(
        `SELECT id, initiative_id, action FROM initiative_history WHERE id = $1`,
        [transitionAuditRef]
      );
      expect(auditRow.rows.length).toBe(1);
      expect(auditRow.rows[0].initiative_id).toBe(initiativeId);
      expect(auditRow.rows[0].action).toBe('status_changed');
    },
    30_000
  );

  // -------------------------------------------------------------------------
  // Negative control A — incomplete evidence (<2) rejected at submit.
  // -------------------------------------------------------------------------

  itDB(
    'negative control A: submit with fewer than 2 evidence refs -> 422 CLOSURE_NOT_READY',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeIncompleteEvidenceId;

      const createRes = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(createRes.status).toBe(201);
      const closureRequestId = createRes.body.id as string;

      const ev1 = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/evidence`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ evidenceType: 'task', evidenceRefId: h.evidenceByInitiative[initiativeId].taskId });
      expect(ev1.status).toBe(201);

      const submitRes = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/submit`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ closureRationale: 'Rationale present', outcomeSummary: 'Outcome present' });
      expect(submitRes.status).toBe(422);
      expect(submitRes.body.code).toBe('CLOSURE_NOT_READY');
      const checklist: Array<{ key: string; satisfied: boolean }> =
        submitRes.body.details.checklist;
      expect(checklist.find((i) => i.key === 'evidenceMinimumTwo')?.satisfied).toBe(false);
      expect(checklist.find((i) => i.key === 'closureRationale')?.satisfied).toBe(true);
      expect(checklist.find((i) => i.key === 'outcomeSummary')?.satisfied).toBe(true);

      const row = await h.client.query(
        `SELECT status FROM initiative_closure_requests WHERE id = $1`,
        [closureRequestId]
      );
      expect(row.rows[0].status).toBe('draft');
    }
  );

  // -------------------------------------------------------------------------
  // Negative control B — wrong-tenant evidence injection rejected.
  // -------------------------------------------------------------------------

  itDB(
    'negative control B: evidenceRefId from org B rejected as org A -> 404, no evidence row created',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeWrongTenantEvidenceId;

      const createRes = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(createRes.status).toBe(201);
      const closureRequestId = createRes.body.id as string;

      const evRes = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/evidence`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ evidenceType: 'task', evidenceRefId: h.taskOrgBId });
      expect(evRes.status).toBe(404);
      expect(evRes.body.code).toBe('EVIDENCE_REF_NOT_FOUND');

      const rows = await h.client.query(
        `SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1 AND evidence_ref_id = $2`,
        [closureRequestId, h.taskOrgBId]
      );
      expect(rows.rows.length).toBe(0);
    }
  );

  // -------------------------------------------------------------------------
  // Negative controls B2-B7 — evidence ownership/terminal-status matrix
  // (Codex review: assertEvidenceRefBelongsToInitiative). All against
  // h.initiativeEvidenceOwnershipId. Each proves: (a) no evidence row gets
  // created, (b) readiness/evidenceMinimumTwo never counts the rejected ref.
  // -------------------------------------------------------------------------

  async function openDraftOn(
    app: express.Express,
    initiativeId: string,
    ownerToken: string
  ): Promise<string> {
    const createRes = await request(app)
      .post(`/api/initiatives/${initiativeId}/closure-requests`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(createRes.status).toBe(201);
    return createRes.body.id as string;
  }

  async function assertEvidenceRejected(
    app: import('node:http').Server,
    initiativeId: string,
    closureRequestId: string,
    ownerToken: string,
    body: { evidenceType: string; evidenceRefId: string },
    expectedStatus: number,
    expectedCode: string
  ): Promise<void> {
    const res = await request(app)
      .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/evidence`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(body);
    expect(res.status).toBe(expectedStatus);
    expect(res.body.code).toBe(expectedCode);
  }

  itDB(
    'negative control B2: task belongs to a DIFFERENT initiative in the same org -> 404, not accepted',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeEvidenceOwnershipId;
      const closureRequestId = await openDraftOn(app, initiativeId, ownerToken);
      // A real, terminal, org-A task — but attached to initiativeGoldenId, not this one.
      const foreignTaskId = h.evidenceByInitiative[h.initiativeGoldenId].taskId;
      await assertEvidenceRejected(
        app,
        initiativeId,
        closureRequestId,
        ownerToken,
        { evidenceType: 'task', evidenceRefId: foreignTaskId },
        404,
        'EVIDENCE_REF_NOT_FOUND'
      );
      const rows = await h.client.query(
        `SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`,
        [closureRequestId]
      );
      expect(rows.rows.length).toBe(0);
    }
  );

  itDB(
    'negative control B3: milestone belongs to a DIFFERENT initiative in the same org -> 404, not accepted',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeEvidenceOwnershipId;
      const closureRequestId = await openDraftOn(app, initiativeId, ownerToken);
      const foreignMilestoneId = h.evidenceByInitiative[h.initiativeGoldenId].milestoneId;
      await assertEvidenceRejected(
        app,
        initiativeId,
        closureRequestId,
        ownerToken,
        { evidenceType: 'milestone', evidenceRefId: foreignMilestoneId },
        404,
        'EVIDENCE_REF_NOT_FOUND'
      );
      const rows = await h.client.query(
        `SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`,
        [closureRequestId]
      );
      expect(rows.rows.length).toBe(0);
    }
  );

  itDB(
    'negative control B4: decision exists but has NO relation to any initiative -> 404, not accepted',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeEvidenceOwnershipId;
      const closureRequestId = await openDraftOn(app, initiativeId, ownerToken);
      await assertEvidenceRejected(
        app,
        initiativeId,
        closureRequestId,
        ownerToken,
        { evidenceType: 'decision', evidenceRefId: h.decisionNoInitiativeId },
        404,
        'EVIDENCE_REF_NOT_FOUND'
      );
      const rows = await h.client.query(
        `SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`,
        [closureRequestId]
      );
      expect(rows.rows.length).toBe(0);
    }
  );

  itDB(
    'negative control B5: task belongs to this initiative but is NOT done -> 409 EVIDENCE_NOT_TERMINAL, not accepted',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeEvidenceOwnershipId;
      const closureRequestId = await openDraftOn(app, initiativeId, ownerToken);
      await assertEvidenceRejected(
        app,
        initiativeId,
        closureRequestId,
        ownerToken,
        { evidenceType: 'task', evidenceRefId: h.taskIncompleteId },
        409,
        'EVIDENCE_NOT_TERMINAL'
      );
      const rows = await h.client.query(
        `SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`,
        [closureRequestId]
      );
      expect(rows.rows.length).toBe(0);
    }
  );

  itDB(
    'negative control B6: milestone belongs to this initiative but is NOT completed -> 409 EVIDENCE_NOT_TERMINAL, not accepted',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeEvidenceOwnershipId;
      const closureRequestId = await openDraftOn(app, initiativeId, ownerToken);
      await assertEvidenceRejected(
        app,
        initiativeId,
        closureRequestId,
        ownerToken,
        { evidenceType: 'milestone', evidenceRefId: h.milestoneIncompleteId },
        409,
        'EVIDENCE_NOT_TERMINAL'
      );
      const rows = await h.client.query(
        `SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`,
        [closureRequestId]
      );
      expect(rows.rows.length).toBe(0);
    }
  );

  itDB(
    'negative control B7: decision belongs to this initiative but is still pending -> 409 EVIDENCE_NOT_TERMINAL, not accepted',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeEvidenceOwnershipId;
      const closureRequestId = await openDraftOn(app, initiativeId, ownerToken);
      await assertEvidenceRejected(
        app,
        initiativeId,
        closureRequestId,
        ownerToken,
        { evidenceType: 'decision', evidenceRefId: h.decisionPendingId },
        409,
        'EVIDENCE_NOT_TERMINAL'
      );
      const rows = await h.client.query(
        `SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`,
        [closureRequestId]
      );
      expect(rows.rows.length).toBe(0);
    }
  );

  // -------------------------------------------------------------------------
  // Negative control D — idempotent retry of approve.
  // -------------------------------------------------------------------------

  itDB(
    'negative control D: retrying approve with the same idempotencyKey does not re-run the engine',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeIdemApproveId;
      const closureRequestId = await driveClosureRequestToSubmitted(
        app,
        initiativeId,
        ownerToken,
        h
      );
      const idempotencyKey = `idem-approve-${suffix()}`;

      const approveUrl = `/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/approve`;

      const firstRes = await request(app)
        .post(approveUrl)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ idempotencyKey });
      expect(firstRes.status).toBe(200);
      expect(firstRes.body.idempotent).toBe(false);
      expect(firstRes.body.status).toBe('done');

      const secondRes = await request(app)
        .post(approveUrl)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ idempotencyKey });
      expect(secondRes.status).toBe(200);
      expect(secondRes.body.idempotent).toBe(true);
      expect(secondRes.body.status).toBe('done');

      const historyRows = await h.client.query(
        `SELECT id FROM initiative_history
         WHERE initiative_id = $1 AND action = 'closure_approved' AND idempotency_key = $2`,
        [initiativeId, idempotencyKey]
      );
      expect(historyRows.rows.length).toBe(1);

      const statusChangedRows = await h.client.query(
        `SELECT id FROM initiative_history WHERE initiative_id = $1 AND action = 'status_changed'`,
        [initiativeId]
      );
      expect(statusChangedRows.rows.length).toBe(1);

      const initiativeRow = await h.client.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(initiativeRow.rows[0].status).toBe('DONE');
    },
    30_000
  );

  // -------------------------------------------------------------------------
  // Negative control E — concurrent double-approve, most important test in
  // this file per the task brief. Two simultaneous POST approve calls with
  // DIFFERENT idempotencyKeys on the SAME submitted closure request.
  // -------------------------------------------------------------------------

  itDB(
    'negative control E: concurrent double-approve settles on exactly one engine transition, closure request ends done',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeConcurrentApproveId;
      const closureRequestId = await driveClosureRequestToSubmitted(
        app,
        initiativeId,
        ownerToken,
        h
      );
      const approveUrl = `/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/approve`;

      // No shared idempotencyKey — this exercises the row-lock serialization
      // in approveUnit1OnClient (initiativeClosureService.ts), not the
      // idempotency-key dedup path (covered by negative control D).
      const [resA, resB] = await Promise.all([
        request(app)
          .post(approveUrl)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ idempotencyKey: `idem-race-a-${suffix()}` }),
        request(app)
          .post(approveUrl)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ idempotencyKey: `idem-race-b-${suffix()}` }),
      ]);

      // Neither request errors — the loser sees `already_pending`, not an
      // HTTP error (see initiativeClosureService.ts's `approveUnit1OnClient`
      // doc comment: "the loser sees the already-updated row once the lock
      // releases").
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const winner = resA.body.idempotent === false ? resA : resB;
      const loser = resA.body.idempotent === false ? resB : resA;

      expect(winner.body.idempotent).toBe(false);
      expect(winner.body.status).toBe('done');
      expect(loser.body.idempotent).toBe(true);
      // The loser observes the in-flight state the winner committed in Unit 1
      // before Unit 2 (the engine call) ran — not yet 'done' from ITS OWN
      // point of view, even though by the time Promise.all resolves the
      // winner's request has already finished (including its own finalize
      // step), so the row is provably 'done' in the DB by then (checked
      // below).
      expect(loser.body.status).toBe('approved_pending_transition');

      // KEY assertion: the engine ran EXACTLY ONCE (one status_changed row),
      // and the closure request did not get stuck — it ends in 'done'.
      const statusChangedRows = await h.client.query(
        `SELECT id FROM initiative_history WHERE initiative_id = $1 AND action = 'status_changed'`,
        [initiativeId]
      );
      expect(statusChangedRows.rows.length).toBe(1);

      const closureRow = await h.client.query(
        `SELECT status FROM initiative_closure_requests WHERE id = $1`,
        [closureRequestId]
      );
      expect(closureRow.rows[0].status).toBe('done');

      const initiativeRow = await h.client.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(initiativeRow.rows[0].status).toBe('DONE');
    },
    30_000
  );

  // -------------------------------------------------------------------------
  // Negative control F — stale expectedInitiativeVersion at approve time.
  // -------------------------------------------------------------------------

  itDB(
    'negative control F: initiative changed after submit -> approve rejects with 409 STALE_VERSION',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeStaleVersionId;
      const closureRequestId = await driveClosureRequestToSubmitted(
        app,
        initiativeId,
        ownerToken,
        h
      );

      // Simulate "something changed" on the initiative between submit and
      // approve via the real quick-update endpoint (bumps
      // initiatives.updated_at, which expected_initiative_version was
      // snapshotted against at submit time).
      const quickUpdateRes = await request(app)
        .patch(`/api/initiatives/${initiativeId}/quick-update`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ progress: 7 });
      expect(quickUpdateRes.status).toBe(200);

      const approveRes = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(approveRes.status).toBe(409);
      expect(approveRes.body.code).toBe('STALE_VERSION');

      const closureRow = await h.client.query(
        `SELECT status FROM initiative_closure_requests WHERE id = $1`,
        [closureRequestId]
      );
      expect(closureRow.rows[0].status).toBe('submitted');

      const initiativeRow = await h.client.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(initiativeRow.rows[0].status).toBe('EXECUTING');
    },
    30_000
  );

  // -------------------------------------------------------------------------
  // Negative control G — cross-tenant access to another org's closure
  // request: 404 on every verb, never a 403 (which would leak existence),
  // never a silent no-op that partially succeeds.
  // -------------------------------------------------------------------------

  itDB(
    'negative control G: org B cannot read or write org A closure requests -> 404 everywhere, no state change',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);
      const initiativeId = h.initiativeCrossTenantClosureId;

      const createRes = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(createRes.status).toBe(201);
      const closureRequestId = createRes.body.id as string;

      const listRes = await request(app)
        .get(`/api/initiatives/${initiativeId}/closure-requests`)
        .set('Authorization', `Bearer ${attackerToken}`);
      expect(listRes.status).toBe(404);

      const getOneRes = await request(app)
        .get(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}`)
        .set('Authorization', `Bearer ${attackerToken}`);
      expect(getOneRes.status).toBe(404);

      const evidenceRes = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/evidence`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          evidenceType: 'task',
          evidenceRefId: h.evidenceByInitiative[h.initiativeGoldenId].taskId,
        });
      expect(evidenceRes.status).toBe(404);

      const submitRes = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/submit`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ closureRationale: 'stolen', outcomeSummary: 'stolen' });
      expect(submitRes.status).toBe(404);

      const approveRes = await request(app)
        .post(`/api/initiatives/${initiativeId}/closure-requests/${closureRequestId}/approve`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({});
      expect(approveRes.status).toBe(404);

      const row = await h.client.query(
        `SELECT status FROM initiative_closure_requests WHERE id = $1`,
        [closureRequestId]
      );
      expect(row.rows[0].status).toBe('draft');

      const evidenceRows = await h.client.query(
        `SELECT id FROM initiative_closure_evidence WHERE closure_request_id = $1`,
        [closureRequestId]
      );
      expect(evidenceRows.rows.length).toBe(0);
    }
  );

  // -------------------------------------------------------------------------
  // Negative control H — direct-DONE bypass endpoint is closed.
  // -------------------------------------------------------------------------

  itDB(
    'negative control H: legacy POST /:id/complete no longer completes an initiative -> 410 CLOSURE_REQUEST_REQUIRED',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeCompleteBypassId;

      const res = await request(app)
        .post(`/api/initiatives/${initiativeId}/complete`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(res.status).toBe(410);
      expect(res.body.code).toBe('CLOSURE_REQUEST_REQUIRED');

      const row = await h.client.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(row.rows[0].status).toBe('EXECUTING');
    }
  );

  // -------------------------------------------------------------------------
  // Negative control (honestly named — NOT fault injection, just a 404
  // check): approve against a fabricated closureRequestId on a real, owned
  // initiative. Real fault injection (proving the two-unit recovery model
  // actually recovers) is below, using the test-only seam added to
  // approveClosureRequest/reconcileClosureRequestStatus per Codex review.
  // -------------------------------------------------------------------------

  itDB(
    'negative control: approve against a fabricated closureRequestId -> 404, no writes',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeFaultInjectionId;
      const fabricatedClosureRequestId = `nonexistent-closure-request-${suffix()}`;

      const res = await request(app)
        .post(
          `/api/initiatives/${initiativeId}/closure-requests/${fabricatedClosureRequestId}/approve`
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({});
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CLOSURE_REQUEST_NOT_FOUND');

      const initiativeRow = await h.client.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(initiativeRow.rows[0].status).toBe('EXECUTING');

      const historyRows = await h.client.query(
        `SELECT id FROM initiative_history WHERE initiative_id = $1 AND action = 'closure_approved'`,
        [initiativeId]
      );
      expect(historyRows.rows.length).toBe(0);
    }
  );

  // -------------------------------------------------------------------------
  // REAL fault injection — the honest two-unit atomicity model
  // (initiativeClosureService.ts file header) proven to actually recover,
  // not just documented as theoretically sound (Codex review). Uses the
  // test-only crash-injection seam on approveClosureRequest, calling the
  // service directly (never reachable via HTTP — initiativeClosure.routes.ts
  // only ever passes the named body fields, never these flags).
  // -------------------------------------------------------------------------

  async function countHistory(h: Harness, initiativeId: string, action: string): Promise<number> {
    const rows = await h.client.query(
      `SELECT id FROM initiative_history WHERE initiative_id = $1 AND action = $2`,
      [initiativeId, action]
    );
    return rows.rows.length;
  }

  itDB(
    'recovery scenario A: crash after Unit 1 commits, before the engine is called -> stuck pending, retry completes exactly once',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeRecoveryAId;
      const closureRequestId = await driveClosureRequestToSubmitted(
        app,
        initiativeId,
        ownerToken,
        h
      );

      await expect(
        approveClosureRequest({
          orgId: h.orgAId,
          initiativeId,
          closureRequestId,
          actorId: h.userAId,
          __testFailAfterUnit1: true,
        })
      ).rejects.toThrow('TEST_INJECTED_FAILURE_AFTER_UNIT1_BEFORE_ENGINE');

      // Unit 1 committed (durable approval decision); Unit 2 (the engine)
      // was never called.
      const stuckRow = await h.client.query(
        `SELECT status FROM initiative_closure_requests WHERE id = $1`,
        [closureRequestId]
      );
      expect(stuckRow.rows[0].status).toBe('approved_pending_transition');
      const stuckInitiative = await h.client.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(stuckInitiative.rows[0].status).toBe('EXECUTING');
      expect(await countHistory(h, initiativeId, 'closure_approved')).toBe(1);
      expect(await countHistory(h, initiativeId, 'status_changed')).toBe(0);

      // Retry — a plain call, no injected flag. reconcileClosureRequestStatus
      // (called at the top of approveClosureRequest) detects the stuck
      // pending state, sees the initiative is NOT done, and retries Unit 2
      // itself before Unit 1 even runs again.
      const retryResult = await approveClosureRequest({
        orgId: h.orgAId,
        initiativeId,
        closureRequestId,
        actorId: h.userAId,
      });
      expect(retryResult.ok).toBe(true);
      expect(retryResult.status).toBe('done');

      const finalRow = await h.client.query(
        `SELECT status, transition_audit_ref as "transitionAuditRef" FROM initiative_closure_requests WHERE id = $1`,
        [closureRequestId]
      );
      expect(finalRow.rows[0].status).toBe('done');
      expect(finalRow.rows[0].transitionAuditRef).toBeTruthy();
      const finalInitiative = await h.client.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(finalInitiative.rows[0].status).toBe('DONE');

      // KEY assertion: exactly ONE approval decision, exactly ONE engine
      // transition — the retry did not duplicate either.
      expect(await countHistory(h, initiativeId, 'closure_approved')).toBe(1);
      expect(await countHistory(h, initiativeId, 'status_changed')).toBe(1);
    },
    30_000
  );

  itDB(
    'recovery scenario B: crash after the engine succeeds, before finalize -> initiative already DONE, retry finalizes without a second transition',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeRecoveryBId;
      const closureRequestId = await driveClosureRequestToSubmitted(
        app,
        initiativeId,
        ownerToken,
        h
      );

      await expect(
        approveClosureRequest({
          orgId: h.orgAId,
          initiativeId,
          closureRequestId,
          actorId: h.userAId,
          __testFailAfterEngineBeforeFinalize: true,
        })
      ).rejects.toThrow('TEST_INJECTED_FAILURE_AFTER_ENGINE_BEFORE_FINALIZE');

      // The engine already ran and succeeded; only the finalize write on the
      // closure request itself never happened.
      const stuckRow = await h.client.query(
        `SELECT status FROM initiative_closure_requests WHERE id = $1`,
        [closureRequestId]
      );
      expect(stuckRow.rows[0].status).toBe('approved_pending_transition');
      const stuckInitiative = await h.client.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(stuckInitiative.rows[0].status).toBe('DONE');
      expect(await countHistory(h, initiativeId, 'closure_approved')).toBe(1);
      expect(await countHistory(h, initiativeId, 'status_changed')).toBe(1);

      // Retry — reconcileClosureRequestStatus sees the initiative is ALREADY
      // done and just finalizes; it must NOT call the engine a second time.
      const retryResult = await approveClosureRequest({
        orgId: h.orgAId,
        initiativeId,
        closureRequestId,
        actorId: h.userAId,
      });
      expect(retryResult.ok).toBe(true);
      expect(retryResult.idempotent).toBe(true);
      expect(retryResult.status).toBe('done');

      const finalRow = await h.client.query(
        `SELECT status FROM initiative_closure_requests WHERE id = $1`,
        [closureRequestId]
      );
      expect(finalRow.rows[0].status).toBe('done');

      // KEY assertion: still exactly ONE of each — no second transition, no
      // second approval record.
      expect(await countHistory(h, initiativeId, 'closure_approved')).toBe(1);
      expect(await countHistory(h, initiativeId, 'status_changed')).toBe(1);
    },
    30_000
  );

  itDB(
    'recovery scenario C: crash before Unit 1 commits -> nothing persisted, retry proceeds cleanly',
    async (h) => {
      const app = await buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const initiativeId = h.initiativeRecoveryCId;
      const closureRequestId = await driveClosureRequestToSubmitted(
        app,
        initiativeId,
        ownerToken,
        h
      );

      await expect(
        approveClosureRequest({
          orgId: h.orgAId,
          initiativeId,
          closureRequestId,
          actorId: h.userAId,
          __testFailBeforeUnit1Commit: true,
        })
      ).rejects.toThrow('TEST_INJECTED_FAILURE_BEFORE_UNIT1_COMMIT');

      // Unit 1's own transaction rolled back — nothing at all was persisted.
      const stuckRow = await h.client.query(
        `SELECT status FROM initiative_closure_requests WHERE id = $1`,
        [closureRequestId]
      );
      expect(stuckRow.rows[0].status).toBe('submitted');
      const stuckInitiative = await h.client.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(stuckInitiative.rows[0].status).toBe('EXECUTING');
      expect(await countHistory(h, initiativeId, 'closure_approved')).toBe(0);
      expect(await countHistory(h, initiativeId, 'status_changed')).toBe(0);

      // Retry — a completely clean, ordinary approve, as if the first call
      // never happened.
      const retryResult = await approveClosureRequest({
        orgId: h.orgAId,
        initiativeId,
        closureRequestId,
        actorId: h.userAId,
      });
      expect(retryResult.ok).toBe(true);
      expect(retryResult.idempotent).toBe(false);
      expect(retryResult.status).toBe('done');

      const finalRow = await h.client.query(
        `SELECT status FROM initiative_closure_requests WHERE id = $1`,
        [closureRequestId]
      );
      expect(finalRow.rows[0].status).toBe('done');
      const finalInitiative = await h.client.query(`SELECT status FROM initiatives WHERE id = $1`, [
        initiativeId,
      ]);
      expect(finalInitiative.rows[0].status).toBe('DONE');
      expect(await countHistory(h, initiativeId, 'closure_approved')).toBe(1);
      expect(await countHistory(h, initiativeId, 'status_changed')).toBe(1);
    },
    30_000
  );
});
