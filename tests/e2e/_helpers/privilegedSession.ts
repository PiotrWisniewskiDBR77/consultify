/**
 * Privileged e2e session — obtained ONLY via `POST /api/test-support/bootstrap`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS MODULE EXISTS — read before adding any "fallback" here.
 *
 * `POST /api/auth/register-demo` is the PUBLIC demo signup. It is UNPRIVILEGED
 * BY DESIGN:
 *   - it mints a `CONSULTANT` (server/src/services/demo/demoSignupProvisioning.ts
 *     `DEMO_SIGNUP_ROLE`) inside the shared demo org — deliberately NOT ADMIN,
 *     so a public signup can never reach the organization-administration lane;
 *   - the account is a read-only demo principal — `demoWriteProtection` refuses
 *     every write with `403 DEMO_READ_ONLY`.
 *
 * Several harnesses used to fall back to register-demo when test-support was
 * unavailable, and then wrote `role: 'ADMIN'` into localStorage anyway
 * (`String(j.role || 'ADMIN')`, or a hardcoded literal). The result was the
 * WORST possible failure mode: the client-side guards passed (localStorage says
 * ADMIN) while every server call 403'd, so specs "ran" against a session they
 * did not actually have. A clean, loud failure is strictly better.
 *
 * Therefore: this module NEVER falls back to register-demo, NEVER falls back to
 * any other endpoint, and NEVER fabricates a role. If test-support is not
 * enabled on the target backend it THROWS with the exact env vars to set.
 *
 * If you need an INTENTIONALLY unprivileged second account (ACL/isolation
 * testing), call register-demo directly and say so in a comment — see
 * tests/e2e/m04-notebook/_helpers.ts `freshToken()` for the sanctioned example.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Server contract (server/src/routes/testSupport.routes.ts):
 *   enabled when  NODE_ENV !== 'production'
 *            AND  ENABLE_TEST_SUPPORT === 'true'
 *            AND  header `x-test-support-key` === TEST_SUPPORT_KEY (>= 12 chars)
 *   body    { runId, role? }   role ∈ SUPERADMIN | ADMIN | USER | GUEST (default ADMIN)
 *   200     { runId, organizationId, userId, token }   — real fresh org, NON-demo
 *   404     when disabled (deliberately indistinguishable from a missing route)
 */
import type { APIRequestContext, Page } from '@playwright/test';

/** Roles the bootstrap endpoint accepts (`VALID_ROLES` in testSupport.routes.ts). */
export const PRIVILEGED_ROLES = ['SUPERADMIN', 'ADMIN', 'USER', 'GUEST'] as const;
export type PrivilegedRole = (typeof PRIVILEGED_ROLES)[number];

/** Roles that actually carry organization-administration privilege. */
const ADMIN_ROLES: readonly string[] = ['SUPERADMIN', 'ADMIN', 'OWNER'];

export type PrivilegedSession = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
  /** Role the SERVER put in the token — never a client-side default. */
  role: string;
  isSuperAdmin: boolean;
  email: string;
};

export type PrivilegedSessionOptions = {
  /** Persona to mint. Default `'ADMIN'`. */
  role?: PrivilegedRole;
  /** Short label used to build the runId and to name the suite in errors. */
  label?: string;
  /** Explicit runId (bootstrap is idempotent per runId). Overrides `label`. */
  runId?: string;
  /**
   * API origin. Default `E2E_API_URL` or `http://127.0.0.1:3001`.
   * Pass `''` to issue a RELATIVE request against the caller context's baseURL
   * (that is what the M06 harness does — it goes through the Vite dev proxy).
   */
  apiBaseUrl?: string;
  testSupportKey?: string;
  /** Attempts for transient failures (connection resets / SERVER_STARTING). */
  attempts?: number;
  timeoutMs?: number;
};

export const DEFAULT_TEST_SUPPORT_KEY = 'local-test-support-key-change-me';

export function testSupportKey(): string {
  return process.env.TEST_SUPPORT_KEY || DEFAULT_TEST_SUPPORT_KEY;
}

export function defaultApiBaseUrl(): string {
  return process.env.E2E_API_URL || 'http://127.0.0.1:3001';
}

/**
 * Actionable setup instructions. Exported so call sites that layer additional
 * REAL auth mechanisms (e.g. the gateway-only `/api/auth/demo-login`) can append
 * it to their own aggregate error without re-wording it.
 */
export const TEST_SUPPORT_SETUP_HINT = [
  'A privileged e2e session comes ONLY from POST /api/test-support/bootstrap.',
  'The public demo signup (POST /api/auth/register-demo) is unprivileged by design',
  '(TEAM_MEMBER in the read-only demo org, every write → 403 DEMO_READ_ONLY) and is',
  'deliberately NOT used as a fallback — it would give a client-side "ADMIN" over a',
  'server session that has no such privilege.',
  'To run this suite, set on the TARGET BACKEND:',
  '  ENABLE_TEST_SUPPORT=true',
  '  TEST_SUPPORT_KEY=<shared secret, at least 12 characters>',
  '  NODE_ENV must NOT be "production"',
  'and on the TEST RUNNER:',
  '  TEST_SUPPORT_KEY=<the same value>   (defaults to "local-test-support-key-change-me")',
  '  E2E_API_URL=<backend origin>        (defaults to http://127.0.0.1:3001)',
].join('\n');

export class PrivilegedSessionError extends Error {
  readonly attemptsLog: string[];

  constructor(message: string, attemptsLog: string[]) {
    super(message);
    this.name = 'PrivilegedSessionError';
    this.attemptsLog = attemptsLog;
  }
}

export function makeRunId(label: string): string {
  const slug = (label || 'e2e').replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 48);
  return `${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Decode a JWT payload (best-effort, NO verification — test helper only). */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1] || '';
    const padded = part + '='.repeat(((-part.length % 4) + 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isTransient(message: string): boolean {
  return /ECONNREFUSED|ECONNRESET|socket hang up|fetch failed|connect|timeout|Timeout/i.test(
    message
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mint a privileged, NON-demo session for e2e setup.
 *
 * @throws {PrivilegedSessionError} when test-support is unavailable, returns an
 * unusable payload, or hands back a token whose role does not match what was
 * requested. It never degrades to `register-demo` and never invents a role.
 */
export async function getPrivilegedSession(
  api: APIRequestContext,
  options: PrivilegedSessionOptions = {}
): Promise<PrivilegedSession> {
  const role: PrivilegedRole = options.role || 'ADMIN';
  const label = options.label || 'e2e';
  const runId = options.runId || makeRunId(label);
  const apiBaseUrl = options.apiBaseUrl === undefined ? defaultApiBaseUrl() : options.apiBaseUrl;
  const key = options.testSupportKey || testSupportKey();
  const attempts = Math.max(1, options.attempts ?? 4);
  const timeoutMs = options.timeoutMs ?? 45000;
  const url = `${apiBaseUrl.replace(/\/$/, '')}/api/test-support/bootstrap`;

  const log: string[] = [];

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let retryable = false;
    try {
      const res = await api.post(url, {
        headers: { 'x-test-support-key': key, 'content-type': 'application/json' },
        data: { runId, role },
        timeout: timeoutMs,
      });

      if (res.ok()) {
        const payload = (await res.json()) as Partial<PrivilegedSession>;
        const token = String(payload?.token || '').trim();
        if (!token) {
          log.push(`attempt ${attempt + 1}: 200 but payload has no token`);
          break;
        }
        const claims = decodeJwtPayload(token);
        // The role is read back from the SERVER-signed token, never defaulted:
        // a privilege mismatch must surface here, not as a mysterious 403 later.
        const actualRole = String(claims.role || '').trim();
        if (!actualRole) {
          log.push(`attempt ${attempt + 1}: token carries no role claim`);
          break;
        }
        if (actualRole !== role) {
          log.push(
            `attempt ${attempt + 1}: requested role ${role} but the server signed ${actualRole}`
          );
          break;
        }
        return {
          runId: String(payload?.runId || runId),
          organizationId: String(payload?.organizationId || claims.organizationId || ''),
          userId: String(payload?.userId || claims.id || ''),
          token,
          role: actualRole,
          isSuperAdmin: claims.isSuperAdmin === true,
          email: String(claims.email || `e2e+${runId}@local.test`),
        };
      }

      const status = res.status();
      const body = await res.text().catch(() => '<unreadable>');
      log.push(`attempt ${attempt + 1}: POST ${url} → ${status} ${body}`);
      // 503 SERVER_STARTING is the only retryable HTTP status; 404 means
      // test-support is disabled (deliberately looks like a missing route).
      retryable = status === 503;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.push(`attempt ${attempt + 1}: POST ${url} threw ${message}`);
      retryable = isTransient(message);
    }

    if (!retryable) break;
    if (attempt < attempts - 1) await sleep(1000 * (attempt + 1));
  }

  throw new PrivilegedSessionError(
    [
      `Unable to mint a privileged e2e session (label="${label}", role=${role}, runId=${runId}).`,
      TEST_SUPPORT_SETUP_HINT,
      'Bootstrap attempts:',
      ...log.map((line) => `  - ${line}`),
    ].join('\n'),
    log
  );
}

/** Convenience wrapper for specs that hold a `Page` rather than a request context. */
export function getPrivilegedSessionForPage(
  page: Page,
  options: PrivilegedSessionOptions = {}
): Promise<PrivilegedSession> {
  return getPrivilegedSession(page.request, options);
}

/**
 * Build the localStorage `user` object the SPA expects, carrying the REAL role
 * from the session. Never pass a role override here to "make guards pass" — the
 * point is that a privilege mismatch stays visible.
 */
export function privilegedAuthUser(
  session: PrivilegedSession,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: session.userId,
    email: session.email,
    role: session.role,
    userRole: session.role,
    isSuperAdmin: session.isSuperAdmin,
    organizationId: session.organizationId,
    organizationName: 'E2E Organization',
    companyName: 'E2E Organization',
    firstName: 'E2E',
    lastName: 'User',
    avatarUrl: null,
    impersonatorId: null,
    isAuthenticated: true,
    accessLevel: 'full',
    isDemo: false,
    ...overrides,
  };
}

/** True when the role can reach /admin/* (and, for SUPERADMIN, /superadmin/*). */
export function isPrivilegedRole(role: string | undefined | null): boolean {
  return ADMIN_ROLES.includes(String(role || '').toUpperCase());
}
