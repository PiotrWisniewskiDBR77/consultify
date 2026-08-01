/**
 * Public demo signup provisioning (OPS-DEMO-002).
 *
 * Creating a public demo account touches seven stores that have no shared
 * transaction: the org row, the user row, the membership row, legal acceptance,
 * user preferences, the isolated session tenant (its own org + a full seeded
 * dataset + two bookkeeping tables), and the refresh-token family. A plain
 * `try/catch` around them leaves the address permanently unusable when a late
 * step fails — the account exists, so every retry is rejected as a duplicate,
 * while no workspace was ever provisioned.
 *
 * This module runs those steps as a saga:
 *
 *  1. EVERY compensation is registered BEFORE the forward step it undoes. A step
 *     that writes one row and then throws on the next statement (legalService
 *     writes one acceptance per document; the preferences step writes
 *     `demo:enabled`, `demo:started_at`, then three markers) would otherwise
 *     leave that partial write behind, because the compensation was never
 *     pushed. Registering first costs nothing: an undo whose forward step never
 *     ran deletes zero rows and verifies clean.
 *  2. A failure unwinds them in reverse order.
 *  3. Every compensation is READ BACK to confirm it actually removed the row.
 *     Compensation that cannot be verified is reported as incomplete rather than
 *     assumed — a silent half-rollback is the failure mode that produced the
 *     dead accounts in the first place.
 *
 * TENANT IDENTITY. The saga mints its own `runId` and derives the session tenant
 * org id from it, so the tenant this run creates is named by a value nothing else
 * in the system can produce. Cleanup therefore deletes an exact id and never a
 * `LIKE` prefix. The previous implementation swept
 * `${DEMO_ORG_ID}-session-<first 10 alphanumerics of the user id>-%`, which is
 * wrong twice: two user ids collide on 10 characters (one signup's rollback
 * could delete another prospect's live workspace), and the value was
 * interpolated into a `LIKE` pattern without escaping `%`/`_`.
 *
 * The collaborators are injected so fault injection in tests does not need a
 * production backdoor.
 */
import { v4 as uuidv4 } from 'uuid';

import { setUserDemoPreference } from '../../middleware/demoGuard.middleware.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import legalService from '../legalService.js';
import refreshTokenService from '../RefreshTokenService.js';
import { deleteDemoDatasetForOrganization } from './demoSeedService.js';
import { type DemoSessionRecord, resolveOrCreateDemoSession } from './demoSessionService.js';

/**
 * Role granted to a public `Try demo` signup.
 *
 * Constraints this value has to satisfy simultaneously:
 *  - it must NOT be OWNER/ADMIN/SUPERADMIN — a public signup must never reach the
 *    organization-administration lane (`adminP32` admits OWNER/ADMIN);
 *  - it must be accepted by the `organization_members.role` CHECK constraint,
 *    which allows only OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST
 *    (server/migrations/20260412_organization_switch_log.sql). A value outside
 *    that set makes the membership INSERT fail — silently, because `run()`
 *    defaults to `fallback: true`;
 *  - it must NOT be pilot-restricted. `normalizeAppRole` folds MEMBER/TEAM_MEMBER
 *    into the USER band, and `isPilotRestrictedRole` then hides most of the
 *    product (RouterSync bounces every route outside PILOT_ALLOWED_ROUTE_PREFIXES
 *    and the sidebar collapses to six items) — a crippled demo.
 *
 * CONSULTANT is the only value that satisfies all three: it is in the CHECK set,
 * it carries no admin capability, and it is listed in STAFF_EXEMPT_FROM_PILOT
 * (src/utils/roleGuards.ts, mirrored server-side in initiativeGovernanceGuard).
 */
export const DEMO_SIGNUP_ROLE = 'CONSULTANT';

/** Roles a public demo signup must never hold. Asserted by the contract tests. */
export const FORBIDDEN_DEMO_SIGNUP_ROLES = ['SUPERADMIN', 'SUPER_ADMIN', 'OWNER', 'ADMIN'];

/**
 * Durable marker for "this principal was minted by the public demo entry".
 *
 * Deliberately NOT derived from `demo_sessions.source`: that column is
 * client-supplied on `/api/demo/toggle`, and it is rewritten to `status_refresh`
 * the moment `resolveOrCreateDemoSession` re-creates an expired session — so the
 * provenance would evaporate exactly when the lifetime guard needs it.
 */
export const DEMO_ENTRY_SOURCE_PREF_KEY = 'demo:entry_source';
export const PUBLIC_DEMO_ENTRY_SOURCE = 'register_demo';

/**
 * Durable ownership marker for the tenant a single saga run created.
 *
 * HOME: `user_preferences`, not `demo_session_tenants`.
 *
 * `demo_session_tenants` looks like the natural ledger — it is literally the
 * tenant table — but its production schema (server/src/database/PostgresDatabase.ts)
 * declares `FOREIGN KEY(session_id) REFERENCES demo_sessions(id)` and
 * `FOREIGN KEY(tenant_org_id) REFERENCES organizations(id)`. A claim row written
 * BEFORE the tenant is seeded would therefore be rejected: at that instant
 * neither the `demo_sessions` row nor the org row exists. That is precisely the
 * window this marker has to cover, so the FK-constrained table cannot host it.
 *
 * `user_preferences` is an unconstrained `(user_id, key)` key/value store which
 * already carries the demo session bookkeeping (`demo:session_org_id` and
 * friends, written by demoSessionService). The saga writes both markers in the
 * `set_demo_preferences` step, which runs BEFORE `start_demo_session` — so if the
 * process dies after the tenant org has been seeded but before the
 * `demo_sessions` row exists, the marker still names the exact org id to
 * reclaim, and `server/scripts/cleanup-orphan-demo-orgs.ts --run-id <runId>` can
 * delete that one tenant and nothing else.
 */
export const PROVISION_RUN_ID_PREF_KEY = 'demo:provision_run_id';
export const PROVISION_TENANT_ORG_PREF_KEY = 'demo:provision_tenant_org_id';

/** Infix that marks a session tenant owned by a provisioning run. */
export const PROVISION_TENANT_INFIX = '-session-run-';

/**
 * Tenant org id for one provisioning run.
 *
 * Carries the FULL run id (a uuid with its separators stripped), so the id is
 * globally unique by construction and can be matched with `=` instead of `LIKE`.
 * The `${baseOrgId}-session-` prefix is preserved because the rest of the
 * product recognises ephemeral demo tenants by it (superadminSeedFilter,
 * demoService reclamation, the operator cleanup script).
 */
export function makeProvisionTenantOrgId(baseOrgId: string, runId: string): string {
  const compact = String(runId).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'run';
  return `${baseOrgId}${PROVISION_TENANT_INFIX}${compact}`;
}

export interface CompensationStep {
  step: string;
  ok: boolean;
  /** True when a read-back confirmed the row is gone. */
  verified: boolean;
  error?: string;
}

export interface CompensationReport {
  /** False when any compensation failed or could not be verified. */
  complete: boolean;
  steps: CompensationStep[];
}

export interface ProvisionSuccess {
  ok: true;
  /** Unique id of this provisioning run; owns `tenantOrgId`. */
  runId: string;
  userId: string;
  organizationId: string;
  /** The isolated tenant this run created (equals the base org only in DEMO_USE_BASE_ORG mode). */
  tenantOrgId: string;
  session: DemoSessionRecord;
  tokens: { accessToken: string; refreshToken: string };
}

export interface ProvisionFailure {
  ok: false;
  /** Unique id of this provisioning run — the handle for manual cleanup. */
  runId: string;
  /** Tenant org id this run owned, whether or not it was ever created. */
  tenantOrgId: string;
  userId: string;
  failedStep: string;
  error: string;
  compensation: CompensationReport;
  /**
   * True when every compensation was verified: nothing the signup created
   * survives, so the same address can be retried immediately. False means rows
   * may remain and an operator has to reclaim them (`runId` names the tenant).
   */
  retrySafe: boolean;
}

export type ProvisionResult = ProvisionSuccess | ProvisionFailure;

export interface ProvisionInput {
  normalizedEmail: string;
  hashedPassword: string;
  firstName?: string;
  acceptedLegalDocs?: string[];
  locale: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * Seams. Every collaborator that can fail is reachable here so a test can make
 * exactly one step throw and assert the unwind, without a production-visible
 * fault switch.
 */
export interface ProvisionDeps {
  ensureDemoOrg: (demoOrgId: string) => Promise<void>;
  insertUser: (input: {
    userId: string;
    demoOrgId: string;
    normalizedEmail: string;
    hashedPassword: string;
    firstName: string;
  }) => Promise<void>;
  insertMembership: (input: { userId: string; demoOrgId: string }) => Promise<void>;
  recordLegalAcceptance: (input: {
    userId: string;
    demoOrgId: string;
    acceptedLegalDocs: string[];
    ipAddress: string;
    userAgent: string;
  }) => Promise<void>;
  /** Writes `demo:enabled`, `demo:started_at`, the entry-source marker and the run/tenant markers. */
  setDemoPreferences: (input: {
    userId: string;
    runId: string;
    tenantOrgId: string;
  }) => Promise<void>;
  /** Seeds and records the isolated tenant under the id THIS run owns. */
  startSession: (
    userId: string,
    locale: string,
    tenantOrgId: string
  ) => Promise<DemoSessionRecord>;
  issueTokens: (user: {
    id: string;
    email: string;
    role: string;
    organization_id: string;
  }) => Promise<{ accessToken: string; refreshToken: string }>;
  readUser: (userId: string) => Promise<{ id: string } | null>;
  /** Exact existence check for one organization id — no pattern matching. */
  orgExists: (organizationId: string) => Promise<boolean>;
  countRows: (sql: string, params: unknown[]) => Promise<number>;
  deleteRows: (sql: string, params: unknown[]) => Promise<void>;
  deleteSessionTenant: (organizationId: string) => Promise<void>;
  revokeTokens: (userId: string) => Promise<void>;
}

function demoOrgId(): string {
  return process.env.DEMO_ORG_ID || 'demo-org';
}

/** DELETE-then-INSERT upsert that fails loudly. Mirrors demoSessionService. */
async function writePreference(userId: string, key: string, value: string): Promise<void> {
  await dbRun(`DELETE FROM user_preferences WHERE user_id = ? AND key = ?`, [userId, key], {
    fallback: true,
  });
  const written = await dbRun(
    `INSERT INTO user_preferences (user_id, key, value, updated_at)
     VALUES (?, ?, ?, ?)`,
    [userId, key, value, new Date().toISOString()],
    { fallback: false }
  );
  if (!written.success) {
    throw new Error(`preference ${key} failed: ${written.error || 'unknown'}`);
  }
}

const realDeps: ProvisionDeps = {
  ensureDemoOrg: async (id) => {
    await dbRun(
      `INSERT INTO organizations (id, name, plan, status, organization_type)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [id, process.env.DEMO_ORG_NAME || 'Atelier Toys', 'enterprise', 'active', 'DEMO'],
      { fallback: true }
    );
  },

  insertUser: async ({ userId, demoOrgId: orgId, normalizedEmail, hashedPassword, firstName }) => {
    const result = await dbRun(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, orgId, normalizedEmail, hashedPassword, firstName, '', DEMO_SIGNUP_ROLE, 'active'],
      { fallback: false }
    );
    if (!result.success) throw new Error(`user insert failed: ${result.error || 'unknown'}`);
  },

  insertMembership: async ({ userId, demoOrgId: orgId }) => {
    // `fallback: false` on purpose. With the default the CHECK-constraint
    // violation this row is prone to would resolve to `{success:false}` and be
    // dropped on the floor, leaving a demo principal with no membership at all.
    const result = await dbRun(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', datetime('now'))
       ON CONFLICT(organization_id, user_id) DO NOTHING`,
      [uuidv4(), orgId, userId, DEMO_SIGNUP_ROLE],
      { fallback: false }
    );
    if (!result.success) throw new Error(`membership insert failed: ${result.error || 'unknown'}`);

    // NOTE: this read-back throws AFTER the INSERT has already committed, which
    // is exactly why the membership compensation is registered before the call.
    const row = await dbGet<{ id: string }>(
      `SELECT id FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`,
      [orgId, userId],
      { fallback: false }
    );
    if (!row?.id) throw new Error('membership row missing after insert');
  },

  recordLegalAcceptance: async ({ userId, demoOrgId: orgId, acceptedLegalDocs, ipAddress, userAgent }) => {
    // legalService writes one acceptance row per document, so a failure on the
    // second document leaves the first behind. Compensated unconditionally.
    await legalService.acceptDocuments(
      userId,
      acceptedLegalDocs,
      'USER',
      ipAddress,
      userAgent,
      orgId
    );
  },

  setDemoPreferences: async ({ userId, runId, tenantOrgId }) => {
    // Four independent writes. Any of them can throw with the earlier ones
    // already committed — hence a compensation registered before the call that
    // clears every preference row for this user.
    await setUserDemoPreference(userId, true, { setStartedAt: true });
    await writePreference(userId, DEMO_ENTRY_SOURCE_PREF_KEY, PUBLIC_DEMO_ENTRY_SOURCE);
    // Written BEFORE the tenant is seeded: this is the marker that survives the
    // window where the org exists but the demo_sessions row does not.
    await writePreference(userId, PROVISION_RUN_ID_PREF_KEY, runId);
    await writePreference(userId, PROVISION_TENANT_ORG_PREF_KEY, tenantOrgId);
  },

  startSession: async (userId, locale, tenantOrgId) =>
    resolveOrCreateDemoSession(userId, PUBLIC_DEMO_ENTRY_SOURCE, locale, {
      sessionOrgId: tenantOrgId,
    }),

  issueTokens: async (user) => {
    const pair = await refreshTokenService.generateTokenPair(user, {
      deviceInfo: 'Demo Signup',
    });
    if (!pair?.accessToken || !pair?.refreshToken) throw new Error('token generation failed');
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken };
  },

  readUser: async (userId) =>
    dbGet<{ id: string }>(`SELECT id FROM users WHERE id = ?`, [userId], { fallback: false }),

  orgExists: async (organizationId) => {
    const row = await dbGet<{ id: string }>(
      `SELECT id FROM organizations WHERE id = ?`,
      [organizationId],
      { fallback: false }
    );
    return Boolean(row?.id);
  },

  countRows: async (sql, params) => {
    const row = await dbGet<{ c: number }>(sql, params, { fallback: false });
    const numeric = Number(row?.c);
    return Number.isFinite(numeric) ? numeric : 0;
  },

  deleteRows: async (sql, params) => {
    await dbRun(sql, params, { fallback: false });
  },

  deleteSessionTenant: async (organizationId) => {
    await deleteDemoDatasetForOrganization(organizationId);
  },

  revokeTokens: async (userId) => {
    await refreshTokenService.revokeAllUserTokens(userId, 'demo_signup_rollback');
  },
};

interface Compensation {
  step: string;
  undo: () => Promise<void>;
  /** Returns true when the row is confirmed gone. */
  verify: () => Promise<boolean>;
}

/**
 * Provision a public demo account, or leave the database exactly as it was.
 *
 * On failure the returned `compensation` report says, per step, whether the undo
 * ran and whether a read-back confirmed it. `retrySafe`/`compensation.complete`
 * false means a retry with the same address may still be rejected as a duplicate
 * — the caller must surface that as an operational fault, not as a normal
 * rejection, and `runId` is the handle an operator uses to reclaim the tenant.
 */
export async function provisionPublicDemoAccount(
  input: ProvisionInput,
  overrides: Partial<ProvisionDeps> = {}
): Promise<ProvisionResult> {
  const deps: ProvisionDeps = { ...realDeps, ...overrides };
  const orgId = demoOrgId();
  const runId = uuidv4();
  const userId = uuidv4();
  const tenantOrgId = makeProvisionTenantOrgId(orgId, runId);
  const compensations: Compensation[] = [];

  let currentStep = 'ensure_demo_org';
  try {
    // UNIFORM RULE, applied to every step below: the compensation is pushed
    // BEFORE the forward call. Any step that writes something and then throws
    // would otherwise never register its undo, and the partial write would
    // survive the unwind. An undo whose step never wrote anything is harmless:
    // it deletes zero rows and its read-back verifies clean.
    //
    // `ensure_demo_org` is the one step with NO compensation, and that is
    // deliberate rather than an oversight: the curated base org is shared,
    // long-lived and must survive a failed signup. `ON CONFLICT DO NOTHING`
    // makes it idempotent and it writes at most that one row.
    await deps.ensureDemoOrg(orgId);

    currentStep = 'insert_user';
    // `insertUser` is the one place where registering before the call would be
    // impossible on a database-generated id — there would be no id to delete.
    // It is not: `userId` is generated here, so the rule holds uniformly.
    compensations.push({
      step: 'insert_user',
      undo: () => deps.deleteRows(`DELETE FROM users WHERE id = ?`, [userId]),
      verify: async () => (await deps.readUser(userId)) === null,
    });
    await deps.insertUser({
      userId,
      demoOrgId: orgId,
      normalizedEmail: input.normalizedEmail,
      hashedPassword: input.hashedPassword,
      firstName: input.firstName || '',
    });

    currentStep = 'insert_membership';
    compensations.push({
      step: 'insert_membership',
      undo: () => deps.deleteRows(`DELETE FROM organization_members WHERE user_id = ?`, [userId]),
      verify: async () =>
        (await deps.countRows(
          `SELECT COUNT(*) as c FROM organization_members WHERE user_id = ?`,
          [userId]
        )) === 0,
    });
    await deps.insertMembership({ userId, demoOrgId: orgId });

    currentStep = 'record_legal_acceptance';
    if (Array.isArray(input.acceptedLegalDocs) && input.acceptedLegalDocs.length > 0) {
      // Registered even though the step is non-fatal: legalService writes one row
      // per document, so "it threw" does NOT mean "it wrote nothing".
      compensations.push({
        step: 'record_legal_acceptance',
        undo: () =>
          deps.deleteRows(`DELETE FROM legal_document_acceptances WHERE user_id = ?`, [userId]),
        verify: async () =>
          (await deps.countRows(`SELECT COUNT(*) as c FROM legal_document_acceptances WHERE user_id = ?`, [
            userId,
          ])) === 0,
      });
      try {
        await deps.recordLegalAcceptance({
          userId,
          demoOrgId: orgId,
          acceptedLegalDocs: input.acceptedLegalDocs,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        });
      } catch (legalErr: unknown) {
        // Consent recording is an audit nicety; it must not cost the prospect the
        // demo. Whatever it managed to write is still compensated on a later
        // failure, because the compensation above is already registered.
        logger.warn('[DemoProvisioning] legal acceptance recording failed (non-fatal)', {
          error: (legalErr as Error)?.message || String(legalErr),
        });
      }
    }

    currentStep = 'set_demo_preferences';
    compensations.push({
      step: 'set_demo_preferences',
      undo: () => deps.deleteRows(`DELETE FROM user_preferences WHERE user_id = ?`, [userId]),
      verify: async () =>
        (await deps.countRows(`SELECT COUNT(*) as c FROM user_preferences WHERE user_id = ?`, [
          userId,
        ])) === 0,
    });
    await deps.setDemoPreferences({ userId, runId, tenantOrgId });

    currentStep = 'start_demo_session';
    // The tenant org id belongs to THIS run (it carries the full run id), so the
    // compensation names one exact organization instead of sweeping a truncated
    // prefix. That is what makes the orphan case reachable safely: seeding
    // creates the org before the `demo_sessions` row exists, and a failure in
    // between used to leave an org that no return value named — the reason the
    // prefix sweep existed, and the reason it could delete a concurrent
    // prospect's live workspace.
    compensations.push({
      step: 'start_demo_session',
      undo: async () => {
        // Never delete the curated base org: under DEMO_USE_BASE_ORG the session
        // points at DEMO_ORG_ID itself and no per-run tenant is ever created.
        if (tenantOrgId !== orgId && (await deps.orgExists(tenantOrgId))) {
          await deps.deleteSessionTenant(tenantOrgId);
        }
        await deps.deleteRows(`DELETE FROM demo_session_tenants WHERE tenant_org_id = ?`, [
          tenantOrgId,
        ]);
        await deps.deleteRows(`DELETE FROM demo_sessions WHERE user_id = ?`, [userId]);
      },
      verify: async () => {
        const sessions = await deps.countRows(
          `SELECT COUNT(*) as c FROM demo_sessions WHERE user_id = ?`,
          [userId]
        );
        const tenants = await deps.countRows(
          `SELECT COUNT(*) as c FROM demo_session_tenants WHERE tenant_org_id = ?`,
          [tenantOrgId]
        );
        const orphanOrg = tenantOrgId !== orgId && (await deps.orgExists(tenantOrgId));
        return sessions === 0 && tenants === 0 && !orphanOrg;
      },
    });
    const session = await deps.startSession(userId, input.locale, tenantOrgId);

    currentStep = 'issue_tokens';
    // `generateTokenPair` persists the refresh-token family before it returns, so
    // a throw on the way out leaves a usable token behind. Registered first.
    compensations.push({
      step: 'issue_tokens',
      undo: () => deps.revokeTokens(userId),
      verify: async () =>
        (await deps.countRows(
          `SELECT COUNT(*) as c FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL`,
          [userId]
        )) === 0,
    });
    const tokens = await deps.issueTokens({
      id: userId,
      email: input.normalizedEmail,
      role: DEMO_SIGNUP_ROLE,
      organization_id: orgId,
    });

    return {
      ok: true,
      runId,
      userId,
      organizationId: orgId,
      tenantOrgId: session.session_org_id || tenantOrgId,
      session,
      tokens,
    };
  } catch (error: unknown) {
    const message = (error as Error)?.message || String(error);
    logger.error('[DemoProvisioning] signup failed, unwinding', { step: currentStep, error: message });
    const compensation = await unwind(compensations);
    if (!compensation.complete) {
      // Loud on purpose: an unverified unwind means the address is likely stuck
      // and a human has to clean it up before that prospect can retry. `runId`
      // names the tenant exactly — see cleanup-orphan-demo-orgs.ts --run-id.
      logger.error('[DemoProvisioning] INCOMPLETE COMPENSATION — manual cleanup required', {
        runId,
        userId,
        tenantOrgId,
        failedStep: currentStep,
        steps: compensation.steps,
      });
    }
    return {
      ok: false,
      runId,
      userId,
      tenantOrgId,
      failedStep: currentStep,
      error: message,
      compensation,
      retrySafe: compensation.complete,
    };
  }
}

async function unwind(compensations: Compensation[]): Promise<CompensationReport> {
  const steps: CompensationStep[] = [];
  // Reverse order: later steps depend on earlier rows.
  for (const compensation of [...compensations].reverse()) {
    let undoError: string | undefined;
    try {
      await compensation.undo();
    } catch (err: unknown) {
      undoError = (err as Error)?.message || String(err);
    }

    let verified = false;
    let verifyError: string | undefined;
    try {
      verified = await compensation.verify();
    } catch (err: unknown) {
      verifyError = (err as Error)?.message || String(err);
    }

    steps.push({
      step: compensation.step,
      ok: !undoError && verified,
      verified,
      error: undoError || verifyError || (verified ? undefined : 'read-back still found rows'),
    });
  }

  return { complete: steps.every((s) => s.ok), steps };
}

export const __testing__ = { realDeps, unwind };
