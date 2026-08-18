/**
 * FLOW-TRANSFORM-MVP-001 — deterministic, multi-tenant fixture for the
 * cross-module transformation flow (CROSS-FLOW-QUALIFICATION lane).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Every prior proof of this flow was a single-module slice with its own ad-hoc
 * setup, so no two slices ever shared one lineage and "the whole flow works"
 * was never testable. This module owns ONE tenant/actor/lineage fixture that
 * all cross-flow suites reuse, so a receipt produced in Execution can be traced
 * back to the very same organization + actor that started in Chat.
 *
 * HARD RULES THIS FILE ENCODES (each one is a trap this repo has already paid for)
 * ------------------------------------------------------------------------------
 * 1. JWT secret is pinned at IMPORT TIME, before any `server/src/*` module can
 *    load `Config.ts` and compute a different deterministic default. Mirrors
 *    `tests/acceptance/harness.ts:49-54`. Import this file FIRST in every suite.
 * 2. Real JWT, real `verifyToken`, real routers — no auth mock, no `E2E_MODE`,
 *    no `MOCK_AUTH`. A test that bypasses auth proves nothing about tenancy.
 * 3. `NODE_ENV=test` ALONE substitutes a mock database
 *    (`server/src/database/Database.ts`), so the required trio is
 *    `NODE_ENV=test` + `RUN_DB_TESTS=1` + `MOCK_DB=false`. Set here, not left
 *    to the caller's shell.
 * 4. Run-isolated IDs — one random namespace is chosen at process start, then
 *    every identifier is deterministic inside that run. Parallel/retried
 *    suites cannot collide with retained rows from an earlier run.
 * 5. Cold readback uses a SEPARATE pg client the suite opens after the writer
 *    closed, so an in-process cache cannot masquerade as durability.
 */
import { createHash, randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';
import pg from 'pg';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// (1) Environment pin — MUST run before any server module is imported.
// ---------------------------------------------------------------------------
const PINNED_JWT_SECRET = 'consultify-acceptance-harness-pinned-test-secret-fixed-32chars-min';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = PINNED_JWT_SECRET;

process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';
process.env.RUN_DB_TESTS = '1';
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';

/** Deterministic, collision-proof prefix for every row this lane creates. */
export const CF = `cfq-${randomUUID().slice(0, 8)}-`;

// ---------------------------------------------------------------------------
// (2) Deterministic identity generation
// ---------------------------------------------------------------------------
/**
 * Stable ID derived from a semantic path, not from a counter or clock: the same
 * logical object always gets the same id across runs AND across suites, which
 * is what makes one lineage assertable end to end. Truncated sha256 keeps it
 * inside the `text` id columns without needing uuid formatting.
 */
export function cfId(...parts: Array<string | number>): string {
  const digest = createHash('sha256').update(parts.join('|')).digest('hex');
  return `${CF}${parts[0]}-${digest.slice(0, 24)}`;
}

/** Deterministic UUID-shaped id, for columns with a uuid type or format check. */
export function cfUuid(...parts: Array<string | number>): string {
  const h = createHash('sha256').update(`${CF}|${parts.join('|')}`).digest('hex');
  // RFC-4122 v4 shape (version nibble 4, variant nibble 8) so format checks pass.
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

/** Fixed instant — nothing in the fixture may read the wall clock. */
export const CF_EPOCH = new Date('2026-08-17T00:00:00.000Z');

// ---------------------------------------------------------------------------
// (3) Tenants and actors
// ---------------------------------------------------------------------------
export type CfRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface CfActor {
  id: string;
  email: string;
  role: CfRole;
  organizationId: string;
}

export interface CfTenant {
  id: string;
  name: string;
  owner: CfActor;
  admin: CfActor;
  reviewer: CfActor;
  member: CfActor;
}

function buildTenant(slug: string, name: string): CfTenant {
  const orgId = cfId('org', slug);
  const actor = (role: CfRole): CfActor => ({
    id: cfId('user', slug, role),
    email: `${slug}.${role.toLowerCase()}@crossflow.local`,
    role,
    organizationId: orgId,
  });
  return {
    id: orgId,
    name,
    owner: actor('OWNER'),
    admin: actor('ADMIN'),
    reviewer: {
      id: cfId('user', slug, 'REVIEWER'),
      email: `${slug}.reviewer@crossflow.local`,
      role: 'ADMIN',
      organizationId: orgId,
    },
    member: actor('MEMBER'),
  };
}

/** Primary tenant — the whole positive flow runs here. */
export const TENANT_A = buildTenant('alpha', 'Crossflow Alpha Sp. z o.o.');
/** Second tenant — exists only to prove denial without existence leakage. */
export const TENANT_B = buildTenant('beta', 'Crossflow Beta Sp. z o.o.');

export const ALL_TENANTS = [TENANT_A, TENANT_B];
export const ALL_ACTORS = ALL_TENANTS.flatMap((t) => [t.owner, t.admin, t.reviewer, t.member]);

// ---------------------------------------------------------------------------
// (4) Real JWT
// ---------------------------------------------------------------------------
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      `crossflow fixture: JWT_SECRET missing or <32 chars (${secret?.length ?? 0}) at mint time. ` +
        'Something overwrote it after this module loaded — import flowFixture.ts FIRST, before ' +
        'any server/src/* import.'
    );
  }
  return secret;
}

/**
 * Mints a token carrying exactly the claims `auth.middleware.attachUser()`
 * reads. Both spellings of the org claim are supplied because different
 * routers read different ones.
 */
export function mintToken(actor: CfActor, overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      id: actor.id,
      email: actor.email,
      organizationId: actor.organizationId,
      organization_id: actor.organizationId,
      role: actor.role,
      ...overrides,
    },
    jwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

export function bearer(actor: CfActor): string {
  return `Bearer ${mintToken(actor)}`;
}

export interface ApprovedSwotInitiativeLineage {
  toolSessionId: string;
  candidateId: string;
  initiativeId: string;
}

export async function seedTransformationContextForInitiative(
  client: pg.Client,
  initiativeId: string
): Promise<{ transformationCaseId: string; planId: string; runId: string }> {
  const ids = {
    transformationCaseId: cfId('case', initiativeId),
    planId: cfId('plan', initiativeId),
    runId: cfId('run', initiativeId),
    snapshotId: cfId('snapshot', initiativeId),
    lineageId: cfId('lineage', initiativeId),
  };
  const initiative = await client.query<{ project_id: string }>(
    `SELECT project_id FROM initiatives WHERE id=$1 AND organization_id=$2`,
    [initiativeId, TENANT_A.id]
  );
  const projectId = initiative.rows[0]?.project_id;
  if (!projectId) throw new Error('accepted initiative has no canonical project');
  for (const actor of [TENANT_A.owner, TENANT_A.admin]) {
    const projectRole = actor.id === TENANT_A.admin.id ? 'PROJECT_SPONSOR' : 'PROJECT_MANAGER';
    await client.query(
      `INSERT INTO project_members (project_id,user_id,project_role)
       VALUES($1,$2,$3) ON CONFLICT(project_id,user_id) DO UPDATE SET project_role=excluded.project_role`,
      [projectId, actor.id, projectRole]
    );
  }
  await client.query(
    `INSERT INTO v8_context_snapshots
      (snapshot_id,workspace_id,organization_id,project_id,execution_run_id,artifact_refs,
       effective_scope_ref,resolved_role_ref,initiator_user_id,consumer_class,source_context_refs,drift_events)
     VALUES($1,$2,$2,$3,$4,'[]',$5,'transformation_agent',$6,'execution','[]','[]')`,
    [ids.snapshotId, TENANT_A.id, projectId, ids.runId, `project:${projectId}`, TENANT_A.owner.id]
  );
  await client.query(
    `INSERT INTO v8_execution_runs
      (run_id,organization_id,context_snapshot_id,initiator_user_id,state,plan_version,goal,metadata)
     VALUES($1,$2,$3,$4,'planning',1,'Full transformation lineage',$5::jsonb)`,
    [ids.runId, TENANT_A.id, ids.snapshotId, TENANT_A.owner.id, JSON.stringify({ fixture: CF })]
  );
  await client.query(
    `INSERT INTO transformation_cases
      (transformation_case_id,organization_id,project_id,context_snapshot_id,execution_run_id,
       initiated_by_user_id,mandate,status,lifecycle_stage,lineage_id,idempotency_key,version)
     VALUES($1,$2,$3,$4,$5,$6,'Full transformation lineage','active','initial_ideas',$7,$8,1)`,
    [ids.transformationCaseId, TENANT_A.id, projectId, ids.snapshotId, ids.runId, TENANT_A.owner.id, ids.lineageId, cfId('idem', initiativeId)]
  );
  await client.query(
    `INSERT INTO transformation_plans
      (plan_id,transformation_case_id,organization_id,version,status,summary,created_by_user_id)
     VALUES($1,$2,$3,1,'approved','Approved test transformation plan',$4)`,
    [ids.planId, ids.transformationCaseId, TENANT_A.id, TENANT_A.owner.id]
  );
  await client.query(`UPDATE transformation_cases SET active_plan_id=$1 WHERE transformation_case_id=$2`, [
    ids.planId,
    ids.transformationCaseId,
  ]);
  await client.query(
    `INSERT INTO v8_agent_run_identities
      (canonical_run_id,organization_id,transformation_case_id,conversation_id,lineage_id)
     VALUES($1,$2,$3,NULL,$4)`,
    [ids.runId, TENANT_A.id, ids.transformationCaseId, ids.lineageId]
  );
  await client.query(
    `INSERT INTO transformation_case_artifact_links
      (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,artifact_id,lineage_role,created_by_user_id)
     VALUES($1,$2,$3,'initial_ideas','initiative',$4,'output',$5)`,
    [cfId('link', initiativeId), ids.transformationCaseId, TENANT_A.id, initiativeId, TENANT_A.owner.id]
  );
  return ids;
}

/**
 * Drives the real, mounted Tools and Initiative-candidate routers with a
 * signed ACTIVE-member token.  The helper deliberately leaves the accepted
 * Initiative in the canonical DRAFT state: later lifecycle steps must be
 * explicit production commands, never fixture-side status fabrication.
 */
export async function createApprovedSwotInitiative(
  client: pg.Client,
  suffix: string,
  actor: CfActor = TENANT_A.owner
): Promise<ApprovedSwotInitiativeLineage> {
  const toolSessionId = cfId('tool', `full-lineage-${suffix}`);
  // Tools' public contract accepts the stable recommendation key shape
  // `rec-<digits>`; the surrounding session id provides lineage uniqueness.
  const recommendationId = `rec-${Number.parseInt(createHash('sha256').update(suffix).digest('hex').slice(0, 6), 16)}`;
  await client.query(
    `INSERT INTO tool_sessions
       (id, organization_id, tool_type, name, status, approved_at, created_by)
     VALUES ($1, $2, 'dynamic-swot', $3, 'APPROVED', $4, $5)`,
    [toolSessionId, actor.organizationId, `Approved SWOT ${suffix}`, CF_EPOCH, actor.id]
  );

  const toolsRouter = (await import('../../../server/src/routes/tools.routes.js')).default;
  const candidatesRouter = (
    await import('../../../server/src/routes/initiativeCandidates.routes.js')
  ).default;
  const app = express();
  app.use(express.json());
  app.use('/api/tools', toolsRouter);
  app.use('/api/initiatives', candidatesRouter);

  const previousGate = process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL;
  process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL = 'true';
  try {
    const handoff = await request(app)
      .post(`/api/tools/${toolSessionId}/swot-candidates`)
      .set('Authorization', bearer(actor))
      .send({
        id: recommendationId,
        title: `Approved transformation ${suffix}`,
        rationale: 'Approved SWOT source for the full transformation lineage proof',
      });
    if (handoff.status !== 201 || !handoff.body?.candidate?.id) {
      throw new Error(`approved SWOT handoff failed: ${handoff.status} ${JSON.stringify(handoff.body)}`);
    }
    const candidateId = String(handoff.body.candidate.id);
    const accepted = await request(app)
      .post(`/api/initiatives/candidates/${candidateId}/accept`)
      .set('Authorization', bearer(actor))
      .send({ fill: false });
    if (accepted.status !== 200 || accepted.body?.accepted !== true || !accepted.body?.initiativeId) {
      throw new Error(`candidate acceptance failed: ${accepted.status} ${JSON.stringify(accepted.body)}`);
    }
    return { toolSessionId, candidateId, initiativeId: String(accepted.body.initiativeId) };
  } finally {
    if (previousGate === undefined) delete process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL;
    else process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL = previousGate;
  }
}

// ---------------------------------------------------------------------------
// (5) Database access
// ---------------------------------------------------------------------------
export function requireDbUrl(): string {
  const url = process.env.DATABASE_URL || process.env.IE_TEST_DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `crossflow fixture requires a LOCAL disposable DATABASE_URL. Got: ${url || '(unset)'}`
    );
  }
  return url;
}

export function newClient(): pg.Client {
  return new pg.Client({ connectionString: requireDbUrl(), statement_timeout: 30_000 });
}

/**
 * COLD READBACK. Opens a brand-new client (new TCP connection, new backend
 * process, nothing shared with the writer's pool), runs `fn`, then closes it.
 * Any value that survives this genuinely came from disk, not from an
 * in-process map, a memoized service singleton or a warm pool's session state.
 */
export async function coldRead<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = newClient();
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** True when a disposable local Postgres is actually reachable. */
export async function dbReachable(): Promise<boolean> {
  let client: pg.Client | null = null;
  try {
    client = newClient();
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client?.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// (6) Seeding and teardown
// ---------------------------------------------------------------------------
/**
 * Creates both tenants and their three actors each. Idempotent: safe to call
 * from several suites against the same database.
 *
 * `organization_members.role` is CHECK-constrained to
 * OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST — the three roles used here are the
 * ones the RBAC middleware actually distinguishes for maker/checker.
 */
export async function seedTenants(client: pg.Client): Promise<void> {
  for (const tenant of ALL_TENANTS) {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, created_at)
       VALUES ($1, $2, 'enterprise', 'active', $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [tenant.id, tenant.name, CF_EPOCH]
    );
  }

  for (const actor of ALL_ACTORS) {
    await client.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       ON CONFLICT (id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         email = EXCLUDED.email,
         role = EXCLUDED.role`,
      [
        actor.id,
        actor.organizationId,
        actor.email,
        'Crossflow',
        actor.role,
        actor.role,
        CF_EPOCH,
      ]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
       ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [cfId('member', actor.id), actor.organizationId, actor.id, actor.role, CF_EPOCH]
    );
  }
}

/**
 * Synthetic test-only prerequisite for the ROI owner. This is deliberately
 * not a business step and never invents a production default: a signed ACTIVE
 * ADMIN calls the canonical policy publisher on this suite's pinned client.
 *
 * AMD-FLOW-ROI-VISIBILITY-002 STATUS (closure-b F2): this function is now
 * ONLY a workaround for a SEPARATE, still-open gap it does not fix —
 * `createRoiCase` (roiCaseCommands.ts) fails closed on
 * `RoiCaseNoActiveVisibilityPolicyError` unless an active
 * `rvn_platform_visibility_policies` row exists for `domain='roi'`, and NO
 * production writer for that row exists anywhere in this codebase (the
 * only other caller of `publishVisibilityPolicy` is OKR's `publishProgram`,
 * `domain='okr'`) — verified by F2's Phase 1 grep, confirmed independently
 * by the packet lead. This function remains ONLY so `createRoiCase`'s
 * internal call (via `closureReceiptRoiCaseAdapter.ts`, invoked by this
 * suite's closure-delivery worker) does not fail closed here in the test.
 * It is NOT the release-qualification policy the owner decision asked for
 * — see `provisionRoiGovernedVisibilityPolicy` below for that, which gates
 * the actual READ path (`resolveRoiGovernedVisibility`,
 * `GET /cases`/`GET /cases/:caseId`) this suite also now exercises for
 * real. Whether the OLD `domain='roi'` policy path should ever get a real
 * production writer — and if so whether it should be THIS command or
 * something else — is OWNER DECISION REQUIRED (F2 escalation (b)); this
 * function is deliberately left exactly as it was, not resolved as a side
 * effect of this packet.
 */
export async function provisionSyntheticRoiVisibilityPolicy(
  client: pg.Client,
  actor: CfActor,
  organizationId: string
): Promise<{ policyId: string; policyVersion: string; fixtureKind: 'SYNTHETIC_TEST_ONLY' }> {
  if (actor.organizationId !== organizationId || actor.role !== 'ADMIN')
    throw new Error('FLOW synthetic ROI policy requires same-tenant ADMIN');
  const encoded = bearer(actor).replace(/^Bearer /, '');
  const claims = jwt.verify(encoded, process.env.JWT_SECRET || PINNED_JWT_SECRET) as jwt.JwtPayload;
  if (String(claims.id ?? claims.sub ?? '') !== actor.id)
    throw new Error('FLOW synthetic ROI policy signed actor mismatch');
  const membership = await client.query(
    `SELECT 1 FROM organization_members
      WHERE organization_id=$1 AND user_id=$2 AND role='ADMIN' AND UPPER(status)='ACTIVE'`,
    [organizationId, actor.id]
  );
  if (membership.rowCount !== 1) throw new Error('FLOW synthetic ROI policy ACTIVE membership required');

  const { publishVisibilityPolicy } = await import(
    '../../../server/src/services/resultsVnext/platform/visibilityResolver.js'
  );
  await client.query('BEGIN');
  try {
    const policy = await publishVisibilityPolicy(client, {
      organizationId,
      domain: 'roi',
      mode: 'OPEN_ORG',
      publishedBy: actor.id,
    });
    const readback = await client.query<{
      policy_id: string;
      policy_version: number;
      visibility_mode: string;
      created_by: string;
    }>(
      `SELECT policy_id,policy_version,visibility_mode,created_by
         FROM rvn_platform_visibility_policies
        WHERE policy_id=$1 AND organization_id=$2 AND domain='roi' AND is_active=true`,
      [policy.policyId, organizationId]
    );
    if (
      readback.rowCount !== 1 ||
      readback.rows[0]?.created_by !== actor.id ||
      readback.rows[0]?.visibility_mode !== 'OPEN_ORG' ||
      String(readback.rows[0]?.policy_version) !== policy.policyVersion
    ) throw new Error('FLOW synthetic ROI policy exact audit/readback failed');
    await client.query('COMMIT');
    return { ...policy, fixtureKind: 'SYNTHETIC_TEST_ONLY' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/**
 * AMD-FLOW-ROI-VISIBILITY-002 — the REAL, production-capable governance
 * command (server/src/services/resultsVnext/platform/visibilityResolver.ts,
 * `publishRoiGovernedVisibilityPolicy`), called through this suite's own
 * pinned JWT actor exactly the way a real OWNER/ADMIN would from the route
 * layer — NOT a raw SQL insert, NOT a bypass. This is what
 * `resolveRoiGovernedVisibility` (and, through it, `GET /cases` /
 * `GET /cases/:caseId`) actually checks. Unlike
 * `provisionSyntheticRoiVisibilityPolicy` above, this is the intended
 * production path, not a test-only workaround.
 */
export async function provisionRoiGovernedVisibilityPolicy(
  actor: CfActor,
  organizationId: string
): Promise<{
  outcome: 'applied' | 'replayed';
  publication: { organizationId: string; publishedBy: string; publishedAt: string; policyKey: string };
}> {
  const { publishRoiGovernedVisibilityPolicy, ROI_GOVERNED_VISIBILITY_POLICY } = await import(
    '../../../server/src/services/resultsVnext/platform/visibilityResolver.js'
  );
  return publishRoiGovernedVisibilityPolicy({
    organizationId,
    actorUserId: actor.id,
    policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
    policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
    idempotencyKey: cfId('roi-governed-visibility-publish', organizationId, actor.id),
  });
}

/**
 * Deletes every row this lane created, in FK-safe order, and returns the
 * per-table delete counts so a suite can assert ZERO residue instead of
 * trusting that cleanup ran. Unknown/absent tables are skipped rather than
 * failing — the table list is a superset covering all cross-flow segments.
 */
export async function purgeFixture(
  client: pg.Client,
  tables: string[]
): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};
  for (const table of tables) {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [table]
    );
    if (exists.rowCount === 0) continue;

    const orgCol = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
          AND column_name IN ('organization_id','org_id','tenant_id')
        ORDER BY column_name LIMIT 1`,
      [table]
    );
    if (orgCol.rowCount === 0) continue;

    const col = orgCol.rows[0].column_name as string;
    const res = await client.query(
      `DELETE FROM "${table}" WHERE "${col}" = ANY($1::text[])`,
      [ALL_TENANTS.map((t) => t.id)]
    );
    deleted[table] = res.rowCount ?? 0;
  }
  return deleted;
}

/** Exact, disposable-only cleanup for the Results/Finance/PIR leg.  The ROI
 * schema contains intentional FK pointer cycles (case -> approved snapshot ->
 * case), so row-order alone cannot clean a completed case.  A transaction-
 * local replica role is used only after the flow_* guard and advisory lock;
 * every delete remains tenant-scoped and the session/trigger state is proved
 * restored after commit. */
export async function purgeResultsLineageFixture(client: pg.Client): Promise<void> {
  if (process.env.FLOW_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1')
    throw new Error('FLOW Results cleanup requires explicit opt-in');
  const db = await client.query<{ current_database: string }>('SELECT current_database()');
  const actualDb = String(db.rows[0]?.current_database ?? '');
  const callerDb = new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  const requiredPrefix = process.env.FLOW_DISPOSABLE_DB_PREFIX ?? '';
  if (!requiredPrefix || callerDb !== actualDb || !actualDb.startsWith(requiredPrefix) || !/^flow_[a-z0-9_]+$/.test(actualDb))
    throw new Error('FLOW Results cleanup requires a flow_* disposable database');
  const tables = [
    'rvn_finance_reconciliation_decisions', 'rvn_finance_reconciliation_grant_events',
    // AMD-FLOW-ROI-VISIBILITY-002 — same append-only shape as the line above
    // (BEFORE UPDATE OR DELETE trigger, RAISE EXCEPTION), cleaned the exact
    // same sanctioned way: this function's own `session_replication_role=
    // 'replica'` transaction-scoped escape hatch (line below), already gated
    // behind FLOW_ALLOW_IMMUTABLE_FIXTURE_CLEANUP + the flow_* disposable-db
    // check above — never a persistent ALTER TABLE ... DISABLE TRIGGER.
    'rvn_roi_visibility_governance',
    'rvn_roi_variance_causes', 'rvn_roi_scenario_overrides', 'rvn_roi_finance_projections',
    'rvn_roi_variances', 'rvn_roi_actual_entries', 'rvn_roi_actual_snapshots',
    'rvn_roi_approval_snapshots', 'rvn_roi_benefit_evidence_links', 'rvn_roi_calculation_runs',
    'rvn_roi_forecast_versions', 'rvn_roi_post_investment_reviews', 'rvn_roi_finance_reconciliations',
    'rvn_roi_finance_links', 'rvn_roi_assumptions', 'rvn_roi_baselines', 'rvn_roi_benefit_lines',
    'rvn_roi_calculation_policy', 'rvn_roi_cost_lines', 'rvn_roi_scenarios',
    'rvn_platform_events',
    'rvn_platform_obligations', 'rvn_platform_resource_visibility', 'rvn_roi_cases',
    'rvn_platform_visibility_policies', 'closure_delivery_receipts', 'initiative_benefits',
    'initiative_handoffs', 'initiative_schedule_baselines',
  ];
  await client.query('BEGIN');
  try {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('flow-results-lineage-cleanup'))`);
    await client.query(`SET LOCAL session_replication_role='replica'`);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN
        (SELECT event_id FROM rvn_platform_events WHERE organization_id=ANY($1::text[]))`,
      [ALL_TENANTS.map((tenant) => tenant.id)]
    );
    await client.query(
      `DELETE FROM rvn_platform_resource_acl WHERE resource_id IN
        (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id=ANY($1::text[]))`,
      [ALL_TENANTS.map((tenant) => tenant.id)]
    );
    await client.query(`DELETE FROM audit_events WHERE org_id=ANY($1::text[])`, [ALL_TENANTS.map((tenant) => tenant.id)]);
    await purgeFixture(client, tables);
    await client.query(`SET LOCAL session_replication_role='origin'`);
    const residue = await client.query<{ total: string }>(
      `SELECT (${tables.map((table) => `(SELECT count(*) FROM "${table}" WHERE organization_id=ANY($1::text[]))`).join(' + ')} +
        (SELECT count(*) FROM audit_events WHERE org_id=ANY($1::text[])) +
        (SELECT count(*) FROM rvn_platform_outbox WHERE event_id IN
          (SELECT event_id FROM rvn_platform_events WHERE organization_id=ANY($1::text[]))))::text total`,
      [ALL_TENANTS.map((tenant) => tenant.id)]
    );
    if (residue.rows[0]?.total !== '0') throw new Error(`FLOW Results fixture residue ${residue.rows[0]?.total}`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  const state = await client.query<{ role: string; disabled: string; expected_enabled: string; advisory: string }>(
    `SELECT current_setting('session_replication_role') role,
      (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled<>'O'
        AND tgrelid::regclass::text = ANY($1::text[])) disabled,
      (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O'
        AND tgname=ANY($2::text[])) expected_enabled,
      (SELECT count(*)::text FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()) advisory`,
    [tables, [
      'trg_rvn_fin_reconciliation_grant_insert_guard',
      'trg_rvn_fin_reconciliation_decision_append_only',
      'trg_rvn_fin_reconciliation_grant_append_only',
    ]]
  );
  if (state.rows[0]?.role !== 'origin' || state.rows[0]?.disabled !== '0' ||
      state.rows[0]?.expected_enabled !== '3' || state.rows[0]?.advisory !== '0')
    throw new Error('FLOW Results cleanup did not restore trigger/session state');
}

/**
 * Removes the append-only lifecycle-gate rows owned by this fixture.  This is
 * deliberately unavailable unless the caller opts in and the server confirms
 * a disposable FLOW database name.  The named production trigger is restored
 * in the same pinned transaction; rollback is the only failure outcome.
 */
export async function purgeImmutableLifecycleGateFixture(client: pg.Client): Promise<void> {
  if (process.env.FLOW_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1')
    throw new Error('FLOW immutable fixture cleanup requires explicit opt-in');
  const db = await client.query<{ current_database: string }>('SELECT current_database()');
  const actualDb = String(db.rows[0]?.current_database ?? '');
  const callerDb = new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  const requiredPrefix = process.env.FLOW_DISPOSABLE_DB_PREFIX ?? '';
  if (!requiredPrefix || callerDb !== actualDb || !actualDb.startsWith(requiredPrefix) || !/^flow_[a-z0-9_]+$/.test(actualDb))
    throw new Error('FLOW immutable fixture cleanup requires a flow_* disposable database');
  await client.query('BEGIN');
  try {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('flow-full-lineage-cleanup'))`);
    const trigger = await client.query<{ tgenabled: string }>(
      `SELECT tgenabled FROM pg_trigger
        WHERE tgrelid='initiative_lifecycle_gate_decisions'::regclass
          AND tgname='initiative_lifecycle_gate_decisions_immutable' AND NOT tgisinternal`
    );
    if (trigger.rows[0]?.tgenabled !== 'O') throw new Error('FLOW lifecycle trigger is not enabled');
    await client.query(
      `ALTER TABLE initiative_lifecycle_gate_decisions DISABLE TRIGGER initiative_lifecycle_gate_decisions_immutable`
    );
    await client.query(
      `DELETE FROM initiative_lifecycle_gate_decisions WHERE organization_id = ANY($1::text[])`,
      [ALL_TENANTS.map((tenant) => tenant.id)]
    );
    await client.query(
      `ALTER TABLE initiative_lifecycle_gate_decisions ENABLE TRIGGER initiative_lifecycle_gate_decisions_immutable`
    );
    await client.query(
      `DELETE FROM v8_agent_proposal_governance_events e USING v8_agent_proposal_versions p
        WHERE e.proposal_version_id=p.proposal_version_id AND p.organization_id=ANY($1::text[])`,
      [ALL_TENANTS.map((tenant) => tenant.id)]
    );
    await client.query(
      `DELETE FROM v8_agent_proposal_scope_reviews r USING v8_agent_proposal_versions p
        WHERE r.proposal_version_id=p.proposal_version_id AND p.organization_id=ANY($1::text[])`,
      [ALL_TENANTS.map((tenant) => tenant.id)]
    );
    await client.query(
      `DELETE FROM v8_agent_proposal_versions WHERE organization_id=ANY($1::text[])`,
      [ALL_TENANTS.map((tenant) => tenant.id)]
    );
    const restored = await client.query<{ tgenabled: string }>(
      `SELECT tgenabled FROM pg_trigger
        WHERE tgrelid='initiative_lifecycle_gate_decisions'::regclass
          AND tgname='initiative_lifecycle_gate_decisions_immutable' AND NOT tgisinternal`
    );
    if (restored.rows[0]?.tgenabled !== 'O') throw new Error('FLOW lifecycle trigger restore failed');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  const postCommit = await client.query<{ tgenabled: string; advisory: string }>(
    `SELECT t.tgenabled,
       (SELECT count(*)::text FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()) advisory
       FROM pg_trigger t
      WHERE t.tgrelid='initiative_lifecycle_gate_decisions'::regclass
        AND t.tgname='initiative_lifecycle_gate_decisions_immutable' AND NOT t.tgisinternal`
  );
  if (postCommit.rows[0]?.tgenabled !== 'O' || postCommit.rows[0]?.advisory !== '0')
    throw new Error('FLOW lifecycle cleanup post-commit trigger/advisory state invalid');
}

/** Final teardown of tenants/actors themselves. Call after `purgeFixture`. */
export async function dropTenants(client: pg.Client): Promise<void> {
  await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [
    ALL_TENANTS.map((t) => t.id),
  ]);
  await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [ALL_ACTORS.map((a) => a.id)]);
  await client.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [
    ALL_TENANTS.map((t) => t.id),
  ]);
}

// ---------------------------------------------------------------------------
// (7) Assertion helpers shared across the 15 segments
// ---------------------------------------------------------------------------
/**
 * Runs `n` copies of `op` truly concurrently and reports an EXACT denominator:
 * how many attempts were made, how many succeeded, how many were rejected and
 * why. A concurrency claim without this breakdown is unfalsifiable.
 */
export async function raceExactly<T>(
  n: number,
  op: (attempt: number) => Promise<T>
): Promise<{ attempts: number; fulfilled: T[]; rejected: string[] }> {
  const results = await Promise.allSettled(Array.from({ length: n }, (_, i) => op(i)));
  return {
    attempts: n,
    fulfilled: results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
    rejected: results.flatMap((r) =>
      r.status === 'rejected' ? [String((r.reason as Error)?.message ?? r.reason)] : []
    ),
  };
}

/**
 * Cross-tenant denial must not leak existence: a foreign object has to look
 * exactly like a nonexistent one. Returns the pair of statuses so the suite can
 * assert equality rather than merely "not 200".
 */
export function existenceLeak(foreignStatus: number, nonexistentStatus: number): boolean {
  return foreignStatus !== nonexistentStatus;
}
