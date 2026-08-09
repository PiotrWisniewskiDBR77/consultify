type ResolveOptions = {
  databaseUrl?: string;
  publicDatabaseUrl?: string;
  env?: NodeJS.ProcessEnv;
};

function normalize(value: unknown): string | undefined {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function isRailwayPrivateHost(host: string): boolean {
  return host.endsWith('.railway.internal');
}

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
}

function isRunningInsideRailway(env: NodeJS.ProcessEnv): boolean {
  return Boolean(normalize(env.RAILWAY_SERVICE_ID) || normalize(env.RAILWAY_ENVIRONMENT_ID));
}

// ==========================================
// WP-A04 — production database fail-closed guard
//
// Incident: a local runtime (localhost:3000) was able to open a connection
// using a copy-pasted production connection string, because nothing in the
// connection-resolution path distinguished "a reachable Postgres host" from
// "the production Postgres host". This guard adds that distinction.
//
// Defaults are intentionally conservative: any hostname fragment that is
// known to identify the production Railway Postgres proxy is blocked unless
// the process can prove (via Railway's own injected env vars) that it is
// actually running as the production Railway service. A local machine or a
// non-production Railway environment can never produce that proof, so a
// stolen/copy-pasted production connection string is inert everywhere except
// the real production deployment.
// ==========================================

/** Known production Postgres host fingerprint (see docs: db-hosts-prod-demo). */
const DEFAULT_PRODUCTION_DB_HOST_FINGERPRINTS = ['centerbeam'];

function normalizeLower(value: unknown): string {
  return normalize(value)?.toLowerCase() ?? '';
}

/**
 * Fingerprints are plain lowercase substrings matched against the resolved
 * host. Operators can extend (never shrink) the list via
 * PRODUCTION_DB_HOST_DENYLIST_EXTRA (comma-separated), e.g. when a Railway
 * proxy hostname rotates. The built-in default is always included so an
 * unset/blank env var cannot silently disable the guard.
 */
export function getProductionDatabaseHostFingerprints(env: NodeJS.ProcessEnv): string[] {
  const extra = normalize(env.PRODUCTION_DB_HOST_DENYLIST_EXTRA)
    ?.split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean) ?? [];
  return [...DEFAULT_PRODUCTION_DB_HOST_FINGERPRINTS, ...extra];
}

export function isKnownProductionDatabaseHost(
  host: string | null | undefined,
  env: NodeJS.ProcessEnv
): boolean {
  const normalizedHost = normalizeLower(host);
  if (!normalizedHost) return false;
  return getProductionDatabaseHostFingerprints(env).some((fingerprint) =>
    normalizedHost.includes(fingerprint)
  );
}

/**
 * True only when Railway's own injected environment proves this process is
 * the production service. This cannot be spoofed by setting NODE_ENV or
 * APP_ENV locally — those are just app-level flags copied around in
 * connection-string handoffs, which is exactly how the incident happened.
 */
export function isVerifiedProductionRuntime(env: NodeJS.ProcessEnv): boolean {
  return isRunningInsideRailway(env) && normalizeLower(env.RAILWAY_ENVIRONMENT_NAME) === 'production';
}

/**
 * Narrow, explicit escape hatch for a human operator who deliberately needs
 * to run an approved one-off against production from outside Railway (e.g.
 * an emergency read-only diagnostic). Requires a specific sentinel phrase,
 * not just `true`, so it cannot be flipped on by accident.
 */
function hasExplicitProductionOverride(env: NodeJS.ProcessEnv): boolean {
  return normalize(env.PRODUCTION_DB_OVERRIDE_ACK) === 'i-understand-this-is-production';
}

function assertHostIsNotUnverifiedProduction(
  host: string | null | undefined,
  env: NodeJS.ProcessEnv,
  source: string
): void {
  if (!isKnownProductionDatabaseHost(host, env)) return;
  if (isVerifiedProductionRuntime(env)) return;
  if (hasExplicitProductionOverride(env)) return;

  throw new Error(
    `[WP-A04] ${source} points to the production database host (${host}). ` +
      'Refusing to start outside a verified production Railway runtime. ' +
      'Use the demo/staging or local connection string instead. ' +
      'If this is a deliberately approved one-off, set PRODUCTION_DB_OVERRIDE_ACK=i-understand-this-is-production.'
  );
}

function allowLocalDatabaseForTests(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.NODE_ENV === 'test' ||
    env.CI === 'true' ||
    normalize(env.VITEST) ||
    normalize(env.VITEST_POOL_ID) ||
    normalize(env.JEST_WORKER_ID)
  );
}

export function getDatabaseHost(url: string): string | null {
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

function assertResolvedDatabaseUrlIsReachable(
  databaseUrl: string,
  env: NodeJS.ProcessEnv,
  source: 'DATABASE_URL' | 'DATABASE_PUBLIC_URL'
): void {
  const host = getDatabaseHost(databaseUrl);
  if (!host) {
    throw new Error(`Selected ${source} is not a valid database URL.`);
  }

  if (!allowLocalDatabaseForTests(env) && isLocalHost(host)) {
    throw new Error(
      `Selected ${source} points to local host ${host}. This project requires the external Postgres target outside tests.`
    );
  }

  if (!isRunningInsideRailway(env) && isRailwayPrivateHost(host)) {
    throw new Error(
      `Selected ${source} points to private Railway host ${host}, which is unreachable outside Railway. Use a public/external Postgres proxy URL.`
    );
  }

  assertHostIsNotUnverifiedProduction(host, env, `Selected ${source}`);
}

export function resolveReachableDatabaseUrl(options: ResolveOptions = {}): {
  databaseUrl?: string;
  source: 'DATABASE_URL' | 'DATABASE_PUBLIC_URL' | 'none';
  reason?: string;
} {
  const env = options.env || process.env;
  const databaseUrl = normalize(options.databaseUrl ?? env.DATABASE_URL);
  const publicDatabaseUrl = normalize(
    options.publicDatabaseUrl ?? env.FINANCE_IMPORT_DATABASE_URL ?? env.DATABASE_PUBLIC_URL
  );

  if (!databaseUrl && !publicDatabaseUrl) {
    return { source: 'none' };
  }

  const runningInsideRailway = isRunningInsideRailway(env);
  const databaseHost = databaseUrl ? getDatabaseHost(databaseUrl) : null;
  const usesPrivateRailwayHost = Boolean(databaseHost && isRailwayPrivateHost(databaseHost));

  if (!runningInsideRailway && usesPrivateRailwayHost) {
    if (publicDatabaseUrl) {
      return {
        databaseUrl: publicDatabaseUrl,
        source: 'DATABASE_PUBLIC_URL',
        reason: `Using public database URL outside Railway because DATABASE_URL points to private host ${databaseHost}.`,
      };
    }
    throw new Error(
      `DATABASE_URL points to private Railway host ${databaseHost}, which is unreachable outside Railway. Set DATABASE_PUBLIC_URL or use a public Postgres proxy URL.`
    );
  }

  if (databaseUrl) {
    assertResolvedDatabaseUrlIsReachable(databaseUrl, env, 'DATABASE_URL');
    return { databaseUrl, source: 'DATABASE_URL' };
  }

  assertResolvedDatabaseUrlIsReachable(publicDatabaseUrl!, env, 'DATABASE_PUBLIC_URL');
  return {
    databaseUrl: publicDatabaseUrl,
    source: 'DATABASE_PUBLIC_URL',
    reason: 'Falling back to DATABASE_PUBLIC_URL because DATABASE_URL is not set.',
  };
}

export function assertNoPrivateRailwayDbHostOutsideRailway(
  env: NodeJS.ProcessEnv = process.env
): void {
  const dbHost = normalize(env.DB_HOST);
  if (!dbHost) return;
  if (isRunningInsideRailway(env)) return;
  if (!isRailwayPrivateHost(dbHost)) return;

  throw new Error(
    `DB_HOST points to private Railway host ${dbHost}, which is unreachable outside Railway. Use a public/external host for local runs.`
  );
}

/**
 * WP-A04 entry point for the DB_HOST/DB_PORT (non-URL) configuration path.
 * Mirrors assertHostIsNotUnverifiedProduction, which already covers the
 * DATABASE_URL / DATABASE_PUBLIC_URL path via resolveReachableDatabaseUrl.
 */
export function assertNoProductionDatabaseOutsideVerifiedRuntime(
  env: NodeJS.ProcessEnv = process.env
): void {
  const dbHost = normalize(env.DB_HOST);
  if (dbHost) {
    assertHostIsNotUnverifiedProduction(dbHost, env, 'DB_HOST');
  }

  // Also cover a DATABASE_URL that was already validated as "reachable" by
  // an earlier call in this same process (defense in depth — cheap to
  // re-check, and callers that only invoke this function directly still get
  // full coverage).
  const databaseUrl = normalize(env.DATABASE_URL);
  if (databaseUrl) {
    const host = getDatabaseHost(databaseUrl);
    assertHostIsNotUnverifiedProduction(host, env, 'DATABASE_URL');
  }
}

export function assertNoLocalDatabaseOutsideTests(env: NodeJS.ProcessEnv = process.env): void {
  if (allowLocalDatabaseForTests(env)) {
    return;
  }

  const databaseUrl = normalize(env.DATABASE_URL);
  if (databaseUrl) {
    const databaseHost = getDatabaseHost(databaseUrl);
    if (databaseHost && isLocalHost(databaseHost)) {
      throw new Error(
        `DATABASE_URL points to local host ${databaseHost}. This project requires the external Postgres target outside tests.`
      );
    }
  }

  const dbHost = normalize(env.DB_HOST);
  if (dbHost && isLocalHost(dbHost)) {
    throw new Error(
      `DB_HOST points to local host ${dbHost}. This project requires the external Postgres target outside tests.`
    );
  }
}
