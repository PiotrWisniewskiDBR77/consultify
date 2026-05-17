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
