/**
 * Database identity — the ONLY honest answer to "which database is this side
 * actually talking to?".
 *
 * WHY THIS EXISTS (DEC-2026-08-28-165, "rozjazd baz")
 * --------------------------------------------------
 * Three Railway databases are all named `railway` and the environment domains
 * are crossed, so neither the database name nor the domain identifies the
 * target. The staging application connected to one database while the
 * migration gate migrated another, silently.
 *
 * The day-38 attempt at a recurrence check compared `DB_TARGET_LABEL` printed
 * by the migration gate against `DB_TARGET_LABEL` printed by the application.
 * Both sides read the SAME environment variable in the SAME service, so the
 * two values agreed by construction — a tautology that can never observe a
 * divergence.
 *
 * ★ THE SAME TRAP HAS A SECOND SHAPE. Deriving both sides from the same
 * `process.env` is ALSO a tautology, even when neither side reads a hand-set
 * label: `resolveApplicationDatabaseIdentity(process.env)` and the release
 * gate's own `resolveReachableDatabaseUrl({ DATABASE_URL, DATABASE_PUBLIC_URL })`
 * are literally the same expression evaluated twice. The first FIX round
 * shipped exactly that and it reported agreement for every injected
 * divergence. It has been removed from `server/scripts/release-migration-gate.ts`.
 *
 * WHAT THIS MODULE IS FOR, THEN: describing ONE side honestly, so that a
 * process OUTSIDE both services can compare two independently supplied
 * descriptions. That comparison lives in `scripts/validate-deploy-target.sh`
 * (GitHub Actions), which receives APP_DATABASE_URL and MIGRATION_DATABASE_URL
 * as separate secrets copied from two different Railway services. Never
 * compare two values this module derived from one environment and call the
 * result a divergence check.
 *
 * PRIVACY: identity is host + port + database name only. User and password are
 * never read, never formatted and never logged.
 */

import { resolveReachableDatabaseUrl } from './databaseTargetResolver.js';

export type DatabaseIdentityEnvironment = Record<string, string | undefined>;

export interface DatabaseIdentity {
  host: string;
  port: number;
  database: string;
  /** Where the identity came from, for operator diagnostics. */
  source: string;
}

export type DatabaseIdentityRole = 'app' | 'migration';

/** Marker prefix. Grep this in deploy logs; it is emitted level-independently. */
export const DB_IDENTITY_LOG_PREFIX = 'DB_IDENTITY';

function trimmed(value: string | undefined): string {
  return (value ?? '').trim();
}

/**
 * Parse host/port/database out of a Postgres connection string.
 * Returns null for anything unparseable — an unparseable URL is NOT an
 * identity and must never be treated as "matches".
 */
export function parseDatabaseIdentityFromUrl(
  url: string | undefined,
  source = 'connection-string'
): DatabaseIdentity | null {
  const raw = trimmed(url);
  if (!raw) return null;
  // Unexpanded Railway reference (`${{Postgres.DATABASE_URL}}`) is not a target.
  if (raw.includes('${{')) return null;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname;
    if (!host) return null;
    return {
      host: host.toLowerCase(),
      port: Number.parseInt(parsed.port || '5432', 10),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      source,
    };
  } catch {
    return null;
  }
}

/**
 * The identity the APPLICATION will use at runtime, given an environment.
 *
 * This mirrors `DatabaseConfig.getPostgresConfig()` exactly: DATABASE_URL
 * (through the reachability resolver, which may swap in DATABASE_PUBLIC_URL),
 * otherwise the discrete DB_HOST/DB_PORT/DB_NAME variables.
 *
 * ★ CORRECT USE: pass an environment that came from SOMEWHERE ELSE than the
 * caller's own process — e.g. variables read out of another Railway service.
 *
 * ★ INCORRECT USE, AND THE REASON THIS WARNING EXISTS: calling this with the
 * caller's own `process.env` and comparing the answer against a target the
 * caller derived from that same `process.env`. That is one expression counted
 * twice; it agrees by construction and observes nothing. `release-migration-gate.ts`
 * did that and has been corrected — do not reintroduce it.
 */
export function resolveApplicationDatabaseIdentity(
  env: DatabaseIdentityEnvironment
): DatabaseIdentity | null {
  const declared = trimmed(env.DATABASE_URL);
  // An unexpanded Railway reference is not a URL. DatabaseConfig.getDatabaseUrl()
  // treats it as absent and falls through to DB_*; mirror that exactly, and strip
  // it from the env copy so the resolver cannot pick it up again by fallback.
  const sanitized: DatabaseIdentityEnvironment = { ...env };
  if (declared.includes('${{')) delete sanitized.DATABASE_URL;

  let resolvedUrl: string | undefined;
  try {
    resolvedUrl = resolveReachableDatabaseUrl({
      databaseUrl: declared.includes('${{') ? undefined : declared || undefined,
      publicDatabaseUrl: trimmed(env.DATABASE_PUBLIC_URL) || undefined,
      env: sanitized as NodeJS.ProcessEnv,
    }).databaseUrl;
  } catch {
    // The resolver refuses unreachable / forbidden targets. An application that
    // cannot resolve a target has no identity; the caller must fail closed
    // rather than assume agreement.
    resolvedUrl = undefined;
  }
  const fromUrl = parseDatabaseIdentityFromUrl(resolvedUrl, 'app:DATABASE_URL');
  if (fromUrl) return fromUrl;

  const host = trimmed(env.DB_HOST);
  if (!host) return null;
  return {
    host: host.toLowerCase(),
    port: Number.parseInt(trimmed(env.DB_PORT) || '5432', 10),
    database: trimmed(env.DB_NAME),
    source: 'app:DB_HOST',
  };
}

/** Two identities are the same database when host, port and name all agree. */
export function databaseIdentitiesMatch(
  a: DatabaseIdentity | null,
  b: DatabaseIdentity | null
): boolean {
  if (!a || !b) return false;
  return (
    a.host === b.host &&
    a.port === b.port &&
    a.database.toLowerCase() === b.database.toLowerCase()
  );
}

/** `host:port/database` — safe to print, contains no credentials. */
export function formatDatabaseIdentity(identity: DatabaseIdentity | null): string {
  if (!identity) return 'unresolved';
  return `${identity.host}:${identity.port}/${identity.database || '(none)'}`;
}

/**
 * The single line an operator compares by eye. Emitted with console.log on
 * purpose: the winston logger defaults to level `warn` outside development
 * (`server/src/utils/Logger.ts`), which suppressed the previous
 * `[Postgres] Config:` line in production and left the recurrence check with
 * nothing to read. This line must survive any LOG_LEVEL.
 */
export function formatDatabaseIdentityLine(
  role: DatabaseIdentityRole,
  identity: DatabaseIdentity | null
): string {
  if (!identity) {
    return `${DB_IDENTITY_LOG_PREFIX} role=${role} identity=unresolved source=none`;
  }
  return (
    `${DB_IDENTITY_LOG_PREFIX} role=${role} identity=${formatDatabaseIdentity(identity)} ` +
    `host=${identity.host} port=${identity.port} database=${identity.database || '(none)'} ` +
    `source=${identity.source}`
  );
}

export function emitDatabaseIdentity(
  role: DatabaseIdentityRole,
  identity: DatabaseIdentity | null
): void {
  // eslint-disable-next-line no-console
  console.log(formatDatabaseIdentityLine(role, identity));
}
