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
 * This module runs those steps as a saga: each forward step registers its own
 * compensation, a failure unwinds them in reverse, and every compensation is
 * READ BACK to confirm it actually removed the row. Compensation that cannot be
 * verified is reported as incomplete rather than assumed — a silent half-rollback
 * is the failure mode that produced the dead accounts in the first place.
 *
 * The collaborators are injected so fault injection in tests does not need a
 * production backdoor.
 */
import { v4 as uuidv4 } from 'uuid';

import { setUserDemoPreference } from '../../middleware/demoGuard.middleware.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
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
  userId: string;
  organizationId: string;
  session: DemoSessionRecord;
  tokens: { accessToken: string; refreshToken: string };
}

export interface ProvisionFailure {
  ok: false;
  failedStep: string;
  error: string;
  compensation: CompensationReport;
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
  setDemoPreferences: (userId: string) => Promise<void>;
  startSession: (userId: string, locale: string) => Promise<DemoSessionRecord>;
  issueTokens: (user: {
    id: string;
    email: string;
    role: string;
    organization_id: string;
  }) => Promise<{ accessToken: string; refreshToken: string }>;
  readUser: (userId: string) => Promise<{ id: string } | null>;
  countRows: (sql: string, params: unknown[]) => Promise<number>;
  deleteRows: (sql: string, params: unknown[]) => Promise<void>;
  deleteSessionTenant: (organizationId: string) => Promise<void>;
  /** Every session tenant this user could own, found by id prefix. */
  findSessionOrgIds: (userId: string) => Promise<string[]>;
  revokeTokens: (userId: string) => Promise<void>;
}

/**
 * Prefix `demoSessionService.makeSessionOrgId` builds session tenants with.
 * Duplicated here on purpose: the saga has to be able to find a tenant that was
 * created by a `startDemoSession` call which then THREW before returning its id —
 * seeding happens before the `demo_sessions` row is written, so a mid-step
 * failure leaves an org nobody holds a reference to.
 */
export function sessionOrgIdPrefix(userId: string, baseOrgId: string): string {
  const normalizedUser = String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'user';
  return `${baseOrgId}-session-${normalizedUser}-`;
}

function demoOrgId(): string {
  return process.env.DEMO_ORG_ID || 'demo-org';
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

    const row = await dbGet<{ id: string }>(
      `SELECT id FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`,
      [orgId, userId],
      { fallback: false }
    );
    if (!row?.id) throw new Error('membership row missing after insert');
  },

  recordLegalAcceptance: async ({ userId, demoOrgId: orgId, acceptedLegalDocs, ipAddress, userAgent }) => {
    await legalService.acceptDocuments(
      userId,
      acceptedLegalDocs,
      'USER',
      ipAddress,
      userAgent,
      orgId
    );
  },

  setDemoPreferences: async (userId) => {
    await setUserDemoPreference(userId, true, { setStartedAt: true });
    await dbRun(
      `DELETE FROM user_preferences WHERE user_id = ? AND key = ?`,
      [userId, DEMO_ENTRY_SOURCE_PREF_KEY],
      { fallback: true }
    );
    const marker = await dbRun(
      `INSERT INTO user_preferences (user_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)`,
      [userId, DEMO_ENTRY_SOURCE_PREF_KEY, PUBLIC_DEMO_ENTRY_SOURCE, new Date().toISOString()],
      { fallback: false }
    );
    if (!marker.success) {
      throw new Error(`demo entry marker failed: ${marker.error || 'unknown'}`);
    }
  },

  startSession: async (userId, locale) =>
    resolveOrCreateDemoSession(userId, PUBLIC_DEMO_ENTRY_SOURCE, locale),

  issueTokens: async (user) => {
    const pair = await refreshTokenService.generateTokenPair(user, {
      deviceInfo: 'Demo Signup',
    });
    if (!pair?.accessToken || !pair?.refreshToken) throw new Error('token generation failed');
    return { accessToken: pair.accessToken, refreshToken: pair.refreshToken };
  },

  readUser: async (userId) =>
    dbGet<{ id: string }>(`SELECT id FROM users WHERE id = ?`, [userId], { fallback: false }),

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

  findSessionOrgIds: async (userId) => {
    const rows = await dbAll<{ id: string }>(
      `SELECT id FROM organizations WHERE id LIKE ?`,
      [`${sessionOrgIdPrefix(userId, demoOrgId())}%`],
      { fallback: false }
    );
    return (rows || []).map((r) => r.id).filter(Boolean);
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
 * ran and whether a read-back confirmed it. `complete: false` means a retry with
 * the same address may still be rejected as a duplicate — the caller must
 * surface that as an operational fault, not as a normal rejection.
 */
export async function provisionPublicDemoAccount(
  input: ProvisionInput,
  overrides: Partial<ProvisionDeps> = {}
): Promise<ProvisionResult> {
  const deps: ProvisionDeps = { ...realDeps, ...overrides };
  const orgId = demoOrgId();
  const userId = uuidv4();
  const compensations: Compensation[] = [];

  let currentStep = 'ensure_demo_org';
  try {
    await deps.ensureDemoOrg(orgId);
    // Not compensated on purpose: the curated base org is shared, long-lived and
    // must survive a failed signup. `ON CONFLICT DO NOTHING` makes it idempotent.

    currentStep = 'insert_user';
    await deps.insertUser({
      userId,
      demoOrgId: orgId,
      normalizedEmail: input.normalizedEmail,
      hashedPassword: input.hashedPassword,
      firstName: input.firstName || '',
    });
    compensations.push({
      step: 'insert_user',
      undo: () => deps.deleteRows(`DELETE FROM users WHERE id = ?`, [userId]),
      verify: async () => (await deps.readUser(userId)) === null,
    });

    currentStep = 'insert_membership';
    await deps.insertMembership({ userId, demoOrgId: orgId });
    compensations.push({
      step: 'insert_membership',
      undo: () => deps.deleteRows(`DELETE FROM organization_members WHERE user_id = ?`, [userId]),
      verify: async () =>
        (await deps.countRows(
          `SELECT COUNT(*) as c FROM organization_members WHERE user_id = ?`,
          [userId]
        )) === 0,
    });

    currentStep = 'record_legal_acceptance';
    if (Array.isArray(input.acceptedLegalDocs) && input.acceptedLegalDocs.length > 0) {
      try {
        await deps.recordLegalAcceptance({
          userId,
          demoOrgId: orgId,
          acceptedLegalDocs: input.acceptedLegalDocs,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        });
        compensations.push({
          step: 'record_legal_acceptance',
          undo: () =>
            deps.deleteRows(`DELETE FROM legal_document_acceptances WHERE user_id = ?`, [userId]),
          verify: async () =>
            (await deps.countRows(`SELECT COUNT(*) as c FROM legal_document_acceptances WHERE user_id = ?`, [
              userId,
            ])) === 0,
        });
      } catch (legalErr: unknown) {
        // Consent recording is an audit nicety; it must not cost the prospect the
        // demo. Registered as non-fatal, and the compensation above is skipped
        // because nothing was written.
        logger.warn('[DemoProvisioning] legal acceptance recording failed (non-fatal)', {
          error: (legalErr as Error)?.message || String(legalErr),
        });
      }
    }

    currentStep = 'set_demo_preferences';
    await deps.setDemoPreferences(userId);
    compensations.push({
      step: 'set_demo_preferences',
      undo: () => deps.deleteRows(`DELETE FROM user_preferences WHERE user_id = ?`, [userId]),
      verify: async () =>
        (await deps.countRows(`SELECT COUNT(*) as c FROM user_preferences WHERE user_id = ?`, [
          userId,
        ])) === 0,
    });

    currentStep = 'start_demo_session';
    // Registered BEFORE the call, and written to sweep by id prefix rather than by
    // a returned id. `startDemoSession` seeds the tenant org first and inserts the
    // `demo_sessions` row afterwards, so a failure between the two leaves an
    // orphan org that no return value ever names. Compensating on the prefix is
    // the only way to reach it, and it stays correct for the success path too.
    compensations.push({
      step: 'start_demo_session',
      undo: async () => {
        for (const sessionOrgId of await deps.findSessionOrgIds(userId)) {
          // Never delete the curated base org: under DEMO_USE_BASE_ORG the session
          // points at DEMO_ORG_ID itself, and the prefix cannot match it anyway.
          if (sessionOrgId && sessionOrgId !== orgId) {
            await deps.deleteSessionTenant(sessionOrgId);
          }
        }
        await deps.deleteRows(
          `DELETE FROM demo_session_tenants WHERE session_id IN (SELECT id FROM demo_sessions WHERE user_id = ?)`,
          [userId]
        );
        await deps.deleteRows(`DELETE FROM demo_sessions WHERE user_id = ?`, [userId]);
      },
      verify: async () => {
        const sessions = await deps.countRows(
          `SELECT COUNT(*) as c FROM demo_sessions WHERE user_id = ?`,
          [userId]
        );
        const orphanOrgs = (await deps.findSessionOrgIds(userId)).filter((id) => id !== orgId);
        return sessions === 0 && orphanOrgs.length === 0;
      },
    });
    const session = await deps.startSession(userId, input.locale);

    currentStep = 'issue_tokens';
    const tokens = await deps.issueTokens({
      id: userId,
      email: input.normalizedEmail,
      role: DEMO_SIGNUP_ROLE,
      organization_id: orgId,
    });
    compensations.push({
      step: 'issue_tokens',
      undo: () => deps.revokeTokens(userId),
      verify: async () =>
        (await deps.countRows(
          `SELECT COUNT(*) as c FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL`,
          [userId]
        )) === 0,
    });

    return {
      ok: true,
      userId,
      organizationId: orgId,
      session,
      tokens,
    };
  } catch (error: unknown) {
    const message = (error as Error)?.message || String(error);
    logger.error('[DemoProvisioning] signup failed, unwinding', { step: currentStep, error: message });
    const compensation = await unwind(compensations);
    if (!compensation.complete) {
      // Loud on purpose: an unverified unwind means the address is likely stuck
      // and a human has to clean it up before that prospect can retry.
      logger.error('[DemoProvisioning] INCOMPLETE COMPENSATION — manual cleanup required', {
        userId,
        failedStep: currentStep,
        steps: compensation.steps,
      });
    }
    return { ok: false, failedStep: currentStep, error: message, compensation };
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
