/**
 * Case Workspace CONTRACT test harness — real router, real services, REAL
 * PostgreSQL. No service is mocked.
 *
 * ===========================================================================
 * WHY THIS EXISTS (read before "improving" it)
 * ===========================================================================
 * The 11 sibling suites in `server/src/routes/caseWorkspace/__tests__/*.test.ts`
 * mount each router with `vi.mock(...)` over its domain service. Those prove
 * the ROUTE's own contract (zod rejection, status mapping, actor threading)
 * and nothing else: a mocked `createCase` returns whatever the test says, so
 * they cannot tell you whether the endpoint works. They are useful and they
 * stay — this directory is the layer above them.
 *
 * Here the SAME `caseWorkspaceRoutes` aggregator is mounted with the real
 * services behind it and a real Postgres underneath, so an assertion about a
 * status code is an assertion about the whole stack: zod → route auth →
 * service → SQL → outbox → error mapping → HTTP.
 *
 * ---------------------------------------------------------------------------
 * The ONE thing that is substituted, and why it is not a mock of the system
 * ---------------------------------------------------------------------------
 * In production the chain in front of this router is
 * `verifyToken` → `requireV8OrgContext` → `attachV8Context`
 * (server/src/routes/v8/index.ts:55-56, 83), whose only product is
 * `req.v8Context = { organizationId, userId, userRole, isSuperAdmin }`.
 * `createContractApp()` sets that same object directly, which is what minting
 * a real JWT would produce — it substitutes the CREDENTIAL, not any behaviour
 * under test. Everything authorization-related that this codebase actually
 * enforces (`requireOrgMember` / `requireOrgRole` / `requireCaseAccess` in
 * caseWorkspaceAuthContext.ts) still runs for real against real
 * `organization_members` rows, which is why the cross-tenant tests in this
 * directory are meaningful: a user with no ACTIVE membership row genuinely
 * fails closed here.
 *
 * ---------------------------------------------------------------------------
 * GATE — never a silent pass on a mock database
 * ---------------------------------------------------------------------------
 * `NODE_ENV=test` alone is a trap: `Database.ts` hands back an in-memory MOCK
 * unless `RUN_DB_TESTS === '1' && MOCK_DB === 'false'`, and every write
 * becomes a no-op while the suite goes green. `isContractDbReachable()` gates
 * on those env vars AND probes that the migrated tables are present, and the
 * suites SKIP LOUDLY when they are not.
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://... \
 *   npx vitest run src/routes/caseWorkspace/__tests__/contract --environment node
 *
 * ---------------------------------------------------------------------------
 * ISOLATION
 * ---------------------------------------------------------------------------
 * Every fixture id is namespaced with `randomUUID()`, and every test seeds and
 * tears down its own organization. `case_core.project_id` is UNIQUE, so a
 * fixture shared across tests would let one test poison the next. Readback
 * assertions go through the out-of-band `control` pool, never through the
 * service's own return value.
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import { Pool } from 'pg';

import caseWorkspaceRoutes from '../../index.js';
import { errorHandlerMiddleware } from '../../../../utils/ErrorHandler.js';

export const CONNECTION_STRING = process.env.DATABASE_URL ?? '';

export const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

/** Tables every contract suite in this directory touches, directly or transitively. */
const REQUIRED_TABLES = [
  'organizations',
  'organization_members',
  'projects',
  'users',
  'case_core',
  'case_plan_versions',
  'case_workspace_run_bindings',
  'case_workspace_action_proposals',
  'case_workspace_action_proposal_decisions',
  'case_workspace_waits',
  'case_workspace_history_events',
  'case_workspace_value_measurements',
  'case_workspace_artifact_links',
  'case_workspace_event_outbox',
];

/**
 * Reachability AND schema presence, decided once before a suite is declared.
 * Returns false (never throws) so a suite can turn itself into `describe.skip`.
 */
export async function isContractDbReachable(): Promise<boolean> {
  if (!REAL_DB_REQUESTED) return false;
  const probe = new Pool({ connectionString: CONNECTION_STRING, max: 1, connectionTimeoutMillis: 4000 });
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

export function warnSkipped(suiteName: string, reachable: boolean): void {
  if (reachable) return;
  // eslint-disable-next-line no-console
  console.warn(
    `[${suiteName} SKIPPED — clean skip, not a pass] needs DB_TYPE=postgres NODE_ENV=test ` +
      `RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL and the case-workspace migrations ` +
      `applied. requested=${REAL_DB_REQUESTED}`
  );
}

export interface ContractActor {
  organizationId: string;
  userId: string;
  userRole: string;
  isSuperAdmin: boolean;
}

/**
 * The real aggregator router, mounted exactly where production mounts it, with
 * `req.v8Context` pre-populated (see this file's header for why that is a
 * credential substitution and not a mock).
 */
export function createContractApp(actor: ContractActor): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = { ...actor };
    next();
  });
  app.use('/api/v8/case-workspace', caseWorkspaceRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

// ---------------------------------------------------------------------------
// Fixtures — direct INSERTs on an out-of-band pool. Test-only, never a
// production code path (no caseWorkspace service writes users/members/projects).
// ---------------------------------------------------------------------------

export interface Fixture {
  orgId: string;
  projectId: string;
  /** MEMBER-role actor — the default caller for case-scoped routes. */
  memberUserId: string;
  /** ADMIN-role actor — required by the platform-global (registry/flags) routes. */
  adminUserId: string;
}

export class ContractFixtures {
  constructor(private readonly control: Pool) {}

  private readonly orgIds = new Set<string>();
  private readonly projectIds = new Set<string>();
  private readonly userIds = new Set<string>();

  async seedOrg(label: string): Promise<string> {
    const orgId = `cw-contract-org-${label}-${randomUUID()}`;
    await this.control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      orgId,
      `CW contract org (${label})`,
    ]);
    this.orgIds.add(orgId);
    return orgId;
  }

  async seedProject(orgId: string, label: string): Promise<string> {
    const projectId = `cw-contract-project-${label}-${randomUUID()}`;
    await this.control.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)`,
      [projectId, orgId, `CW contract project (${label})`]
    );
    this.projectIds.add(projectId);
    return projectId;
  }

  async seedUser(orgId: string, label: string): Promise<string> {
    const userId = `cw-contract-user-${label}-${randomUUID()}`;
    await this.control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    this.userIds.add(userId);
    return userId;
  }

  async seedMembership(
    orgId: string,
    userId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
    status: 'ACTIVE' | 'REVOKED' | 'SUSPENDED' = 'ACTIVE'
  ): Promise<void> {
    await this.control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, $5)`,
      [`cw-contract-member-${randomUUID()}`, orgId, userId, role, status]
    );
  }

  /**
   * A `v8_execution_runs` row. `runBindingService.bindRunToPlanVersion` does a
   * read-only existence check against this table and throws `run_not_found`
   * when it is absent (runBindingService.ts:210-215), so a run binding cannot
   * be created for an invented runId. It never writes this table, so seeding it
   * directly here is a fixture, not a bypass of the code under test.
   */
  async seedExecutionRun(orgId: string, initiatorUserId: string, label: string): Promise<string> {
    const runId = `cw-contract-run-${label}-${randomUUID()}`;
    await this.control.query(
      `INSERT INTO v8_execution_runs (run_id, organization_id, context_snapshot_id, initiator_user_id, state, plan_version, goal)
         VALUES ($1, $2, $3, $4, 'drafting', 1, $5)`,
      [runId, orgId, `cw-contract-ctx-${randomUUID()}`, initiatorUserId, `CW contract run (${label})`]
    );
    this.runIds.add(runId);
    return runId;
  }

  private readonly runIds = new Set<string>();

  /** One org + one project + a MEMBER actor + an ADMIN actor, all ACTIVE. */
  async seedFixture(label: string): Promise<Fixture> {
    const orgId = await this.seedOrg(label);
    const projectId = await this.seedProject(orgId, label);
    const memberUserId = await this.seedUser(orgId, `${label}-member`);
    await this.seedMembership(orgId, memberUserId, 'MEMBER');
    const adminUserId = await this.seedUser(orgId, `${label}-admin`);
    await this.seedMembership(orgId, adminUserId, 'ADMIN');
    return { orgId, projectId, memberUserId, adminUserId };
  }

  /**
   * Deletes everything this instance created. The outbox has ZERO foreign keys
   * by design (an audit record outlives the thing it describes), so nothing
   * cascades it away — it is deleted explicitly, per org, before the org row.
   */
  async teardown(): Promise<void> {
    for (const runId of this.runIds) {
      await this.control
        .query(`DELETE FROM case_workspace_run_bindings WHERE run_id = $1`, [runId])
        .catch(() => undefined);
      await this.control.query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [runId]).catch(() => undefined);
    }
    for (const projectId of this.projectIds) {
      await this.control
        .query(
          `DELETE FROM case_workspace_waits WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
          [projectId]
        )
        .catch(() => undefined);
      await this.control
        .query(
          `DELETE FROM case_workspace_action_proposals WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
          [projectId]
        )
        .catch(() => undefined);
      // Ordered by FK: run bindings (already dropped in the runIds loop above)
      // reference case_plan_versions, which references case_core.
      await this.control
        .query(
          `DELETE FROM case_workspace_run_bindings WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
          [projectId]
        )
        .catch(() => undefined);
      await this.control
        .query(
          `DELETE FROM case_plan_versions WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
          [projectId]
        )
        .catch(() => undefined);
      await this.control.query(`DELETE FROM case_core WHERE project_id = $1`, [projectId]).catch(() => undefined);
      await this.control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    }
    for (const userId of this.userIds) {
      await this.control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    }
    for (const orgId of this.orgIds) {
      await this.control
        .query(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [orgId])
        .catch(() => undefined);
      await this.control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
    }
    this.runIds.clear();
    this.projectIds.clear();
    this.userIds.clear();
    this.orgIds.clear();
  }
}

/** The smallest graph `casePlanVersionService.createPlanDraft` accepts. */
export function minimalGraph(): Record<string, unknown> {
  return {
    schemaVersion: '1.0',
    graphId: `graph-${randomUUID()}`,
    entryNodeIds: ['start'],
    terminalNodeIds: ['end'],
    nodes: [
      { nodeId: 'start', type: 'START' },
      { nodeId: 'end', type: 'END' },
    ],
    edges: [{ edgeId: 'e1', sourceNodeId: 'start', targetNodeId: 'end', edgeType: 'SEQUENCE' }],
    variables: [],
  };
}
