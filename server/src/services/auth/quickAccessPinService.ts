/**
 * Quick-access PIN → session, server side only (DEC day-39 FIX-1).
 *
 * The owner's requirement: the browser never sees a password, because in this
 * flow a password no longer exists. The PIN travels to the server, the server
 * decides, and the server mints the session through the ordinary login path.
 *
 * Storage variant: a SERVER environment variable, `QUICK_ACCESS_PIN_MAP`,
 * holding `{"<4 digits>": "<account email>"}`. Two properties matter:
 *
 *  1. The value type is a plain email STRING, not an object. There is no field
 *     a password could be written into, so "no passwords stored anywhere" is
 *     enforced by the shape rather than by a reviewer noticing. An entry that
 *     is an object — including `{ email, password }` — is dropped, and the
 *     whole map is refused if any entry carries a credential-looking key.
 *  2. It is absent by default, and an absent or malformed value yields an empty
 *     map, which disables the endpoint. Fail-closed with no ceremony.
 *
 * Why not a table: this map is deployment configuration for non-production
 * environments, not tenant data. A table would need a migration, an admin
 * surface, an encryption key and its rotation, and it would place a
 * session-minting shortcut inside the product's own data plane — where it would
 * travel with every dump restored from demo into somebody's laptop. The env var
 * is scoped to one deployment, never leaves the process, and matches how this
 * codebase already configures `FORCE_SUPERADMIN_EMAILS`.
 *
 * The PIN itself is stored in the clear on purpose. It is four digits: a 10^4
 * space that any hash is brute-forced through in milliseconds, so hashing would
 * buy the appearance of protection and nothing else. The real controls are the
 * rate limiter on the endpoint, the production kill switch below, and the fact
 * that the map is never set outside demo/staging/local.
 */

import {
  getDatabaseHost,
  isKnownProductionDatabaseHost,
  isVerifiedProductionRuntime,
} from '../../config/databaseTargetResolver.js';

/** Public production origins (same list `scripts/validate-deploy-target.sh` uses). */
const PRODUCTION_PUBLIC_HOSTS = new Set(['consultify.ai', 'www.consultify.ai']);

export const QUICK_ACCESS_DISABLED_CODE = 'QUICK_ACCESS_DISABLED';
export const QUICK_ACCESS_INVALID_PIN_CODE = 'QUICK_ACCESS_INVALID_PIN';

function normalizeLower(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function hostOf(url: unknown): string {
  try {
    return new URL(String(url ?? '')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Is this process a production deployment?
 *
 * Deliberately NOT `NODE_ENV === 'production'`: demo and staging run with that
 * exact value, so it does not separate them from production and would disable
 * the shortcut precisely where it is wanted. The signals below are all server
 * side and none of them can be influenced by a browser:
 *
 *  - Railway's own injected identity (`isVerifiedProductionRuntime`), which is
 *    the one signal an app-level flag cannot forge;
 *  - the resolved DATABASE host being the known production Postgres. This is
 *    the substantive guarantee: whatever the flags claim, a PIN can never mint
 *    a session against production DATA;
 *  - `APP_ENV` / `RAILWAY_ENVIRONMENT_NAME` set to production;
 *  - `FRONTEND_URL` pointing at the public production domain.
 */
export function isProductionRuntimeForQuickAccess(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (isVerifiedProductionRuntime(env)) return true;
  if (normalizeLower(env.APP_ENV) === 'production') return true;
  if (normalizeLower(env.RAILWAY_ENVIRONMENT_NAME) === 'production') return true;
  if (PRODUCTION_PUBLIC_HOSTS.has(hostOf(env.FRONTEND_URL))) return true;

  const databaseHost = getDatabaseHost(String(env.DATABASE_URL ?? ''));
  if (isKnownProductionDatabaseHost(databaseHost, env)) return true;

  return false;
}

const CREDENTIAL_KEY_PATTERN = /^(?:password|pass|pwd|secret|token|hash)$/i;

/**
 * Parses `QUICK_ACCESS_PIN_MAP`. Any problem — absent, not JSON, not an object,
 * an entry carrying a credential-looking key — yields `{}`, never a throw and
 * never a partially trusted map.
 */
export function readQuickAccessPinMap(
  env: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const raw = env.QUICK_ACCESS_PIN_MAP;
  if (typeof raw !== 'string' || raw.trim().length === 0) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const entries = Object.entries(parsed as Record<string, unknown>);

  // One credential-shaped entry poisons the whole map rather than being skipped
  // quietly. Somebody pasting the old `{ email, password }` shape in should get
  // a dead shortcut they investigate, not a half-working one they trust.
  const carriesCredential = entries.some(
    ([, value]) =>
      value !== null &&
      typeof value === 'object' &&
      Object.keys(value as Record<string, unknown>).some((key) => CREDENTIAL_KEY_PATTERN.test(key))
  );
  if (carriesCredential) return {};

  return Object.fromEntries(
    entries
      .filter(
        ([pin, email]) =>
          /^\d{4}$/.test(pin) &&
          typeof email === 'string' &&
          email.trim().length > 0 &&
          email.includes('@')
      )
      .map(([pin, email]) => [pin, String(email).trim().toLowerCase()])
  );
}

/** The endpoint answers at all only when configured AND outside production. */
export function isQuickAccessEndpointEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionRuntimeForQuickAccess(env)) return false;
  return Object.keys(readQuickAccessPinMap(env)).length > 0;
}

/** Resolves a PIN to the account email, or null. Never resolves in production. */
export function resolveQuickAccessAccountEmail(
  pin: unknown,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (!isQuickAccessEndpointEnabled(env)) return null;
  const normalized = String(pin ?? '').trim();
  if (!/^\d{4}$/.test(normalized)) return null;
  return readQuickAccessPinMap(env)[normalized] ?? null;
}

/**
 * Defence in depth for the password-skip seam in `AuthController.login`. Any
 * caller that asks to skip password verification has to get past this, so a
 * future mis-wiring cannot turn that option into a production bypass.
 */
export function assertQuickAccessRuntimeEnabled(env: NodeJS.ProcessEnv = process.env): void {
  if (!isQuickAccessEndpointEnabled(env)) {
    throw new Error('[quick-access] refused: endpoint is disabled or this is a production runtime');
  }
}
